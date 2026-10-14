import React, { useState } from 'react';
import { RefreshCw, X, Copy, Download, Loader2, CheckCircle2, AlertCircle, QrCode, UploadCloud, PenLine, Check, Sparkles, Eye, Image as ImageIcon, Wand2 } from 'lucide-react';
import { UploadedFile } from '../types';

interface ImageCardProps {
  upload: UploadedFile;
  onReplace: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (upload: UploadedFile) => void;
  onShowQR: (url: string) => void;
  onForceUpload: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onEdit: (upload: UploadedFile) => void;
  onPreview?: (upload: UploadedFile) => void;
  onOpenAIModal?: (upload: UploadedFile) => void;
  formatBytes: (bytes: number, decimals?: number) => string;
}

export const ImageCard: React.FC<ImageCardProps> = ({ 
  upload, 
  onReplace, 
  onDelete, 
  onDownload, 
  onShowQR, 
  onForceUpload, 
  onRename,
  onEdit,
  onPreview,
  onOpenAIModal,
  formatBytes 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [imgHasError, setImgHasError] = useState(false);
  const [editValue, setEditValue] = useState(
    upload.customName || upload.originalFile?.name?.replace(/\.[^/.]+$/, '') || ''
  );

  const handleSaveRename = () => {
    const trimmed = editValue.trim();
    if (trimmed) {
      onRename(upload.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setEditValue(upload.customName || upload.originalFile?.name?.replace(/\.[^/.]+$/, '') || '');
    setIsEditing(false);
  };

  const fileExt = upload.originalFile?.name ? upload.originalFile.name.split('.').pop() || 'jpg' : 'jpg';
  const displayName = upload.customName 
    ? `${upload.customName}.${fileExt}`
    : (upload.originalFile?.name || 'Image');

  // Compute best image source with fallback chain
  const imageSource = upload.previewUrl || 
    (upload.compressedBlob ? URL.createObjectURL(upload.compressedBlob) : null) || 
    (upload.originalFile instanceof Blob ? URL.createObjectURL(upload.originalFile) : null) || 
    upload.url || 
    upload.originalUrl || 
    '';

  return (
    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex gap-4 items-center group/card hover:border-slate-700 transition-colors">
      <div 
        onClick={() => onPreview ? onPreview(upload) : onEdit(upload)}
        className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-repeat border border-slate-700 cursor-pointer relative group/thumb flex items-center justify-center bg-slate-950/60"
        title="Click to preview large image"
      >
        {imgHasError || !imageSource ? (
          <div className="flex flex-col items-center justify-center text-slate-500 p-1">
            <ImageIcon className="w-6 h-6" />
          </div>
        ) : (
          <img 
            src={imageSource} 
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain" 
            alt={displayName}
            onError={(e) => {
              const target = e.currentTarget;
              if (upload.url && target.src !== upload.url) {
                target.src = upload.url;
              } else if (upload.originalUrl && target.src !== upload.originalUrl) {
                target.src = upload.originalUrl;
              } else if (upload.originalFile instanceof Blob) {
                target.src = URL.createObjectURL(upload.originalFile);
              } else {
                setImgHasError(true);
              }
            }}
          />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
          <Eye className="w-4 h-4" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          {isEditing ? (
            <div className="flex items-center gap-1.5 flex-1 pr-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') handleCancelRename();
                }}
                placeholder="Enter image name..."
                className="bg-slate-950 border border-blue-500 rounded px-2 py-0.5 text-xs text-white outline-none flex-1 max-w-[200px]"
              />
              <button 
                onClick={handleSaveRename} 
                className="text-emerald-400 hover:text-emerald-300 p-1"
                title="Save name"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={handleCancelRename} 
                className="text-slate-400 hover:text-red-400 p-1"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 truncate pr-2 group">
              <p className="text-xs font-medium text-slate-300 truncate" title={displayName}>
                {displayName}
              </p>
              <button
                onClick={() => {
                  setEditValue(upload.customName || upload.originalFile.name.replace(/\.[^/.]+$/, ''));
                  setIsEditing(true);
                }}
                className="text-slate-500 hover:text-blue-400 opacity-60 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                title="Rename image (e.g. saqibviusal7)"
              >
                <PenLine className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 shrink-0">
            {upload.status === 'pending' && (
              <button
                onClick={() => onForceUpload(upload.id)}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-[10px] font-semibold transition-colors"
                title="Upload this image now"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            )}
            {upload.status === 'success' && !upload.url && (
              <button 
                onClick={() => onForceUpload(upload.id)}
                className="text-slate-400 hover:text-blue-400 transition-colors"
                title="Upload to Server"
              >
                <UploadCloud className="w-4 h-4" />
              </button>
            )}
            {upload.originalUrl && upload.status === 'success' && upload.url && (
              <button 
                onClick={() => onForceUpload(upload.id)}
                className="text-slate-400 hover:text-blue-400 transition-colors"
                title="Re-upload to Server"
              >
                <UploadCloud className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => onPreview ? onPreview(upload) : onEdit(upload)}
              className="text-slate-400 hover:text-cyan-400 transition-colors"
              title="View & Preview Image"
            >
              <Eye className="w-4 h-4" />
            </button>
            {onOpenAIModal && (
              <button 
                onClick={() => onOpenAIModal(upload)}
                className="text-slate-400 hover:text-purple-400 transition-colors"
                title="ImageKit AI Studio (Remove BG, Face Avatar, Smart Crop, Auto Enhance)"
              >
                <Wand2 className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => onEdit(upload)}
              className="text-slate-400 hover:text-purple-400 transition-colors"
              title="Open Photo Studio (Crop, Rotate, Adjust, Filters)"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onReplace(upload.id)}
              className="text-slate-400 hover:text-blue-400 transition-colors"
              title="Replace Image"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(upload.id)}
              className="text-slate-400 hover:text-red-400 transition-colors"
              title="Remove Image"
            >
              <X className="w-4 h-4" />
            </button>
            {upload.status === 'success' && upload.url && (
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(upload.url!);
                }}
                className="text-slate-400 hover:text-emerald-400 transition-colors"
                title="Copy Link"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            {(upload.status === 'success' || upload.status === 'error') && (
              <button 
                onClick={() => onDownload(upload)}
                className="text-slate-400 hover:text-blue-400 transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <span className="shrink-0 border-l border-slate-700 pl-3 ml-1">
              {upload.status === 'pending' && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
              {upload.status === 'compressing' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
              {upload.status === 'uploading' && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
              {upload.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {upload.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span>{formatBytes(upload.originalSize)}</span>
          {upload.compressedSize && upload.compressedSize < upload.originalSize && (
            <>
              <span className="text-slate-700">→</span>
              <span className="text-emerald-400 font-medium">{formatBytes(upload.compressedSize)}</span>
              <span className="text-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                -{Math.round((1 - upload.compressedSize / upload.originalSize) * 100)}%
              </span>
            </>
          )}
        </div>

        {upload.status === 'success' && upload.url && (
          <div className="mt-2 flex items-center gap-2">
            <input 
              type="text" 
              readOnly 
              value={upload.url}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-[10px] text-slate-400 outline-none focus:border-blue-500/50 transition-colors"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => onShowQR(upload.url!)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-400 transition-colors"
              title="Show QR Code"
            >
              <QrCode className="w-3 h-3" />
            </button>
          </div>
        )}
        {upload.status === 'error' && (
          <p className="mt-1 text-[10px] text-red-400">{upload.error}</p>
        )}
      </div>
    </div>
  );
}
