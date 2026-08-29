export type PageType = 'BUILT_IN' | 'CUSTOM_SCHEMA' | 'CUSTOM_STATIC_PACKAGE';

export interface BasePageSchema {
  versionId: string; // e.g., v1
  pageId: string; // Used to identify the template collection it belongs to
  type: PageType;
  metadata: {
    name: string;
    description: string;
    publishedBy: string; // uid
    publishedAt: string; // ISO string
    hash?: string;
  };
}

export interface BuiltInPageSchema extends BasePageSchema {
  type: 'BUILT_IN';
  templateId: string;
  sections: SimplifiedSectionSchema[];
}

export interface CustomSchemaPageSchema extends BasePageSchema {
  type: 'CUSTOM_SCHEMA';
  sections: SimplifiedSectionSchema[];
}

export interface CustomStaticPackageSchema extends BasePageSchema {
  type: 'CUSTOM_STATIC_PACKAGE';
  r2Url: string;
  entryFile: string;
}

export type PageSchema = BuiltInPageSchema | CustomSchemaPageSchema | CustomStaticPackageSchema;

export type SectionType = 
  | 'HERO' 
  | 'CATEGORIES' 
  | 'CRAVINGS'
  | 'CRAVING_CATEGORIES'
  | 'COUPONS' 
  | 'ADS' 
  | 'RECOMMENDATIONS' 
  | 'DOWNLOAD_APP' 
  | 'FEATURED'
  | 'VIDEO_HERO'
  | 'PIZZA_SHOWCASE'
  | 'TESTIMONIALS'
  | 'COUNTDOWN'
  | 'GALLERY'
  | 'ORDER_AGAIN'
  | 'COMPLETE_MEAL';

export type AnimationType = 'None' | 'Fade' | 'Fade Up' | 'Fade Down' | 'Slide' | 'Scale' | 'Pop' | 'Floating' | 'Stagger';

export interface SimplifiedSectionSchema {
  id: string;
  type: SectionType;
  isHidden: boolean;
  config: {
    headline?: string;
    subtitle?: string;
    buttonText?: string;
    buttonAction?: ActionPayload;
    mediaUrl?: string; // Cloudinary URL
    animationType?: AnimationType;
    styleOverrides?: {
      backgroundColor?: string;
      textColor?: string;
      paddingY?: 'none' | 'small' | 'medium' | 'large';
    };
    [key: string]: any; // Allow other specific config
  };
}

export type ApprovedActionType = 
  | 'OPEN_MENU'
  | 'OPEN_CART'
  | 'ADD_TO_CART'
  | 'OPEN_CHECKOUT'
  | 'LOGIN'
  | 'OPEN_OFFERS'
  | 'OPEN_PROFILE'
  | 'EXTERNAL_LINK';

export interface ActionPayload {
  type: ApprovedActionType;
  url?: string;
  productId?: string;
}
