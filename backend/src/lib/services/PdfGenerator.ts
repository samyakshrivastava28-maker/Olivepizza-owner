import PDFDocument from 'pdfkit';

export interface MonthlyReportMetrics {
  month: string;
  year: number;
  monthNumber: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  failedOrders: number;
  totalRevenue: number;
  netRevenue: number;
  taxes: number;
  discounts: number;
  averageOrderValue: number;
  paymentBreakdown: {
    cod: { amount: number; count: number; percent: number };
    upi: { amount: number; count: number; percent: number };
    card: { amount: number; count: number; percent: number };
  };
  couponsUsed: { code: string; count: number; discountTotal: number }[];
  avgDeliveryTimeMinutes: number;
  avgPreparationTimeMinutes: number;
  onTimeDeliveryRate: number;
  topSellingProducts: { name: string; quantity: number; revenue: number }[];
  worstSellingProducts: { name: string; quantity: number; revenue: number }[];
  newCustomers: number;
  returningCustomers: number;
  totalActiveCustomers: number;
  activeDeliveryPartners: number;
  deliveryPartnerStats: { name: string; completedCount: number; rating: number }[];
  totalReviews: number;
  averageRating: number;
  notificationsSent: number;
  emailsSent: number;
  emailSuccessRate: number;
  dailySales: { date: string; revenue: number; orders: number }[];
  weeklySales: { date: string; revenue: number; orders: number }[];
  peakHours: { hour: string; count: number }[];
}

export interface WeeklyReportMetrics {
  weekLabel: string;             // e.g. "Week 29, 2026"
  weekNumber: number;            // e.g. 29
  year: number;                  // 2026
  dateRange: string;             // e.g. "14 Jul 2026 - 20 Jul 2026"

  // Sales
  totalRevenue: number;
  netRevenue: number;
  taxes: number;
  discounts: number;
  couponSavings: number;
  refundsCount: number;
  refundsAmount: number;
  averageOrderValue: number;

  // Orders
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  avgPreparationTimeMinutes: number;
  avgDeliveryTimeMinutes: number;

  // Customers
  newCustomers: number;
  returningCustomers: number;
  totalActiveCustomers: number;
  topCustomers: { name: string; orders: number; spent: number }[];

  // Products
  bestSellingItems: { name: string; quantity: number; revenue: number }[];
  worstSellingItems: { name: string; quantity: number; revenue: number }[];
  mostViewedItems: { name: string; views: number }[];
  frequentlyOrderedTogether: { itemA: string; itemB: string; count: number }[];

  // Delivery
  deliveryPartnerStats: { name: string; completedCount: number; cancelledCount: number; avgTime: number; rating: number }[];

  // Payments
  paymentBreakdown: {
    cash: { amount: number; count: number; percent: number };
    upi: { amount: number; count: number; percent: number };
    card: { amount: number; count: number; percent: number };
    wallet: { amount: number; count: number; percent: number };
  };

  // Coupons
  couponsStats: { code: string; count: number; savings: number }[];
  mostPopularCoupon: string;

  // Notifications
  notificationsSent: number;
  deliverySuccessNotifications: number;
  failedNotifications: number;

  // Emails
  emailsSent: number;
  failedEmails: number;
  emailRetryCount: number;

  // Reviews
  averageRating: number;
  totalReviews: number;
  ratingDistribution: { stars: number; count: number }[];
  mostCommonComplaints: string[];

  // AI Business Insights
  aiInsights: {
    peakOrderingHours: string;
    busyDays: string;
    lowPerformingDays: string;
    revenueTrend: string;
    customerGrowth: string;
    recommendations: string[];
  };

  // Daily Trends for visual table
  dailySales: { dayName: string; revenue: number; orders: number }[];
}

export class PdfGenerator {

  public async generateReport(metrics: WeeklyReportMetrics): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const primaryColor = '#f97316'; // Olive Pizza Orange
        const darkColor = '#1e293b';    // Dark Slate
        const greenColor = '#16a34a';   // Success Green
        const mutedColor = '#64748b';   // Muted Slate

        // ── PAGE 1: EXECUTIVE SALES & ORDERS SUMMARY ────────────────────────

