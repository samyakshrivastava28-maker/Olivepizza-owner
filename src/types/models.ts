export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
  crust?: string;
  addons?: { name: string; price: number }[];
}

export type OrderStatus =
  | 'pending'
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export interface Order {
  id: string;
  userId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: OrderItem[];
  totalAmount: number;
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  couponCode?: string;
  status: OrderStatus;
  paymentMethod: 'cod' | 'online' | 'upi' | 'card';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  deliveryAddress: {
    address: string;
    landmark?: string;
    city?: string;
    pincode?: string;
    lat?: number;
    lng?: number;
  };
  deliveryPartnerId?: string;
  deliveryPartnerName?: string;
  deliveryPartnerPhone?: string;
  cancelReason?: string;
  dailyOrderNumber?: number;
  createdAt: any;
  updatedAt?: any;
}

export interface ProductVariant {
  name: string;
  price: number;
}

export interface ProductAddon {
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  offerPrice?: number;
  category: string;
  imageUrl: string;
  isVeg: boolean;
  isAvailable: boolean;
  isPopular?: boolean;
  tags?: string[];
  variants?: ProductVariant[];
  crusts?: ProductVariant[];
  addons?: ProductAddon[];
  rating?: number;
  prepTimeMinutes?: number;
  createdAt?: any;
}

export interface Category {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  imageUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface Combo {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  items: string[];
  isActive: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number;
  expiryDate: string;
  usageLimit?: number;
  usedCount?: number;
  isActive: boolean;
}

export interface Advertisement {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  targetUrl?: string;
  placement: 'home_hero' | 'home_banner' | 'popup';
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  clickCount?: number;
}

export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  isOnline: boolean;
  activeOrderId?: string;
  currentLat?: number;
  currentLng?: number;
  rating?: number;
  completedDeliveries?: number;
  lastActiveAt?: any;
}

export interface MediaItem {
  publicId: string;
  url: string;
  format: string;
  bytes: number;
  createdAt: string;
  resourceType: 'image' | 'video';
}
