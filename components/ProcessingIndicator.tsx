import { cn } from '@/lib/utils';
import { ProcessingStatus } from '@/lib/types';

interface ProcessingIndicatorProps {
  status: ProcessingStatus;
  className?: string;
}

export default function ProcessingIndicator({ status, className }: ProcessingIndicatorProps) {
  if (!status.isProcessing && !status.error) {
    return null;
  }

  return (
    <div className={cn("bg-white rounded-lg border shadow-sm p-4", className)}>
      {status.error ? (
        <div className="flex items-center space-x-3 text-red-600">
          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <div className="font-medium">Processing Error</div>
            <div className="text-sm text-red-500">{status.error}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <div>
              <div className="font-medium text-gray-900">{status.currentStep}</div>
              <div className="text-sm text-gray-500">
                {Math.round(status.progress * 100)}% complete
              </div>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${status.progress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}