        // Header Banner
        doc.rect(0, 0, 595.28, 80).fill(darkColor);
        doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('OLIVE PIZZA', 40, 22);
        doc.fontSize(12).font('Helvetica').fillColor('#f97316').text('WEEKLY BUSINESS PERFORMANCE REPORT', 40, 48);

        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold').text(metrics.weekLabel, 410, 25, { align: 'right' });
        doc.fontSize(9).font('Helvetica').fillColor('#94a3b8').text(metrics.dateRange, 410, 45, { align: 'right' });

        doc.y = 95;

        // Executive Financial Summary
        doc.fillColor(darkColor).fontSize(13).font('Helvetica-Bold').text('Weekly Financial & Order Summary');
        doc.strokeColor(primaryColor).lineWidth(2).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.moveDown(1);

        // Financial Cards (3 Grid)
        const c1Y = doc.y;
        this.drawMetricCard(doc, 40, c1Y, 160, 60, 'Total Revenue', `₹${metrics.totalRevenue.toLocaleString('en-IN')}`, greenColor);
        this.drawMetricCard(doc, 215, c1Y, 160, 60, 'Net Revenue', `₹${metrics.netRevenue.toLocaleString('en-IN')}`, primaryColor);
        this.drawMetricCard(doc, 390, c1Y, 165, 60, 'Avg Order Value', `₹${Math.round(metrics.averageOrderValue)}`, darkColor);

        doc.y = c1Y + 70;
        const c2Y = doc.y;
        this.drawMetricCard(doc, 40, c2Y, 160, 60, 'Total Orders', `${metrics.totalOrders}`, darkColor);
        this.drawMetricCard(doc, 215, c2Y, 160, 60, 'Completed Orders', `${metrics.completedOrders}`, greenColor);
        this.drawMetricCard(doc, 390, c2Y, 165, 60, 'Cancelled / Pending', `${metrics.cancelledOrders} / ${metrics.pendingOrders}`, '#dc2626');

        doc.y = c2Y + 80;

        // Payment Method Breakdown
        doc.fillColor(darkColor).fontSize(12).font('Helvetica-Bold').text('Payment Method Breakdown');
        doc.moveDown(0.4);

        const pmY = doc.y;
        this.drawProgressBar(doc, 40, pmY, 515, 16, [
          { label: 'UPI', percent: metrics.paymentBreakdown.upi.percent, color: '#8b5cf6' },
          { label: 'Cards', percent: metrics.paymentBreakdown.card.percent, color: '#3b82f6' },
          { label: 'Cash', percent: metrics.paymentBreakdown.cash.percent, color: '#10b981' },
          { label: 'Wallet', percent: metrics.paymentBreakdown.wallet.percent, color: '#f59e0b' },
        ]);

        doc.y = pmY + 24;
        doc.fontSize(8.5).font('Helvetica').fillColor(mutedColor);
        doc.text(
          `UPI: ₹${metrics.paymentBreakdown.upi.amount.toLocaleString()} (${metrics.paymentBreakdown.upi.percent}%)  |  Card: ₹${metrics.paymentBreakdown.card.amount.toLocaleString()} (${metrics.paymentBreakdown.card.percent}%)  |  Cash: ₹${metrics.paymentBreakdown.cash.amount.toLocaleString()} (${metrics.paymentBreakdown.cash.percent}%)  |  Wallet: ₹${metrics.paymentBreakdown.wallet.amount.toLocaleString()} (${metrics.paymentBreakdown.wallet.percent}%)`,
          40, doc.y
        );

        doc.moveDown(1.5);

        // Daily Sales Table
        doc.fillColor(darkColor).fontSize(12).font('Helvetica-Bold').text('Daily Sales & Volume Breakdown');
        doc.moveDown(0.4);

