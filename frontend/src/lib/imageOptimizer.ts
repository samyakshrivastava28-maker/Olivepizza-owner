/**
 * Image Optimizer Utility for Olive Pizza
 * Formats Cloudinary, Unsplash, and Firebase Storage URLs for optimal performance:
 * - Automatic modern format (f_auto -> webp/avif)
 * - Intelligent quality compression (q_auto)
 * - Responsive width scaling (w_{size})
 */

export function getOptimizedImageUrl(
  url?: string | null,
  options?: {
    width?: number;
    height?: number;
    quality?: 'auto' | 'auto:good' | 'auto:eco' | 'auto:low' | number;
    crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  }
): string {
  if (!url || typeof url !== 'string') {
    return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80';
  }

  // 1. Cloudinary URLs
  if (url.includes('res.cloudinary.com')) {
    // Already contains transformations
    if (url.includes('/upload/f_auto,') || url.includes('/upload/w_')) {
      return url;
    }

    const { width = 500, quality = 'auto', crop = 'fill' } = options || {};
    const transforms = ['f_auto', 'q_' + quality, 'w_' + width, 'c_' + crop].join(',');

    return url.replace('/upload/', '/upload/' + transforms + '/');
  }

  // 2. Unsplash URLs
  if (url.includes('images.unsplash.com')) {
    const { width = 500 } = options || {};
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.set('w', width.toString());
      parsedUrl.searchParams.set('auto', 'format');
      parsedUrl.searchParams.set('fit', 'crop');
      parsedUrl.searchParams.set('q', '80');
      return parsedUrl.toString();
    } catch {
      return url;
    }
  }

  return url;
}
