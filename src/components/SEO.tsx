import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  schemaMarkup?: object | object[];
  image?: string;
  type?: string;
  breadcrumbs?: Array<{name: string; url: string}>;
}

const DEFAULT_TITLE = 'Olive Pizza | Premium Pizza Delivery';
const DEFAULT_DESCRIPTION = 'Experience the best artisan pizza delivered hot and fresh to your door. Olive Pizza offers premium ingredients, fast delivery, and unforgettable taste.';
const BASE_URL = 'https://olivepizza.com'; // Replace with actual domain
const DEFAULT_IMAGE = `${BASE_URL}/og-image.jpg`;

export default function SEO({ 
  title, 
  description, 
  canonicalUrl, 
  schemaMarkup,
  image = DEFAULT_IMAGE,
  type = 'website',
  breadcrumbs
}: SEOProps) {
  const fullTitle = title ? `${title} | Olive Pizza` : DEFAULT_TITLE;
  const metaDescription = description || DEFAULT_DESCRIPTION;
  const url = canonicalUrl ? `${BASE_URL}${canonicalUrl}` : BASE_URL;

  // Organization Schema
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "name": "Olive Pizza",
    "image": DEFAULT_IMAGE,
    "url": BASE_URL,
    "telephone": "+1234567890",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Pizza Street",
      "addressLocality": "Foodville",
      "addressRegion": "Taste State",
      "postalCode": "12345",
      "addressCountry": "US"
    },
    "servesCuisine": "Pizza",
    "priceRange": "$$"
  };

  // WebPage Schema
  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": fullTitle,
    "description": metaDescription,
    "url": url,
    "publisher": {
      "@type": "Organization",
      "name": "Olive Pizza"
    }
  };

  const breadcrumbSchema = breadcrumbs ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": `${BASE_URL}${crumb.url}`
    }))
  } : null;

  const schemas: any[] = [orgSchema, webPageSchema];
  if (breadcrumbSchema) schemas.push(breadcrumbSchema);
  if (schemaMarkup) {
    if (Array.isArray(schemaMarkup)) {
      schemas.push(...schemaMarkup);
    } else {
      schemas.push(schemaMarkup);
    }
  }

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={metaDescription} />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={metaDescription} />
      <meta property="twitter:image" content={image} />

      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(schemas)}
      </script>
    </Helmet>
  );
}
