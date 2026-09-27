/**
 * Production-Grade Media Optimization Layer for Olive Pizza Owner Dashboard
 * Supports Cloudinary, Unsplash, and standard image/video URLs:
 * - Dynamic format conversion (f_auto -> AVIF/WebP)
 * - Intelligent visual quality compression (q_auto:good / q_auto:best)
 * - Safe food-preserving cropping (c_limit / c_fill,g_auto)
 * - DPR-aware retina scaling (dpr_auto)
 * - Responsive srcset generation
 * - Cloudinary video optimization (f_auto, q_auto, vc_auto, responsive bitrates)
 * - Video poster extraction at frame 0 (so_0)
 */

export type ImageQuality = 'auto' | 'auto:good' | 'auto:best' | 'auto:eco' | 'auto:low' | number;
export type ImageCrop = 'fill' | 'fit' | 'limit' | 'scale' | 'thumb' | 'pad' | 'crop';
export type ImageGravity = 'auto' | 'center' | 'face' | 'north' | 'south' | 'east' | 'west';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: ImageQuality;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: ImageCrop;
  gravity?: ImageGravity;
  dpr?: 'auto' | number;
  preset?: 'thumbnail' | 'card' | 'detail' | 'banner' | 'hero' | 'avatar';
}

export interface VideoOptimizationOptions {
  width?: number;
  quality?: 'auto' | 'auto:good' | 'auto:best' | 'auto:eco' | 'auto:low';
  format?: 'auto' | 'mp4' | 'webm';
  isMobile?: boolean;
}

const PRESET_CONFIGS: Record<string, Partial<ImageOptimizationOptions>> = {
  thumbnail: { width: 180, height: 180, crop: 'fill', gravity: 'auto', quality: 'auto:good' },
  card: { width: 500, crop: 'fill', gravity: 'auto', quality: 'auto:good' },
  detail: { width: 900, crop: 'limit', quality: 'auto:best' },
  banner: { width: 1200, crop: 'limit', quality: 'auto:good' },
  hero: { width: 1920, crop: 'limit', quality: 'auto:best' },
  avatar: { width: 128, height: 128, crop: 'fill', gravity: 'face', quality: 'auto:good' },
};

const DEFAULT_FALLBACK_IMAGE = '/images/pizza-placeholder.webp';

function isCloudinaryTransformSegment(segment: string): boolean {
  if (!segment) return false;
  return (
    /^[a-z]{1,4}_/.test(segment) ||
    segment.includes(',') ||
    segment.startsWith('f_') ||
    segment.startsWith('q_') ||
    segment.startsWith('w_')
  );
}

function parseCloudinaryUrl(url: string) {
  const match = url.match(/^(https?:\/\/res\.cloudinary\.com\/[^\/]+\/(?:(image|video|raw)\/)?upload\/)(.*)$/);
  if (!match) return null;

  const prefix = match[1];
  const resourceType = (match[2] as 'image' | 'video' | 'raw') || 'image';
  const rest = match[3];

  const parts = rest.split('/');
  let existingTransforms: string[] = [];
  let version = '';
  let publicPathParts: string[] = [];

  let idx = 0;
  if (parts.length > 0 && isCloudinaryTransformSegment(parts[0])) {
    existingTransforms = parts[0].split(',');
    idx = 1;
  }

  if (idx < parts.length && /^v\d+$/.test(parts[idx])) {
    version = parts[idx];
    idx++;
  }

  publicPathParts = parts.slice(idx);
  const publicPath = publicPathParts.join('/');

  return {
    prefix,
    resourceType,
    existingTransforms,
    version,
    publicPath,
  };
}

