import React, { useState, useEffect, useRef } from 'react';
import { Download, Search, Video, Music, Info, AlertCircle, CheckCircle2, Loader2, ExternalLink, Server, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoFormat {
  id: string;
  quality: string;
  ext: string;
  url: string;
  filesize: number;
  vcodec: string;
  acodec: string;
}

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  formats: VideoFormat[];
}

interface DownloadProgress {
  progress: number;
  status: 'idle' | 'downloading' | 'complete' | 'error';
  message?: string;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [cookies, setCookies] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [downloads, setDownloads] = useState<Record<string, DownloadProgress>>({});
  
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    const connect = () => {
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setDownloads(prev => ({
            ...prev,
            [data.downloadId]: { progress: data.progress, status: 'downloading' }
          }));
        } else if (data.type === 'complete') {
          setDownloads(prev => ({
            ...prev,
            [data.downloadId]: { progress: 100, status: 'complete', message: data.message }
          }));
        } else if (data.type === 'error') {
          setDownloads(prev => ({
            ...prev,
            [data.downloadId]: { progress: 0, status: 'error', message: data.message }
          }));
        }
      };

      ws.current.onclose = () => {
        setTimeout(connect, 3000);
      };
    };

    connect();
    return () => ws.current?.close();
  }, []);

  const startServerDownload = (formatId: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket not connected. Please refresh.");
      return;
    }

    const downloadId = `${formatId}-${Date.now()}`;
    setDownloads(prev => ({
      ...prev,
      [downloadId]: { progress: 0, status: 'downloading' }
    }));

    ws.current.send(JSON.stringify({
      type: 'start_download',
      url,
      formatId,
      cookies: cookies || undefined,
      downloadId
    }));
  };

  const fetchVideoInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const response = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, cookies: cookies || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video info');
      }

      setVideoInfo(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s]
      .map(v => v < 10 ? "0" + v : v)
      .filter((v, i) => v !== "00" || i > 0)
      .join(":");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-xl tracking-tight">1DM <span className="text-emerald-500">API</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <a href="#" className="hover:text-white transition-colors">Home</a>
            <a href="#" className="hover:text-white transition-colors">API Docs</a>
            <a href="#" className="hover:text-white transition-colors">Supported Sites</a>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold mb-4 tracking-tight"
          >
            Download Anything, <br />
            <span className="text-emerald-500">Anywhere.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-lg max-w-2xl mx-auto"
          >
            A high-performance video downloader API inspired by 1DM. 
            Supports YouTube, Facebook, Instagram, Twitter, and 1000+ more sites.
          </motion.p>
        </div>

        {/* Search Bar */}
        <div className="max-w-3xl mx-auto mb-16">
          <form onSubmit={fetchVideoInfo} className="relative group">
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl group-hover:bg-emerald-500/30 transition-all duration-500 rounded-full" />
            <div className="relative flex items-center">
              <div className="absolute left-4 text-zinc-500">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste video URL here (YouTube, FB, IG, etc.)"
                className="w-full bg-zinc-900/80 border border-white/10 rounded-2xl py-5 pl-12 pr-32 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all text-lg backdrop-blur-sm"
              />
              <button
                type="submit"
                disabled={loading || !url}
                className="absolute right-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze'}
              </button>
            </div>
          </form>

          {/* Advanced Settings Toggle */}
          <div className="mt-4 flex justify-center">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1 uppercase tracking-widest font-bold"
            >
              <Info className="w-3 h-3" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings (Cookies)
            </button>
          </div>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4">
                  <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
                    Netscape Cookies (for bypassing restrictions)
                  </label>
                  <textarea
                    value={cookies}
                    onChange={(e) => setCookies(e.target.value)}
                    placeholder="# Netscape HTTP Cookie File..."
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-emerald-400/80 focus:outline-none focus:border-emerald-500/50 h-24 resize-none"
                  />
                  <p className="text-[10px] text-zinc-600 mt-2">
                    Tip: Use a browser extension to export YouTube cookies in Netscape format to download age-restricted or private videos.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-3xl mx-auto bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-start gap-4 text-red-400"
            >
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold mb-1">Error Occurred</h3>
                <p className="text-sm opacity-90">{error}</p>
                <p className="text-xs mt-2 opacity-60 italic">Note: Local preview might fail if yt-dlp is not installed. This app is designed for Docker deployment.</p>
              </div>
            </motion.div>
          )}

          {videoInfo && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Video Preview */}
              <div className="lg:col-span-5">
                <div className="sticky top-24">
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-zinc-900">
                    <img 
                      src={videoInfo.thumbnail} 
                      alt={videoInfo.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur px-2 py-1 rounded text-xs font-mono">
                      {formatDuration(videoInfo.duration)}
                    </div>
                  </div>
                  <div className="mt-6">
                    <h2 className="text-2xl font-bold leading-tight mb-2">{videoInfo.title}</h2>
                    <p className="text-zinc-400 flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                      {videoInfo.uploader}
                    </p>
                  </div>
                </div>
              </div>

              {/* Download Options */}
              <div className="lg:col-span-7">
                <div className="bg-zinc-900/50 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Download className="w-5 h-5 text-emerald-500" />
                      Available Formats
                    </h3>
                    <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
                      {videoInfo.formats.length} Options
                    </span>
                  </div>

                  <div className="space-y-3">
                    {videoInfo.formats.map((format, idx) => {
                      const activeDownload = Object.entries(downloads).find(([id, d]) => id.startsWith(format.id) && (d as DownloadProgress).status === 'downloading') as [string, DownloadProgress] | undefined;
                      const completedDownload = Object.entries(downloads).find(([id, d]) => id.startsWith(format.id) && (d as DownloadProgress).status === 'complete') as [string, DownloadProgress] | undefined;
                      
                      return (
                        <motion.div
                          key={format.id + idx}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group relative overflow-hidden p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all"
                        >
                          {/* Progress Bar Background */}
                          {activeDownload && (
                            <div 
                              className="absolute inset-0 bg-emerald-500/10 transition-all duration-300"
                              style={{ width: `${activeDownload[1].progress}%` }}
                            />
                          )}

                          <div className="relative flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                format.vcodec !== 'none' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                              }`}>
                                {format.vcodec !== 'none' ? <Video className="w-5 h-5" /> : <Music className="w-5 h-5" />}
                              </div>
                              <div>
                                <div className="font-bold flex items-center gap-2">
                                  {format.quality}
                                  <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded uppercase text-zinc-400">
                                    {format.ext}
                                  </span>
                                  {activeDownload && (
                                    <span className="text-[10px] text-emerald-500 font-mono animate-pulse">
                                      {activeDownload[1].progress.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-500 flex items-center gap-3">
                                  <span>{formatSize(format.filesize)}</span>
                                  {format.vcodec !== 'none' && <span>{format.vcodec}</span>}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {/* Server Download with Progress */}
                              <button
                                onClick={() => startServerDownload(format.id)}
                                disabled={!!activeDownload || !!completedDownload}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                                  completedDownload ? 'bg-emerald-500 text-black' : 
                                  activeDownload ? 'bg-zinc-800 text-emerald-500 cursor-not-allowed' :
                                  'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black'
                                }`}
                              >
                                {activeDownload ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>{activeDownload[1].progress.toFixed(1)}%</span>
                                  </>
                                ) : completedDownload ? (
                                  <>
                                    <Check className="w-4 h-4" />
                                    <span>Done</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4" />
                                    <span>Download</span>
                                  </>
                                )}
                              </button>

                              {/* External Link */}
                              <a
                                href={format.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-zinc-800 hover:bg-zinc-700 p-2.5 rounded-xl transition-all text-zinc-400 hover:text-white"
                                title="Direct Link"
                              >
                                <ExternalLink className="w-5 h-5" />
                              </a>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features Grid */}
        {!videoInfo && !loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {[
              { icon: <CheckCircle2 className="text-emerald-500" />, title: "1000+ Sites", desc: "Download from YouTube, Facebook, Instagram, TikTok, and more." },
              { icon: <Video className="text-blue-500" />, title: "High Quality", desc: "Get videos in 4K, 1080p, 720p or extract audio in MP3/M4A." },
              { icon: <Info className="text-purple-500" />, title: "Fast & Free", desc: "Powered by yt-dlp for the fastest extraction speeds possible." }
            ].map((feature, i) => (
              <div key={i} className="p-6 bg-zinc-900/30 border border-white/5 rounded-3xl">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h4 className="text-lg font-bold mb-2">{feature.title}</h4>
                <p className="text-zinc-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">1DM API v1.0.0</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <p className="text-xs text-zinc-600">© 2026 1DM API. Built for performance.</p>
        </div>
      </footer>
    </div>
  );
}
