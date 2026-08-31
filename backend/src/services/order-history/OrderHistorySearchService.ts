import https from 'https';
import dotenv from 'dotenv';
import { ZillizOrderRepository, ZillizSearchFilters, ZillizSearchResult } from './ZillizOrderRepository.js';
import { OrderEmbeddingService } from './OrderEmbeddingService.js';
import { adminDb } from '../../config/firebase.js';

dotenv.config();

export interface OrderSearchRequest {
  query?: string;
  filters?: {
    franchiseId?: string;
    branchId?: string;
    status?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
    customerPhone?: string;
  };
  pagination?: {
    page?: number;
    limit?: number;
  };
  callerScope: {
    role: 'owner' | 'restaurant_manager' | 'franchise_admin' | string;
    franchiseId?: string;
    branchId?: string;
  };
}

export interface VerifiedOrderDetails {
  orderId: string;
  customerName: string;
  customerPhone?: string;
  branchName: string;
  branchId: string;
  franchiseName: string;
  franchiseId: string;
  orderDate: string;
  orderTimestamp?: number;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  subtotal?: number;
  discount?: number;
  gst?: number;
  items: Array<{
    name: string;
    quantity: number;
    size?: string;
    crust?: string;
    customizations?: string[];
    price?: number;
  }>;
  orderNotes?: string;
  source: 'verified_archive' | 'zilliz_index';
}

export interface OrderSearchResponse {
  query: string;
  parsedFilters: Record<string, any>;
  aiSummary: string;
  totalMatches: number;
  results: VerifiedOrderDetails[];
  searchMode: 'exact_match' | 'hybrid_semantic' | 'structured_filtered';
  latencyMs: number;
}

