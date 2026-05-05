import { useState, useRef } from 'react';
import { uploadProjectZip } from '../services/api';
import type { UploadResponse } from '../types';
import { formatBytes } from '../utils/format';

interface FileUploaderProps {
  onUploadSuccess: (data: UploadResponse) => void;
}

export default function FileUploader({ onUploadSuccess }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a ZIP file');
      return;
    }
    if (selectedFile.size > 200 * 1024 * 1024) {
      setError('File too large (max 200MB)');
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const data = await uploadProjectZip(file);
      onUploadSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2 text-zinc-100">Upload Project ZIP</h2>
        <p className="text-zinc-500">Upload your codebase for AI-powered language migration</p>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-300 ${
          dragOver
            ? 'border-blue-500 bg-blue-500/5 scale-[1.02]'
            : 'border-white/[0.08] hover:border-white/[0.12] bg-zinc-950'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />

        {!file ? (
          <div className="py-8">
            <div className="w-24 h-24 mx-auto mb-8 rounded-[2rem] bg-blue-500/5 border border-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
              <span className="text-5xl">📦</span>
            </div>
            <h3 className="text-2xl font-bold mb-3 text-zinc-200 tracking-tight">Drop ZIP file here</h3>
            <p className="text-sm text-zinc-500 mb-8 font-medium tracking-wide">Maximum size: 200MB</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-10 py-4 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/10 active:scale-95"
            >
              Choose File
            </button>
          </div>
        ) : (
          <div className="py-8">
            <div className="w-24 h-24 mx-auto mb-8 rounded-[2rem] bg-green-500/5 border border-green-500/10 flex items-center justify-center text-green-500 shadow-inner">
              <span className="text-5xl">✓</span>
            </div>
            <h3 className="text-2xl font-bold mb-2 text-zinc-200 tracking-tight">{file.name}</h3>
            <p className="text-sm text-zinc-500 mb-8 font-medium tracking-wide">{formatBytes(file.size)} • Ready to upload</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={reset}
                disabled={uploading}
                className="px-8 py-3.5 bg-black border border-white/[0.08] text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-900 transition-colors disabled:opacity-50 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-10 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-3 shadow-lg shadow-blue-500/10 active:scale-95"
              >
                {uploading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {uploading ? 'Uploading...' : 'Upload & Analyze'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
