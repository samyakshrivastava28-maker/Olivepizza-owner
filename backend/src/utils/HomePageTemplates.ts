import { PageSchema, BuiltInPageSchema } from '../types/PageSchema.js';

export const PREDEFINED_TEMPLATES: BuiltInPageSchema[] = [
  {
    versionId: 'v1',
    pageId: 'default',
    type: 'BUILT_IN',
    templateId: 'default',
    metadata: {
      name: 'Default Home',
      description: 'The standard premium Olive Pizza experience.',
      publishedBy: 'system',
      publishedAt: new Date().toISOString()
    },
    sections: [
      {
        id: 'hero',
        type: 'HERO',
        isHidden: false,
        config: {
          headline: 'Olive Pizza',
          subtitle: 'Artisan hand-stretched dough, rich San Marzano sauce, and 100% pure Fior di Latte mozzarella.',
          animationType: 'Fade Up',
          buttonText: 'EXPLORE MENU',
          buttonAction: { type: 'OPEN_MENU' }
        }
      },
      { id: 'cravings', type: 'CRAVINGS', isHidden: false, config: { headline: "WHAT'S YOUR CRAVING FOR?", subtitle: "Explore our freshly handcrafted artisan creations." } },
      { id: 'ads', type: 'ADS', isHidden: false, config: {} },
      { id: 'coupons', type: 'COUPONS', isHidden: false, config: {} },
      { id: 'featured', type: 'FEATURED', isHidden: false, config: {} },
      { id: 'app', type: 'DOWNLOAD_APP', isHidden: false, config: {} },
      { id: 'testimonials', type: 'TESTIMONIALS', isHidden: false, config: {} }
    ]
  },
  {
    versionId: 'v1',
    pageId: 'diwali',
    type: 'BUILT_IN',
    templateId: 'diwali',
    metadata: {
      name: 'Diwali Special',
      description: 'Festive vibrant layout for Diwali offers.',
      publishedBy: 'system',
      publishedAt: new Date().toISOString()
    },
    sections: [
      {
        id: 'diwali_hero',
        type: 'VIDEO_HERO',
        isHidden: false,
        config: {
          headline: 'Happy Diwali!',
          subtitle: 'Light up your celebrations with 50% OFF.',
          animationType: 'Pop',
          buttonText: 'GRAB OFFER',
          buttonAction: { type: 'OPEN_OFFERS' },
          styleOverrides: { backgroundColor: '#431407', textColor: '#fef08a' }
        }
      },
      { id: 'coupons', type: 'COUPONS', isHidden: false, config: {} },
      {
        id: 'pizza_showcase',
        type: 'PIZZA_SHOWCASE',
        isHidden: false,
        config: {
          headline: 'Festive Combos',
          animationType: 'Slide'
        }
      }
    ]
  },
  {
    versionId: 'v1',
    pageId: 'holi',
    type: 'BUILT_IN',
    templateId: 'holi',
    metadata: {
      name: 'Holi Colors',
      description: 'Colorful splashes for the Holi festival.',
      publishedBy: 'system',
      publishedAt: new Date().toISOString()
    },
    sections: [
      {
        id: 'holi_hero',
        type: 'HERO',
        isHidden: false,
        config: {
          headline: 'A Splash of Flavor!',
          subtitle: 'Celebrate Holi with our colorful new toppings.',
          animationType: 'Floating',
          buttonText: 'VIEW MENU',
          buttonAction: { type: 'OPEN_MENU' },
          styleOverrides: { backgroundColor: '#ec4899', textColor: '#ffffff' }
        }
      },
      { id: 'featured', type: 'FEATURED', isHidden: false, config: {} }
    ]
  },
  {
    versionId: 'v1',
    pageId: 'cricket',
    type: 'BUILT_IN',
    templateId: 'cricket',
    metadata: {
      name: 'Cricket Match Day',
      description: 'Dynamic banner for match day ordering.',
      publishedBy: 'system',
      publishedAt: new Date().toISOString()
    },
    sections: [
      {
        id: 'match_banner',
        type: 'COUNTDOWN',
        isHidden: false,
        config: {
          headline: 'Match Starts In:',
          animationType: 'Stagger',
          styleOverrides: { backgroundColor: '#1e3a8a', textColor: '#ffffff' }
        }
      },
      {
        id: 'hero',
        type: 'HERO',
        isHidden: false,
        config: {
          headline: 'Game On, Pizza On!',
          subtitle: 'Order before the first ball.',
          buttonText: 'ORDER NOW',
          buttonAction: { type: 'OPEN_MENU' }
        }
      },
      { id: 'coupons', type: 'COUPONS', isHidden: false, config: {} }
    ]
  },
  {
    versionId: 'v1',
    pageId: 'weekend',
    type: 'BUILT_IN',
    templateId: 'weekend',
    metadata: {
      name: 'Weekend Special',
      description: 'High conversion layout for weekend spikes.',
      publishedBy: 'system',
      publishedAt: new Date().toISOString()
    },
    sections: [
      {
        id: 'hero',
        type: 'HERO',
        isHidden: false,
        config: {
          headline: 'Weekend Pizza Offer',
          subtitle: 'BOGO on all large pizzas this weekend only!',
          animationType: 'Slide',
          buttonText: 'CLAIM BOGO',
          buttonAction: { type: 'OPEN_OFFERS' }
        }
      },
      {
        id: 'gallery',
        type: 'GALLERY',
        isHidden: false,
        config: {
          headline: 'Trending This Weekend'
        }
      }
    ]
  }
];

export const getTemplateById = (pageId: string): BuiltInPageSchema | undefined => {
  return PREDEFINED_TEMPLATES.find(t => t.pageId === pageId);
};
