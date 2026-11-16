import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { CATEGORY_IMAGES, ImageKey } from '../types/hub';

interface ProductImageProps {
  imageKey: ImageKey;
  imageUrl?: string;
  alt: string;
  className?: string;
}

export function ProductImage({ imageKey, imageUrl, alt, className = '' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageKey, imageUrl]);

  const trimmedUrl = imageUrl?.trim();
  const src = trimmedUrl || CATEGORY_IMAGES[imageKey] || CATEGORY_IMAGES.trigger_sprayer;

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 ${className}`}
        aria-label={alt}
      >
        <Package className="w-6 h-6 mb-1 text-slate-400" />
        <span className="text-[11px] font-medium px-2 text-center truncate max-w-full">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover bg-slate-100 ${className}`}
    />
  );
}
