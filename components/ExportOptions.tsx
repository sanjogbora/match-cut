import { useState, useRef } from 'react';
import { Download, Settings, Volume2, VolumeX, Upload, Play, Pause } from 'lucide-react';
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

            {/* Audio Settings */}
            <div className="space-y-4">
              {settings.format === 'gif' && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-500">
                    <VolumeX className="w-4 h-4" />
                    <span className="text-sm font-medium">Audio Settings</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Audio is only available for MP4 format. Switch to MP4 to add sound effects.
                  </p>
                </div>
              )}
              
              {settings.format === 'mp4' && (
                <div className="space-y-4">
                  <h5 className="font-medium text-gray-900 flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    Audio Settings
                  </h5>
                
                {/* Enable Audio */}
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
                      Add Sound Effects
                    </span>
                  </label>
                </div>

                {/* Audio Options */}
                {settings.addSound && (
                  <div className="space-y-4 ml-6 pl-4 border-l-2 border-gray-200">
                    {/* Sound Type Selection */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Sound Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleSettingChange('soundType', 'builtin')}
                          disabled={disabled}
                          className={cn(
                            "px-3 py-2 border rounded-lg text-sm font-medium transition-all",
                            "hover:border-blue-300 disabled:opacity-50",
                            {
                              "border-blue-500 bg-blue-50 text-blue-700": settings.soundType === 'builtin',
                              "border-gray-200 text-gray-700": settings.soundType !== 'builtin',
                            }
                          )}
                        >
                          Built-in
                        </button>
                        <button
                          onClick={() => handleSettingChange('soundType', 'custom')}
                          disabled={disabled}
                          className={cn(
                            "px-3 py-2 border rounded-lg text-sm font-medium transition-all",
                            "hover:border-blue-300 disabled:opacity-50",
                            {
                              "border-blue-500 bg-blue-50 text-blue-700": settings.soundType === 'custom',
                              "border-gray-200 text-gray-700": settings.soundType !== 'custom',
                            }
                          )}
                        >
                          Custom
                        </button>
                      </div>
                    </div>

                    {/* Built-in Sound Selection */}
                    {settings.soundType === 'builtin' && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Built-in Sound
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['click', 'shutter', 'pop'] as const).map((sound) => (
                            <button
                              key={sound}
                              onClick={() => handleSettingChange('builtinSound', sound)}
                              disabled={disabled}
                              className={cn(
                                "px-2 py-1 border rounded text-xs font-medium transition-all",
                                "hover:border-blue-300 disabled:opacity-50",
                                {
                                  "border-blue-500 bg-blue-50 text-blue-700": settings.builtinSound === sound,
                                  "border-gray-200 text-gray-700": settings.builtinSound !== sound,
                                }
                              )}
                            >
                              {sound.charAt(0).toUpperCase() + sound.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom Audio Upload */}
                    {settings.soundType === 'custom' && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Upload Audio File
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleSettingChange('customAudioFile', file);
                              }
                            }}
                            disabled={disabled}
                            className="hidden"
                            id="audio-upload"
                          />
                          <label
                            htmlFor="audio-upload"
                            className={cn(
                              "flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer",
                              "hover:border-blue-300 transition-colors disabled:opacity-50",
                              disabled && "cursor-not-allowed"
                            )}
                          >
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">
                              {settings.customAudioFile ? settings.customAudioFile.name : 'Choose file'}
                            </span>
                          </label>
                        </div>
                        <p className="text-xs text-gray-500">
                          Supports MP3, WAV, OGG files
                        </p>
                      </div>
                    )}

                    {/* Volume Control */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Volume: <span className="text-blue-600 font-semibold">{Math.round(settings.audioVolume * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.audioVolume}
                        onChange={(e) => handleSettingChange('audioVolume', parseFloat(e.target.value))}
                        disabled={disabled}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>
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