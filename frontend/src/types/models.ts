export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'partner_assigned' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  imageUrl?: string;
  isAvailable?: boolean;
  isVegetarian?: boolean;
  rating?: number;
  tags?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  order?: number;
  isActive?: boolean;
}

export interface Combo {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  image?: string;
  imageUrl?: string;
  products?: string[];
  isAvailable?: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  validFrom?: any;
  validUntil?: any;
  usageLimit?: number;
  usedCount?: number;
  isActive?: boolean;
  applicableCategories?: string[];
}

export interface Advertisement {
  id: string;
  title: string;
  description?: string;
  image: string;
  imageUrl?: string;
  linkUrl?: string;
  ctaText?: string;
  target?: string;
  startDate?: any;
  endDate?: any;
  isActive: boolean;
  placement?: 'home_banner' | 'popup' | 'checkout' | 'category';
}

export interface MediaItem {
  id: string;
  name?: string;
  url: string;
  mediaUrl?: string;
  secure_url?: string;
  cloudinaryPublicId?: string;
  public_id?: string;
  format?: string;
  bytes?: number;
  resource_type?: string;
  uploadedAt?: any;
  createdAt?: any;
}

export interface DeliveryPartner {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'online' | 'offline' | 'busy' | 'break';
  approvalStatus: 'pending' | 'approved' | 'suspended';
  vehicleType?: string;
  vehicleNumber?: string;
  photoUrl?: string;
  joinedAt?: string;
  rating?: number;
  totalDeliveries?: number;
  lat?: number;
  lng?: number;
}

export interface MenuItem {
  id?: string;
  name: string;
  description: string;
  category: 'pizza' | 'sides' | 'beverage' | 'dessert' | 'combo' | string;
  pricingMode?: 'fixed' | 'offer';
  basePrice: number;
  offerPrice?: number;
  discountPercentage?: number;
  image: string;
  isVegetarian: boolean;
  isAvailable: boolean;
  productIds?: string[];
  variants?: {
    name: string;
    price: number;
  }[];
  crusts?: {
    name: string;
    price: number;
  }[];
  addons?: {
    name: string;
    price: number;
  }[];
}

export interface CartItem {
  id: string;
  menuItemId?: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  variant?: string;
  crust?: string;
  addons?: string[];
  image: string;
  isVegetarian?: boolean;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: 'customer' | 'owner' | 'delivery_partner' | 'admin' | 'developer';
  fullAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  photoUrl?: string;
  
  approvalStatus?: 'pending' | 'approved' | 'suspended';
  status?: 'online' | 'offline' | 'busy' | 'break';
  vehicleType?: string;
  vehicleNumber?: string;
  joinedAt?: string;
  
  fcmTokens?: string[];
  notificationEnabled?: boolean;
  lastTokenUpdate?: string;
  deviceName?: string;
  platform?: string;
  browser?: string;

  getIdToken?: () => Promise<string>;
}

export interface Order {
  id?: string;
  dailyOrderNumber?: string;
  permanentOrderId?: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  customerInfo?: {
    name: string;
    phone: string;
    email?: string;
  };
  items: CartItem[];
  totalAmount: number;
  paymentMethod?: string;
  status: OrderStatus;
  deliveryAddress?: {
    addressLine: string;
    address?: string;
    landmark?: string;
    pincode: string;
    lat?: number;
    lng?: number;
  };
  address?: string;
  contactPhone: string;
  createdAt: any;
  updatedAt: any;
  deliveryPartnerId?: string;
  
  orderTiming?: 'now' | 'scheduled';
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  noContactDelivery?: boolean;
  
  cancellationReason?: string;
  cancelledAt?: string;
  declinedPartnerIds?: string[];
  orderDateLocal?: string;
  
  deliveryProof?: {
    photoUrl?: string;
    note?: string;
    signatureUrl?: string;
  };
  deliveryRating?: {
    score: number;
    review?: string;
    createdAt: string;
  };
  pickedUpAt?: string;
  deliveredAt?: string;
  deliveryFee?: number;
  
  alertSent?: boolean;
  firstAlertAt?: string | null;
  secondAlertAt?: string | null;
  urgentAlertAt?: string | null;
}
