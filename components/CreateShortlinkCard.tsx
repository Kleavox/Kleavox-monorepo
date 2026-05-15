//components/CreateShortlinkCard.tsx

"use client";

import { useState } from "react";
import { CalendarBlank, Lock, Link as LinkIcon, ArrowRight, CircleNotch, CaretDown, CaretUp, SlidersHorizontal, Warning } from "@phosphor-icons/react";

interface CreateShortlinkCardProps {
  targetUrl: string;
  slug: string;
  password: string;
  expiresAt: string;
  loading: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onChangeTarget: (value: string) => void;
  onChangeSlug: (value: string) => void;
  onChangePassword: (value: string) => void;
  onChangeExpiresAt: (value: string) => void;
}

export function CreateShortlinkCard({
  targetUrl, slug, password, expiresAt, loading, error, onSubmit,
  onChangeTarget, onChangeSlug, onChangePassword, onChangeExpiresAt,
}: CreateShortlinkCardProps) {

  const [isExpanded, setIsExpanded] = useState(false);
  const isTyping = targetUrl.length > 0;

  return (
    <div className={`db-card p-5 sm:p-8 transition-all duration-700 ${isTyping ? 'shadow-2xl border-(--db-primary)/40' : 'shadow-xl'}`}>

      <div className="mb-6 sm:mb-8 flex items-center gap-4 border-b border-(--db-border)/30 pb-5 sm:pb-6">
        <div className="bg-(--db-primary)/15 p-3 rounded-2xl shrink-0">
          <LinkIcon size={22} className="text-(--db-primary)" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl nothing-title text-(--db-text)">GENERATE_LINK</h2>
          <p className="nothing-label">Infrastructure_Creation_Node</p>
        </div>
      </div>

      <form className="space-y-6 sm:space-y-8" onSubmit={onSubmit} autoComplete="off">

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <label className="nothing-label block ml-2">Destination_Target</label>
            <input
              className="db-input"
              placeholder="https://example.com/resource"
              value={targetUrl}
              onChange={(e) => onChangeTarget(e.target.value)}
              required
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div className="sm:w-44 space-y-2">
            <label className="nothing-label block ml-2">Custom_Slug</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) font-dot text-sm z-10">/</span>
              <input
                className="db-input pl-7!"
                placeholder="my-slug"
                value={slug}
                onChange={(e) => onChangeSlug(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        <div className="db-card rounded-2xl! bg-(--db-surface-hover) overflow-hidden">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-4 px-5 hover:bg-(--db-surface) transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal size={15} className="text-(--db-text-muted)" />
              <span className="nothing-label opacity-100 text-[9px]">
                Advanced_Options {(password || expiresAt) && <span className="text-(--db-primary) ml-2">• ENABLED</span>}
              </span>
            </div>
            {isExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
          </button>

          {isExpanded && (
            <div className="p-5 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-reveal">
              <div className="space-y-2">
                <label className="nothing-label text-[9px] block">Security_Key</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
                    <Lock size={15} />
                  </div>
                  <input
                    type="text"
                    className="db-input pl-10!"
                    placeholder="Lock with password"
                    value={password}
                    onChange={(e) => onChangePassword(e.target.value)}
                    disabled={loading}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="nothing-label text-[9px] block">Self_Destruct_Timer</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
                    <CalendarBlank size={15} />
                  </div>
                  <input
                    type="datetime-local"
                    className="db-input pl-10!"
                    value={expiresAt}
                    onChange={(e) => onChangeExpiresAt(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-500 font-bold p-4 rounded-2xl border border-red-500/20 text-[10px] animate-error-shake uppercase tracking-widest flex items-center gap-3">
            <Warning size={16} weight="fill" className="shrink-0" /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !targetUrl}
          className="btn-primary w-full py-4 sm:py-5 text-sm tracking-[0.3em] disabled:opacity-40"
        >
          {loading ? <CircleNotch size={20} className="animate-spin" /> : <><ArrowRight size={18} /> GENERATE_INFRASTRUCTURE</>}
        </button>
      </form>
    </div>
  );
}
