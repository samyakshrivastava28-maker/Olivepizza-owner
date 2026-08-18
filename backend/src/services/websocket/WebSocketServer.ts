/**
 * WebSocketServer — Real-Time In-App Updates & Live GPS Tracking
 *
 * Only for users who are ACTIVELY using the application.
 * FCM handles background/killed-app notifications.
 *
 * Use cases:
 *  - 500ms Live driver location streaming (Customer Live Track + Owner Fleet Map)
 *  - Live order status updates in FloatingTracker
 *  - Live order created alerts for Owner Dashboard
 *  - Delivery dashboard live orders
 *  - FloatingCart badge updates
 */

import { WebSocketServer as WSSNative, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { appEventBus, OrderStatusChangedEvent, OrderCreatedEvent } from '../eventBus/AppEventBus.js';

export interface ConnectedClient {
  ws: WebSocket;
  uid: string;
  role?: string;
  connectedAt: number;
  subscribedOrders: Set<string>;
}

export interface DriverLocationData {
  deliveryPartnerId: string;
  orderId?: string | null;
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  battery?: number;
  isMoving?: boolean;
  timestamp: string | number;
  status?: 'ONLINE' | 'OFFLINE' | 'STALE' | 'DELIVERING';
}

class OliveWebSocketServer {
  private wss: WSSNative | null = null;
  private clients = new Map<string, Set<ConnectedClient>>();
  private orderSubscribers = new Map<string, Set<ConnectedClient>>();
  private driverLocations = new Map<string, DriverLocationData>();
  private totalConnections = 0;

  /**
   * Attach to an existing Node.js HTTP server.
   */
  attach(httpServer: any): void {
    if (this.wss) return; // Already attached

    this.wss = new WSSNative({ server: httpServer, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || '/', `ws://${req.headers.host}`);
      const uid = url.searchParams.get('uid') || 'anonymous';
      const role = url.searchParams.get('role') || 'customer';

      const client: ConnectedClient = { 
        ws, 
        uid, 
        role, 
        connectedAt: Date.now(),
        subscribedOrders: new Set<string>()
      };
      this.totalConnections++;

      // Register client
      if (!this.clients.has(uid)) this.clients.set(uid, new Set());
      this.clients.get(uid)!.add(client);

      console.log(`[WebSocketServer] Client connected uid=${uid} role=${role} total=${this.totalConnections}`);

      // Send connection acknowledgment
      this.safeSend(ws, { 
        type: 'connected', 
        data: { 
          uid, 
          role, 
          timestamp: new Date().toISOString(),
          activeDriversCount: this.driverLocations.size
        } 
      });

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          
          // 1. Keepalive ping/pong
          if (msg.type === 'ping') {
            this.safeSend(ws, { type: 'pong', data: { timestamp: new Date().toISOString() } });
            return;
          }

          // 2. Subscribe to order tracking channel
          if (msg.type === 'subscribe.order' && msg.data?.orderId) {
            const orderId = String(msg.data.orderId);
            client.subscribedOrders.add(orderId);
            if (!this.orderSubscribers.has(orderId)) {
              this.orderSubscribers.set(orderId, new Set());
            }
            this.orderSubscribers.get(orderId)!.add(client);
            
            // Immediately send current driver location if available for this order
            for (const loc of this.driverLocations.values()) {
              if (loc.orderId === orderId) {
                this.safeSend(ws, { type: 'driver.location_update', data: loc });
                break;
              }
            }
            return;
          }

          // 3. Unsubscribe from order tracking channel
          if (msg.type === 'unsubscribe.order' && msg.data?.orderId) {
            const orderId = String(msg.data.orderId);
            client.subscribedOrders.delete(orderId);
            this.orderSubscribers.get(orderId)?.delete(client);
            return;
          }

          // 4. Live location streaming from Delivery Partner (~500ms stream)
          if (msg.type === 'driver.location_update' && msg.data) {
            this.handleDriverLocationUpdate(msg.data);
            return;
          }

        } catch (parseErr) {
          // Ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.totalConnections = Math.max(0, this.totalConnections - 1);
        
        // Remove from user client map
        const userSet = this.clients.get(uid);
        if (userSet) {
          userSet.delete(client);
          if (userSet.size === 0) this.clients.delete(uid);
        }

        // Remove from order subscriptions
        for (const orderId of client.subscribedOrders) {
          const orderSet = this.orderSubscribers.get(orderId);
          if (orderSet) {
            orderSet.delete(client);
            if (orderSet.size === 0) this.orderSubscribers.delete(orderId);
          }
        }

        console.log(`[WebSocketServer] Client disconnected uid=${uid} total=${this.totalConnections}`);
      });

      ws.on('error', (err) => {
        console.error(`[WebSocketServer] WS error uid=${uid}:`, err.message);
      });
    });

    this.wss.on('error', (err) => {
      console.error('[WebSocketServer] Server error:', err.message);
    });

    // Subscribe to AppEventBus to broadcast live updates
    appEventBus.on('order.status_changed', (event: OrderStatusChangedEvent) => {
      // 1. Broadcast to user directly
      this.broadcastToUser(event.userId, {
        type: 'order.status_changed',
        data: {
          orderId: event.orderId,
          orderNumber: event.orderNumber,
          status: event.currentStatus,
          previousStatus: event.previousStatus,
          deliveryPartnerName: event.deliveryPartnerName,
          timestamp: event.timestamp,
        },
      });

      // 2. Broadcast to all clients watching this order channel
      this.broadcastToOrder(event.orderId, {
        type: 'order.status_changed',
        data: {
          orderId: event.orderId,
          orderNumber: event.orderNumber,
          status: event.currentStatus,
          previousStatus: event.previousStatus,
          deliveryPartnerName: event.deliveryPartnerName,
          timestamp: event.timestamp,
        },
      });
    });

    appEventBus.on('order.created', (event: OrderCreatedEvent) => {
      // Broadcast new order to all owner/manager clients
      this.broadcastToRole('owner', {
        type: 'order.created',
        data: {
          orderId: event.orderId,
          orderNumber: event.orderNumber,
          customerName: event.customerName,
          totalAmount: event.totalAmount,
          timestamp: event.timestamp,
        },
      });
    });

    console.log('[WebSocketServer] Attached to HTTP server on path /ws');
  }

  /**
   * Processes a live location update from a driver.
   */
  public handleDriverLocationUpdate(data: DriverLocationData): void {
    if (!data || !data.deliveryPartnerId || data.lat === undefined || data.lng === undefined) {
      return;
    }

    const normalizedData: DriverLocationData = {
      deliveryPartnerId: data.deliveryPartnerId,
      orderId: data.orderId || null,
      lat: Number(data.lat),
      lng: Number(data.lng),
      accuracy: data.accuracy ? Number(data.accuracy) : 5,
      speed: data.speed !== undefined ? Number(data.speed) : 0,
      heading: data.heading !== undefined ? Number(data.heading) : 0,
      battery: data.battery !== undefined ? Number(data.battery) : 100,
      isMoving: data.isMoving !== undefined ? Boolean(data.isMoving) : (Number(data.speed || 0) > 1),
      timestamp: data.timestamp || new Date().toISOString(),
      status: 'ONLINE'
    };

    // Cache latest location in memory
    this.driverLocations.set(data.deliveryPartnerId, normalizedData);

    const broadcastMsg = {
      type: 'driver.location_update',
      data: normalizedData
    };

    // 1. If assigned to an active order, broadcast to all clients subscribed to that order (Customer tracking)
    if (normalizedData.orderId) {
      this.broadcastToOrder(normalizedData.orderId, broadcastMsg);
    }

    // 2. Broadcast to all owner/admin clients for real-time fleet map
    this.broadcastToRole('owner', broadcastMsg);
  }

  /**
   * Broadcast to all clients subscribed to a specific order ID.
   */
  public broadcastToOrder(orderId: string, message: object): void {
    const subs = this.orderSubscribers.get(orderId);
    if (!subs || subs.size === 0) return;

    const payload = JSON.stringify(message);
    for (const client of subs) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  /**
   * Send a message to all WebSocket connections for a specific Firebase UID.
   */
  broadcastToUser(uid: string, message: object): void {
    const userClients = this.clients.get(uid);
    if (!userClients || userClients.size === 0) return;

    const payload = JSON.stringify(message);
    for (const client of userClients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  /**
   * Broadcast to all users with a specific role (for owner/delivery dashboards).
   */
  broadcastToRole(role: string, message: object): void {
    const payload = JSON.stringify(message);
    for (const userClients of this.clients.values()) {
      for (const client of userClients) {
        if ((client.role === role || client.role === 'owner' || client.role === 'admin') && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(payload);
        }
      }
    }
  }

  /**
   * Broadcast to ALL connected clients.
   */
  broadcastToAll(message: object): void {
    if (!this.wss) return;
    const payload = JSON.stringify(message);
    for (const userClients of this.clients.values()) {
      for (const client of userClients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(payload);
        }
      }
    }
  }

  /**
   * Returns all active cached driver locations with offline detection (>30s stale check)
   */
  getActiveDriverLocations(): DriverLocationData[] {
    const now = Date.now();
    const result: DriverLocationData[] = [];

    for (const [id, loc] of this.driverLocations.entries()) {
      const locTime = typeof loc.timestamp === 'number' ? loc.timestamp : new Date(loc.timestamp).getTime();
      const isStale = (now - locTime) > 30000; // > 30 seconds without GPS signal

      result.push({
        ...loc,
        status: isStale ? 'STALE' : 'ONLINE'
      });
    }

    return result;
  }

  /**
   * Statistics for diagnostics overlay.
   */
  stats(): { totalConnections: number; uniqueUsers: number; activeDrivers: number; activeOrdersWatched: number } {
    return {
      totalConnections: this.totalConnections,
      uniqueUsers: this.clients.size,
      activeDrivers: this.driverLocations.size,
      activeOrdersWatched: this.orderSubscribers.size,
    };
  }

  private safeSend(ws: WebSocket, data: object): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    } catch {
      // Ignore send errors
    }
  }
}

export const webSocketServer = new OliveWebSocketServer();

