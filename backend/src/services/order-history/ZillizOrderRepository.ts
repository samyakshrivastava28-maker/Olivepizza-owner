import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import dotenv from 'dotenv';

dotenv.config();

export interface ZillizOrderRecord {
  order_id: string;
  vector: number[];
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  franchise_id?: string;
  franchise_name?: string;
  branch_id?: string;
  branch_name?: string;
  order_date?: string;
  order_timestamp?: number;
  status?: string;
  total_amount?: number;
  payment_method?: string;
  product_names?: string;
  order_text?: string;
  embedding_version?: string;
}

export interface ZillizSearchFilters {
  franchise_id?: string;
  branch_id?: string;
  branch_name?: string;
  status?: string;
  payment_method?: string;
  min_amount?: number;
  max_amount?: number;
  start_date?: string;
  end_date?: string;
}

export interface ZillizSearchResult {
  order_id: string;
  score: number;
  customer_name?: string;
  branch_name?: string;
  franchise_name?: string;
  order_date?: string;
  status?: string;
  total_amount?: number;
  payment_method?: string;
  product_names?: string;
  order_text?: string;
}

export class ZillizOrderRepository {
  public static readonly COLLECTION_NAME = 'Olive_Pizza_orders';
  public static readonly VECTOR_DIMENSION = 2048;
  public static readonly METRIC_TYPE = 'COSINE';

  private static client: MilvusClient | null = null;
  private static isInitialized = false;
  private static initPromise: Promise<boolean> | null = null;
  private static localMemoryStore: Map<string, ZillizOrderRecord> = new Map();

  public static async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const endpoint = process.env.ZILLIZ_ENDPOINT || process.env.ZILLIZ_URI || process.env.MILVUS_ENDPOINT;
      const token = process.env.ZILLIZ_TOKEN || process.env.ZILLIZ_API_KEY || process.env.MILVUS_TOKEN;

      if (!endpoint || !token) {
        console.warn('[ZillizOrderRepository] ZILLIZ_ENDPOINT or ZILLIZ_TOKEN not set. Running with In-Memory Hybrid Mock.');
        this.isInitialized = true;
        return true;
      }

