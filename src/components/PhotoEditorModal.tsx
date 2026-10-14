import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Check, 
  RotateCw, 
  RotateCcw, 
  FlipHorizontal, 
  FlipVertical, 
  Crop, 
  Sliders, 
  Sparkles, 
  Undo2, 
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { UploadedFile } from '../types';

interface PhotoEditorModalProps {
  isOpen: boolean;
  upload: UploadedFile | null;
  onClose: () => void;
  onSaveAsNew: (originalUpload: UploadedFile, newFile: File, newName: string) => void;
  onReplaceCurrent: (originalUpload: UploadedFile, newFile: File, newName: string) => void;
}

type TabType = 'transform' | 'adjust' | 'presets';
type AspectRatio = 'free' | '1:1' | '4:3' | '16:9' | '9:16';

interface Adjustments {
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
  saturation: number; // -100 to 100
  warmth: number;     // -100 to 100
  blur: number;       // 0 to 20
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  blur: 0,
};

const PRESETS: { id: string; name: string; adjustments: Partial<Adjustments> }[] = [
  { id: 'original', name: 'Original', adjustments: DEFAULT_ADJUSTMENTS },
  { id: 'vivid', name: 'Vivid', adjustments: { brightness: 5, contrast: 25, saturation: 40, warmth: 0, blur: 0 } },
  { id: 'cinematic', name: 'Cinematic', adjustments: { brightness: -5, contrast: 20, saturation: -15, warmth: 25, blur: 0 } },
  { id: 'warm', name: 'Warm Glow', adjustments: { brightness: 10, contrast: 10, saturation: 15, warmth: 45, blur: 0 } },
  { id: 'cool', name: 'Cool Mist', adjustments: { brightness: 5, contrast: 10, saturation: -10, warmth: -45, blur: 0 } },
  { id: 'bw', name: 'B&W Classic', adjustments: { brightness: 5, contrast: 30, saturation: -100, warmth: 0, blur: 0 } },
  { id: 'vintage', name: 'Vintage', adjustments: { brightness: 10, contrast: 15, saturation: -25, warmth: 55, blur: 0 } },
  { id: 'noir', name: 'Noir Drama', adjustments: { brightness: -15, contrast: 50, saturation: -100, warmth: 0, blur: 0 } },
];

