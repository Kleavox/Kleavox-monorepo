//components/ExistingShortlinksCard.tsx

"use client";

import { useState, useMemo } from "react";
import { Copy, Trash2, QrCode, BarChart3, ExternalLink, Clock, AlertTriangle, Check, Search, X, Pencil, ChevronLeft, ChevronRight } from "lucide-react";

export interface ShortLink {
  id: string;
  slug: string;
  targetUrl: string;
  createdAt: string;
  expiresAt?: string | null;
}

interface ExistingShortlinksCardProps {
  links: ShortLink[];
  loadingTable: boolean;
  baseUrl: string;
  getDomainLabel: (url: string) => string;
  onDelete: (slugs: string[]) => void;
  deletingSlugs?: string[];
  onEdit: (link: ShortLink) => void;
  onViewTarget: (link: ShortLink) => void;
  onViewStats: (slug: string) => void;
  onViewQr: (slug: string) => void;
  
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

interface ShortlinkRowProps {
  link: ShortLink;
  baseUrl: string;
  getDomainLabel: (url: string) => string;
  onViewStats: (slug: string) => void;
  onViewQr: (slug: string) => void;
  onEdit: (link: ShortLink) => void;
  selected: boolean;
  onToggleSelect: (slug: string) => void;
  isDeleting?: boolean;
  isCopied: boolean;
  onCopy: (slug: string) => void;
}

function ShortlinkRow({ 
  link, 
  baseUrl, 
  getDomainLabel, 
  onViewStats, 
  onViewQr, 
  onEdit, 
  selected, 
  onToggleSelect,
  isDeleting,
  isCopied,
  onCopy
}: ShortlinkRowProps) {
  const shortUrl = `${baseUrl}/${link.slug}`;
  const domainLabel = getDomainLabel(link.targetUrl);

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl).then(() => {
      onCopy(link.slug);
    }).catch(() => {});
  };

  const getExpiryStatus = () => {
    if (!link.expiresAt) return null;
    const now = new Date();
    const expiry = new Date(link.expiresAt);
    const isExpired = now > expiry;
    const dateStr = expiry.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

    if (isExpired) {
      return (
        <span className="text-[9px] bg-red-100 text-red-800 border border-(--db-border) px-1.5 py-0.5 flex items-center gap-1 font-bold">
           <AlertTriangle className="h-3 w-3"/> EXP
        </span>
      );
    }
    return (
      <span className="text-[9px] bg-orange-100 text-orange-800 border border-(--db-border) px-1.5 py-0.5 flex items-center gap-1 font-bold" title={expiry.toLocaleString()}>
         <Clock className="h-3 w-3"/> {dateStr}
      </span>
    );
  };

  return (
    <div className={`db-card group relative p-2.5 lg:p-3 flex flex-col justify-between h-full ${selected ? "ring-4 ring-(--db-primary) ring-offset-2 z-10" : ""} ${isDeleting ? "animate-shrink-out pointer-events-none" : ""}`}>
      
      <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
              <input 
                type="checkbox" 
                checked={selected} 
                onChange={() => onToggleSelect(link.slug)}
                className="w-3.5 h-3.5 accent-(--db-primary) cursor-pointer"
              />
              <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-black uppercase tracking-tighter text-(--db-text-muted) leading-none">Slug</span>
                  <a href={shortUrl} target="_blank" className={`truncate bg-(--db-accent) text-(--db-accent-fg) text-[10px] lg:text-xs font-black px-2 py-1 border-2 border-(--db-border) shadow-[2px_2px_0px_0px_var(--db-border)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center gap-1 cursor-pointer ${isCopied ? "animate-copy-flash" : ""}`}>
                      /{link.slug} <ExternalLink className="h-3 w-3"/>
                  </a>
              </div>
          </div>
          {getExpiryStatus()}
      </div>
      
      <div className="mb-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-(--db-text-muted) font-mono bg-(--db-bg) p-1.5 border border-(--db-border) w-full">
              <span className="truncate flex-1 block text-(--db-text)" title={link.targetUrl}>{domainLabel}</span>
          </div>
          <span className="text-[9px] font-bold text-(--db-text-muted) mt-1 block text-right">
            {new Date(link.createdAt).toLocaleDateString()}
          </span>
      </div>

      <div className="grid grid-cols-4 gap-2 pt-2 border-t-2 border-dashed border-(--db-border) mt-auto">
          <button onClick={() => onViewStats(link.slug)} className="py-1 border border-(--db-border) bg-blue-50 text-blue-900 hover:bg-blue-200 transition-colors flex justify-center items-center" title="Stats">
              <BarChart3 className="h-3.5 w-3.5" />
          </button>
          
          <button onClick={() => onEdit(link)} className="py-1 border border-(--db-border) bg-orange-50 text-orange-900 hover:bg-orange-200 transition-colors flex justify-center items-center" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
          </button>

          <button onClick={() => onViewQr(link.slug)} className="py-1 border border-(--db-border) bg-yellow-50 text-yellow-900 hover:bg-yellow-200 transition-colors flex justify-center items-center" title="QR">
              <QrCode className="h-3.5 w-3.5" />
          </button>
          
          <button onClick={handleCopy} className={`py-1 border border-(--db-border) transition-all flex justify-center items-center gap-1 font-bold text-[10px] ${isCopied ? "animate-copy-flash" : "bg-green-50 text-green-900 hover:bg-green-200"}`}>
              {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
      </div>
    </div>
  );
}


