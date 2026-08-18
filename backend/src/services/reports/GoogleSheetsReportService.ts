/**
 * GoogleSheetsReportService.ts — Live Monthly Business Reporting Engine
 * 
 * Manages live Google Sheets for Olive Pizza monthly business analytics.
 * Incremental order updates, automatic section summaries, and professional charts.
 */

import { google } from 'googleapis';
import { adminDb as db } from '../../config/firebase.js';

export interface OrderRowData {
  orderId: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  paymentMethod: string;
  orderType: 'delivery' | 'pickup';
  status: string;
  itemCount: number;
  couponCode?: string;
  deliveryTimeMins?: number;
  timestamp: string;
}

export class GoogleSheetsReportService {
  private static sheetsClient: any = null;

  /**
   * Initializes Google Sheets API v4 client.
   */
  private static getSheetsClient() {
    if (this.sheetsClient) return this.sheetsClient;

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
    let authClient: any;

    if (serviceAccountJson) {
      try {
        const decoded = JSON.parse(Buffer.from(serviceAccountJson, 'base64').toString('utf-8'));
        authClient = new google.auth.JWT({
          email: decoded.client_email,
          key: decoded.private_key,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      } catch (err: any) {
        console.warn('[GoogleSheetsReport] Base64 service account parse warning:', err.message);
      }
    } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      authClient = new google.auth.JWT({
        email: process.env.FIREBASE_CLIENT_EMAIL,
        key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    }

    if (!authClient) {
      authClient = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    }

    this.sheetsClient = google.sheets({ version: 'v4', auth: authClient });
    return this.sheetsClient;
  }

  /**
   * Returns current spreadsheet ID for monthly reports from Firestore settings.
   */
  static async getSpreadsheetId(): Promise<string | null> {
    try {
      const doc = await db.collection('settings').doc('google_sheets').get();
      if (doc.exists && doc.data()?.spreadsheetId) {
        return doc.data()?.spreadsheetId;
      }
      return process.env.GOOGLE_SHEET_SPREADSHEET_ID || null;
    } catch {
      return null;
    }
  }

  /**
   * Generates formatted sheet title for a given date (e.g. "2026-August").
   */
  static getMonthSheetTitle(date: Date = new Date()): string {
    const year = date.getFullYear();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${year}-${monthNames[date.getMonth()]}`;
  }

  /**
   * Ensures monthly sheet exists with complete header & structured sections.
   */
  static async ensureMonthlySheetExists(spreadsheetId: string, sheetTitle: string): Promise<void> {
    const sheets = this.getSheetsClient();

    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetExists = (spreadsheet.data.sheets || []).some(
        (s: any) => s.properties?.title === sheetTitle
      );

      if (!sheetExists) {
        console.log(`[GoogleSheetsReport] Creating new monthly sheet "${sheetTitle}"...`);

        // Add sheet tab
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetTitle,
                    gridProperties: { rowCount: 1000, columnCount: 15 },
                  },
                },
              },
            ],
          },
        });

        // Initialize structured headers & summary section
        await this.initializeSheetHeaders(spreadsheetId, sheetTitle);
      }
    } catch (err: any) {
      console.warn(`[GoogleSheetsReport] ensureMonthlySheetExists notice:`, err.message);
    }
  }

  /**
   * Writes professional header sections to the monthly sheet.
   */
  private static async initializeSheetHeaders(spreadsheetId: string, sheetTitle: string): Promise<void> {
    const sheets = this.getSheetsClient();

    const headers = [
      ['OLIVE PIZZA — LIVE MONTHLY BUSINESS REPORT', '', '', '', '', '', '', '', '', '', '', ''],
      [`Month: ${sheetTitle}`, `Generated: ${new Date().toLocaleString()}`, '', '', '', '', '', '', '', '', '', ''],
      [''],
      ['SUMMARY METRICS', 'VALUE'],
      ['Total Revenue (₹)', '=SUM(G10:G5000)'],
      ['Total Completed Orders', '=COUNTIF(H10:H5000, "delivered")'],
      ['Average Order Value (₹)', '=AVERAGE(G10:G5000)'],
      [''],
      ['ORDER ID', 'CUSTOMER NAME', 'PHONE', 'ORDER TYPE', 'PAYMENT METHOD', 'ITEMS', 'TOTAL AMOUNT (₹)', 'STATUS', 'COUPON', 'DELIVERY TIME (MINS)', 'TIMESTAMP']
    ];

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetTitle}'!A1:K9`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: headers },
      });
    } catch (err: any) {
      console.warn('[GoogleSheetsReport] initializeSheetHeaders error:', err.message);
    }
  }

  /**
   * Syncs a live order (creates or updates) to the monthly Google Sheet.
   */
  static async syncOrderToMonthlySheet(orderData: any): Promise<void> {
    try {
      const spreadsheetId = await this.getSpreadsheetId();
      if (!spreadsheetId) {
        return;
      }

      const orderId = orderData.id || orderData.orderId || '';
      if (!orderId) return;

      const orderDate = orderData.createdAt 
        ? (typeof orderData.createdAt?.toDate === 'function' 
            ? orderData.createdAt.toDate() 
            : new Date(orderData.createdAt?._seconds ? orderData.createdAt._seconds * 1000 : orderData.createdAt))
        : new Date();

      const validDate = isNaN(orderDate.getTime()) ? new Date() : orderDate;
      const sheetTitle = this.getMonthSheetTitle(validDate);
      await this.ensureMonthlySheetExists(spreadsheetId, sheetTitle);

      const shortId = orderId.slice(-6).toUpperCase();
      const orderNumber = orderData.dailyOrderNumber 
        ? `#${orderData.dailyOrderNumber}` 
        : (orderData.daily_order_number || `OP-${shortId}`);

      const customerName = orderData.customerName || orderData.customer_name || orderData.deliveryAddress?.name || 'Customer';
      const customerPhone = orderData.contactPhone || orderData.phone || orderData.customerPhone || orderData.deliveryAddress?.phone || 'N/A';
      const orderType = orderData.orderType || orderData.type || 'delivery';
      const paymentMethod = orderData.paymentMethod || orderData.payment_method || 'COD';
      const itemsListStr = Array.isArray(orderData.items) 
        ? orderData.items.map((i: any) => typeof i === 'string' ? i : `${i.quantity || 1}x ${i.name || i.productName || 'Item'}`).join(', ')
        : '1x Item';
      const totalAmount = Number(orderData.totalAmount || orderData.total_amount || 0);
      const status = (orderData.status || 'pending').toLowerCase();
      const couponCode = orderData.couponCode || orderData.coupon || 'NONE';
      const deliveryTimeMins = orderData.deliveryTimeMins || orderData.estimatedDeliveryTime || 25;
      const timestampStr = validDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      const row = [
        orderNumber,
        customerName,
        customerPhone,
        orderType,
        paymentMethod,
        itemsListStr,
        totalAmount,
        status,
        couponCode,
        deliveryTimeMins,
        timestampStr,
      ];

      const sheets = this.getSheetsClient();

      // Read existing order IDs from Column A
      const existingRowsRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTitle}'!A10:A5000`,
      });

      const existingOrderIds = existingRowsRes.data.values || [];
      const rowIndex = existingOrderIds.findIndex((r: any[]) => r && (r[0] === orderNumber || r[0] === orderId || r[0] === `OP-${shortId}`));

      if (rowIndex !== -1) {
        const targetRow = 10 + rowIndex;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${sheetTitle}'!A${targetRow}:K${targetRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [row] },
        });
        console.log(`[GoogleSheetsReport] ✅ Updated live order ${orderNumber} in Google Sheet "${sheetTitle}" at row ${targetRow}`);
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${sheetTitle}'!A10:K10`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [row] },
        });
        console.log(`[GoogleSheetsReport] ✅ Appended live order ${orderNumber} to Google Sheet "${sheetTitle}"`);
      }
    } catch (err: any) {
      console.error(`[GoogleSheetsReport] Error syncing live order to Google Sheet:`, err.message);
    }
  }

  /**
   * Appends a completed order incrementally to the monthly Google Sheet (Backwards compatibility).
   */
  static async appendOrderToMonthlySheet(order: OrderRowData): Promise<void> {
    return this.syncOrderToMonthlySheet(order);
  }

  /**
   * Ensures 'Weekly Reports' sheet exists with structured header.
   */
  static async ensureWeeklySheetExists(spreadsheetId: string, sheetTitle: string = 'Weekly Reports'): Promise<void> {
    const sheets = this.getSheetsClient();

    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetExists = (spreadsheet.data.sheets || []).some(
        (s: any) => s.properties?.title === sheetTitle
      );

      if (!sheetExists) {
        console.log(`[GoogleSheetsReport] Creating weekly reports sheet "${sheetTitle}"...`);

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetTitle,
                    gridProperties: { rowCount: 500, columnCount: 15 },
                  },
                },
              },
            ],
          },
        });

        const headers = [
          ['OLIVE PIZZA — WEEKLY BUSINESS INTELLIGENCE REPORTS', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
          [`Initialized: ${new Date().toLocaleString()}`, '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
          [''],
          [
            'WEEK DOC ID', 'WEEK LABEL', 'DATE RANGE', 'TOTAL ORDERS', 'COMPLETED',
            'CANCELLED', 'TOTAL REVENUE (₹)', 'NET REVENUE (₹)', 'AVG ORDER VALUE (₹)',
            'NEW CUSTOMERS', 'RETURNING CUSTOMERS', 'AVG RATING', 'TOP SELLER',
            'AI INSIGHTS SUMMARY', 'GENERATED AT'
          ]
        ];

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'${sheetTitle}'!A1:O4`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: headers },
        });
      }
    } catch (err: any) {
      console.warn(`[GoogleSheetsReport] ensureWeeklySheetExists notice:`, err.message);
    }
  }

  /**
   * Appends weekly business intelligence report summary to Google Sheet.
   */
  static async appendWeeklyReportSummary(weekInfo: any, metrics: any): Promise<void> {
    const spreadsheetId = await this.getSpreadsheetId();
    if (!spreadsheetId) {
      console.log('[GoogleSheetsReport] Spreadsheet ID not configured. Skipping weekly sheet append.');
      return;
    }

    const sheetTitle = 'Weekly Reports';
    await this.ensureWeeklySheetExists(spreadsheetId, sheetTitle);

    const topSelling = (metrics.bestSellingItems || []).map((p: any) => p.name || p).slice(0, 3).join(', ') || 'N/A';
    const aiSummary = metrics.aiInsights?.recommendations?.[0] || 'Weekly report compiled successfully.';

    const row = [
      weekInfo.docId,
      weekInfo.weekLabel,
      weekInfo.dateRange,
      metrics.totalOrders || 0,
      metrics.completedOrders || 0,
      metrics.cancelledOrders || 0,
      metrics.totalRevenue || 0,
      metrics.netRevenue || 0,
      Math.round(metrics.averageOrderValue || 0),
      metrics.newCustomers || 0,
      metrics.returningCustomers || 0,
      Number(metrics.averageRating || 5).toFixed(1),
      topSelling,
      aiSummary,
      new Date().toLocaleString(),
    ];

    try {
      const sheets = this.getSheetsClient();
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetTitle}'!A5:O5`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      });

      console.log(`[GoogleSheetsReport] Weekly report summary appended to "${sheetTitle}" for ${weekInfo.docId}`);
    } catch (err: any) {
      console.error(`[GoogleSheetsReport] Error appending weekly report summary:`, err.message);
    }
  }

  /**
   * Updates monthly summary metrics and inserts automatic charts into Google Sheet.
   */
  static async addChartsToMonthlySheet(spreadsheetId: string, sheetTitle: string): Promise<void> {
    try {
      const sheets = this.getSheetsClient();
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const targetSheet = (spreadsheet.data.sheets || []).find((s: any) => s.properties?.title === sheetTitle);

      if (!targetSheet) return;
      const sheetId = targetSheet.properties.sheetId;

      // Add Revenue Line Chart and Orders Bar Chart via batchUpdate
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addChart: {
                chart: {
                  spec: {
                    title: `Olive Pizza — ${sheetTitle} Revenue Trend`,
                    basicChart: {
                      chartType: 'LINE',
                      legendPosition: 'BOTTOM_LEGEND',
                      domains: [
                        {
                          domain: {
                            sourceRange: {
                              sources: [{ sheetId, startRowIndex: 8, endRowIndex: 50, startColumnIndex: 10, endColumnIndex: 11 }]
                            }
                          }
                        }
                      ],
                      series: [
                        {
                          series: {
                            sourceRange: {
                              sources: [{ sheetId, startRowIndex: 8, endRowIndex: 50, startColumnIndex: 6, endColumnIndex: 7 }]
                            }
                          },
                          targetAxis: 'LEFT_AXIS'
                        }
                      ]
                    }
                  },
                  position: {
                    overlayPosition: {
                      anchorCell: { sheetId, rowIndex: 1, columnIndex: 12 },
                      offsetXPixels: 0,
                      offsetYPixels: 0,
                    }
                  }
                }
              }
            }
          ]
        }
      });
      console.log(`[GoogleSheetsReport] Charts inserted successfully in sheet "${sheetTitle}"`);
    } catch (err: any) {
      console.warn(`[GoogleSheetsReport] addChartsToMonthlySheet notice:`, err.message);
    }
  }
}
