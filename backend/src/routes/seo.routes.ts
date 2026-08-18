import express from 'express';
import { adminDb as db } from '../config/firebase.js';

const router = express.Router();
const BASE_URL = 'https://olivepizza.com'; // Change to actual domain

router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /owner/
Disallow: /delivery/
Disallow: /customer/
Disallow: /cart/
Disallow: /checkout/

Sitemap: ${BASE_URL}/sitemap.xml
`);
});

router.get('/sitemap.xml', async (req, res) => {
  try {
    let urls = [
      '/',
      '/menu',
      '/about',
      '/contact',
      '/faq',
      '/delete-account',
      '/delivery-policy',
      '/privacy-policy',
      '/terms',
      '/refund-policy',
      '/cookie-policy',
      '/cancellation-policy',
      '/accessibility'
    ];

    // Fetch products for dynamic URLs
    const productsSnap = await db.collection('products').where('isActive', '==', true).get();
    productsSnap.forEach((doc) => {
      urls.push(`/menu/product/${doc.id}`);
    });

    // Fetch combos for dynamic URLs
    const combosSnap = await db.collection('combos').where('isActive', '==', true).get();
    combosSnap.forEach((doc) => {
      urls.push(`/menu/product/${doc.id}`);
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.map(url => `
  <url>
    <loc>${BASE_URL}${url}</loc>
    <changefreq>${url === '/' || url === '/menu' ? 'daily' : 'weekly'}</changefreq>
    <priority>${url === '/' ? '1.0' : url === '/menu' ? '0.9' : '0.7'}</priority>
  </url>
  `).join('')}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(sitemap.trim());
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).end();
  }
});

export default router;
