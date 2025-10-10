import { useCallback, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onImagesUpload: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export default function ImageUpload({ 
  onImagesUpload, 
  maxFiles = 200, 
  disabled = false,
  className 
}: ImageUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragReject, setIsDragReject] = useState(false);

  const validateFiles = useCallback((files: FileList) => {
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        if (file.size <= 10 * 1024 * 1024) { // 10MB limit
          validFiles.push(file);
        } else {
          invalidFiles.push(`${file.name} (too large)`);
        }
      } else {
        invalidFiles.push(`${file.name} (not an image)`);
      }
    });

    if (validFiles.length > maxFiles) {
      invalidFiles.push(`Only first ${maxFiles} files will be processed`);
      return validFiles.slice(0, maxFiles);
    }

    if (invalidFiles.length > 0) {
      console.warn('Some files were rejected:', invalidFiles);
    }

    return validFiles;
  }, [maxFiles]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    setIsDragReject(false);

    if (disabled) return;

    const files = validateFiles(e.dataTransfer.files);
    if (files.length > 0) {
      onImagesUpload(files);
    }
  }, [disabled, onImagesUpload, validateFiles]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    
    const hasImages = Array.from(e.dataTransfer.items).some(
      item => item.type.startsWith('image/')
    );
    
    setIsDragActive(hasImages);
    setIsDragReject(!hasImages);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    setIsDragReject(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || disabled) return;
    
    const files = validateFiles(e.target.files);
    if (files.length > 0) {
      onImagesUpload(files);
    }
    
    // Reset input
    e.target.value = '';
  }, [disabled, onImagesUpload, validateFiles]);

  return (
    <div className={cn("w-full", className)}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200",
          "hover:border-blue-400 hover:bg-blue-50/50",
          {
            "border-gray-300 bg-gray-50": !isDragActive && !isDragReject,
            "border-blue-500 bg-blue-50": isDragActive,
            "border-red-500 bg-red-50": isDragReject,
            "opacity-50 cursor-not-allowed": disabled,
            "cursor-pointer": !disabled,
          }
        )}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        <div className="flex flex-col items-center space-y-4">
          <div className={cn(
            "mx-auto w-12 h-12 rounded-full flex items-center justify-center",
            "bg-blue-100 text-blue-600",
            { "bg-red-100 text-red-600": isDragReject }
          )}>
            {isDragReject ? (
              <X className="w-6 h-6" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>
          
          <div className="space-y-2">
            <p className="text-lg font-medium text-gray-900">
              {isDragActive && "Drop images here"}
              {isDragReject && "Only image files are allowed"}
              {!isDragActive && !isDragReject && "Upload Images"}
            </p>
            
            <p className="text-sm text-gray-500">
              Drag & drop or click to select images
            </p>
            
            <p className="text-xs text-gray-400">
              Supports JPG, PNG, GIF up to 10MB each (max {maxFiles} files)
            </p>
          </div>
        </div>
      </div>
      
      {!disabled && (
        <div className="mt-4 text-center">
          <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
            <ImageIcon className="w-4 h-4 mr-2" />
            Choose Files
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>
      )}
    </div>
  );
}