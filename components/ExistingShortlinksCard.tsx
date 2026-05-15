//components/ExistingShortlinksCard.tsx

"use client";

import { useState, useMemo } from "react";
import { Copy, Trash, QrCode, ChartBar, ArrowSquareOut, Check, MagnifyingGlass, X, PencilSimple, CaretLeft, CaretRight, CircleNotch } from "@phosphor-icons/react";

export interface ShortLink {
  id: string;
  slug: string;
  targetUrl: string;
  createdAt: string;
  expiresAt?: string | null;
  _count?: { clicks: number };
}

interface ExistingShortlinksCardProps {
  links: ShortLink[];
  loadingTable: boolean;
  baseUrl: string;
  getDomainLabel: (url: string) => string;
  onDelete: (slugs: string[]) => void;
  deletingSlugs?: string[];
  onEdit: (link: ShortLink) => void;
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
  link, baseUrl, getDomainLabel, onViewStats, onViewQr, onEdit,
  selected, onToggleSelect, isDeleting, isCopied, onCopy
}: ShortlinkRowProps) {
  const shortUrl = `${baseUrl}/${link.slug}`;
  const domainLabel = getDomainLabel(link.targetUrl);
  const clickCount = link._count?.clicks || 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl).then(() => onCopy(link.slug)).catch(() => {});
  };

  const isExpired = link.expiresAt && new Date() > new Date(link.expiresAt);

  return (
    <div className={`db-card p-4 sm:p-5 flex items-start sm:items-center gap-3 sm:gap-4 transition-all duration-500 hover:shadow-xl bg-(--db-surface) ${selected ? "border-(--db-primary)/40 bg-(--db-primary)/3" : ""} ${isDeleting ? "opacity-0 scale-95 pointer-events-none" : ""}`}>

      <div className="shrink-0 mt-1 sm:mt-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(link.slug)}
          className="w-4 h-4 accent-(--db-primary) cursor-pointer"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
        <div className="flex flex-col min-w-0 sm:flex-1">
          <a
            href={shortUrl}
            target="_blank"
            className={`font-dot text-base sm:text-lg font-bold truncate flex items-center gap-1.5 transition-colors ${isCopied ? "text-(--db-primary)" : "text-(--db-text) hover:text-(--db-primary)"}`}
          >
            /{link.slug}
            <ArrowSquareOut size={12} className="opacity-20 shrink-0" />
          </a>
          <span className="text-xs font-semibold text-(--db-text-muted) truncate opacity-50 mt-0.5" title={link.targetUrl}>
            {domainLabel}
          </span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex flex-col">
            <span className="nothing-label text-[8px] mb-0.5">Hits</span>
            <span className="text-sm font-black text-(--db-text) tracking-tighter">{clickCount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="nothing-label text-[8px] mb-0.5">Status</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isExpired ? "bg-(--db-danger)" : "bg-(--db-primary) shadow-[0_0_6px_rgba(163,230,53,0.5)]"}`} />
              <span className="nothing-label tracking-normal text-[8px] opacity-40">
                {isExpired ? "EXPIRED" : link.expiresAt ? "TEMP" : "LIVE"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onViewStats(link.slug)} className="p-2 rounded-full hover:bg-(--db-primary)/15 text-(--db-text-muted) hover:text-(--db-primary) transition-all" title="Analytics">
          <ChartBar size={15} />
        </button>
        <button onClick={() => onEdit(link)} className="p-2 rounded-full hover:bg-(--db-primary)/15 text-(--db-text-muted) hover:text-(--db-primary) transition-all" title="Edit">
          <PencilSimple size={15} />
        </button>
        <button onClick={() => onViewQr(link.slug)} className="p-2 rounded-full hover:bg-(--db-primary)/15 text-(--db-text-muted) hover:text-(--db-primary) transition-all" title="QR Code">
          <QrCode size={15} />
        </button>
        <button
          onClick={handleCopy}
          className={`p-2 rounded-full transition-all ${isCopied ? "bg-(--db-primary) text-(--db-primary-fg) shadow-lg shadow-(--db-primary)/20" : "hover:bg-(--db-primary)/15 text-(--db-text-muted) hover:text-(--db-primary)"}`}
          title="Copy"
        >
          {isCopied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}


export function ExistingShortlinksCard({
  links, loadingTable, baseUrl, getDomainLabel,
  onDelete, deletingSlugs = [], onEdit, onViewStats, onViewQr,
  currentPage, totalPages, onPageChange
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
    <div className="flex flex-col gap-5 sm:gap-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-(--db-surface) border border-(--db-border) rounded-3xl p-4 sm:p-5">
        <div className="relative flex-1 max-w-sm">
          <input
            className="db-input pl-10!"
            placeholder="Search link logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <MagnifyingGlass size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) pointer-events-none z-10" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-(--db-primary) transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-(--db-surface-hover) rounded-full border border-(--db-border)">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-(--db-primary) cursor-pointer"
              checked={filteredLinks.length > 0 && selectedIds.size === filteredLinks.length}
              onChange={handleSelectAll}
              disabled={filteredLinks.length === 0}
            />
            <span className="nothing-label opacity-100 text-[9px]">All</span>
          </div>

          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete} className="btn-danger py-2 px-5 text-[10px] nothing-label opacity-100">
              <Trash size={13} /> TERMINATE ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loadingTable ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 opacity-30">
            <CircleNotch size={36} className="animate-spin text-(--db-primary)" />
            <span className="nothing-label">Syncing_Records...</span>
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="db-card border-dashed p-16 text-center bg-transparent">
            <p className="nothing-label text-sm mb-1">NO_RECORDS_FOUND</p>
            <p className="nothing-label normal-case tracking-normal opacity-30 text-[10px] mt-2">System database returned null for this query.</p>
          </div>
        ) : (
          filteredLinks.map((link, idx) => (
            <div key={link.id} className="animate-item-enter" style={{ animationDelay: `${idx * 45}ms` }}>
              <ShortlinkRow
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
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-5 py-6">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-3.5 rounded-full border border-(--db-border) bg-(--db-surface) hover:bg-(--db-primary) hover:text-(--db-primary-fg) hover:border-(--db-primary) disabled:opacity-20 transition-all shadow-sm"
          >
            <CaretLeft size={18} />
          </button>

          <div className="flex flex-col items-center">
            <span className="nothing-label opacity-30 mb-0.5">Page</span>
            <span className="text-sm font-black tracking-widest">
              {currentPage} <span className="opacity-20">/</span> {totalPages}
            </span>
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-3.5 rounded-full border border-(--db-border) bg-(--db-surface) hover:bg-(--db-primary) hover:text-(--db-primary-fg) hover:border-(--db-primary) disabled:opacity-20 transition-all shadow-sm"
          >
            <CaretRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
