export interface SDUISection {
  id: string;
  type:
    | 'hero_banner'
    | 'categories'
    | 'featured_products'
    | 'curated_selections'
    | 'promotional_banner'
    | 'storytelling'
    | 'testimonials'
    | 'app_download'
    | 'footer';
  title?: string;
  subtitle?: string;
  isActive: boolean;
  order: number;
  config?: Record<string, any>;
}

export interface SDUIConfig {
  version: number;
  updatedAt: string;
  updatedBy?: string;
  theme?: {
    primaryColor?: string;
    accentColor?: string;
    darkMode?: boolean;
  };
  sections: SDUISection[];
}

export interface SDUIHistory {
  id: string;
  version: number;
  publishedAt: string;
  publishedBy: string;
  sectionsCount: number;
  config: SDUIConfig;
}
