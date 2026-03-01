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
  onEdit: (link: ShortLink) => void;
  onViewTarget: (link: ShortLink) => void;
  onViewStats: (slug: string) => void;
  onViewQr: (slug: string) => void;
  
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

function ShortlinkRow({ 
  link, 
  baseUrl, 
  getDomainLabel, 
  onViewStats, 
  onViewQr, 
  onEdit, 
  selected, 
  onToggleSelect 
}: any) {
  const [copied, setCopied] = useState(false);
  const shortUrl = `${baseUrl}/${link.slug}`;
  const domainLabel = getDomainLabel(link.targetUrl);

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
        <span className="text-[9px] bg-red-100 text-red-800 border border-[var(--db-border)] px-1.5 py-0.5 flex items-center gap-1 font-bold">
           <AlertTriangle className="h-3 w-3"/> EXP
        </span>
      );
    }
    return (
      <span className="text-[9px] bg-orange-100 text-orange-800 border border-[var(--db-border)] px-1.5 py-0.5 flex items-center gap-1 font-bold" title={expiry.toLocaleString()}>
         <Clock className="h-3 w-3"/> {dateStr}
      </span>
    );
  };

  return (
    <div className={`group relative bg-[var(--db-surface)] border-2 border-[var(--db-border)] p-2.5 lg:p-3 shadow-[3px_3px_0px_0px_var(--db-border)] transition-all flex flex-col justify-between h-full ${selected ? "ring-2 ring-[var(--db-primary)] ring-offset-1" : ""}`}>
      
      <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
              <input 
                type="checkbox" 
                checked={selected} 
                onChange={() => onToggleSelect(link.slug)}
                className="w-3.5 h-3.5 accent-[var(--db-primary)] cursor-pointer"
              />
              <a href={shortUrl} target="_blank" className="truncate bg-[var(--db-accent)] text-[var(--db-accent-fg)] text-[10px] lg:text-xs font-black px-2 py-0.5 border border-[var(--db-border)] hover:opacity-80 flex items-center gap-1 cursor-pointer">
                  /{link.slug} <ExternalLink className="h-3 w-3"/>
              </a>
          </div>
          {getExpiryStatus()}
      </div>
      
      <div className="mb-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--db-text-muted)] font-mono bg-[var(--db-bg)] p-1.5 border border-[var(--db-border)] w-full">
              <span className="truncate flex-1 block text-[var(--db-text)]" title={link.targetUrl}>{domainLabel}</span>
          </div>
          <span className="text-[9px] font-bold text-[var(--db-text-muted)] mt-1 block text-right">
            {new Date(link.createdAt).toLocaleDateString()}
          </span>
      </div>

      <div className="grid grid-cols-4 gap-2 pt-2 border-t-2 border-dashed border-[var(--db-border)] mt-auto">
          <button onClick={() => onViewStats(link.slug)} className="py-1 border border-[var(--db-border)] bg-blue-50 text-blue-900 hover:bg-blue-200 transition-colors flex justify-center items-center" title="Stats">
              <BarChart3 className="h-3.5 w-3.5" />
          </button>
          
          <button onClick={() => onEdit(link)} className="py-1 border border-[var(--db-border)] bg-orange-50 text-orange-900 hover:bg-orange-200 transition-colors flex justify-center items-center" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
          </button>

          <button onClick={() => onViewQr(link.slug)} className="py-1 border border-[var(--db-border)] bg-yellow-50 text-yellow-900 hover:bg-yellow-200 transition-colors flex justify-center items-center" title="QR">
              <QrCode className="h-3.5 w-3.5" />
          </button>
          
          <button onClick={handleCopy} className={`py-1 border border-[var(--db-border)] transition-all flex justify-center items-center gap-1 font-bold text-[10px] ${copied ? "bg-green-500 text-white border-green-700" : "bg-green-50 text-green-900 hover:bg-green-200"}`}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
      </div>
    </div>
  );
}

export function ExistingShortlinksCard({ 
    links, loadingTable, baseUrl, getDomainLabel, 
    onDelete, onEdit, onViewStats, onViewQr, 
    currentPage, totalPages, totalItems, onPageChange 
}: ExistingShortlinksCardProps) {
  
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      
      <div className="mb-4 flex flex-col gap-3 border-b-4 border-[var(--db-border)] pb-3">
        <div className="flex items-center justify-between">
            <h2 className="text-lg lg:text-xl font-black uppercase tracking-tighter text-[var(--db-text)]">
                Links <span className="text-[var(--db-text-muted)] text-sm lg:text-lg">({totalItems})</span>
            </h2>
        </div>

        <div className="flex gap-2">
            <div className="relative flex-1">
                <input 
                    className="w-full bg-[var(--db-bg)] border-2 border-[var(--db-border)] pl-8 pr-4 py-1.5 text-xs lg:text-sm font-bold text-[var(--db-text)] focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all placeholder:font-normal"
                    placeholder="Filter current page..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[var(--db-text-muted)]" />
                {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2.5 top-2 hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
            
            {selectedIds.size > 0 && (
                <button 
                    onClick={handleBulkDelete}
                    className="bg-red-500 text-white border-2 border-[var(--db-border)] px-3 font-black uppercase text-[10px] flex items-center gap-1 hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all"
                >
                    <Trash2 className="h-3.5 w-3.5"/> DEL ({selectedIds.size})
                </button>
            )}
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--db-text)]">
            <input 
                type="checkbox" 
                className="w-3.5 h-3.5 accent-[var(--db-primary)] cursor-pointer"
                checked={filteredLinks.length > 0 && selectedIds.size === filteredLinks.length}
                onChange={handleSelectAll}
                disabled={filteredLinks.length === 0}
            />
            <span>SELECT ALL</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 md:pr-2 pb-4">
        {loadingTable ? (
            <div className="text-center p-10 font-bold animate-pulse text-[var(--db-text-muted)] text-xs">LOADING DATA...</div>
        ) : filteredLinks.length === 0 ? (
            <div className="border-4 border-[var(--db-border)] border-dashed p-8 text-center bg-[var(--db-surface)]">
                <p className="font-black text-sm lg:text-lg mb-1 text-[var(--db-text)]">NO LINKS.</p>
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
                  />
                ))}
            </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pt-4 border-t-4 border-[var(--db-border)] flex items-center justify-between gap-2 mt-auto">
            <button 
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 border-2 border-[var(--db-border)] bg-[var(--db-surface)] hover:bg-[var(--db-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronLeft className="h-4 w-4 text-[var(--db-text)]"/>
            </button>
            
            <span className="text-xs font-black text-[var(--db-text)]">
                PAGE {currentPage} / {totalPages}
            </span>

            <button 
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 border-2 border-[var(--db-border)] bg-[var(--db-surface)] hover:bg-[var(--db-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronRight className="h-4 w-4 text-[var(--db-text)]"/>
            </button>
        </div>
      )}
    </div>
  );
}
