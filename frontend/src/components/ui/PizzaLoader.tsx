import React from 'react';
import { Pizza } from 'lucide-react';

interface PizzaLoaderProps {
  text?: string;
  size?: 'inline' | 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  className?: string;
  overlayClassName?: string;
}

export const PizzaLoader: React.FC<PizzaLoaderProps> = ({ 
  text = 'Loading...', 
  size = 'medium',
  fullScreen = false,
  className = '',
  overlayClassName = ''
}) => {
  const sizeClasses = {
    inline: 'w-5 h-5',
    small: 'w-10 h-10',
    medium: 'w-16 h-16',
    large: 'w-24 h-24'
  };

  const loaderContent = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 animate-bounce shadow-lg shadow-orange-500/20">
          <Pizza className="w-6 h-6 animate-pulse" />
        </div>
      </div>
      
      {text && (
        <p className="text-xs font-bold text-orange-400 tracking-wider uppercase animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F17]/90 backdrop-blur-md ${overlayClassName}`}>
        {loaderContent}
      </div>
    );
  }

  return (
    <div className={`flex w-full min-h-[160px] items-center justify-center ${overlayClassName}`}>
      {loaderContent}
    </div>
  );
};

export default PizzaLoader;
