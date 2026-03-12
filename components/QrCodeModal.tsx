//components/QrCodeModal.tsx

"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Download, Loader2, QrCode } from "lucide-react";

interface QrCodeModalProps { slug: string; shortUrl: string; onClose: () => void; }

export default function QrCodeModal({ slug, shortUrl, onClose }: QrCodeModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  
  const previewQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=5&data=${encodeURIComponent(shortUrl)}`;

  const downloadApiUrl = `/api/qr-download?url=${encodeURIComponent(shortUrl)}`;

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(false);
    try {
      const response = await fetch(downloadApiUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a'); 
      link.href = url; 
      link.download = `deaubit-${slug}.png`;
      
      document.body.appendChild(link); 
      link.click(); 
      document.body.removeChild(link); 
      window.URL.revokeObjectURL(url);
    } catch { 
      setDownloadError(true);
    } finally { 
      setDownloading(false); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="db-card relative w-full max-w-sm p-6 shadow-[12px_12px_0px_0px_var(--db-border)] space-y-6">
        
        <div className="flex items-center justify-between border-b-4 border-(--db-border) pb-4">
          <div>
            <h3 className="text-lg font-black uppercase flex items-center gap-2 text-(--db-text)">
              <QrCode className="h-5 w-5" /> QR CODE
            </h3>
            <p className="text-xs font-mono bg-(--db-accent) text-black px-1 inline-block mt-1">/{slug}</p>
          </div>
          <button onClick={onClose} className="border-2 border-(--db-border) p-1 hover:bg-red-500 hover:text-white transition-colors"><X className="h-5 w-5"/></button>
        </div>

        <div className="bg-white border-4 border-(--db-border) p-2 flex items-center justify-center aspect-square relative min-h-75 overflow-hidden">
          <div className="qr-scan-line z-20" />
          
          {!imgLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
               <Loader2 className="h-10 w-10 animate-spin text-black" />
               <p className="text-[10px] font-black text-black uppercase animate-pulse tracking-widest">Generating...</p>
            </div>
          )}

          <Image 
            src={previewQrUrl} 
            alt={`QR ${slug}`} 
            width={300}
            height={300}
            className={`w-full h-full object-contain transition-opacity duration-300 ${imgLoaded ? 'opacity-100 animate-qr-pulse' : 'opacity-0'}`} 
            onLoad={() => setImgLoaded(true)}
            unoptimized
          />
        </div>
        
        {downloadError && (
          <div className="bg-(--db-danger) text-white text-xs font-bold p-2 border-2 border-(--db-border) text-center">
            DOWNLOAD FAILED. TRY AGAIN.
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 font-bold border-2 border-(--db-border) hover:bg-(--db-bg) text-(--db-text)">CLOSE</button>
          
          <button 
            onClick={handleDownload} 
            disabled={downloading || !imgLoaded} 
            className="flex-1 py-3 font-bold bg-(--db-primary) text-white border-2 border-(--db-border) hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Download className="h-4 w-4"/> DOWNLOAD</>}
          </button>
        </div>
      </div>
    </div>
  );
}
