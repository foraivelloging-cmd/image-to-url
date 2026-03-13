import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Copy, ArrowRight, Image as ImageIcon, Loader2, Download, Trash2, Settings2, Wand2, QrCode } from 'lucide-react';

const IMAGEKIT_PUBLIC = "public_W8pXprjPHYrYwlWMf811dtUm2Og=";
const IMAGEKIT_PRIVATE = "private_Wu/w/ZEmydjv/FbRgVKOffRxtNY=";
const IMGBB_API_KEY = 'a26bed1b2fd07ba03bff75343d0834fe';

interface UploadedFile {
  id: string;
  originalFile: File;
  originalSize: number;
  compressedBlob?: Blob;
  compressedSize?: number;
  status: 'pending' | 'compressing' | 'uploading' | 'success' | 'error';
  url?: string;
  previewUrl: string;
  error?: string;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const compressImage = (file: File, targetSizeKB: number, format: string, filter: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_WIDTH = 1600; 
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas context not found"));
      
      const isTransparent = file.type === 'image/png' || file.type === 'image/webp';
      const outputType = format === 'auto' 
        ? (isTransparent ? 'image/webp' : 'image/jpeg')
        : `image/${format}`;

      ctx.clearRect(0, 0, width, height);
      if (outputType === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }
      if (filter !== 'none') {
        ctx.filter = filter;
      }
      ctx.drawImage(img, 0, 0, width, height);
      
      let quality = 0.9;

      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("Compression error"));
          if (blob.size <= (targetSizeKB * 1024) || quality <= 0.1) {
            resolve(blob);
          } else {
            quality = Math.max(0.1, quality - 0.1);
            tryCompress(); 
          }
        }, outputType, quality);
      };
      tryCompress();
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
  });
};

const uploadToImageKit = async (blob: Blob | File, type: string) => {
  const extension = type.split('/')[1] || 'jpg';
  const formData = new FormData();
  formData.append('file', blob);
  formData.append('fileName', `lite_${Date.now()}.${extension}`);
  formData.append('publicKey', IMAGEKIT_PUBLIC);

  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + btoa(IMAGEKIT_PRIVATE + ':') },
    body: formData
  });

  const data = await res.json();
  if (!data.url) throw new Error(data.message || "ImageKit Upload Failed");
  return data.url;
};

const uploadToImgBB = async (blob: Blob | File, type: string) => {
  const extension = type.split('/')[1] || 'jpg';
  const formData = new FormData();
  formData.append('image', blob, `image.${extension}`);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error?.message || "ImgBB Upload Failed");
  return data.data.url;
};

