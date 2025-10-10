import { useState, useRef } from 'react';
import { Download, Settings, Volume2, VolumeX, Upload, Play, Pause, Music, Zap, Clock } from 'lucide-react';
import { ExportSettings, VideoExportProgress } from '@/lib/types';
import { AudioManager } from '@/lib/audioManager';
import { cn } from '@/lib/utils';

interface ExportOptionsProps {
  settings: ExportSettings;
  onSettingsChange: (settings: ExportSettings) => void;
  onExport: () => void;
  isExporting: boolean;
  exportProgress?: VideoExportProgress;
  audioManager?: AudioManager | null;
  disabled?: boolean;
  className?: string;
}

export default function ExportOptions({
  settings,
  onSettingsChange,
  onExport,
  isExporting,
  exportProgress,
  audioManager,
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
                
                {/* Mutual exclusivity warning */}
                {settings.beatSync.enabled && (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-800 font-medium">
                      🎵 Beat Sync is enabled - Sound effects are disabled
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      Beat sync includes the music file. Disable beat sync to use sound effects instead.
                    </p>
                  </div>
                )}

                {/* Enable Audio */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.addSound}
                      onChange={(e) => handleSettingChange('addSound', e.target.checked)}
                      disabled={disabled || settings.beatSync.enabled}
                      className="rounded border-gray-300 text-blue-600 disabled:opacity-50"
                    />
                    <span className={`text-sm font-medium ${settings.beatSync.enabled ? 'text-gray-400' : 'text-gray-700'}`}>
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

                    {/* Test Audio Button */}
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          if (audioManager) {
                            audioManager.playSoundEffect(
                              settings.soundType,
                              settings.builtinSound,
                              settings.customAudioFile,
                              settings.audioVolume,
                              0.5 // Test with 0.5 second duration
                            );
                          }
                        }}
                        disabled={disabled}
                        className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                      >
                        <Play className="w-4 h-4" />
                        <span>Test Sound</span>
                      </button>
                    </div>
                  </div>
                )}
                </div>
              )}
            </div>

            {/* Beat Sync Section - Revolutionary Feature */}
            <div className="space-y-4 pt-4 border-t border-orange-200">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                  <Zap className="w-3 h-3 text-white" />
                </div>
                <h5 className="font-medium text-gray-900 flex items-center gap-2">
                  <Music className="w-4 h-4 text-orange-600" />
                  Beat Sync (Revolutionary!)
                </h5>
              </div>
              
              <div className="bg-gradient-to-r from-orange-50 to-red-50 p-3 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-800 font-medium mb-1">
                  🎵 Sync your match cuts to music beats!
                </p>
                <p className="text-xs text-orange-700">
                  Upload music → AI detects beats → Images change on every beat with perfect timing
                </p>
              </div>

              {/* Mutual exclusivity warning */}
              {settings.addSound && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 font-medium">
                    🔊 Sound Effects are enabled - Beat sync will override them
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Beat sync includes music. Sound effects will be disabled when beat sync is enabled.
                  </p>
                </div>
              )}

              {/* Enable Beat Sync */}
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.beatSync.enabled}
                    onChange={(e) => {
                      const newEnabled = e.target.checked;
                      handleSettingChange('beatSync', { ...settings.beatSync, enabled: newEnabled });
                      // Auto-disable sound effects when beat sync is enabled
                      if (newEnabled && settings.addSound) {
                        handleSettingChange('addSound', false);
                      }
                    }}
                    disabled={disabled}
                    className="rounded border-gray-300 text-orange-600 disabled:opacity-50"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable Beat Synchronization
                  </span>
                </label>
              </div>

              {/* Beat Sync Options */}
              {settings.beatSync.enabled && (
                <div className="space-y-4 ml-6 pl-4 border-l-2 border-orange-200">
                  {/* Music Upload */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Upload Music Track
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleSettingChange('beatSync', { ...settings.beatSync, musicFile: file });
                          }
                        }}
                        disabled={disabled}
                        className="hidden"
                        id="music-upload"
                      />
                      <label
                        htmlFor="music-upload"
                        className={cn(
                          "flex items-center space-x-2 px-3 py-2 border border-orange-300 rounded-lg cursor-pointer",
                          "hover:border-orange-400 transition-colors disabled:opacity-50 bg-orange-50",
                          disabled && "cursor-not-allowed"
                        )}
                      >
                        <Music className="w-4 h-4 text-orange-600" />
                        <span className="text-sm">
                          {settings.beatSync.musicFile ? settings.beatSync.musicFile.name : 'Choose music file'}
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">
                      Supports MP3, WAV, M4A files. AI will analyze beats automatically.
                    </p>
                  </div>

                  {/* Beat Detection Mode */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Beat Detection Mode
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleSettingChange('beatSync', { ...settings.beatSync, syncMode: 'auto' })}
                        disabled={disabled}
                        className={cn(
                          "px-3 py-2 border rounded-lg text-sm font-medium transition-all",
                          "hover:border-orange-300 disabled:opacity-50",
                          {
                            "border-orange-500 bg-orange-50 text-orange-700": settings.beatSync.syncMode === 'auto',
                            "border-gray-200 text-gray-700": settings.beatSync.syncMode !== 'auto',
                          }
                        )}
                      >
                        Auto Detect
                      </button>
                      <button
                        onClick={() => handleSettingChange('beatSync', { ...settings.beatSync, syncMode: 'manual' })}
                        disabled={disabled}
                        className={cn(
                          "px-3 py-2 border rounded-lg text-sm font-medium transition-all",
                          "hover:border-orange-300 disabled:opacity-50",
                          {
                            "border-orange-500 bg-orange-50 text-orange-700": settings.beatSync.syncMode === 'manual',
                            "border-gray-200 text-gray-700": settings.beatSync.syncMode !== 'manual',
                          }
                        )}
                      >
                        Manual BPM
                      </button>
                    </div>
                  </div>

                  {/* Manual BPM Input */}
                  {settings.beatSync.syncMode === 'manual' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Manual BPM
                      </label>
                      <input
                        type="number"
                        min="60"
                        max="200"
                        value={settings.beatSync.manualBpm || 120}
                        onChange={(e) => handleSettingChange('beatSync', { 
                          ...settings.beatSync, 
                          manualBpm: parseInt(e.target.value) 
                        })}
                        disabled={disabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="120"
                      />
                    </div>
                  )}

                  {/* Beat Sensitivity */}
                  {settings.beatSync.syncMode === 'auto' && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Beat Sensitivity: <span className="text-orange-600 font-semibold">{Math.round(settings.beatSync.beatSensitivity * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={settings.beatSync.beatSensitivity}
                        onChange={(e) => handleSettingChange('beatSync', { 
                          ...settings.beatSync, 
                          beatSensitivity: parseFloat(e.target.value) 
                        })}
                        disabled={disabled}
                        className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Less sensitive</span>
                        <span>More sensitive</span>
                      </div>
                    </div>
                  )}

                  {/* Beat Offset */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Beat Offset: <span className="text-orange-600 font-semibold">{settings.beatSync.beatOffset.toFixed(1)}s</span>
                    </label>
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={settings.beatSync.beatOffset}
                      onChange={(e) => handleSettingChange('beatSync', { 
                        ...settings.beatSync, 
                        beatOffset: parseFloat(e.target.value) 
                      })}
                      disabled={disabled}
                      className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>-2s (Earlier)</span>
                      <span>+2s (Later)</span>
                    </div>
                  </div>

                  {/* Format-specific explanations */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-800 mb-1">How Beat Sync Works:</p>
                        {settings.format === 'mp4' ? (
                          <p className="text-blue-700">
                            <strong>MP4:</strong> Music plays with perfectly synced image changes on every beat. 
                            Video duration matches the music length needed for all your images.
                          </p>
                        ) : (
                          <p className="text-blue-700">
                            <strong>GIF:</strong> Images change with the same beat timing (no audio). 
                            Perfect for adding music in post-production with pre-synced timing!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
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
              Audio: {
                settings.beatSync.enabled && settings.beatSync.musicFile 
                  ? `Music (${settings.beatSync.musicFile.name})`
                  : settings.addSound 
                  ? 'Sound effects' 
                  : 'Silent'
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}