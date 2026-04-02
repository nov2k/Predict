import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Info } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { translations } from '../translations';
import { apiFetch } from '../lib/api';
import { Button, GlassCard } from '../components/ui/Button';
import { getProposalCategoryOptions } from '../constants/categories';

export function CreateView({ onClose, showToast }: { onClose: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const { user, language } = useAuthStore();
  const t = translations[language];
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('crypto');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        showToast(t.videoTooLarge, 'error');
        return;
      }

      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
      setSelectedVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !user || loading) return;
    setLoading(true);
    try {
      let finalVideoUrl = videoUrl;
      if (selectedVideoFile) {
        const formData = new FormData();
        formData.append('video', selectedVideoFile);
        const uploadRes = await apiFetch('/api/uploads/video', {
          method: 'POST',
          body: formData
        });
        if (!uploadRes.ok) {
          const uploadError = await uploadRes.json().catch(() => ({}));
          throw new Error(uploadError.error || 'Failed to upload video');
        }
        const uploadData = await uploadRes.json();
        finalVideoUrl = uploadData.url || '';
      }

      const res = await apiFetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          videoUrl: finalVideoUrl
        })
      });

      if (!res.ok) {
        let errorMsg = 'Failed to submit proposal';
        try {
          const clone = res.clone();
          const errorData = await clone.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          const text = await res.text();
          console.error("Server returned non-JSON error:", text);
          errorMsg = `Server error: ${res.status}`;
        }

        if (res.status === 401 || (errorMsg && errorMsg.includes("User not found"))) {
          useAuthStore.getState().logout();
          window.location.reload(); // Force reload to clear state
          return;
        }
        throw new Error(errorMsg);
      }

      onClose();
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full w-full pt-6 pb-24 overflow-y-auto no-scrollbar px-6"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-black tracking-tighter">{t.propose}</h2>
        <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-full"><X size={24} /></button>
      </div>

      <GlassCard className="p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.question}</label>
          <textarea 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Will Bitcoin hit $100k?" 
            className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-emerald-500 h-20 resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.description}</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide context for this market..." 
            className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-emerald-500 h-24 resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.category}</label>
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-emerald-500 appearance-none"
          >
            {getProposalCategoryOptions(t).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{t.uploadVideo}</label>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-[9/16] max-h-[400px] bg-zinc-800/50 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-800/80 transition-colors overflow-hidden relative mx-auto group"
          >
            {videoPreviewUrl || videoUrl ? (
              <video src={videoPreviewUrl || videoUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-emerald-500 transition-colors">
                  <Plus size={32} />
                </div>
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{t.chooseVideo}</span>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleVideoUpload} 
              className="hidden" 
              accept="video/*"
            />
          </div>
        </div>

        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5 space-y-3">
          <div className="flex items-center gap-2 text-zinc-400">
            <Info size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t.videoReqTitle}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">{t.videoReqFormat}</p>
              <p className="text-xs font-medium">{t.videoReqFormatValue}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">{t.videoReqSize}</p>
              <p className="text-xs font-medium">{t.videoReqSizeValue}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">{t.videoReqResolution}</p>
              <p className="text-xs font-medium">{t.videoReqResolutionValue}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">{t.videoReqOrientation}</p>
              <p className="text-xs font-medium">{t.videoReqOrientationValue}</p>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button 
            className="w-full py-4 rounded-2xl font-bold" 
            onClick={handleSubmit}
            disabled={loading || !title || !description}
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" /> : t.submit}
          </Button>
          <p className="text-center text-[10px] text-zinc-600 mt-4 uppercase tracking-widest">{t.reviewNote}</p>
        </div>
      </GlassCard>
    </motion.div>
  );
}
