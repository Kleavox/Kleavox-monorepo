//components/QrCodeModal.tsx

"use client";

import { useState } from "react";
import Image from "next/image";
import { X, DownloadSimple, CircleNotch, QrCode, ShieldCheck } from "@phosphor-icons/react";

interface QrCodeModalProps { slug: string; shortUrl: string; onClose: () => void; }

export default function QrCodeModal({ slug, shortUrl, onClose }: QrCodeModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const previewQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=5&data=${encodeURIComponent(shortUrl)}`;
  const downloadApiUrl = `/api/qr-download?url=${encodeURIComponent(shortUrl)}`;

  const handleDownload = async () => {
    setDownloading(true); setDownloadError(false);
    try {
      const response = await fetch(downloadApiUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 db-overlay animate-reveal">
      <div className="db-card animate-modal-in relative w-full max-w-sm shadow-2xl">

        <div className="flex items-center justify-between px-6 py-5 border-b border-(--db-border)">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-(--db-primary)/15 text-(--db-primary) rounded-xl">
              <QrCode size={18} />
            </div>
            <div>
              <h3 className="nothing-title text-base text-(--db-text)">QR_CODE</h3>
              <p className="nothing-label text-[9px] opacity-40 tracking-widest">/{slug}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-(--db-surface-hover) text-(--db-text) opacity-30 hover:opacity-100 transition-all group"
          >
            <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          <div className="relative rounded-3xl overflow-hidden bg-white aspect-square flex items-center justify-center border border-(--db-border)/20 shadow-xl shadow-(--db-primary)/5">
            <div className="qr-scan-line" />

            {!imgLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-white">
                <CircleNotch size={32} className="animate-spin text-(--db-primary)" />
                <p className="nothing-label text-[9px] text-black animate-pulse">Generating_Matrix...</p>
              </div>
            )}

            <Image
              src={previewQrUrl}
              alt={`QR ${slug}`}
              width={320}
              height={320}
              className={`w-full h-full object-contain transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              unoptimized
            />

            {imgLoaded && (
              <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm p-1.5 rounded-full border border-green-200 shadow-sm">
                <ShieldCheck size={14} className="text-green-500" weight="fill" />
              </div>
            )}
          </div>

          <div className="bg-(--db-surface-hover) rounded-2xl px-4 py-3 border border-(--db-border)">
            <p className="nothing-label text-[8px] mb-1 opacity-40">Destination_URL</p>
            <p className="font-dot text-xs text-(--db-text) truncate tracking-tighter">{shortUrl.replace(/^https?:\/\//, "")}</p>
          </div>

          {downloadError && (
            <div className="bg-red-500/10 text-red-500 font-bold p-3 rounded-2xl border border-red-500/20 text-[10px] text-center uppercase tracking-widest">
              DOWNLOAD_FAILED — RETRY
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3.5 text-[10px] nothing-label opacity-100">
              CLOSE
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading || !imgLoaded}
              className="btn-primary flex-1 py-3.5 text-[10px] nothing-label opacity-100 shadow-lg shadow-(--db-primary)/20 disabled:opacity-30 disabled:grayscale"
            >
              {downloading ? <CircleNotch size={16} className="animate-spin" /> : <><DownloadSimple size={15} /> DOWNLOAD</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
