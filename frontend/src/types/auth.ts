export type UserRole = 
  | 'owner' 
  | 'admin' 
  | 'developer' 
  | 'platform_owner'
  | 'franchise_owner' 
  | 'franchise_manager' 
  | 'restaurant_manager' 
  | 'manager'
  | 'staff'
  | 'cashier' 
  | 'delivery_partner' 
  | 'customer';

export interface User {
  uid: string;
  email: string | null;
  name?: string;
  photoURL?: string;
  photoUrl?: string;
  role?: UserRole;
  phoneNumber?: string;
  phone?: string;
  allowedApps?: string[];
  applicationAccess?: {
    app_franchise_management?: boolean;
    app_restaurant_management?: boolean;
    app_pos?: boolean;
    app_delivery?: boolean;
    [key: string]: boolean | undefined;
  };
  permissions?: string[];
  branchId?: string;
  branchIds?: string[];
  franchiseId?: string;

  // Email
  emailVerified?: boolean;

  // Onboarding fields
  onboardingComplete?: boolean;
  phoneVerified?: boolean;
  phoneSetupCompleted?: boolean;
  locationSetupCompleted?: boolean;

  // Location fields
  fullAddress?: string;
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
  pincode?: string;

  // Delivery partner specific fields
  approvalStatus?: 'pending' | 'approved' | 'suspended';
  status?: 'online' | 'offline' | 'busy' | 'break';
  vehicleType?: string;
  vehicleNumber?: string;
  vehicleImage?: string;
  joinedAt?: string;

  // Live location (delivery partner tracking)
  liveLocation?: {
    lat: number;
    lng: number;
    speed?: number;
    bearing?: number;
    updatedAt?: string;
    activeOrderId?: string;
  };

  // Earnings and metrics (delivery partner)
  earnings?: {
    total?: number;
    today?: number;
    thisWeek?: number;
    thisMonth?: number;
  };
  metrics?: {
    totalDeliveries?: number;
    rating?: number;
    completionRate?: number;
  };

  // FCM / device push notification fields
  fcmTokens?: string[];
  notificationEnabled?: boolean;
  lastTokenUpdate?: string;
  deviceName?: string;
  platform?: string;
  browser?: string;

  // Firebase-compatible getIdToken
  getIdToken?: () => Promise<string>;
}

export interface AuthState {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null, role: UserRole | null) => void;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}