export function ExistingShortlinksCard({ 
    links, loadingTable, baseUrl, getDomainLabel, 
    onDelete, deletingSlugs = [], onEdit, onViewStats, onViewQr, 
    currentPage, totalPages, totalItems, onPageChange 
}: ExistingShortlinksCardProps) {
  
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const handleCopy = (slug: string) => {
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 600);
  };

  const filteredLinks = useMemo(() => {
    if (!search) return links;
    return links.filter(l => 
        l.slug.toLowerCase().includes(search.toLowerCase()) || 
        l.targetUrl.toLowerCase().includes(search.toLowerCase())
    );
  }, [links, search]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredLinks.length && filteredLinks.length > 0) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(filteredLinks.map(l => l.slug)));
    }
  };

  const toggleSelection = (slug: string) => {
    const next = new Set(selectedIds);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    onDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  return (
    <div className="h-full flex flex-col relative">
      
      <div className="mb-4 flex flex-col gap-3 border-b-4 border-(--db-border) pb-3">
        <div className="flex items-center justify-between">
            <h2 className="text-lg lg:text-xl font-black uppercase tracking-tighter text-(--db-text)">
                Links <span className="text-(--db-text-muted) text-sm lg:text-lg">({totalItems})</span>
            </h2>
        </div>

        <div className="flex gap-2">
            <div className="relative flex-1">
                <input 
                    className="w-full bg-(--db-bg) border-2 border-(--db-border) pl-8 pr-4 py-1.5 text-xs lg:text-sm font-bold text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all placeholder:font-normal"
                    placeholder="Filter current page..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-(--db-text-muted)" />
                {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2.5 top-2 hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
            
            {selectedIds.size > 0 && (
                <button 
                    onClick={handleBulkDelete}
                    className="bg-red-500 text-white border-2 border-(--db-border) px-3 font-black uppercase text-[10px] flex items-center gap-1 hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all"
                >
                    <Trash2 className="h-3.5 w-3.5"/> DEL ({selectedIds.size})
                </button>
            )}
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold text-(--db-text)">
            <input 
                type="checkbox" 
                className="w-3.5 h-3.5 accent-(--db-primary) cursor-pointer"
                checked={filteredLinks.length > 0 && selectedIds.size === filteredLinks.length}
                onChange={handleSelectAll}
                disabled={filteredLinks.length === 0}
            />
            <span>SELECT ALL</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 md:pr-2 pb-4">
        {loadingTable ? (
            <div className="text-center p-10 font-bold animate-pulse text-(--db-text-muted) text-xs">LOADING DATA...</div>
        ) : filteredLinks.length === 0 ? (
            <div className="border-4 border-(--db-border) border-dashed p-8 text-center bg-(--db-surface)">
                <p className="font-black text-sm lg:text-lg mb-1 text-(--db-text)">NO LINKS.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 lg:gap-4">
                {filteredLinks.map((link) => (
                  <ShortlinkRow 
                    key={link.id} 
                    link={link} 
                    baseUrl={baseUrl} 
                    getDomainLabel={getDomainLabel} 
                    onEdit={onEdit}
                    onViewStats={onViewStats} 
                    onViewQr={onViewQr} 
                    selected={selectedIds.has(link.slug)}
                    onToggleSelect={toggleSelection}
                    isDeleting={deletingSlugs.includes(link.slug)}
                    isCopied={copiedSlug === link.slug}
                    onCopy={handleCopy}
                  />
                ))}
            </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pt-4 border-t-4 border-(--db-border) flex items-center justify-between gap-2 mt-auto">
            <button 
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border-2 border-(--db-border) bg-(--db-surface) hover:bg-(--db-bg) disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronLeft className="h-4 w-4 text-(--db-text)"/>
            </button>
            
            <span className="text-xs font-black text-(--db-text)">
                PAGE {currentPage} / {totalPages}
            </span>

            <button 
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border-2 border-(--db-border) bg-(--db-surface) hover:bg-(--db-bg) disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronRight className="h-4 w-4 text-(--db-text)"/>
            </button>
        </div>
      )}
    </div>
  );
}
