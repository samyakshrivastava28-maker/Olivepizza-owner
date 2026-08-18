import React from 'react';

interface PizzaLoaderProps {
  text?: string;
  size?: 'inline' | 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  className?: string;
  overlayClassName?: string;
}

const PizzaLoader: React.FC<PizzaLoaderProps> = ({ 
  text = 'Preparing something delicious...', 
  size = 'medium',
  fullScreen = false,
  className = '',
  overlayClassName = ''
}) => {
  
  const sizeClasses = {
    inline: 'w-5 h-5',
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32'
  };

  const loaderContent = (
    <div className="flex flex-col items-center justify-center space-y-6">
      <div className={`relative ${sizeClasses[size]} drop-shadow-lg`}>
        <img 
          src="/pizza-loader.gif" 
          alt="Loading..." 
          className="w-full h-full object-contain"
        />
      </div>
      
      {text && (
        <p className="text-primary-600 dark:text-primary-400 font-bold tracking-wide animate-pulse text-lg">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm ${overlayClassName}`}>
        {loaderContent}
      </div>
    );
  }

  if (size === 'inline') {
    return (
      <div className={`inline-flex items-center justify-center ${overlayClassName}`}>
        <div className={`relative ${sizeClasses.inline} animate-spin`} style={{ animationDuration: '2s' }}>
          {/* SVG Pizza Base */}
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="#e2a159" stroke="#b46d24" strokeWidth="4" />
            <circle cx="50" cy="50" r="42" fill="#ffd166" />
            <line x1="50" y1="8" x2="50" y2="92" stroke="#e2a159" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="50" x2="92" y2="50" stroke="#e2a159" strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="20" x2="80" y2="80" stroke="#e2a159" strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="80" x2="80" y2="20" stroke="#e2a159" strokeWidth="2" strokeLinecap="round" />
            <path d="M50 50 L50 0 A 50 50 0 0 1 85.355 14.644 Z" className="animate-pulse" fill="currentColor" style={{ fillOpacity: 0.3 }} />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full h-full min-h-[200px] items-center justify-center ${overlayClassName}`}>
      {loaderContent}
    </div>
  );
};

export { PizzaLoader };
export default PizzaLoader;