export const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({
  isOpen,
  upload,
  onClose,
  onSaveAsNew,
  onReplaceCurrent,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('transform');
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [activePreset, setActivePreset] = useState<string>('original');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [outputFileName, setOutputFileName] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageLoadedVersion, setImageLoadedVersion] = useState<number>(0);

  // Initialize state and load image whenever upload changes
  useEffect(() => {
    if (!upload) return;

    const baseName = upload.customName?.trim() || upload.originalFile?.name?.replace(/\.[^/.]+$/, '') || 'edited_photo';
    setOutputFileName(`${baseName}_edited`);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCropBox(null);
    setIsCropping(false);
    setAspectRatio('free');
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setActivePreset('original');
    setZoomLevel(1);
    setIsImageLoading(true);
    setLoadError(null);

    // Determine the most reliable image source (local blob is best to avoid any CORS/canvas taint issues)
    let tempBlobUrl: string | null = null;
    let targetSrc = '';

    if (upload.compressedBlob) {
      tempBlobUrl = URL.createObjectURL(upload.compressedBlob);
      targetSrc = tempBlobUrl;
    } else if (upload.originalFile instanceof Blob) {
      tempBlobUrl = URL.createObjectURL(upload.originalFile);
      targetSrc = tempBlobUrl;
    } else {
      targetSrc = upload.previewUrl || upload.url || upload.originalUrl || '';
    }

    if (!targetSrc) {
      setIsImageLoading(false);
      setLoadError('Image source not found.');
      return;
    }

    let isCancelled = false;
    const img = new Image();
    
    // Only set crossOrigin if loading an external URL, not for local blob: URLs
    if (!targetSrc.startsWith('blob:') && !targetSrc.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      if (isCancelled) return;
      sourceImageRef.current = img;
      setImageSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      setIsImageLoading(false);
      setLoadError(null);
      setImageLoadedVersion((v) => v + 1);
    };

    img.onerror = () => {
      if (isCancelled) return;
      // If crossOrigin anonymous failed on external image, retry without crossOrigin
      if (img.crossOrigin) {
        const retryImg = new Image();
        retryImg.onload = () => {
          if (isCancelled) return;
          sourceImageRef.current = retryImg;
          setImageSize({ width: retryImg.naturalWidth || retryImg.width, height: retryImg.naturalHeight || retryImg.height });
          setIsImageLoading(false);
          setLoadError(null);
          setImageLoadedVersion((v) => v + 1);
        };
        retryImg.onerror = () => {
          if (isCancelled) return;
          setIsImageLoading(false);
          setLoadError('Failed to load image preview.');
        };
        retryImg.src = targetSrc;
      } else {
        setIsImageLoading(false);
        setLoadError('Failed to load image.');
      }
    };

    img.src = targetSrc;

    return () => {
      isCancelled = true;
      if (tempBlobUrl) {
        URL.revokeObjectURL(tempBlobUrl);
      }
    };
  }, [upload]);

  // Render processed image onto the canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = sourceImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isRotated90or270 = rotation === 90 || rotation === 270;
    const transformedWidth = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
    const transformedHeight = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

    canvas.width = transformedWidth;
    canvas.height = transformedHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply geometric transforms from center
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Apply Canvas Filters
    const b = 100 + adjustments.brightness;
    const c = 100 + adjustments.contrast;
    const s = 100 + adjustments.saturation;
    const blurPx = adjustments.blur;
    const filterParts: string[] = [
      `brightness(${Math.max(0, b)}%)`,
      `contrast(${Math.max(0, c)}%)`,
      `saturate(${Math.max(0, s)}%)`,
    ];
    if (blurPx > 0) {
      filterParts.push(`blur(${blurPx}px)`);
    }
    ctx.filter = filterParts.join(' ');

    // Draw source image centered
    ctx.drawImage(
      img,
      -img.naturalWidth / 2,
      -img.naturalHeight / 2,
      img.naturalWidth,
      img.naturalHeight
    );

    // Color Warmth overlay
    if (adjustments.warmth !== 0) {
      ctx.filter = 'none';
      if (adjustments.warmth > 0) {
        ctx.fillStyle = `rgba(255, 140, 0, ${adjustments.warmth * 0.0025})`;
      } else {
        ctx.fillStyle = `rgba(0, 120, 255, ${Math.abs(adjustments.warmth) * 0.0025})`;
      }
      ctx.fillRect(-img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);
    }

    ctx.restore();

    // If crop is active, draw crop overlay
    if (isCropping && cropBox) {
      ctx.save();
      // Darken outside crop
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, canvas.width, cropBox.y);
      ctx.fillRect(0, cropBox.y + cropBox.height, canvas.width, canvas.height - (cropBox.y + cropBox.height));
      ctx.fillRect(0, cropBox.y, cropBox.x, cropBox.height);
      ctx.fillRect(cropBox.x + cropBox.width, cropBox.y, canvas.width - (cropBox.x + cropBox.width), cropBox.height);

      // Crop border & grid lines
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(2, Math.round(canvas.width / 400));
      ctx.strokeRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height);

      // Rule of thirds
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cropBox.x + cropBox.width / 3, cropBox.y);
      ctx.lineTo(cropBox.x + cropBox.width / 3, cropBox.y + cropBox.height);
      ctx.moveTo(cropBox.x + (cropBox.width * 2) / 3, cropBox.y);
      ctx.lineTo(cropBox.x + (cropBox.width * 2) / 3, cropBox.y + cropBox.height);
      ctx.moveTo(cropBox.x, cropBox.y + cropBox.height / 3);
      ctx.lineTo(cropBox.x + cropBox.width, cropBox.y + cropBox.height / 3);
      ctx.moveTo(cropBox.x, cropBox.y + (cropBox.height * 2) / 3);
      ctx.lineTo(cropBox.x + cropBox.width, cropBox.y + (cropBox.height * 2) / 3);
      ctx.stroke();

      ctx.restore();
    }
  }, [rotation, flipH, flipV, adjustments, isCropping, cropBox, imageLoadedVersion]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Adjustments handlers
  const handleAdjustmentChange = (key: keyof Adjustments, value: number) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
    setActivePreset('custom');
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setActivePreset(preset.id);
    setAdjustments({
      ...DEFAULT_ADJUSTMENTS,
      ...preset.adjustments,
    });
  };

  const handleResetAdjustments = () => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setActivePreset('original');
  };

  // Rotation & Flipping
  const handleRotateCw = () => {
    setRotation((prev) => (prev + 90) % 360);
    setCropBox(null);
  };

  const handleRotateCcw = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
    setCropBox(null);
  };

  const handleFlipH = () => setFlipH((prev) => !prev);
  const handleFlipV = () => setFlipV((prev) => !prev);

  // Aspect ratio crop setup
  const initCropBox = (ratio: AspectRatio) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsCropping(true);
    setAspectRatio(ratio);

    const w = canvas.width;
    const h = canvas.height;

    let targetWidth = w * 0.8;
    let targetHeight = h * 0.8;

    if (ratio === '1:1') {
      const minDim = Math.min(w, h) * 0.8;
      targetWidth = minDim;
      targetHeight = minDim;
    } else if (ratio === '4:3') {
      targetWidth = Math.min(w * 0.8, h * 0.8 * (4 / 3));
      targetHeight = targetWidth * (3 / 4);
    } else if (ratio === '16:9') {
      targetWidth = Math.min(w * 0.8, h * 0.8 * (16 / 9));
      targetHeight = targetWidth * (9 / 16);
    } else if (ratio === '9:16') {
      targetHeight = Math.min(h * 0.8, w * 0.8 * (16 / 9));
      targetWidth = targetHeight * (9 / 16);
    }

    setCropBox({
      x: Math.round((w - targetWidth) / 2),
      y: Math.round((h - targetHeight) / 2),
      width: Math.round(targetWidth),
      height: Math.round(targetHeight),
    });
  };

  const handleApplyCrop = () => {
    if (!cropBox || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create temporary canvas with the cropped region
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropBox.width;
    croppedCanvas.height = cropBox.height;
    const cropCtx = croppedCanvas.getContext('2d');
    if (!cropCtx) return;

    // Render current clean view without overlay to extract pixels
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx || !sourceImageRef.current) return;

    const img = sourceImageRef.current;
    tempCtx.save();
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate((rotation * Math.PI) / 180);
    tempCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    const b = 100 + adjustments.brightness;
    const c = 100 + adjustments.contrast;
    const s = 100 + adjustments.saturation;
    const filterParts = [
      `brightness(${Math.max(0, b)}%)`,
      `contrast(${Math.max(0, c)}%)`,
      `saturate(${Math.max(0, s)}%)`,
    ];
    if (adjustments.blur > 0) filterParts.push(`blur(${adjustments.blur}px)`);
    tempCtx.filter = filterParts.join(' ');

    tempCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);

    if (adjustments.warmth !== 0) {
      tempCtx.filter = 'none';
      if (adjustments.warmth > 0) {
        tempCtx.fillStyle = `rgba(255, 140, 0, ${adjustments.warmth * 0.0025})`;
      } else {
        tempCtx.fillStyle = `rgba(0, 120, 255, ${Math.abs(adjustments.warmth) * 0.0025})`;
      }
      tempCtx.fillRect(-img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);
    }
    tempCtx.restore();

    cropCtx.drawImage(
      tempCanvas,
      cropBox.x,
      cropBox.y,
      cropBox.width,
      cropBox.height,
      0,
      0,
      cropBox.width,
      cropBox.height
    );

    // Update source image to the cropped image
    const croppedImage = new Image();
    croppedImage.src = croppedCanvas.toDataURL('image/png');
    croppedImage.onload = () => {
      sourceImageRef.current = croppedImage;
      setImageSize({ width: cropBox.width, height: cropBox.height });
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setIsCropping(false);
      setCropBox(null);
    };
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setCropBox(null);
  };

  // Canvas Mouse events for custom interactive crop box dragging
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    cropStartRef.current = { x: clickX, y: clickY };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping || !cropStartRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    const startX = cropStartRef.current.x;
    const startY = cropStartRef.current.y;

    let width = Math.abs(currentX - startX);
    let height = Math.abs(currentY - startY);

    if (aspectRatio === '1:1') {
      const side = Math.max(width, height);
      width = side;
      height = side;
    } else if (aspectRatio === '4:3') {
      height = width * (3 / 4);
    } else if (aspectRatio === '16:9') {
      height = width * (9 / 16);
    } else if (aspectRatio === '9:16') {
      width = height * (9 / 16);
    }

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);

    setCropBox({
      x: Math.max(0, Math.min(x, canvasRef.current.width - width)),
      y: Math.max(0, Math.min(y, canvasRef.current.height - height)),
      width: Math.min(width, canvasRef.current.width),
      height: Math.min(height, canvasRef.current.height),
    });
  };

  const handleCanvasMouseUp = () => {
    cropStartRef.current = null;
  };

  // Export & Save Pipeline
  const generateExportBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      const img = sourceImageRef.current;
      if (!canvas || !img) {
        return reject(new Error('Canvas or image not ready'));
      }

      // If in middle of crop, apply crop first to temp canvas
      const exportCanvas = document.createElement('canvas');
      const isRotated90or270 = rotation === 90 || rotation === 270;
      exportCanvas.width = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
      exportCanvas.height = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context failure'));

      ctx.translate(exportCanvas.width / 2, exportCanvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

      const b = 100 + adjustments.brightness;
      const c = 100 + adjustments.contrast;
      const s = 100 + adjustments.saturation;
      const filterParts = [
        `brightness(${Math.max(0, b)}%)`,
        `contrast(${Math.max(0, c)}%)`,
        `saturate(${Math.max(0, s)}%)`,
      ];
      if (adjustments.blur > 0) filterParts.push(`blur(${adjustments.blur}px)`);
      ctx.filter = filterParts.join(' ');

      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);

      if (adjustments.warmth !== 0) {
        ctx.filter = 'none';
        if (adjustments.warmth > 0) {
          ctx.fillStyle = `rgba(255, 140, 0, ${adjustments.warmth * 0.0025})`;
        } else {
          ctx.fillStyle = `rgba(0, 120, 255, ${Math.abs(adjustments.warmth) * 0.0025})`;
        }
        ctx.fillRect(-img.naturalWidth / 2, -img.naturalHeight / 2, img.naturalWidth, img.naturalHeight);
      }

      const fileType = upload.originalFile.type || 'image/jpeg';
      const outputType = fileType.includes('png') ? 'image/png' : 'image/jpeg';
      exportCanvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Blob generation failed'));
      }, outputType, 0.95);
    });
  };

  const handleSaveAsNew = async () => {
    try {
      const blob = await generateExportBlob();
      const cleanName = outputFileName.trim() || 'edited_image';
      const ext = upload.originalFile.name.split('.').pop() || 'jpg';
      const newFile = new File([blob], `${cleanName}.${ext}`, { type: blob.type });

      onSaveAsNew(upload, newFile, cleanName);
      onClose();
    } catch (err) {
      console.error('Failed to export edited image', err);
    }
  };

  const handleReplaceCurrent = async () => {
    try {
      const blob = await generateExportBlob();
      const cleanName = outputFileName.trim() || upload.customName || upload.originalFile.name.replace(/\.[^/.]+$/, '');
      const ext = upload.originalFile.name.split('.').pop() || 'jpg';
      const newFile = new File([blob], `${cleanName}.${ext}`, { type: blob.type });

      onReplaceCurrent(upload, newFile, cleanName);
      onClose();
    } catch (err) {
      console.error('Failed to replace current image', err);
    }
  };

  if (!isOpen || !upload) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-6xl h-[94vh] sm:h-[88vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white font-sans">
        
        {/* Top Header Bar */}
        <div className="h-14 sm:h-16 px-4 sm:px-6 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold tracking-tight text-white flex items-center gap-2">
                Photo Studio Editor
              </h2>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                <span>{imageSize.width} × {imageSize.height} px</span>
                <span>·</span>
                <span className="truncate max-w-[200px] text-slate-300">{upload.originalFile.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-800/60 p-1 rounded-lg border border-slate-700/60 text-xs">
              <button 
                onClick={() => setZoomLevel((z) => Math.max(0.4, Number((z - 0.2).toFixed(1))))}
                className="p-1 hover:text-blue-400 text-slate-400 rounded transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 font-mono text-[10px] text-slate-300 min-w-10 text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button 
                onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.2).toFixed(1))))}
                className="p-1 hover:text-blue-400 text-slate-400 rounded transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setZoomLevel(1)}
                className="p-1 hover:text-blue-400 text-slate-400 rounded transition-colors"
                title="Reset Zoom"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded-xl transition-colors"
              title="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Workspace: Canvas Stage + Control Inspector */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Central Canvas Viewport */}
          <div className="flex-1 bg-slate-950/70 p-4 sm:p-6 flex flex-col items-center justify-center relative overflow-hidden select-none">
            <div className="w-full h-full flex items-center justify-center overflow-auto rounded-xl border border-slate-800/80 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-repeat shadow-inner relative">
              {isImageLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm gap-2">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  <p className="text-xs text-slate-300 font-medium">Loading high-resolution image...</p>
                </div>
              )}

              {loadError && !isImageLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 p-6 text-center gap-2">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                  <p className="text-xs text-red-300 font-medium">{loadError}</p>
                  <p className="text-[11px] text-slate-400">Please check your image or try re-uploading.</p>
                </div>
              )}

              <canvas
                ref={canvasRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  maxHeight: '85%',
                  maxWidth: '85%',
                  objectFit: 'contain',
                  cursor: isCropping ? 'crosshair' : 'default',
                  transition: 'transform 0.15s ease-out',
                  display: isImageLoading || loadError ? 'none' : 'block'
                }}
                className="drop-shadow-2xl rounded"
              />

              {isCropping && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-blue-500/50 backdrop-blur-md px-4 py-2 rounded-xl text-xs flex items-center gap-3 shadow-2xl z-20">
                  <span className="text-slate-300 font-medium">Drag on canvas to crop</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleApplyCrop}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Apply Crop
                    </button>
                    <button
                      onClick={handleCancelCrop}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Inspector Sidebar */}
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800/80 bg-slate-900 flex flex-col shrink-0 h-72 lg:h-full">
            
            {/* Inspector Navigation Tabs */}
            <div className="h-12 border-b border-slate-800 flex items-center justify-around px-3 bg-slate-950/30">
              <button
                onClick={() => setActiveTab('transform')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'transform'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Crop className="w-3.5 h-3.5" />
                <span>Transform</span>
              </button>
              <button
                onClick={() => setActiveTab('adjust')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'adjust'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Adjust</span>
              </button>
              <button
                onClick={() => setActiveTab('presets')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'presets'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Presets</span>
              </button>
            </div>

            {/* Inspector Panel Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              
              {/* TAB 1: TRANSFORM (Rotate, Flip, Aspect Ratio Crop) */}
              {activeTab === 'transform' && (
                <div className="space-y-5 animate-in fade-in">
                  
                  {/* Rotate & Flip Grid */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      Rotate & Flip
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={handleRotateCcw}
                        className="flex flex-col items-center justify-center p-2.5 bg-slate-950 hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors"
                        title="Rotate 90° Counter-Clockwise"
                      >
                        <RotateCcw className="w-4 h-4 text-blue-400 mb-1" />
                        <span className="text-[10px] text-slate-300">-90°</span>
                      </button>
                      <button
                        onClick={handleRotateCw}
                        className="flex flex-col items-center justify-center p-2.5 bg-slate-950 hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors"
                        title="Rotate 90° Clockwise"
                      >
                        <RotateCw className="w-4 h-4 text-blue-400 mb-1" />
                        <span className="text-[10px] text-slate-300">+90°</span>
                      </button>
                      <button
                        onClick={handleFlipH}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-colors ${
                          flipH ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                        title="Flip Horizontal"
                      >
                        <FlipHorizontal className="w-4 h-4 mb-1" />
                        <span className="text-[10px]">Flip H</span>
                      </button>
                      <button
                        onClick={handleFlipV}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-colors ${
                          flipV ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                        title="Flip Vertical"
                      >
                        <FlipVertical className="w-4 h-4 mb-1" />
                        <span className="text-[10px]">Flip V</span>
                      </button>
                    </div>
                  </div>

                  {/* Crop Aspect Ratio Presets */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Crop Ratio
                      </label>
                      {isCropping && (
                        <button
                          onClick={handleCancelCrop}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          Cancel Crop
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { ratio: 'free', label: 'Freeform' },
                        { ratio: '1:1', label: '1:1 Square' },
                        { ratio: '4:3', label: '4:3 Standard' },
                        { ratio: '16:9', label: '16:9 Wide' },
                        { ratio: '9:16', label: '9:16 Story' },
                      ].map(({ ratio, label }) => (
                        <button
                          key={ratio}
                          onClick={() => initCropBox(ratio as AspectRatio)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-medium border text-center transition-all ${
                            isCropping && aspectRatio === ratio
                              ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                              : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: ADJUST (Brightness, Contrast, Saturation, Warmth, Blur) */}
              {activeTab === 'adjust' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Fine Adjustments
                    </span>
                    <button
                      onClick={handleResetAdjustments}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-400 transition-colors"
                    >
                      <Undo2 className="w-3 h-3" />
                      Reset
                    </button>
                  </div>

                  {/* Brightness */}
                  <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">Brightness</span>
                      <span className="font-mono text-blue-400 tabular-nums">
                        {adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustments.brightness}
                      onChange={(e) => handleAdjustmentChange('brightness', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">Contrast</span>
                      <span className="font-mono text-blue-400 tabular-nums">
                        {adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustments.contrast}
                      onChange={(e) => handleAdjustmentChange('contrast', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Saturation */}
                  <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">Saturation</span>
                      <span className="font-mono text-blue-400 tabular-nums">
                        {adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustments.saturation}
                      onChange={(e) => handleAdjustmentChange('saturation', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Warmth / Color Tone */}
                  <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">Warmth</span>
                      <span className="font-mono text-blue-400 tabular-nums">
                        {adjustments.warmth > 0 ? `+${adjustments.warmth}` : adjustments.warmth}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={adjustments.warmth}
                      onChange={(e) => handleAdjustmentChange('warmth', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Blur */}
                  <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300">Soft Blur</span>
                      <span className="font-mono text-blue-400 tabular-nums">{adjustments.blur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      value={adjustments.blur}
                      onChange={(e) => handleAdjustmentChange('blur', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                </div>
              )}

              {/* TAB 3: PRESETS */}
              {activeTab === 'presets' && (
                <div className="space-y-3 animate-in fade-in">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Style Presets
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          activePreset === preset.id
                            ? 'bg-blue-600/20 border-blue-500 text-white'
                            : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-xs">{preset.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {preset.id === 'original' ? 'Reset styles' : 'One-click filter'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Save & Export Actions */}
            <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 space-y-3 shrink-0">
              
              {/* Output Name Input */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Save Image Name</span>
                  <span className="text-blue-400 font-mono">.{upload.originalFile.name.split('.').pop() || 'jpg'}</span>
                </div>
                <input
                  type="text"
                  value={outputFileName}
                  onChange={(e) => setOutputFileName(e.target.value)}
                  placeholder="e.g. saqibviusal7_edited"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-1.5 text-xs text-white outline-none font-mono"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleReplaceCurrent}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors border border-slate-700/60"
                  title="Overwrite this image with the edited version"
                >
                  Replace Current
                </button>
                <button
                  onClick={handleSaveAsNew}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-1.5"
                  title="Save edited image as a new item in your upload list"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save as New
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