export default function App() {
  const [server, setServer] = useState<'imagekit' | 'imgbb'>('imgbb');
  const [compressEnabled, setCompressEnabled] = useState(true);
  const [multipleEnabled, setMultipleEnabled] = useState(false);
  const [targetSize, setTargetSize] = useState(150);
  const [outputFormat, setOutputFormat] = useState<'auto' | 'webp' | 'jpeg' | 'png'>('auto');
  const [imageFilter, setImageFilter] = useState<string>('none');
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [activeQR, setActiveQR] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef({ server, compressEnabled, multipleEnabled, targetSize, outputFormat, imageFilter });

  useEffect(() => {
    settingsRef.current = { server, compressEnabled, multipleEnabled, targetSize, outputFormat, imageFilter };
  }, [server, compressEnabled, multipleEnabled, targetSize, outputFormat, imageFilter]);

  const updateUploadStatus = useCallback((id: string, updates: Partial<UploadedFile>) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
  }, []);

  const processSingleFile = useCallback(async (id: string, file: File, currentSettings: any) => {
    try {
      let fileToUpload: Blob | File = file;
      let outputType = file.type;

      if (currentSettings.compressEnabled) {
        updateUploadStatus(id, { status: 'compressing' });
        const isTransparent = outputType === 'image/png' || outputType === 'image/webp';
        outputType = currentSettings.outputFormat === 'auto' 
          ? (isTransparent ? 'image/webp' : 'image/jpeg')
          : `image/${currentSettings.outputFormat}`;
        
        fileToUpload = await compressImage(fileToUpload as File, currentSettings.targetSize, currentSettings.outputFormat, currentSettings.imageFilter);
        updateUploadStatus(id, { compressedBlob: fileToUpload, compressedSize: fileToUpload.size });
      }

      updateUploadStatus(id, { status: 'uploading' });
      
      let url;
      try {
        if (currentSettings.server === 'imagekit') {
          try {
            url = await uploadToImageKit(fileToUpload, outputType);
          } catch (e) {
            console.warn("ImageKit failed, falling back to ImgBB");
            url = await uploadToImgBB(fileToUpload, outputType);
          }
        } else {
          try {
            url = await uploadToImgBB(fileToUpload, outputType);
          } catch (e) {
            console.warn("ImgBB failed, falling back to ImageKit");
            url = await uploadToImageKit(fileToUpload, outputType);
          }
        }
      } catch (finalError: any) {
        throw new Error("Upload failed on all servers. Please try again.");
      }

      updateUploadStatus(id, { status: 'success', url });
    } catch (error: any) {
      updateUploadStatus(id, { status: 'error', error: error.message || 'Upload failed' });
    }
  }, [updateUploadStatus]);

  const processFiles = useCallback((files: File[]) => {
    const currentSettings = settingsRef.current;
    if (files.length === 0) return;

    const filesToProcess = currentSettings.multipleEnabled ? files : [files[0]];
    
    const newUploads: UploadedFile[] = filesToProcess.map(file => ({
      id: Math.random().toString(36).substring(7),
      originalFile: file,
      originalSize: file.size,
      status: 'pending',
      previewUrl: URL.createObjectURL(file)
    }));

    if (!currentSettings.multipleEnabled) {
      setUploads(newUploads);
    } else {
      setUploads(prev => [...prev, ...newUploads]);
    }

    newUploads.forEach(upload => {
      processSingleFile(upload.id, upload.originalFile, currentSettings);
    });
  }, [processSingleFile]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      
      // Check for files directly
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
          e.preventDefault();
          processFiles(files);
          return;
        }
      }

      // Check items (for images copied from browser)
      const items = Array.from(e.clipboardData.items);
      const filesFromItems = items
        .filter(item => item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean) as File[];
      
      if (filesFromItems.length > 0) {
        e.preventDefault();
        processFiles(filesFromItems);
        return;
      }

      const text = e.clipboardData.getData('text');
      if (text) {
        if (text.startsWith('data:image/')) {
          e.preventDefault();
          try {
            const arr = text.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            const file = new File([u8arr], 'pasted-image.png', { type: mime });
            processFiles([file]);
          } catch (err) {
            console.error('Failed to parse base64 image', err);
          }
        } else if ((text.startsWith('http://') || text.startsWith('https://')) && text.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
          e.preventDefault();
          try {
            const response = await fetch(text);
            const blob = await response.blob();
            const filename = text.split('/').pop() || 'pasted-image.jpg';
            const file = new File([blob], filename, { type: blob.type });
            processFiles([file]);
          } catch (err) {
            console.error('Failed to fetch pasted image URL', err);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter((f: File) => f.type.startsWith('image/'));
      processFiles(files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter((f: File) => f.type.startsWith('image/'));
      processFiles(files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyAllLinks = () => {
    const successfulUploads = uploads.filter(u => u.status === 'success' && u.url);
    if (successfulUploads.length === 0) return;

    const textToCopy = successfulUploads.map((u, index) => `Image ${index + 1}: ${u.url}`).join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownload = (upload: UploadedFile) => {
    const blob = upload.compressedBlob || upload.originalFile;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    let ext = upload.originalFile.name.split('.').pop() || 'jpg';
    if (compressEnabled) {
      if (outputFormat === 'webp') ext = 'webp';
      else if (outputFormat === 'jpeg') ext = 'jpg';
      else if (outputFormat === 'png') ext = 'png';
      else if (outputFormat === 'auto') {
        const isTransparent = upload.originalFile.type === 'image/png' || upload.originalFile.type === 'image/webp';
        ext = isTransparent ? 'webp' : 'jpg';
      }
    }
    
    a.download = `optimized_${upload.originalFile.name.split('.')[0]}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const mainContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainContainerRef.current) {
      mainContainerRef.current.focus();
    }
  }, []);

  const totalOriginalSize = uploads.reduce((acc, u) => acc + u.originalSize, 0);
  const totalCompressedSize = uploads.reduce((acc, u) => acc + (u.compressedSize || u.originalSize), 0);

  return (
    <div 
      ref={mainContainerRef}
      tabIndex={-1}
      className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white font-sans focus:outline-none"
    >
      <div className="bg-slate-900/80 backdrop-blur-xl w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col md:flex-row h-auto md:h-[700px]">
        
        {/* Left Panel */}
        <div className="w-full md:w-5/12 p-8 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">
                Image<span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">Lite</span>
              </h1>
              <p className="text-slate-400 text-xs">Smart Image Compressor & Uploader</p>
            </div>
            <div className="flex items-center gap-2">
              <a 
                href="https://picsart.com/background-remover/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg text-xs font-semibold transition-colors border border-purple-500/20"
                title="Remove Background (Opens Picsart)"
              >
                <Wand2 className="w-4 h-4" />
                <span className="hidden xl:inline">BG Remover</span>
              </a>
              {uploads.length > 0 && (
                <button 
                  onClick={() => setUploads([])}
                  className="p-2 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors group"
                  title="Clear All"
                >
                  <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300">
                <Settings2 className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Settings</span>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Compress</span>
                  <button 
                    onClick={() => setCompressEnabled(!compressEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${compressEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${compressEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Multiple</span>
                  <button 
                    onClick={() => setMultipleEnabled(!multipleEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${multipleEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${multipleEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Server</span>
                <select 
                  value={server} 
                  onChange={(e) => setServer(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="imagekit">ImageKit</option>
                  <option value="imgbb">ImgBB</option>
                </select>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Format</span>
                <select 
                  value={outputFormat} 
                  onChange={(e) => setOutputFormat(e.target.value as any)}
                  disabled={!compressEnabled}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="auto">Auto (Smart)</option>
                  <option value="webp">WebP</option>
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                </select>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Image Filter (Requires Compress)</span>
                <select 
                  value={imageFilter} 
                  onChange={(e) => setImageFilter(e.target.value)}
                  disabled={!compressEnabled}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="none">Normal</option>
                  <option value="grayscale(100%)">Grayscale</option>
                  <option value="sepia(100%)">Sepia</option>
                  <option value="invert(100%)">Invert</option>
                  <option value="blur(4px)">Blur</option>
                </select>
              </div>
            </div>

            <div className={`flex flex-col transition-opacity ${!compressEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Target Size</span>
                <span className="text-[10px] font-bold text-blue-400">{targetSize} KB</span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="1000" 
                step="50"
                value={targetSize} 
                onChange={(e) => setTargetSize(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          <div 
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px] focus:outline-none focus:ring-2 focus:ring-blue-500/50
              ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'}`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              multiple={multipleEnabled}
              onChange={handleFileInput}
            />
            <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-base text-slate-200">Upload Image{multipleEnabled ? 's' : ''}</h3>
            <p className="text-xs text-slate-500 mt-2">Drag & Drop or CTRL+V</p>
          </div>

          {uploads.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Original</p>
                <p className="text-base font-mono mt-1 text-slate-300">{formatBytes(totalOriginalSize)}</p>
              </div>
              <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-900/50">
                <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider">Total Output</p>
                <p className="text-base font-mono mt-1 text-emerald-400">{formatBytes(totalCompressedSize)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-full md:w-7/12 bg-slate-950/50 flex flex-col relative overflow-hidden">
          {uploads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-40">
              <ImageIcon className="w-20 h-20 text-slate-600 mb-4" />
              <p className="font-medium text-slate-400">Optimized results will appear here</p>
            </div>
          ) : uploads.length === 1 ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden p-6">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <h2 className="font-semibold text-slate-200 truncate pr-4">{uploads[0].originalFile.name}</h2>
                <span className="shrink-0 flex items-center gap-2">
                  {uploads[0].status === 'pending' && <><Loader2 className="w-4 h-4 text-slate-500 animate-spin" /><span className="text-xs text-slate-500">Pending</span></>}
                  {uploads[0].status === 'compressing' && <><Loader2 className="w-4 h-4 text-blue-400 animate-spin" /><span className="text-xs text-blue-400">Compressing</span></>}
                  {uploads[0].status === 'uploading' && <><Loader2 className="w-4 h-4 text-emerald-400 animate-spin" /><span className="text-xs text-emerald-400">Uploading</span></>}
                  {uploads[0].status === 'success' && <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-xs text-emerald-500">Success</span></>}
                  {uploads[0].status === 'error' && <><AlertCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-red-500">Error</span></>}
                </span>
              </div>

              <div className="flex-1 min-h-0 mb-6 rounded-2xl overflow-hidden border border-slate-700 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-repeat flex items-center justify-center relative bg-slate-900/50 shadow-inner">
                <img src={uploads[0].previewUrl} className="max-w-full max-h-full object-contain drop-shadow-2xl" alt="preview" />
              </div>

              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shrink-0">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                  <div className="flex items-center gap-2">
                    <span>Original: {formatBytes(uploads[0].originalSize)}</span>
                    {compressEnabled && uploads[0].compressedSize && (
                      <>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-emerald-400">Compressed: {formatBytes(uploads[0].compressedSize)}</span>
                      </>
                    )}
                  </div>
                  {(uploads[0].status === 'success' || uploads[0].status === 'error') && (
                    <button 
                      onClick={() => handleDownload(uploads[0])}
                      className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  )}
                </div>

                {uploads[0].status === 'success' && uploads[0].url && (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        readOnly 
                        value={uploads[0].url} 
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500" 
                      />
                      <button 
                        onClick={() => setActiveQR(activeQR === uploads[0].id ? null : uploads[0].id)}
                        className={`px-3 rounded-lg flex items-center justify-center transition-colors ${activeQR === uploads[0].id ? 'bg-purple-600 text-white border border-purple-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}
                        title="Show QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { 
                          navigator.clipboard.writeText(uploads[0].url!); 
                          const btn = e.currentTarget;
                          const originalText = btn.innerText;
                          btn.innerText = 'Copied!';
                          btn.classList.add('bg-emerald-600');
                          setTimeout(() => {
                            btn.innerText = originalText;
                            btn.classList.remove('bg-emerald-600');
                          }, 2000);
                        }} 
                        className="bg-blue-600 hover:bg-blue-500 px-4 rounded-lg text-xs font-bold transition-colors text-white"
                      >
                        Copy
                      </button>
                    </div>
                    {activeQR === uploads[0].id && (
                      <div className="flex justify-center p-4 bg-white rounded-xl self-start shadow-xl border border-slate-200">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(uploads[0].url)}`} alt="QR Code" className="w-32 h-32" />
                      </div>
                    )}
                  </div>
                )}
                {uploads[0].status === 'error' && (
                  <p className="text-xs text-red-400">{uploads[0].error}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                <h2 className="font-semibold text-slate-200">Uploads ({uploads.length})</h2>
                {uploads.some(u => u.status === 'success') && (
                  <button 
                    onClick={copyAllLinks}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                  >
                    {copiedAll ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedAll ? 'Copied All!' : 'Copy All Links'}
                  </button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {uploads.map(upload => (
                  <div key={upload.id} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')] bg-repeat border border-slate-700">
                      <img src={upload.previewUrl} className="w-full h-full object-contain" alt="preview" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-medium text-slate-300 truncate pr-2">{upload.originalFile.name}</p>
                        <div className="flex items-center gap-3 shrink-0">
                          {(upload.status === 'success' || upload.status === 'error') && (
                            <button 
                              onClick={() => handleDownload(upload)}
                              className="text-slate-400 hover:text-blue-400 transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <span className="shrink-0">
                            {upload.status === 'pending' && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
                            {upload.status === 'compressing' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                            {upload.status === 'uploading' && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
                            {upload.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                            {upload.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
                        <span>{formatBytes(upload.originalSize)}</span>
                        {compressEnabled && upload.compressedSize && (
                          <>
                            <ArrowRight className="w-3 h-3" />
                            <span className="text-emerald-400">{formatBytes(upload.compressedSize)}</span>
                          </>
                        )}
                      </div>

                      {upload.status === 'success' && upload.url && (
                        <div className="flex flex-col gap-2 mt-2">
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              readOnly 
                              value={upload.url} 
                              className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-blue-500" 
                            />
                            <button 
                              onClick={() => setActiveQR(activeQR === upload.id ? null : upload.id)}
                              className={`px-2 rounded flex items-center justify-center transition-colors ${activeQR === upload.id ? 'bg-purple-600 text-white border border-purple-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}
                              title="Show QR Code"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={(e) => { 
                                navigator.clipboard.writeText(upload.url!); 
                                const btn = e.currentTarget;
                                const originalText = btn.innerText;
                                btn.innerText = 'Copied!';
                                btn.classList.add('bg-emerald-600');
                                setTimeout(() => {
                                  btn.innerText = originalText;
                                  btn.classList.remove('bg-emerald-600');
                                }, 2000);
                              }} 
                              className="bg-slate-800 hover:bg-slate-700 px-3 rounded text-[10px] font-bold transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          {activeQR === upload.id && (
                            <div className="flex justify-center p-2 bg-white rounded-lg self-start shadow-xl border border-slate-200">
                              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(upload.url)}`} alt="QR Code" className="w-24 h-24" />
                            </div>
                          )}
                        </div>
                      )}
                      {upload.status === 'error' && (
                        <p className="text-[10px] text-red-400">{upload.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
