
import React, { useState, useEffect } from 'react';

interface RotatingLoaderProps {
  images: string[];
  interval?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const RotatingLoader: React.FC<RotatingLoaderProps> = ({ images, interval = 200, className = "", size = 'md' }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length === 0) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, interval);
    return () => clearInterval(timer);
  }, [images.length, interval]);

  if (images.length === 0) {
     return (
        <div className={`flex items-center justify-center bg-gray-700 animate-pulse border-2 border-gray-600 ${className} ${size === 'sm' ? 'h-full w-full' : 'h-32 w-32'}`}>
             <span className="text-gray-500 font-bold animate-bounce text-2xl">?</span>
        </div>
     );
  }

  return (
    <div className={`relative overflow-hidden border-2 border-gray-600 bg-gray-900 ${className} ${size === 'sm' ? 'h-full w-full' : 'h-32 w-32'}`}>
        <img 
            src={images[index]} 
            alt="Loading..." 
            className="w-full h-full object-contain pixel-art opacity-60 grayscale" 
            style={{imageRendering: 'pixelated'}}
        />
        <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-1/2 h-1/2 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
    </div>
  );
};

export default RotatingLoader;
