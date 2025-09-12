import { useState } from 'react';
import { Download, Settings, Volume2, VolumeX } from 'lucide-react';
import { ExportSettings, VideoExportProgress } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ExportOptionsProps {
  settings: ExportSettings;
  onSettingsChange: (settings: ExportSettings) => void;
  onExport: () => void;
  isExporting: boolean;
  exportProgress?: VideoExportProgress;
  disabled?: boolean;
  className?: string;
}

export default function ExportOptions({
  settings,
  onSettingsChange,
  onExport,
  isExporting,
  exportProgress,
  disabled = false,
  className
}: ExportOptionsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSettingChange = <K extends keyof ExportSettings>(
    key: K,
    value: ExportSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  return (
    <div className={cn("bg-white rounded-lg border shadow-sm", className)}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Export Options</h3>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
            title="Advanced Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Format Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Output Format
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSettingChange('format', 'gif')}
              disabled={disabled}
              className={cn(
                "p-3 border-2 rounded-lg text-left transition-all",
                "hover:border-blue-300 disabled:opacity-50",
                {
                  "border-blue-500 bg-blue-50": settings.format === 'gif',
                  "border-gray-200": settings.format !== 'gif',
                }
              )}
            >
              <div className="font-medium">GIF</div>
              <div className="text-sm text-gray-500">
                Widely compatible, smaller file size
              </div>
            </button>
            
            <button
              onClick={() => handleSettingChange('format', 'mp4')}
              disabled={disabled}
              className={cn(
                "p-3 border-2 rounded-lg text-left transition-all",
                "hover:border-blue-300 disabled:opacity-50",
                {
                  "border-blue-500 bg-blue-50": settings.format === 'mp4',
                  "border-gray-200": settings.format !== 'mp4',
                }
              )}
            >
              <div className="font-medium">MP4</div>
              <div className="text-sm text-gray-500">
                Higher quality, better compression
              </div>
            </button>
          </div>
        </div>

        {/* Resolution Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Resolution
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['480p', '720p', '1080p'] as const).map((resolution) => (
              <button
                key={resolution}
                onClick={() => handleSettingChange('resolution', resolution)}
                disabled={disabled}
                className={cn(
                  "px-3 py-2 border rounded-lg text-sm font-medium transition-all",
                  "hover:border-blue-300 disabled:opacity-50",
                  {
                    "border-blue-500 bg-blue-50 text-blue-700": settings.resolution === resolution,
                    "border-gray-200 text-gray-700": settings.resolution !== resolution,
                  }
                )}
              >
                {resolution}
              </button>
            ))}
          </div>
        </div>

        {/* Frame Duration */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Frame Duration: <span className="text-blue-600 font-semibold">{settings.frameDuration}s</span>
          </label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={settings.frameDuration}
            onChange={(e) => handleSettingChange('frameDuration', parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 slider-blue"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0.1s (Fast)</span>
            <span>3s (Slow)</span>
          </div>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium text-gray-900">Advanced Options</h4>
            
            {/* Loop Option */}
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.loop}
                  onChange={(e) => handleSettingChange('loop', e.target.checked)}
                  disabled={disabled}
                  className="rounded border-gray-300 text-blue-600 disabled:opacity-50"
                />
                <span className="text-sm font-medium text-gray-700">
                  Loop Animation
                </span>
              </label>
            </div>

            {/* Sound Option (MP4 only) */}
            {settings.format === 'mp4' && (
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.addSound}
                    onChange={(e) => handleSettingChange('addSound', e.target.checked)}
                    disabled={disabled}
                    className="rounded border-gray-300 text-blue-600 disabled:opacity-50"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Add Click Sound
                  </span>
                </label>
                
                <div className="text-gray-400">
                  {settings.addSound ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export Progress */}
        {isExporting && exportProgress && (
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">
                {exportProgress.phase === 'preparing' && 'Preparing frames...'}
                {exportProgress.phase === 'encoding' && 'Encoding video...'}
                {exportProgress.phase === 'finalizing' && 'Finalizing export...'}
                {exportProgress.phase === 'complete' && 'Export complete!'}
              </span>
              <span className="text-sm text-blue-700">
                {Math.round(exportProgress.progress * 100)}%
              </span>
            </div>
            
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${exportProgress.progress * 100}%` }}
              />
            </div>
            
            {exportProgress.frameCount && exportProgress.currentFrame && (
              <div className="text-xs text-blue-700 text-center">
                Frame {exportProgress.currentFrame} of {exportProgress.frameCount}
              </div>
            )}
          </div>
        )}

        {/* Export Button */}
        <button
          onClick={onExport}
          disabled={disabled || isExporting}
          className={cn(
            "w-full flex items-center justify-center space-x-2 px-4 py-3",
            "bg-blue-600 text-white rounded-lg font-medium transition-all",
            "hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>Export {settings.format.toUpperCase()}</span>
            </>
          )}
        </button>

        {/* Export Info */}
        <div className="text-xs text-gray-500 text-center space-y-1">
          <div>
            Format: {settings.format.toUpperCase()} • Resolution: {settings.resolution}
          </div>
          <div>
            Frame Duration: {settings.frameDuration}s • Loop: {settings.loop ? 'Yes' : 'No'}
          </div>
          {settings.format === 'mp4' && (
            <div>
              Audio: {settings.addSound ? 'Click sounds' : 'Silent'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}