import { useState } from 'react';
import { X, Eye, RotateCcw, ArrowUp, ArrowDown } from 'lucide-react';
import { ImageData } from '@/lib/types';
import { cn, formatFileSize } from '@/lib/utils';

interface ImageGridProps {
  images: ImageData[];
  onRemoveImage: (id: string) => void;
  onReorderImages: (fromIndex: number, toIndex: number) => void;
  onRetryAlignment: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function ImageGrid({
  images,
  onRemoveImage,
  onReorderImages,
  onRetryAlignment,
  disabled = false,
  className
}: ImageGridProps) {
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Helper function to safely get image status (fallback for existing images)
  const getImageStatus = (image: ImageData): 'pending' | 'processing' | 'aligned' | 'failed' => {
    if (image.status) return image.status;
    return image.aligned ? 'aligned' : 'pending';
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      onReorderImages(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < images.length - 1) {
      onReorderImages(index, index + 1);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (disabled || draggedIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (disabled || draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    onReorderImages(draggedIndex, dropIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (images.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <p className="text-gray-500">No images uploaded yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Uploaded Images ({images.length})
        </h3>
        
        <div className="text-right">
          <div className="text-sm text-gray-500">
            {images.filter(img => getImageStatus(img) === 'aligned').length} aligned, {' '}
            {images.filter(img => getImageStatus(img) === 'processing').length} processing, {' '}
            {images.filter(img => getImageStatus(img) === 'failed').length} failed, {' '}
            {images.filter(img => getImageStatus(img) === 'pending').length} pending
          </div>
          {images.length > 1 && (
            <div className="text-xs text-gray-400 mt-1">
              Drag to reorder • Use arrows to adjust
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            draggable={!disabled}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "relative group bg-white rounded-lg shadow-sm border-2 transition-all duration-200",
              "hover:shadow-md hover:scale-105",
              {
                "border-green-300 bg-green-50": getImageStatus(image) === 'aligned',
                "border-blue-300 bg-blue-50": getImageStatus(image) === 'processing',
                "border-orange-300 bg-orange-50": getImageStatus(image) === 'pending',
                "border-red-300 bg-red-50": getImageStatus(image) === 'failed',
                "opacity-50": disabled,
                "opacity-60 transform scale-95": draggedIndex === index,
                "border-blue-400 border-dashed bg-blue-50": dragOverIndex === index && draggedIndex !== index,
                "cursor-move": !disabled,
                "cursor-not-allowed": disabled,
              }
            )}
          >
            {/* Image Preview */}
            <div className="aspect-square relative overflow-hidden rounded-t-lg">
              <img
                src={image.processedUrl || image.url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
                onClick={() => setSelectedImage(image)}
              />
              
              {/* Status Indicator */}
              <div className={cn(
                "absolute top-2 left-2 w-3 h-3 rounded-full",
                {
                  "bg-green-500": getImageStatus(image) === 'aligned',
                  "bg-blue-500 animate-pulse": getImageStatus(image) === 'processing',
                  "bg-orange-500": getImageStatus(image) === 'pending',
                  "bg-red-500": getImageStatus(image) === 'failed',
                }
              )} />
              
              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                  <button
                    onClick={() => setSelectedImage(image)}
                    className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  
                  {(getImageStatus(image) === 'failed' || getImageStatus(image) === 'pending') && (
                    <button
                      onClick={() => onRetryAlignment(image.id)}
                      disabled={disabled}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                      title={getImageStatus(image) === 'failed' ? 'Retry Failed Alignment' : 'Retry Alignment'}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Image Info */}
            <div className="p-3 space-y-2">
              <div className="text-xs text-gray-600 truncate">
                {image.file.name}
              </div>
              
              <div className="text-xs text-gray-500">
                {formatFileSize(image.file.size)}
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "text-xs font-medium",
                    {
                      "text-green-600": getImageStatus(image) === 'aligned',
                      "text-blue-600": getImageStatus(image) === 'processing',
                      "text-orange-600": getImageStatus(image) === 'pending',
                      "text-red-600": getImageStatus(image) === 'failed',
                    }
                  )}>
                    {getImageStatus(image) === 'aligned' && 'Aligned'}
                    {getImageStatus(image) === 'processing' && 'Processing...'}
                    {getImageStatus(image) === 'pending' && 'Pending'}
                    {getImageStatus(image) === 'failed' && 'Failed'}
                  </div>
                  
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={disabled || index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={disabled || index === images.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                {/* Confidence and Processing Time */}
                {getImageStatus(image) === 'aligned' && (
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    {image.alignmentConfidence !== undefined && (
                      <div title="Alignment quality confidence">
                        Conf: {(image.alignmentConfidence * 100).toFixed(0)}%
                      </div>
                    )}
                    {image.processingTime !== undefined && (
                      <div title="Processing time">
                        {image.processingTime < 1000 
                          ? `${Math.round(image.processingTime)}ms`
                          : `${(image.processingTime / 1000).toFixed(1)}s`
                        }
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Remove Button */}
            <button
              onClick={() => onRemoveImage(image.id)}
              disabled={disabled}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
              title="Remove Image"
            >
              <X className="w-3 h-3" />
            </button>

            {/* Processing Indicator */}
            {getImageStatus(image) === 'processing' && (
              <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center rounded-lg">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            )}

            {/* Failed Indicator with Error Message */}
            {getImageStatus(image) === 'failed' && image.error && (
              <div 
                className="absolute inset-0 bg-red-50 bg-opacity-95 flex items-center justify-center rounded-lg p-2"
                title={image.error}
              >
                <div className="text-center">
                  <div className="text-red-600 text-lg mb-1">⚠</div>
                  <div className="text-xs text-red-700 leading-tight">
                    {image.error.split('.')[0]}...
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl max-h-full overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {selectedImage.file.name}
              </h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <img
                src={selectedImage.processedUrl || selectedImage.url}
                alt="Preview"
                className="w-full h-auto max-h-96 object-contain"
              />
              
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <div>Size: {formatFileSize(selectedImage.file.size)}</div>
                <div>Status: {getImageStatus(selectedImage).charAt(0).toUpperCase() + getImageStatus(selectedImage).slice(1)}</div>
                {selectedImage.error && (
                  <div className="text-red-600 bg-red-50 p-2 rounded text-xs">
                    <strong>Error:</strong> {selectedImage.error}
                  </div>
                )}
                {selectedImage.eyePoints && (
                  <div>
                    Eye Points: Left({selectedImage.eyePoints.left[0].toFixed(0)}, {selectedImage.eyePoints.left[1].toFixed(0)}), 
                    Right({selectedImage.eyePoints.right[0].toFixed(0)}, {selectedImage.eyePoints.right[1].toFixed(0)})
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}