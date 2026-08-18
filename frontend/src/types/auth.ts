export interface User {
  uid: string;
  email: string | null;
  name?: string;
  photoURL?: string;
  role?: 'owner' | 'admin' | 'developer' | 'customer' | 'delivery';
  phoneNumber?: string;
}

export interface AuthState {
  user: User | null;
  role: 'owner' | 'admin' | 'developer' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null, role: 'owner' | 'admin' | 'developer' | null) => void;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}
