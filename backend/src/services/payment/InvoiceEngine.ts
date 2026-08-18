import { getPaymentConfig } from '../../config/payment.config.js';

export interface InvoiceParams {
  orderId: string;
  paymentId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: any[];
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
}

export class InvoiceEngine {
  public static generateInvoiceHtml(params: InvoiceParams): string {
    const config = getPaymentConfig();
    const subtotal = Math.round(params.totalAmount / 1.05); // 5% GST calculation
    const gstAmount = params.totalAmount - subtotal;
    const shortOrderId = params.orderId.slice(0, 8).toUpperCase();
    const dateStr = new Date(params.createdAt || Date.now()).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice — Olive Pizza #${shortOrderId}</title>
  <style>
    body { font-family: 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; }
    .invoice-card { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 30px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #f97316; padding-bottom: 15px; margin-bottom: 20px; }
    .brand { font-size: 24px; font-weight: bold; color: #f97316; }
    .meta { text-align: right; font-size: 12px; color: #94a3b8; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .table th { text-align: left; border-bottom: 1px solid #475569; padding: 8px; color: #cbd5e1; }
    .table td { padding: 10px 8px; border-bottom: 1px solid #334155; }
    .total-row { font-weight: bold; font-size: 16px; color: #f97316; }
    .badge { background: #166534; color: #4ade80; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand">🍕 ${config.businessName}</div>
        <div style="font-size:12px; color:#94a3b8;">100% Pure Veg Gourmet Pizzeria</div>
        <div style="font-size:12px; color:#94a3b8;">GSTIN: ${config.gstNumber}</div>
      </div>
      <div class="meta">
        <div><strong>INVOICE #${shortOrderId}</strong></div>
        <div>Date: ${dateStr}</div>
        <div>Payment: <span class="badge">${params.paymentMethod.toUpperCase()}</span></div>
      </div>
    </div>

    <div style="margin-bottom: 15px; font-size: 13px;">
      <div><strong>Billed To:</strong> ${params.customerName} (${params.customerPhone || 'N/A'})</div>
      <div><strong>Delivery Address:</strong> ${params.customerAddress || 'Customer Address'}</div>
      <div><strong>Transaction ID:</strong> ${params.paymentId}</div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Item Description</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${params.items.map(item => `
          <tr>
            <td>${item.name} ${item.size ? `(${item.size})` : ''}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">₹${(item.price * item.quantity).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="text-align: right; line-height: 1.8; font-size: 14px;">
      <div>Subtotal: ₹${subtotal.toFixed(2)}</div>
      <div>GST (5% SGST/CGST): ₹${gstAmount.toFixed(2)}</div>
      <div class="total-row" style="margin-top: 10px;">Grand Total: ₹${params.totalAmount.toFixed(2)}</div>
    </div>

    <div class="footer">
      Thank you for ordering with ${config.businessName}! <br/>
      For support contact ${config.supportEmail} | ${config.supportPhone}
    </div>
  </div>
</body>
</html>`;
  }
}
