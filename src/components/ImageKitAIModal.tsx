import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Copy, 
  Download, 
  Wand2, 
  Check, 
  Loader2, 
  ExternalLink, 
  Layers, 
  UserCheck, 
  Focus, 
  Zap, 
  Eye, 
  Maximize2, 
  RotateCcw,
  Sliders,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { UploadedFile } from '../types';

interface ImageKitAIModalProps {
  isOpen: boolean;
  upload: UploadedFile;
  endpoint: string;
  onClose: () => void;
  onSaveAsNew: (original: UploadedFile, aiUrl: string, newName: string) => void;
  onReplaceCurrent: (original: UploadedFile, aiUrl: string, newName: string) => void;
  onUploadToImageKit?: (uploadId: string) => Promise<string | undefined>;
}

interface AITransformPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'ai' | 'smart_crop' | 'enhancement' | 'artistic';
  transformParam: string;
  badge?: string;
}

const AI_PRESETS: AITransformPreset[] = [
  {
    id: 'bg-remove',
    name: 'AI Background Remover',
    description: 'Intelligent cutout removing the entire background cleanly',
    icon: <Wand2 className="w-4 h-4 text-purple-400" />,
    category: 'ai',
    transformParam: 'tr=bg-remove',
    badge: 'Popular'
  },
  {
    id: 'bg-white',
    name: 'Studio White Backdrop',
    description: 'AI removes background and replaces with clean e-commerce white',
    icon: <Layers className="w-4 h-4 text-emerald-400" />,
    category: 'ai',
    transformParam: 'tr=bg-remove,bg-FFFFFF'
  },
  {
    id: 'bg-dark',
    name: 'Dark Studio Backdrop',
    description: 'AI removes background and adds modern dark luxury backdrop',
    icon: <Layers className="w-4 h-4 text-blue-400" />,
    category: 'ai',
    transformParam: 'tr=bg-remove,bg-0F172A'
  },
  {
    id: 'face-avatar',
    name: 'AI Face Portrait Avatar',
    description: 'Auto-detects faces and crops into a perfect circular avatar',
    icon: <UserCheck className="w-4 h-4 text-amber-400" />,
    category: 'smart_crop',
    transformParam: 'tr=w-500,h-500,fo-face,r-max',
    badge: 'AI Face'
  },
  {
    id: 'face-crop',
    name: 'AI Portrait Focus',
    description: 'Centers subject and focuses on the human face automatically',
    icon: <UserCheck className="w-4 h-4 text-cyan-400" />,
    category: 'smart_crop',
    transformParam: 'tr=w-600,h-800,fo-face'
  },
  {
    id: 'smart-crop',
    name: 'AI Smart Subject Focus',
    description: 'Detects most interesting subject and centers automatically',
    icon: <Focus className="w-4 h-4 text-blue-400" />,
    category: 'smart_crop',
    transformParam: 'tr=w-600,h-600,fo-auto',
    badge: 'Smart'
  },
  {
    id: 'auto-enhance',
    name: 'AI Auto Retouch & Enhance',
    description: 'Boosts contrast, vibrant lighting, and micro-edge sharpness',
    icon: <Sparkles className="w-4 h-4 text-yellow-400" />,
    category: 'enhancement',
    transformParam: 'tr=e-contrast,e-sharpen',
    badge: 'Vibrant'
  },
  {
    id: 'upscale',
    name: 'AI High-Res Upscale',
    description: 'AI enhanced detail upscaling for crisp high-resolution output',
    icon: <Zap className="w-4 h-4 text-emerald-400" />,
    category: 'enhancement',
    transformParam: 'tr=e-upscale'
  },
  {
    id: 'bokeh',
    name: 'AI Depth Bokeh / Blur',
    description: 'Creates a cinematic lens blur effect on the scene',
    icon: <Sliders className="w-4 h-4 text-indigo-400" />,
    category: 'artistic',
    transformParam: 'tr=bl-12'
  },
  {
    id: 'noir',
    name: 'AI Classic Noir B&W',
    description: 'Dramatic high-contrast black and white cinematic monochrome',
    icon: <Eye className="w-4 h-4 text-slate-300" />,
    category: 'artistic',
    transformParam: 'tr=e-grayscale,e-contrast'
  },
  {
    id: 'sepia',
    name: 'AI Vintage Film Warmth',
    description: 'Warm nostalgic retro film color grading with sepia tones',
    icon: <Layers className="w-4 h-4 text-amber-500" />,
    category: 'artistic',
    transformParam: 'tr=e-sepia'
  },
  {
    id: 'smart-compress',
    name: 'AI Smart WebP/AVIF Auto',
    description: 'Lossless next-gen compression optimized for instant loading',
    icon: <Check className="w-4 h-4 text-teal-400" />,
    category: 'enhancement',
    transformParam: 'tr=f-auto,q-auto'
  }
];