        let rowY = doc.y;
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(mutedColor);
        doc.text('Day', 50, rowY);
        doc.text('Orders', 180, rowY);
        doc.text('Revenue', 300, rowY);
        doc.text('Volume Visualizer', 400, rowY);

        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, rowY + 14).lineTo(555, rowY + 14).stroke();
        rowY += 20;

        const maxDailyRev = Math.max(...metrics.dailySales.map(d => d.revenue), 1);

        metrics.dailySales.forEach((d) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(darkColor);
          doc.text(d.dayName, 50, rowY);
          doc.text(`${d.orders} orders`, 180, rowY);
          doc.text(`₹${d.revenue.toLocaleString('en-IN')}`, 300, rowY);

          const barW = Math.min(130, (d.revenue / maxDailyRev) * 130);
          doc.rect(400, rowY + 1, Math.max(barW, 3), 7).fill(primaryColor);
          rowY += 15;
        });

        this.drawFooter(doc, 1, 4);

        // ── PAGE 2: PRODUCTS, COMBOS & CUSTOMERS ─────────────────────────────
        doc.addPage();

        doc.fillColor(darkColor).fontSize(15).font('Helvetica-Bold').text('Product Rankings & Customer Behavior');
        doc.strokeColor(primaryColor).lineWidth(2).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.moveDown(1.2);

        // Best & Worst Selling Items
        const pColY = doc.y;
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Top 5 Best Selling Items', 40, pColY);
        doc.text('Worst Selling Items', 300, pColY);

        doc.moveDown(0.8);
        let pRowY = doc.y;

        metrics.bestSellingItems.slice(0, 5).forEach((item, idx) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(darkColor);
          doc.text(`${idx + 1}. ${item.name} (${item.quantity} sold - ₹${item.revenue})`, 40, pRowY);
          pRowY += 15;
        });

        let pRowY2 = doc.y;
        metrics.worstSellingItems.slice(0, 5).forEach((item, idx) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(mutedColor);
          doc.text(`${idx + 1}. ${item.name} (${item.quantity} sold)`, 300, pRowY2);
          pRowY2 += 15;
        });

        doc.y = Math.max(pRowY, pRowY2) + 15;

        // Frequently Ordered Together & Most Viewed
        const comboY = doc.y;
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Frequently Ordered Together (Combos)', 40, comboY);
        doc.text('Most Viewed Menu Items', 300, comboY);

        doc.moveDown(0.8);
        let cRowY = doc.y;

        metrics.frequentlyOrderedTogether.slice(0, 4).forEach((combo, idx) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(darkColor);
          doc.text(`${idx + 1}. ${combo.itemA} + ${combo.itemB} (${combo.count}x)`, 40, cRowY);
          cRowY += 15;
        });

        let cRowY2 = doc.y;
        metrics.mostViewedItems.slice(0, 4).forEach((item, idx) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(darkColor);
          doc.text(`${idx + 1}. ${item.name} (${item.views} views)`, 300, cRowY2);
          cRowY2 += 15;
        });

        doc.y = Math.max(cRowY, cRowY2) + 20;

        // Customer Growth Box
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Customer Acquisition & Loyalty');
        doc.moveDown(0.5);

        const custBoxY = doc.y;
        doc.rect(40, custBoxY, 515, 65).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fillColor(darkColor).fontSize(9.5).font('Helvetica-Bold').text(`New Customers: ${metrics.newCustomers}`, 55, custBoxY + 12);
        doc.fontSize(9.5).font('Helvetica-Bold').text(`Returning Customers: ${metrics.returningCustomers}`, 200, custBoxY + 12);
        doc.fontSize(9.5).font('Helvetica-Bold').text(`Total Active Buyers: ${metrics.totalActiveCustomers}`, 380, custBoxY + 12);

        doc.fontSize(8.5).font('Helvetica').fillColor(mutedColor).text(
          `Popular Coupon Code: ${metrics.mostPopularCoupon} (Total Savings Given: ₹${metrics.couponSavings.toLocaleString()})`,
          55, custBoxY + 38
        );

        this.drawFooter(doc, 2, 4);

        // ── PAGE 3: DELIVERY, NOTIFICATIONS, EMAILS & REVIEWS ──────────────────
        doc.addPage();

        doc.fillColor(darkColor).fontSize(15).font('Helvetica-Bold').text('Operations, Communications & Customer Reviews');
        doc.strokeColor(primaryColor).lineWidth(2).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.moveDown(1.2);

        // Delivery Partner Performance Table
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Delivery Fleet Performance');
        doc.moveDown(0.4);

        let dpY = doc.y;
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(mutedColor);
        doc.text('Partner Name', 50, dpY);
        doc.text('Deliveries Completed', 220, dpY);
        doc.text('Avg Delivery Time', 360, dpY);
        doc.text('Rating', 480, dpY);

        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, dpY + 14).lineTo(555, dpY + 14).stroke();
        dpY += 20;

        metrics.deliveryPartnerStats.slice(0, 5).forEach((dp) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(darkColor);
          doc.text(dp.name, 50, dpY);
          doc.text(`${dp.completedCount} orders`, 220, dpY);
          doc.text(`${dp.avgTime} mins`, 360, dpY);
          doc.text(`⭐ ${dp.rating.toFixed(1)}`, 480, dpY);
          dpY += 15;
        });

        doc.y = dpY + 15;

        // Notifications & Emails Health (Side-by-side)
        const infraY = doc.y;
        this.drawMetricCard(doc, 40, infraY, 245, 60, 'FCM Push Notifications', `${metrics.notificationsSent} Sent (${metrics.deliverySuccessNotifications} Success)`, darkColor);
        this.drawMetricCard(doc, 305, infraY, 250, 60, 'PostgreSQL Email Queue', `${metrics.emailsSent} Sent (${metrics.failedEmails} Failed, ${metrics.emailRetryCount} Retries)`, darkColor);

        doc.y = infraY + 75;

        // Customer Review Summary & Complaints Tags
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Customer Feedback & Review Ratings');
        doc.moveDown(0.5);

        const revBoxY = doc.y;
        doc.rect(40, revBoxY, 515, 80).fillAndStroke('#fff7ed', '#ffedd5');
        doc.fillColor(primaryColor).fontSize(22).font('Helvetica-Bold').text(`⭐ ${metrics.averageRating.toFixed(1)} / 5.0`, 55, revBoxY + 15);
        doc.fillColor(darkColor).fontSize(9).font('Helvetica').text(`Based on ${metrics.totalReviews} customer reviews this week`, 55, revBoxY + 50);

        doc.fontSize(9).font('Helvetica-Bold').fillColor(darkColor).text('Feedback & Complaint Highlights:', 250, revBoxY + 15);
        let tagY = revBoxY + 32;
        metrics.mostCommonComplaints.forEach(c => {
          doc.fontSize(8.5).font('Helvetica').fillColor(mutedColor).text(`• ${c}`, 250, tagY);
          tagY += 13;
        });

        this.drawFooter(doc, 3, 4);

        // ── PAGE 4: AI BUSINESS INSIGHTS & STRATEGIC RECOMMENDATIONS ─────────
        doc.addPage();

        doc.fillColor(darkColor).fontSize(15).font('Helvetica-Bold').text('AI Business Insights & Executive Recommendations');
        doc.strokeColor(primaryColor).lineWidth(2).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.moveDown(1.2);

        // Peak Hours & Busy Days Callout Box
        const aiBox1Y = doc.y;
        doc.rect(40, aiBox1Y, 515, 75).fillAndStroke('#f0fdf4', '#bbf7d0');
        doc.fillColor(greenColor).fontSize(10).font('Helvetica-Bold').text('PEAK DEMAND & TIMING ANALYSIS', 55, aiBox1Y + 12);
        doc.fillColor(darkColor).fontSize(9).font('Helvetica').text(`Peak Ordering Hours: ${metrics.aiInsights.peakOrderingHours}`, 55, aiBox1Y + 30);
        doc.text(`Busiest Sales Days: ${metrics.aiInsights.busyDays}`, 55, aiBox1Y + 45);
        doc.text(`Low-Performing Days: ${metrics.aiInsights.lowPerformingDays}`, 55, aiBox1Y + 60);

        doc.y = aiBox1Y + 90;

        // Revenue Trend & Growth Commentary
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Revenue & Growth Commentary');
        doc.moveDown(0.4);
        doc.fontSize(9).font('Helvetica').fillColor(darkColor).text(metrics.aiInsights.revenueTrend, 40, doc.y, { width: 515 });

        doc.moveDown(1);
        doc.fontSize(9).font('Helvetica').fillColor(darkColor).text(metrics.aiInsights.customerGrowth, 40, doc.y, { width: 515 });

        doc.moveDown(1.5);

        // Strategic Recommendations List
        doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('Actionable Recommendations to Boost Revenue');
        doc.moveDown(0.5);

        metrics.aiInsights.recommendations.forEach((rec, idx) => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor(darkColor).text(`${idx + 1}. `, 40, doc.y, { continued: true });
          doc.font('Helvetica').fillColor('#334155').text(rec, { width: 500 });
          doc.moveDown(0.6);
        });

        // Sign-off Footer
        doc.moveDown(1);
        doc.rect(40, doc.y, 515, 40).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fillColor(darkColor).fontSize(8.5).font('Helvetica-Bold').text('SYSTEM COMPLIANCE NOTICE', 55, doc.y + 10);
        doc.fontSize(7.5).font('Helvetica').fillColor(mutedColor).text('Generated autonomously by Olive Pizza Reporting Engine. Primary business database: Firestore.', 55, doc.y + 22);

        this.drawFooter(doc, 4, 4);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generates a premium monthly business report PDF.
   * Used by MonthlyReportService for the automated monthly report pipeline.
   */
  public async generateMonthlyReport(metrics: MonthlyReportMetrics): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const primaryColor = '#f97316'; // Olive Pizza Orange
        const darkColor = '#1e293b';    // Dark Slate
        const greenColor = '#16a34a';   // Success Green
        const mutedColor = '#64748b';   // Muted Slate

        // ── PAGE 1: EXECUTIVE SUMMARY ────────────────────────────────────────
        doc.rect(0, 0, 595.28, 80).fill(darkColor);
        doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('OLIVE PIZZA', 40, 22);
        doc.fontSize(12).font('Helvetica').fillColor('#f97316').text('MONTHLY BUSINESS PERFORMANCE REPORT', 40, 48);

        doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold').text(metrics.month, 410, 25, { align: 'right' });
        doc.fontSize(9).font('Helvetica').fillColor('#94a3b8').text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 410, 45, { align: 'right' });

        doc.y = 95;

        // Financial Summary
        doc.fillColor(darkColor).fontSize(13).font('Helvetica-Bold').text('Monthly Financial & Order Summary');
        doc.strokeColor(primaryColor).lineWidth(2).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.moveDown(1);

        const c1Y = doc.y;
        this.drawMetricCard(doc, 40, c1Y, 160, 60, 'Total Revenue', `₹${metrics.totalRevenue.toLocaleString('en-IN')}`, greenColor);
        this.drawMetricCard(doc, 215, c1Y, 160, 60, 'Net Revenue', `₹${metrics.netRevenue.toLocaleString('en-IN')}`, primaryColor);
        this.drawMetricCard(doc, 390, c1Y, 165, 60, 'Avg Order Value', `₹${Math.round(metrics.averageOrderValue)}`, darkColor);

        doc.y = c1Y + 70;
        const c2Y = doc.y;
        this.drawMetricCard(doc, 40, c2Y, 160, 60, 'Total Orders', `${metrics.totalOrders}`, darkColor);
        this.drawMetricCard(doc, 215, c2Y, 160, 60, 'Completed Orders', `${metrics.completedOrders}`, greenColor);
        this.drawMetricCard(doc, 390, c2Y, 165, 60, 'Cancelled / Failed', `${metrics.cancelledOrders} / ${metrics.failedOrders}`, '#dc2626');

        doc.y = c2Y + 80;

        // Taxes & Discounts
        const c3Y = doc.y;
        this.drawMetricCard(doc, 40, c3Y, 160, 60, 'Taxes (GST)', `₹${metrics.taxes.toLocaleString('en-IN')}`, darkColor);
        this.drawMetricCard(doc, 215, c3Y, 160, 60, 'Total Discounts', `₹${metrics.discounts.toLocaleString('en-IN')}`, '#dc2626');
        this.drawMetricCard(doc, 390, c3Y, 165, 60, 'Active Customers', `${metrics.totalActiveCustomers}`, primaryColor);

        doc.y = c3Y + 80;

        // Payment Method Breakdown
        doc.fillColor(darkColor).fontSize(12).font('Helvetica-Bold').text('Payment Method Breakdown (Cash vs UPI vs Card)');
        doc.moveDown(0.4);

        const pmY = doc.y;
        this.drawProgressBar(doc, 40, pmY, 515, 16, [
          { label: 'UPI', percent: metrics.paymentBreakdown.upi.percent, color: '#8b5cf6' },
          { label: 'Cards', percent: metrics.paymentBreakdown.card.percent, color: '#3b82f6' },
          { label: 'Cash', percent: metrics.paymentBreakdown.cod.percent, color: '#10b981' },
        ]);

        doc.y = pmY + 24;
        doc.fontSize(8.5).font('Helvetica').fillColor(mutedColor);
        doc.text(
          `UPI: ₹${metrics.paymentBreakdown.upi.amount.toLocaleString()} (${metrics.paymentBreakdown.upi.percent}%)  |  Card: ₹${metrics.paymentBreakdown.card.amount.toLocaleString()} (${metrics.paymentBreakdown.card.percent}%)  |  Cash: ₹${metrics.paymentBreakdown.cod.amount.toLocaleString()} (${metrics.paymentBreakdown.cod.percent}%)`,
          40, doc.y
        );

        this.drawMonthlyFooter(doc, 1, 4);

        // ── PAGE 2: PRODUCTS, COUPONS & CUSTOMERS ─────────────────────────────
        doc.addPage();

        doc.fillColor(darkColor).fontSize(15).font('Helvetica-Bold').text('Product Rankings, Coupons & Customer Growth');
        doc.strokeColor(primaryColor).lineWidth(2).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.moveDown(1.2);

        // Top & Worst Selling
        const pColY = doc.y;
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Top 5 Best Selling Products', 40, pColY);
        doc.text('Worst Selling Products', 300, pColY);

        doc.moveDown(0.8);
        let pRowY = doc.y;
        metrics.topSellingProducts.slice(0, 5).forEach((item: { name: string; quantity: number; revenue: number }, idx: number) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(darkColor);
          doc.text(`${idx + 1}. ${item.name} (${item.quantity} sold - ₹${item.revenue})`, 40, pRowY);
          pRowY += 15;
        });

        let pRowY2 = doc.y;
        metrics.worstSellingProducts.slice(0, 5).forEach((item: { name: string; quantity: number; revenue: number }, idx: number) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(mutedColor);
          doc.text(`${idx + 1}. ${item.name} (${item.quantity} sold)`, 300, pRowY2);
          pRowY2 += 15;
        });

        doc.y = Math.max(pRowY, pRowY2) + 15;

        // Coupons Used
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Coupons Used This Month');
        doc.moveDown(0.4);
        let coupY = doc.y;
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(mutedColor);
        doc.text('Code', 50, coupY);
        doc.text('Times Used', 220, coupY);
        doc.text('Total Discount', 360, coupY);
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, coupY + 14).lineTo(555, coupY + 14).stroke();
        coupY += 20;
        metrics.couponsUsed.slice(0, 8).forEach((c: { code: string; count: number; discountTotal: number }) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(darkColor);
          doc.text(c.code, 50, coupY);
          doc.text(`${c.count}x`, 220, coupY);
          doc.text(`₹${c.discountTotal.toLocaleString('en-IN')}`, 360, coupY);
          coupY += 15;
        });

        doc.y = coupY + 15;

        // Customer Growth
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Customer Acquisition & Loyalty');
        doc.moveDown(0.5);
        const custBoxY = doc.y;
        doc.rect(40, custBoxY, 515, 65).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fillColor(darkColor).fontSize(9.5).font('Helvetica-Bold').text(`New Customers: ${metrics.newCustomers}`, 55, custBoxY + 12);
        doc.fontSize(9.5).font('Helvetica-Bold').text(`Returning Customers: ${metrics.returningCustomers}`, 200, custBoxY + 12);
        doc.fontSize(9.5).font('Helvetica-Bold').text(`Total Active Buyers: ${metrics.totalActiveCustomers}`, 380, custBoxY + 12);
        doc.fontSize(8.5).font('Helvetica').fillColor(mutedColor).text(
          `Average Rating: ⭐ ${metrics.averageRating.toFixed(1)} / 5.0 (based on ${metrics.totalReviews} reviews)`,
          55, custBoxY + 38
        );

        this.drawMonthlyFooter(doc, 2, 4);

        // ── PAGE 3: DELIVERY, NOTIFICATIONS & DAILY SALES ──────────────────────
        doc.addPage();

        doc.fillColor(darkColor).fontSize(15).font('Helvetica-Bold').text('Operations, Communications & Daily Sales Trends');
        doc.strokeColor(primaryColor).lineWidth(2).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.moveDown(1.2);

        // Delivery Stats
        const dStatY = doc.y;
        this.drawMetricCard(doc, 40, dStatY, 160, 60, 'Avg Delivery Time', `${metrics.avgDeliveryTimeMinutes} mins`, darkColor);
        this.drawMetricCard(doc, 215, dStatY, 160, 60, 'Avg Prep Time', `${metrics.avgPreparationTimeMinutes} mins`, primaryColor);
        this.drawMetricCard(doc, 390, dStatY, 165, 60, 'On-Time Rate', `${metrics.onTimeDeliveryRate}%`, greenColor);

        doc.y = dStatY + 75;

        // Delivery Partner Table
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Delivery Partner Performance');
        doc.moveDown(0.4);
        let dpY = doc.y;
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(mutedColor);
        doc.text('Partner Name', 50, dpY);
        doc.text('Deliveries Completed', 220, dpY);
        doc.text('Rating', 480, dpY);
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, dpY + 14).lineTo(555, dpY + 14).stroke();
        dpY += 20;
        metrics.deliveryPartnerStats.slice(0, 5).forEach((dp: { name: string; completedCount: number; rating: number }) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(darkColor);
          doc.text(dp.name, 50, dpY);
          doc.text(`${dp.completedCount} orders`, 220, dpY);
          doc.text(`⭐ ${dp.rating.toFixed(1)}`, 480, dpY);
          dpY += 15;
        });

        doc.y = dpY + 15;

        // Notifications & Emails
        const infraY = doc.y;
        this.drawMetricCard(doc, 40, infraY, 245, 60, 'Push Notifications Sent', `${metrics.notificationsSent}`, darkColor);
        this.drawMetricCard(doc, 305, infraY, 250, 60, 'Emails Sent', `${metrics.emailsSent} (${metrics.emailSuccessRate}% success)`, darkColor);

        doc.y = infraY + 75;

        // Daily Sales Table
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Daily Sales Breakdown');
        doc.moveDown(0.4);
        let dsY = doc.y;
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(mutedColor);
        doc.text('Date', 50, dsY);
        doc.text('Orders', 180, dsY);
        doc.text('Revenue', 300, dsY);
        doc.text('Volume', 400, dsY);
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, dsY + 14).lineTo(555, dsY + 14).stroke();
        dsY += 20;

        const maxDailyRev = Math.max(...metrics.dailySales.map((d: { revenue: number }) => d.revenue), 1);
        metrics.dailySales.slice(0, 20).forEach((d: { date: string; revenue: number; orders: number }) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(darkColor);
          doc.text(d.date, 50, dsY);
          doc.text(`${d.orders}`, 180, dsY);
          doc.text(`₹${d.revenue.toLocaleString('en-IN')}`, 300, dsY);
          const barW = Math.min(130, (d.revenue / maxDailyRev) * 130);
          doc.rect(400, dsY + 1, Math.max(barW, 3), 7).fill(primaryColor);
          dsY += 14;
        });

        this.drawMonthlyFooter(doc, 3, 4);

        // ── PAGE 4: PEAK HOURS & REVIEW SUMMARY ───────────────────────────────
        doc.addPage();

        doc.fillColor(darkColor).fontSize(15).font('Helvetica-Bold').text('Peak Hours, Reviews & Executive Summary');
        doc.strokeColor(primaryColor).lineWidth(2).moveTo(40, doc.y + 4).lineTo(555, doc.y + 4).stroke();
        doc.moveDown(1.2);

        // Peak Hours
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Peak Ordering Hours');
        doc.moveDown(0.4);
        let phY = doc.y;
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(mutedColor);
        doc.text('Hour', 50, phY);
        doc.text('Order Count', 220, phY);
        doc.text('Activity', 360, phY);
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, phY + 14).lineTo(555, phY + 14).stroke();
        phY += 20;
        const maxHourCount = Math.max(...metrics.peakHours.map((h: { count: number }) => h.count), 1);
        metrics.peakHours.slice(0, 12).forEach((h: { hour: string; count: number }) => {
          doc.fontSize(8.5).font('Helvetica').fillColor(darkColor);
          doc.text(h.hour, 50, phY);
          doc.text(`${h.count} orders`, 220, phY);
          const barW = Math.min(150, (h.count / maxHourCount) * 150);
          doc.rect(360, phY + 1, Math.max(barW, 3), 7).fill(primaryColor);
          phY += 15;
        });

        doc.y = phY + 15;

        // Review Summary Box
        doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold').text('Customer Review Summary');
        doc.moveDown(0.5);
        const revBoxY = doc.y;
        doc.rect(40, revBoxY, 515, 80).fillAndStroke('#fff7ed', '#ffedd5');
        doc.fillColor(primaryColor).fontSize(22).font('Helvetica-Bold').text(`⭐ ${metrics.averageRating.toFixed(1)} / 5.0`, 55, revBoxY + 15);
        doc.fillColor(darkColor).fontSize(9).font('Helvetica').text(`Based on ${metrics.totalReviews} customer reviews this month`, 55, revBoxY + 50);

        doc.y = revBoxY + 95;

        // Executive Summary
        doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('Monthly Executive Summary');
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica').fillColor('#334155').text(
          `In ${metrics.month}, Olive Pizza processed ${metrics.totalOrders} total orders (${metrics.completedOrders} completed, ${metrics.cancelledOrders} cancelled). ` +
          `Total revenue was ₹${metrics.totalRevenue.toLocaleString('en-IN')} with an average order value of ₹${Math.round(metrics.averageOrderValue)}. ` +
          `${metrics.newCustomers} new customers joined and ${metrics.returningCustomers} returning customers ordered again. ` +
          `Average delivery time was ${metrics.avgDeliveryTimeMinutes} minutes with a ${metrics.onTimeDeliveryRate}% on-time delivery rate. ` +
          `Customer satisfaction averaged ⭐ ${metrics.averageRating.toFixed(1)}/5.0 across ${metrics.totalReviews} reviews.`,
          40, doc.y, { width: 515 }
        );

        doc.moveDown(1);
        doc.rect(40, doc.y, 515, 40).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fillColor(darkColor).fontSize(8.5).font('Helvetica-Bold').text('SYSTEM COMPLIANCE NOTICE', 55, doc.y + 10);
        doc.fontSize(7.5).font('Helvetica').fillColor(mutedColor).text('Generated autonomously by Olive Pizza Monthly Reporting Engine. Primary business database: Firestore.', 55, doc.y + 22);

        this.drawMonthlyFooter(doc, 4, 4);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private drawMonthlyFooter(doc: PDFKit.PDFDocument, currentPage: number, totalPages: number) {
    const bottomY = 780;
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, bottomY - 10).lineTo(555, bottomY - 10).stroke();
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('Olive Pizza Inc. • Monthly Business Intelligence', 40, bottomY);
    doc.text(`Page ${currentPage} of ${totalPages}`, 40, bottomY, { align: 'right' });
  }

  private drawMetricCard(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, title: string, value: string, valueColor: string) {
    doc.rect(x, y, width, height).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Bold').text(title.toUpperCase(), x + 10, y + 10);
    doc.fillColor(valueColor).fontSize(14).font('Helvetica-Bold').text(value, x + 10, y + 26);
  }

  private drawProgressBar(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, segments: { label: string; percent: number; color: string }[]) {
    let currentX = x;
    segments.forEach(seg => {
      const segWidth = (seg.percent / 100) * width;
      if (segWidth > 0) {
        doc.rect(currentX, y, segWidth, height).fill(seg.color);
        currentX += segWidth;
      }
    });
  }

  private drawFooter(doc: PDFKit.PDFDocument, currentPage: number, totalPages: number) {
    const bottomY = 780;
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, bottomY - 10).lineTo(555, bottomY - 10).stroke();
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica').text('Olive Pizza Inc. • Weekly Business Intelligence', 40, bottomY);
    doc.text(`Page ${currentPage} of ${totalPages}`, 40, bottomY, { align: 'right' });
  }
}

export const pdfGenerator = new PdfGenerator();
