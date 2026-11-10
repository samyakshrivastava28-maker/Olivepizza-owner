import { useState, useEffect } from 'react';

export type ScreenCategory = 
  | 'small-phone'   // 320px - 360px
  | 'standard-phone'// 361px - 430px
  | 'large-phone'   // 431px - 480px
  | 'foldable'       // 481px - 767px (or open fold 884px)
  | 'tablet-portrait'// 768px - 820px
  | 'tablet-landscape'// 821px - 1024px
  | 'laptop'         // 1025px - 1440px
  | 'desktop';       // 1441px+

export function useViewport() {
  const [width, setWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [height, setHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 800);
  const [isLandscape, setIsLandscape] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  );

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const getCategory = (): ScreenCategory => {
    if (width <= 360) return 'small-phone';
    if (width <= 430) return 'standard-phone';
    if (width <= 480) return 'large-phone';
    if (width <= 767) return 'foldable';
    if (width <= 820) return 'tablet-portrait';
    if (width <= 1024) return 'tablet-landscape';
    if (width <= 1440) return 'laptop';
    return 'desktop';
  };

  return {
    width,
    height,
    isLandscape,
    category: getCategory(),
    isMobile: width < 768,
    isTablet: width >= 768 && width <= 1024,
    isDesktop: width > 1024,
  };
}