export function getOptimizedImageUrl(
  url?: string | null,
  options?: ImageOptimizationOptions
): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return DEFAULT_FALLBACK_IMAGE;
  }

  const trimmed = url.trim();

  const effectiveOptions: ImageOptimizationOptions = {
    ...(options?.preset ? PRESET_CONFIGS[options.preset] : {}),
    ...options,
  };

  const {
    width,
    height,
    quality = 'auto:good',
    format = 'auto',
    crop,
    gravity,
    dpr = 'auto',
  } = effectiveOptions;

  if (trimmed.includes('res.cloudinary.com')) {
    const parsed = parseCloudinaryUrl(trimmed);
    if (parsed) {
      const transformTokens: string[] = [];

      transformTokens.push(`f_${format}`);
      transformTokens.push(`q_${quality}`);

      if (dpr) {
        transformTokens.push(`dpr_${dpr}`);
      }

      if (width) transformTokens.push(`w_${width}`);
      if (height) transformTokens.push(`h_${height}`);

      if (crop) {
        transformTokens.push(`c_${crop}`);
        if (gravity && (crop === 'fill' || crop === 'thumb' || crop === 'crop')) {
          transformTokens.push(`g_${gravity}`);
        }
      } else if (width && height) {
        transformTokens.push('c_fill');
        transformTokens.push(`g_${gravity || 'auto'}`);
      } else if (width) {
        transformTokens.push('c_limit');
      }

      const transformString = transformTokens.join(',');
      const versionString = parsed.version ? `${parsed.version}/` : '';
      const normalizedPrefix = parsed.prefix.replace(/\/(video|raw)\/upload\//, '/image/upload/');

      return `${normalizedPrefix}${transformString}/${versionString}${parsed.publicPath}`;
    }
  }

  if (trimmed.includes('images.unsplash.com')) {
    try {
      const parsedUrl = new URL(trimmed);
      if (width) parsedUrl.searchParams.set('w', width.toString());
      if (height) parsedUrl.searchParams.set('h', height.toString());
      parsedUrl.searchParams.set('auto', 'format');
      parsedUrl.searchParams.set('fit', crop === 'fill' ? 'crop' : 'max');
      parsedUrl.searchParams.set('q', quality === 'auto:best' ? '85' : '75');
      return parsedUrl.toString();
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

export function getResponsiveImageSrcSet(
  url?: string | null,
  options?: Omit<ImageOptimizationOptions, 'width'> & {
    widths?: number[];
    sizes?: string;
  }
): {
  src: string;
  srcSet: string;
  sizes: string;
} {
  const widths = options?.widths || [320, 480, 640, 768, 1024, 1280];
  const defaultSizes = options?.sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';

  const defaultSrc = getOptimizedImageUrl(url, {
    ...options,
    width: widths[Math.floor(widths.length / 2)] || 640,
  });

  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com')) {
    return {
      src: defaultSrc,
      srcSet: '',
      sizes: defaultSizes,
    };
  }

  const srcSetEntries = widths.map((w) => {
    const optimized = getOptimizedImageUrl(url, {
      ...options,
      width: w,
    });
    return `${optimized} ${w}w`;
  });

  return {
    src: defaultSrc,
    srcSet: srcSetEntries.join(', '),
    sizes: defaultSizes,
  };
}

export function getOptimizedVideoUrl(
  url?: string | null,
  options?: VideoOptimizationOptions
): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return '';
  }

  const trimmed = url.trim();

  if (trimmed.includes('res.cloudinary.com')) {
    const parsed = parseCloudinaryUrl(trimmed);
    if (parsed) {
      const isMobile = options?.isMobile ?? false;
      const targetWidth = options?.width || (isMobile ? 720 : 1080);
      const quality = options?.quality || 'auto:good';

      const transformTokens = [
        'f_auto',
        `q_${quality}`,
        'vc_auto',
        `w_${targetWidth}`,
        'c_limit',
      ];

      const transformString = transformTokens.join(',');
      const versionString = parsed.version ? `${parsed.version}/` : '';
      const normalizedPrefix = parsed.prefix.replace(/\/(image|raw)\/upload\//, '/video/upload/');

      return `${normalizedPrefix}${transformString}/${versionString}${parsed.publicPath}`;
    }
  }

  return trimmed;
}

export function getVideoPosterUrl(
  url?: string | null,
  options?: { width?: number; quality?: ImageQuality }
): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return DEFAULT_FALLBACK_IMAGE;
  }

  const trimmed = url.trim();

  if (trimmed.includes('res.cloudinary.com')) {
    const parsed = parseCloudinaryUrl(trimmed);
    if (parsed) {
      const width = options?.width || 1200;
      const quality = options?.quality || 'auto:good';

      const transformTokens = ['so_0', 'f_auto', `q_${quality}`, `w_${width}`, 'c_limit'];
      const transformString = transformTokens.join(',');
      const versionString = parsed.version ? `${parsed.version}/` : '';

      const publicPathWithoutExt = parsed.publicPath.replace(/\.(mp4|mov|webm|mkv|avi)$/i, '');
      const posterPath = `${publicPathWithoutExt}.jpg`;

      const normalizedPrefix = parsed.prefix.replace(/\/(raw)\/upload\//, '/video/upload/');

      return `${normalizedPrefix}${transformString}/${versionString}${posterPath}`;
    }
  }

  return DEFAULT_FALLBACK_IMAGE;
}