export class OrderHistorySearchService {
  public static async search(request: OrderSearchRequest): Promise<OrderSearchResponse> {
    const startTime = Date.now();
    const rawQuery = (request.query || '').trim();
    const callerScope = request.callerScope;

    const extractedFilters = this.parseQueryFilters(rawQuery, request.filters);

    // Enforce Caller Authorization Scope
    if (callerScope.role !== 'owner' && callerScope.role !== 'admin') {
      if (callerScope.franchiseId) extractedFilters.franchise_id = callerScope.franchiseId;
      if (callerScope.branchId) extractedFilters.branch_id = callerScope.branchId;
    }

    let searchMode: 'exact_match' | 'hybrid_semantic' | 'structured_filtered' = 'hybrid_semantic';
    let matchedOrderIds: Array<{ orderId: string; score: number; preview?: any }> = [];

    // Exact ID lookup pattern
    const exactIdMatch = rawQuery.match(/OP-[A-Za-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (exactIdMatch) {
      searchMode = 'exact_match';
      const orderId = exactIdMatch[0].toUpperCase();
      matchedOrderIds.push({ orderId, score: 1.0 });
    } else {
      try {
        const queryVector = await OrderEmbeddingService.generateQueryEmbedding(rawQuery || 'Olive Pizza orders');
        const zillizResults = await ZillizOrderRepository.searchSimilarOrders(
          queryVector,
          request.pagination?.limit || 15,
          extractedFilters
        );

        matchedOrderIds = zillizResults.map(r => ({
          orderId: r.order_id,
          score: r.score,
          preview: r
        }));
      } catch (err: any) {
        console.warn('[OrderHistorySearchService] Zilliz search fallback: ' + err.message);
        searchMode = 'structured_filtered';
      }
    }

    const hydratedOrders = await this.hydrateAuthoritativeOrders(matchedOrderIds);

    // Authorization filter
    const authorizedOrders = hydratedOrders.filter(order => {
      if (callerScope.role === 'owner' || callerScope.role === 'admin') return true;
      if (callerScope.franchiseId && order.franchiseId !== callerScope.franchiseId) return false;
      if (callerScope.branchId && order.branchId !== callerScope.branchId) return false;
      return true;
    });

    const aiSummary = await this.generateRAGAnswer(rawQuery, authorizedOrders);
    const latencyMs = Date.now() - startTime;

    return {
      query: rawQuery,
      parsedFilters: extractedFilters,
      aiSummary,
      totalMatches: authorizedOrders.length,
      results: authorizedOrders,
      searchMode,
      latencyMs
    };
  }

  private static parseQueryFilters(query: string, userFilters?: OrderSearchRequest['filters']): ZillizSearchFilters {
    const filters: ZillizSearchFilters = {};

    if (userFilters?.franchiseId) filters.franchise_id = userFilters.franchiseId;
    if (userFilters?.branchId) filters.branch_id = userFilters.branchId;
    if (userFilters?.status) filters.status = userFilters.status;
    if (userFilters?.paymentMethod) filters.payment_method = userFilters.paymentMethod;
    if (userFilters?.minAmount) filters.min_amount = userFilters.minAmount;
    if (userFilters?.maxAmount) filters.max_amount = userFilters.maxAmount;

    const lower = query.toLowerCase();

    if (!filters.status) {
      if (lower.includes('delivered')) filters.status = 'delivered';
      else if (lower.includes('cancelled') || lower.includes('canceled')) filters.status = 'cancelled';
      else if (lower.includes('preparing')) filters.status = 'preparing';
      else if (lower.includes('ready')) filters.status = 'ready';
    }

    if (!filters.payment_method) {
      if (lower.includes('upi') || lower.includes('gpay') || lower.includes('phonepe') || lower.includes('paytm')) filters.payment_method = 'UPI';
      else if (lower.includes('cash') || lower.includes('cod')) filters.payment_method = 'Cash';
      else if (lower.includes('card')) filters.payment_method = 'Card';
    }

    if (!filters.branch_name) {
      if (lower.includes('civil lines')) filters.branch_name = 'Civil Lines';
      else if (lower.includes('rajnandgaon')) filters.branch_name = 'Rajnandgaon';
      else if (lower.includes('station road')) filters.branch_name = 'Station Road';
    }

    const amountMatch = query.match(/(?:around|above|over|below|₹|rs.?)s*(d+)/i);
    if (amountMatch && !filters.min_amount && !filters.max_amount) {
      const amt = parseInt(amountMatch[1], 10);
      if (lower.includes('above') || lower.includes('over')) {
        filters.min_amount = amt;
      } else if (lower.includes('below') || lower.includes('under')) {
        filters.max_amount = amt;
      } else {
        filters.min_amount = Math.max(0, amt - 150);
        filters.max_amount = amt + 150;
      }
    }

    return filters;
  }

  private static async hydrateAuthoritativeOrders(
    candidates: Array<{ orderId: string; score: number; preview?: any }>
  ): Promise<VerifiedOrderDetails[]> {
    const verifiedList: VerifiedOrderDetails[] = [];

    for (const c of candidates) {
      let authoritativeData: any = null;

      try {
        const doc = await adminDb.collection('orders').doc(c.orderId).get();
        if (doc.exists) {
          authoritativeData = { id: doc.id, ...doc.data() };
        }
      } catch (e) {
        // Fallback
      }

      if (!authoritativeData && !c.preview) {
        const zillizRec = await ZillizOrderRepository.getOrder(c.orderId);
        if (zillizRec) {
          c.preview = zillizRec;
        }
      }

      if (authoritativeData) {
        verifiedList.push({
          orderId: authoritativeData.orderId || authoritativeData.id || c.orderId,
          customerName: authoritativeData.customerName || authoritativeData.customer?.name || authoritativeData.userName || 'Customer',
          customerPhone: authoritativeData.contactPhone || authoritativeData.phone || '',
          branchName: authoritativeData.branchName || authoritativeData.restaurantName || 'Main Branch',
          branchId: authoritativeData.branchId || authoritativeData.branch_id || 'branch-default',
          franchiseName: authoritativeData.franchiseName || authoritativeData.franchise?.name || 'Olive Pizza',
          franchiseId: authoritativeData.franchiseId || authoritativeData.franchise_id || 'franchise-default',
          orderDate: authoritativeData.orderDate || (authoritativeData.createdAt?.toDate ? authoritativeData.createdAt.toDate().toISOString().split('T')[0] : '2026-08-14'),
          orderTimestamp: authoritativeData.createdAt?.toMillis ? authoritativeData.createdAt.toMillis() : Date.now(),
          status: authoritativeData.status || authoritativeData.orderStatus || 'delivered',
          paymentMethod: authoritativeData.paymentMethod || authoritativeData.payment?.method || 'UPI',
          totalAmount: Number(authoritativeData.totalAmount || authoritativeData.total || 0),
          subtotal: Number(authoritativeData.subtotal || authoritativeData.totalAmount || 0),
          discount: Number(authoritativeData.discount || 0),
          gst: Number(authoritativeData.gst || authoritativeData.tax || 0),
          items: Array.isArray(authoritativeData.items) ? authoritativeData.items.map((it: any) => ({
            name: it.name || it.productName || 'Pizza',
            quantity: it.quantity || 1,
            size: it.size || '',
            crust: it.crust || '',
            customizations: it.customizations || [],
            price: it.price || 0
          })) : [],
          orderNotes: authoritativeData.orderNotes || '',
          source: 'verified_archive'
        });
      } else if (c.preview) {
        const p = c.preview;
        verifiedList.push({
          orderId: p.order_id || c.orderId,
          customerName: p.customer_name || 'Customer',
          branchName: p.branch_name || 'Main Branch',
          branchId: p.branch_id || 'branch-default',
          franchiseName: p.franchise_name || 'Olive Pizza',
          franchiseId: p.franchise_id || 'franchise-default',
          orderDate: p.order_date || '2026-08-14',
          status: p.status || 'delivered',
          paymentMethod: p.payment_method || 'UPI',
          totalAmount: Number(p.total_amount || 0),
          items: (p.product_names || 'Pizza').split(',').map((name: string) => ({
            name: name.trim(),
            quantity: 1
          })),
          source: 'zilliz_index'
        });
      }
    }

    return verifiedList;
  }

  private static async generateRAGAnswer(
    query: string,
    orders: VerifiedOrderDetails[]
  ): Promise<string> {
    if (!query) {
      return orders.length > 0
        ? 'Found ' + orders.length + ' matching order(s) in the archive.'
        : 'Enter a search query to search all-time order history.';
    }

    if (orders.length === 0) {
      return 'No matching orders were found matching "' + query + '".';
    }

    const apiKey = process.env.NVIDIA_API_KEY || process.env.ASSISTANT_NVIDIA_API_KEY;
    if (!apiKey) {
      return 'Found ' + orders.length + ' verified matching order(s) (e.g. #' + orders[0].orderId + ').';
    }

    const contextSummary = orders.slice(0, 5).map(o => {
      const itemStr = o.items.map(i => i.quantity + 'x ' + i.name + (i.size ? ' [' + i.size + ']' : '')).join(', ');
      return 'Order #' + o.orderId + ': Date=' + o.orderDate + ', Customer=' + o.customerName + ', Branch=' + o.branchName + ', Total=₹' + o.totalAmount + ', Status=' + o.status + ', Payment=' + o.paymentMethod + ', Items=' + itemStr;
    }).join('\n');

    const prompt = 'You are the Olive Pizza AI Assistant. Answer the Owner question strictly using the verified order records below. Never hallucinate orders, items, or prices.\n\n' +
      'Verified Order Records:\n' + contextSummary + '\n\n' +
      'Owner Question: ' + query + '\n\n' +
      'Provide a concise 1-2 sentence response summarizing the match, explicitly citing the Order ID(s) like #OP-10482.';

    try {
      const response = await this.callNvidiaLLM(prompt, apiKey);
      return response || ('Found ' + orders.length + ' matching order(s) including #' + orders[0].orderId + '.');
    } catch (e: any) {
      return 'Found ' + orders.length + ' verified order(s) matching your request including #' + orders[0].orderId + '.';
    }
  }

  private static async callNvidiaLLM(prompt: string, apiKey: string): Promise<string> {
    const payload = JSON.stringify({
      model: 'deepseek-ai/deepseek-v4-flash-0731',
      messages: [
        { role: 'system', content: 'You are the Olive Pizza Owner Order Assistant. Answer accurately using provided context.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 200
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'integrate.api.nvidia.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 8000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
              resolve(parsed.choices[0].message.content.trim());
            } else {
              reject(new Error('No response from LLM'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('LLM timeout'));
      });
      req.write(payload);
      req.end();
    });
  }
}
