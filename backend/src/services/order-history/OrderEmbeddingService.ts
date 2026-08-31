import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

export interface OrderEmbeddingPayload {
  orderId: string;
  customerName?: string;
  customerPhone?: string;
  branchName?: string;
  franchiseName?: string;
  orderDate?: string;
  status?: string;
  paymentMethod?: string;
  totalAmount?: number;
  items?: Array<{
    name: string;
    quantity?: number;
    size?: string;
    crust?: string;
    customizations?: string[];
    price?: number;
  }>;
  orderNotes?: string;
}

export class OrderEmbeddingService {
  private static readonly MODEL_NAME = 'nvidia/nemotron-3-embed-1b';
  private static readonly EMBEDDING_DIMENSION = 2048;
  private static readonly EMBEDDING_VERSION = 'v1-nemotron-2048';
  private static readonly API_HOST = 'integrate.api.nvidia.com';
  private static readonly API_PATH = '/v1/embeddings';

  public static getModelName(): string {
    return this.MODEL_NAME;
  }

  public static getDimension(): number {
    return this.EMBEDDING_DIMENSION;
  }

  public static getVersion(): string {
    return this.EMBEDDING_VERSION;
  }

  /**
   * Formats an order object into a deterministic structured representation for vector indexing.
   */
  public static formatOrderForEmbedding(order: OrderEmbeddingPayload): string {
    const parts: string[] = [];

    parts.push(`Order ${order.orderId || 'Unknown'}`);
    if (order.customerName) parts.push(`Customer: ${order.customerName}`);
    if (order.branchName) parts.push(`Restaurant Branch: ${order.branchName}`);
    if (order.franchiseName) parts.push(`Franchise: ${order.franchiseName}`);
    if (order.orderDate) parts.push(`Date: ${order.orderDate}`);
    if (order.status) parts.push(`Status: ${order.status}`);
    if (order.paymentMethod) parts.push(`Payment Method: ${order.paymentMethod}`);
    if (typeof order.totalAmount === 'number') parts.push(`Total Amount: ₹${order.totalAmount}`);

    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      parts.push('Items:');
      order.items.forEach(item => {
        const qty = item.quantity ? `${item.quantity}x ` : '';
        const size = item.size ? `[${item.size}] ` : '';
        const crust = item.crust ? `(${item.crust}) ` : '';
        const custom = item.customizations && item.customizations.length > 0
          ? ` - with ${item.customizations.join(', ')}`
          : '';
        parts.push(`- ${qty}${size}${item.name} ${crust}${custom}`.trim());
      });
    }

    if (order.orderNotes) {
      const cleanNotes = order.orderNotes.slice(0, 300).replace(/\r?\n/g, ' ');
      parts.push(`Notes: ${cleanNotes}`);
    }

    return parts.join('\n');
  }

  /**
   * Generates a 2048-dimensional passage embedding for an order.
   */
  public static async generateOrderEmbedding(order: OrderEmbeddingPayload | string): Promise<{ vector: number[]; text: string; version: string }> {
    const text = typeof order === 'string' ? order : this.formatOrderForEmbedding(order);
    const vector = await this.callNvidiaEmbedding(text, 'passage');
    return { vector, text, version: this.EMBEDDING_VERSION };
  }

  /**
   * Generates a 2048-dimensional query embedding for search input.
   */
  public static async generateQueryEmbedding(queryText: string): Promise<number[]> {
    return this.callNvidiaEmbedding(queryText.trim(), 'query');
  }

  /**
   * Low-level caller to NVIDIA Embedding API with retry and validation.
   */
  private static async callNvidiaEmbedding(inputText: string, inputType: 'passage' | 'query', retries = 2): Promise<number[]> {
    const apiKey = process.env.NVIDIA_API_KEY || process.env.ASSISTANT_NVIDIA_API_KEY;

    if (!apiKey) {
      console.warn('[OrderEmbeddingService] NVIDIA API key not found. Using fallback mock embedding.');
      return this.generateDeterministicFallbackVector(inputText);
    }

    const payload = JSON.stringify({
      input: [inputText.slice(0, 4000)],
      model: this.MODEL_NAME,
      input_type: inputType
    });

    try {
      const responseData: any = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: this.API_HOST,
          path: this.API_PATH,
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 10000
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (res.statusCode === 200 && parsed.data && parsed.data[0] && parsed.data[0].embedding) {
                resolve(parsed.data[0].embedding);
              } else {
                reject(new Error(`NVIDIA API status ${res.statusCode}: ${parsed.detail || parsed.message || body.slice(0, 200)}`));
              }
            } catch (e: any) {
              reject(new Error(`Failed to parse NVIDIA response: ${e.message}`));
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('NVIDIA embedding request timed out'));
        });
        req.write(payload);
        req.end();
      });

      if (!Array.isArray(responseData) || responseData.length !== this.EMBEDDING_DIMENSION) {
        throw new Error(`Invalid vector dimension from NVIDIA: expected ${this.EMBEDDING_DIMENSION}, got ${responseData?.length}`);
      }

      return responseData;
    } catch (err: any) {
      console.error(`[OrderEmbeddingService] Embedding call failed (attempt left: ${retries}): ${err.message}`);
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return this.callNvidiaEmbedding(inputText, inputType, retries - 1);
      }
      console.warn('[OrderEmbeddingService] Max retries reached, falling back to deterministic mock vector.');
      return this.generateDeterministicFallbackVector(inputText);
    }
  }

  private static generateDeterministicFallbackVector(text: string): number[] {
    const vector = new Array(this.EMBEDDING_DIMENSION).fill(0);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
      const idx = Math.abs(hash) % this.EMBEDDING_DIMENSION;
      vector[idx] += (text.charCodeAt(i) % 10) / 10.0;
    }
    let norm = 0;
    for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm) || 1;
    return vector.map(v => v / norm);
  }
}