export const ImageKitAIModal: React.FC<ImageKitAIModalProps> = ({
  isOpen,
  upload,
  endpoint,
  onClose,
  onSaveAsNew,
  onReplaceCurrent,
  onUploadToImageKit
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('bg-remove');
  const [customParams, setCustomParams] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
  const [imageError, setImageError] = useState<boolean>(false);
  const [isUploadingToIK, setIsUploadingToIK] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'transformed' | 'split' | 'original'>('transformed');

  const selectedPreset = AI_PRESETS.find(p => p.id === selectedPresetId);

  // Check if current upload has an ImageKit URL
  const isImageKitUrl = Boolean(upload.url && (upload.url.includes('imagekit.io') || upload.url.includes('ik.imagekit.io')));
  
  // Construct baseUrl on ImageKit
  const cleanEndpoint = endpoint.replace(/\/$/, '');
  
  // Get base URL for transformation
  const getBaseImageUrl = (): string | null => {
    if (upload.url && upload.url.includes('imagekit.io')) {
      // Strip any existing ?tr= or /tr:
      const u = new URL(upload.url);
      u.searchParams.delete('tr');
      // If path has /tr:..., strip it
      let pathname = u.pathname.replace(/\/tr:[^/]+/, '');
      return `${u.origin}${pathname}`;
    }
    return upload.url || null;
  };

  const baseImage = getBaseImageUrl();

  // Active transform string
  const activeTransform = customParams.trim() 
    ? (customParams.startsWith('tr=') ? customParams : `tr=${customParams}`)
    : (selectedPreset ? selectedPreset.transformParam : 'tr=bg-remove');

  // Compute final transformed URL
  const transformedUrl = baseImage 
    ? (baseImage.includes('?') ? `${baseImage}&${activeTransform}` : `${baseImage}?${activeTransform}`)
    : '';

  useEffect(() => {
    setIsImageLoading(true);
    setImageError(false);
  }, [transformedUrl, selectedPresetId]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!transformedUrl) return;
    navigator.clipboard.writeText(transformedUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!transformedUrl) return;
    try {
      const res = await fetch(transformedUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const baseName = upload.customName || upload.originalFile?.name?.replace(/\.[^/.]+$/, '') || 'image';
      a.download = `${baseName}_ai_${selectedPresetId}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      window.open(transformedUrl, '_blank');
    }
  };

  const handleSaveNew = () => {
    if (!transformedUrl) return;
    const baseName = upload.customName || upload.originalFile?.name?.replace(/\.[^/.]+$/, '') || 'image';
    const newName = `${baseName}_ai_${selectedPresetId}`;
    onSaveAsNew(upload, transformedUrl, newName);
    onClose();
  };

  const handleReplace = () => {
    if (!transformedUrl) return;
    const baseName = upload.customName || upload.originalFile?.name?.replace(/\.[^/.]+$/, '') || 'image';
    onReplaceCurrent(upload, transformedUrl, `${baseName}_ai`);
    onClose();
  };

  const handleTriggerUpload = async () => {
    if (!onUploadToImageKit) return;
    setIsUploadingToIK(true);
    try {
      await onUploadToImageKit(upload.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploadingToIK(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">ImageKit AI Studio</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  mrsaqib AI Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                URL Endpoint: <span className="font-mono text-cyan-400">{cleanEndpoint}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 text-xs">
              <button
                onClick={() => setViewMode('transformed')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${viewMode === 'transformed' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                AI Result
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${viewMode === 'split' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Side by Side
              </button>
              <button
                onClick={() => setViewMode('original')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${viewMode === 'original' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Original
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Main Visual Stage */}
          <div className="flex-1 bg-slate-950 p-6 flex flex-col justify-center items-center relative overflow-hidden">
            {/* Background pattern */}
            <div className="w-full h-full rounded-2xl border border-slate-800/80 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-repeat relative flex items-center justify-center p-4 overflow-hidden shadow-inner">
              
              {!isImageKitUrl ? (
                <div className="max-w-md text-center p-6 bg-slate-900/90 backdrop-blur rounded-2xl border border-slate-800 shadow-2xl">
                  <Wand2 className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white mb-2">Upload to ImageKit First</h3>
                  <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                    ImageKit AI transformations (background removal, face avatars, smart crop, upscale) run real-time on your ImageKit server (<span className="text-cyan-400 font-mono">ik.imagekit.io/mrsaqib</span>).
                  </p>
                  <button
                    onClick={handleTriggerUpload}
                    disabled={isUploadingToIK}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
                  >
                    {isUploadingToIK ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isUploadingToIK ? 'Uploading to ImageKit...' : 'Upload Now & Enable AI Magic'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Viewports */}
                  {viewMode === 'split' ? (
                    <div className="w-full h-full flex flex-col sm:flex-row gap-4 items-center justify-center">
                      <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-slate-900/40 rounded-xl border border-slate-800 p-2 relative">
                        <span className="absolute top-2 left-2 text-[10px] bg-slate-800/90 text-slate-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          Original
                        </span>
                        <img 
                          src={baseImage || upload.previewUrl} 
                          alt="Original" 
                          referrerPolicy="no-referrer"
                          className="max-h-full max-w-full object-contain drop-shadow-xl rounded" 
                        />
                      </div>
                      <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-slate-900/40 rounded-xl border border-purple-500/30 p-2 relative">
                        <span className="absolute top-2 left-2 text-[10px] bg-purple-600/90 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> AI Transformed
                        </span>
                        {isImageLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 rounded-xl">
                            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                          </div>
                        )}
                        <img 
                          src={transformedUrl} 
                          alt="AI Transformed" 
                          referrerPolicy="no-referrer"
                          onLoad={() => setIsImageLoading(false)}
                          onError={() => {
                            setIsImageLoading(false);
                            setImageError(true);
                          }}
                          className={`max-h-full max-w-full object-contain drop-shadow-2xl rounded transition-opacity ${isImageLoading ? 'opacity-30' : 'opacity-100'}`} 
                        />
                      </div>
                    </div>
                  ) : viewMode === 'original' ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img 
                        src={baseImage || upload.previewUrl} 
                        alt="Original" 
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain drop-shadow-2xl rounded" 
                      />
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {isImageLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 z-10 backdrop-blur-sm rounded-xl">
                          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
                          <p className="text-xs text-purple-300 font-medium">Processing with ImageKit AI...</p>
                        </div>
                      )}
                      {imageError ? (
                        <div className="text-center p-6 bg-slate-900/90 rounded-xl border border-red-500/30">
                          <p className="text-xs text-red-400 mb-2 font-semibold">AI transformation rendered with alternative fallback</p>
                          <a 
                            href={transformedUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-xs text-cyan-400 hover:underline flex items-center justify-center gap-1"
                          >
                            Open transformed URL <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <img 
                          src={transformedUrl} 
                          alt="AI Output" 
                          referrerPolicy="no-referrer"
                          onLoad={() => setIsImageLoading(false)}
                          onError={() => {
                            setIsImageLoading(false);
                            setImageError(true);
                          }}
                          className={`max-h-full max-w-full object-contain drop-shadow-2xl rounded transition-opacity ${isImageLoading ? 'opacity-20' : 'opacity-100'}`} 
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Active URL bar */}
            {isImageKitUrl && transformedUrl && (
              <div className="w-full mt-3 flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-2 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 uppercase px-1">AI Link:</span>
                <input 
                  type="text" 
                  readOnly 
                  value={transformedUrl}
                  className="flex-1 bg-transparent text-[11px] text-cyan-300 font-mono outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
                  title="Copy AI Image URL"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={transformedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                  title="Open full size in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Right AI Controls & Presets Panel */}
          <div className="w-full md:w-80 bg-slate-900/80 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col p-5 overflow-y-auto shrink-0 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI Transform Presets
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Real-time
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Select an AI model transformation to apply instant server-side AI processing.
              </p>

              {/* Preset Cards List */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {AI_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id && !customParams;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setSelectedPresetId(preset.id);
                        setCustomParams('');
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-3 group relative ${
                        isSelected 
                          ? 'bg-purple-600/15 border-purple-500/60 shadow-md shadow-purple-600/10' 
                          : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800/80 text-slate-400'}`}>
                        {preset.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={`text-xs font-semibold truncate ${isSelected ? 'text-purple-300' : 'text-slate-200'}`}>
                            {preset.name}
                          </span>
                          {preset.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {preset.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                          {preset.description}
                        </p>
                        <code className="text-[9px] text-slate-500 font-mono block mt-1">
                          {preset.transformParam}
                        </code>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Transformation Box */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Custom Transformation</span>
                {customParams && (
                  <button 
                    onClick={() => setCustomParams('')}
                    className="text-[9px] text-red-400 hover:underline"
                  >
                    Reset
                  </button>
                )}
              </label>
              <input
                type="text"
                value={customParams}
                onChange={(e) => setCustomParams(e.target.value)}
                placeholder="e.g. tr=bg-remove,w-800 or tr=bl-5"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
              />
              <span className="text-[9px] text-slate-500 block">
                Combine parameters like: <code className="text-purple-400">tr=bg-remove,fo-face,w-500</code>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleSaveNew}
                disabled={!transformedUrl || !isImageKitUrl}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Save as New Version</span>
              </button>

              <button
                onClick={handleReplace}
                disabled={!transformedUrl || !isImageKitUrl}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replace Current Image</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleCopy}
                  disabled={!transformedUrl}
                  className="py-2 px-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Copy URL</span>
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!transformedUrl}
                  className="py-2 px-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
