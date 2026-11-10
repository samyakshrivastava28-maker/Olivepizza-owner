/**
 * Helper functions to generate Schema.org JSON-LD structured data.
 * Validates against Google's Rich Results Guidelines.
 */

const BASE_URL = 'https://olivepizza.com'; // Replace with actual domain
const LOGO_URL = `${BASE_URL}/icons/icon-512x512.webp`;

export const generateRestaurantSchema = () => {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": "Olive Pizza",
    "image": [
      LOGO_URL,
      `${BASE_URL}/og-image.jpg`
    ],
    "@id": BASE_URL,
    "url": BASE_URL,
    "telephone": "+1-555-019-2834", // Placeholder
    "priceRange": "$$",
    "menu": `${BASE_URL}/menu`,
    "servesCuisine": "Pizza, Italian",
    "acceptsReservations": "False",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Pizza Lane",
      "addressLocality": "New York",
      "addressRegion": "NY",
      "postalCode": "10001",
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
        ],
        "opens": "11:00",
        "closes": "23:00"
      }
    ],
    "potentialAction": {
      "@type": "OrderAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${BASE_URL}/menu`,
        "inLanguage": "en-US",
        "actionPlatform": [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/IOSPlatform",
          "http://schema.org/AndroidPlatform"
        ]
      },
      "deliveryMethod": ["http://purl.org/goodrelations/v1#DeliveryModeOwnFleet"]
    }
  };
};

export const generateProductSchema = (product: any) => {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": product.image || LOGO_URL,
    "description": product.description || `Delicious ${product.name} from Olive Pizza.`,
    "sku": product.id,
    "brand": {
      "@type": "Brand",
      "name": "Olive Pizza"
    },
    "offers": {
      "@type": "Offer",
      "url": `${BASE_URL}/menu/product/${product.id}`,
      "priceCurrency": "USD", // Adjust to actual currency
      "price": product.offerPrice || product.basePrice || "0.00",
      "priceValidUntil": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      "itemCondition": "https://schema.org/NewCondition",
      "availability": product.isAvailable !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };
};

export const generateFAQSchema = (faqs: { question: string; answer: string }[]) => {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
};

export const generateBreadcrumbSchema = (items: { name: string; url: string }[]) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `${BASE_URL}${item.url}`
    }))
  };
};