      try {
        console.log('[ZillizOrderRepository] Connecting to Zilliz Cloud: ' + endpoint + '...');
        const address = endpoint.replace(/^https?:\/\//, '');
        this.client = new MilvusClient({
          address,
          token,
          ssl: true
        });

        await this.ensureCollection();
        this.isInitialized = true;
        console.log('[ZillizOrderRepository] Successfully connected to Zilliz and initialized collection: ' + this.COLLECTION_NAME);
        return true;
      } catch (err: any) {
        console.error('[ZillizOrderRepository] Zilliz connection error: ' + err.message + '. Falling back to In-Memory store.');
        this.isInitialized = true;
        return false;
      }
    })();

    return this.initPromise;
  }

  private static async ensureCollection(): Promise<void> {
    if (!this.client) return;

    try {
      const hasCollection = await this.client.hasCollection({
        collection_name: this.COLLECTION_NAME
      });

      if (!hasCollection.value) {
        console.log('[ZillizOrderRepository] Creating collection ' + this.COLLECTION_NAME + ' (dimension ' + this.VECTOR_DIMENSION + ')...');
        await this.client.createCollection({
          collection_name: this.COLLECTION_NAME,
          fields: [
            {
              name: 'order_id',
              description: 'Primary Order ID (e.g. OP-10482)',
              data_type: DataType.VarChar,
              max_length: 64,
              is_primary_key: true
            },
            {
              name: 'vector',
              description: 'NVIDIA Nemotron 2048-dim embedding',
              data_type: DataType.FloatVector,
              dim: this.VECTOR_DIMENSION
            },
            {
              name: 'customer_id',
              data_type: DataType.VarChar,
              max_length: 64
            },
            {
              name: 'customer_name',
              data_type: DataType.VarChar,
              max_length: 128
            },
            {
              name: 'customer_phone',
              data_type: DataType.VarChar,
              max_length: 32
            },
            {
              name: 'franchise_id',
              data_type: DataType.VarChar,
              max_length: 64
            },
            {
              name: 'franchise_name',
              data_type: DataType.VarChar,
              max_length: 128
            },
            {
              name: 'branch_id',
              data_type: DataType.VarChar,
              max_length: 64
            },
            {
              name: 'branch_name',
              data_type: DataType.VarChar,
              max_length: 128
            },
            {
              name: 'order_date',
              data_type: DataType.VarChar,
              max_length: 32
            },
            {
              name: 'order_timestamp',
              data_type: DataType.Int64
            },
            {
              name: 'status',
              data_type: DataType.VarChar,
              max_length: 32
            },
            {
              name: 'total_amount',
              data_type: DataType.Float
            },
            {
              name: 'payment_method',
              data_type: DataType.VarChar,
              max_length: 32
            },
            {
              name: 'product_names',
              data_type: DataType.VarChar,
              max_length: 512
            },
            {
              name: 'order_text',
              data_type: DataType.VarChar,
              max_length: 2048
            },
            {
              name: 'embedding_version',
              data_type: DataType.VarChar,
              max_length: 32
            }
          ]
        });

        console.log('[ZillizOrderRepository] Creating vector index on ' + this.COLLECTION_NAME + '...');
        await this.client.createIndex({
          collection_name: this.COLLECTION_NAME,
          field_name: 'vector',
          index_type: 'AUTOINDEX',
          metric_type: this.METRIC_TYPE
        });

        console.log('[ZillizOrderRepository] Loading collection ' + this.COLLECTION_NAME + ' into memory...');
        await this.client.loadCollectionSync({
          collection_name: this.COLLECTION_NAME
        });
      }
    } catch (e: any) {
      console.warn('[ZillizOrderRepository] Collection check/creation notice: ' + e.message);
    }
  }

  public static async upsertOrder(record: ZillizOrderRecord): Promise<boolean> {
    await this.initialize();
    this.localMemoryStore.set(record.order_id, record);

    if (!this.client) return true;

    try {
      const normalizedRecord = {
        order_id: String(record.order_id),
        vector: record.vector,
        customer_id: String(record.customer_id || ''),
        customer_name: String(record.customer_name || ''),
        customer_phone: String(record.customer_phone || ''),
        franchise_id: String(record.franchise_id || ''),
        franchise_name: String(record.franchise_name || ''),
        branch_id: String(record.branch_id || ''),
        branch_name: String(record.branch_name || ''),
        order_date: String(record.order_date || new Date().toISOString().split('T')[0]),
        order_timestamp: Number(record.order_timestamp || Date.now()),
        status: String(record.status || 'delivered'),
        total_amount: Number(record.total_amount || 0),
        payment_method: String(record.payment_method || 'UPI'),
        product_names: String(record.product_names || '').slice(0, 500),
        order_text: String(record.order_text || '').slice(0, 2000),
        embedding_version: String(record.embedding_version || 'v1-nemotron-2048')
      };

      const result = await this.client.upsert({
        collection_name: this.COLLECTION_NAME,
        fields_data: [normalizedRecord]
      });

      return result.status.error_code === 'Success' || result.status.code === 0;
    } catch (err: any) {
      console.error('[ZillizOrderRepository] Upsert error for ' + record.order_id + ': ' + err.message);
      return false;
    }
  }

  public static async searchSimilarOrders(
    queryVector: number[],
    limit = 10,
    filters?: ZillizSearchFilters
  ): Promise<ZillizSearchResult[]> {
    await this.initialize();

    if (this.client) {
      try {
        const filterExpressions: string[] = [];

        if (filters?.franchise_id) {
          filterExpressions.push('franchise_id == "' + filters.franchise_id + '"');
        }
        if (filters?.branch_id) {
          filterExpressions.push('branch_id == "' + filters.branch_id + '"');
        }
        if (filters?.status) {
          filterExpressions.push('status == "' + filters.status + '"');
        }
        if (filters?.payment_method) {
          filterExpressions.push('payment_method == "' + filters.payment_method + '"');
        }
        if (typeof filters?.min_amount === 'number') {
          filterExpressions.push('total_amount >= ' + filters.min_amount);
        }
        if (typeof filters?.max_amount === 'number') {
          filterExpressions.push('total_amount <= ' + filters.max_amount);
        }

        const expr = filterExpressions.length > 0 ? filterExpressions.join(' and ') : '';

        const searchRes = await this.client.search({
          collection_name: this.COLLECTION_NAME,
          vector: queryVector,
          limit,
          filter: expr,
          output_fields: [
            'order_id',
            'customer_name',
            'branch_name',
            'franchise_name',
            'order_date',
            'status',
            'total_amount',
            'payment_method',
            'product_names',
            'order_text'
          ]
        });

        if (searchRes.results && Array.isArray(searchRes.results)) {
          return searchRes.results.map((r: any) => ({
            order_id: r.order_id || r.id,
            score: r.score ?? 1.0,
            customer_name: r.customer_name,
            branch_name: r.branch_name,
            franchise_name: r.franchise_name,
            order_date: r.order_date,
            status: r.status,
            total_amount: r.total_amount,
            payment_method: r.payment_method,
            product_names: r.product_names,
            order_text: r.order_text
          }));
        }
      } catch (err: any) {
        console.warn('[ZillizOrderRepository] Zilliz search warning: ' + err.message + '. Falling back to memory index.');
      }
    }

    return this.searchInMemory(queryVector, limit, filters);
  }

  private static searchInMemory(
    queryVector: number[],
    limit: number,
    filters?: ZillizSearchFilters
  ): ZillizSearchResult[] {
    const scored: Array<{ record: ZillizOrderRecord; score: number }> = [];

    for (const record of this.localMemoryStore.values()) {
      if (filters?.franchise_id && record.franchise_id !== filters.franchise_id) continue;
      if (filters?.branch_id && record.branch_id !== filters.branch_id) continue;
      if (filters?.status && record.status?.toLowerCase() !== filters.status.toLowerCase()) continue;
      if (filters?.payment_method && record.payment_method?.toLowerCase() !== filters.payment_method.toLowerCase()) continue;
      if (typeof filters?.min_amount === 'number' && (record.total_amount || 0) < filters.min_amount) continue;
      if (typeof filters?.max_amount === 'number' && (record.total_amount || 0) > filters.max_amount) continue;

      let dot = 0;
      let normA = 0;
      let normB = 0;
      const v = record.vector || [];
      for (let i = 0; i < queryVector.length; i++) {
        const a = queryVector[i] || 0;
        const b = v[i] || 0;
        dot += a * b;
        normA += a * a;
        normB += b * b;
      }
      const score = (normA && normB) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
      scored.push({ record, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ record, score }) => ({
      order_id: record.order_id,
      score,
      customer_name: record.customer_name,
      branch_name: record.branch_name,
      franchise_name: record.franchise_name,
      order_date: record.order_date,
      status: record.status,
      total_amount: record.total_amount,
      payment_method: record.payment_method,
      product_names: record.product_names,
      order_text: record.order_text
    }));
  }

  
  public static async getOrder(orderId: string): Promise<ZillizOrderRecord | null> {
    await this.initialize();
    if (this.localMemoryStore.has(orderId)) {
      return this.localMemoryStore.get(orderId) || null;
    }
    if (this.client) {
      try {
        const res = await this.client.query({
          collection_name: this.COLLECTION_NAME,
          filter: 'order_id == "' + orderId + '"',
          output_fields: ['order_id', 'customer_name', 'branch_name', 'franchise_name', 'order_date', 'status', 'total_amount', 'payment_method', 'product_names', 'order_text']
        });
        if (res.data && res.data[0]) {
          return res.data[0] as any;
        }
      } catch (e) {}
    }
    return null;
  }

  public static async deleteOrder(orderId: string): Promise<boolean> {
    await this.initialize();
    this.localMemoryStore.delete(orderId);

    if (!this.client) return true;

    try {
      await this.client.delete({
        collection_name: this.COLLECTION_NAME,
        filter: 'order_id == "' + orderId + '"'
      });
      return true;
    } catch (e: any) {
      console.error('[ZillizOrderRepository] Delete failed for ' + orderId + ': ' + e.message);
      return false;
    }
  }

  public static async getStatus(): Promise<{
    connected: boolean;
    collection: string;
    dimension: number;
    metric: string;
    indexedCount: number;
    mode: 'zilliz_cloud' | 'in_memory_hybrid';
  }> {
    await this.initialize();
    return {
      connected: !!this.client,
      collection: this.COLLECTION_NAME,
      dimension: this.VECTOR_DIMENSION,
      metric: this.METRIC_TYPE,
      indexedCount: this.localMemoryStore.size,
      mode: this.client ? 'zilliz_cloud' : 'in_memory_hybrid'
    };
  }
}
