//components/CreateShortlinkCard.tsx

"use client";

import { useState } from "react";
import { Calendar, Lock, Link2, ArrowRight, Loader2, ChevronDown, ChevronUp, Settings2 } from "lucide-react";

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
  const isTyping = targetUrl.length > 0 || slug.length > 0 || password.length > 0;

  return (
    <div className={`db-card db-card-accent p-4 lg:p-5 ${isTyping ? 'animate-border-pulse' : ''}`}>
      
      <div className="mb-4 lg:mb-5 flex items-center gap-3 border-b-2 md:border-b-4 border-(--db-border) pb-3">
        <div className="bg-(--db-accent) p-1.5 border-2 border-(--db-border) shadow-[2px_2px_0px_0px_var(--db-border)]">
            <Link2 className="h-5 w-5 text-(--db-accent-fg)" />
        </div>
        <h2 className="text-lg lg:text-xl font-black uppercase tracking-tighter text-(--db-text)">New Link</h2>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} autoComplete="off">
        
        <div className="space-y-1">
          <label className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-(--db-text-muted)">Target URL</label>
          <input
            className="w-full bg-(--db-bg) border-2 border-(--db-border) px-3 py-2.5 text-sm font-bold text-(--db-text) db-input-focus placeholder:font-normal"
            placeholder="https://example.com"
            value={targetUrl}
            onChange={(e) => onChangeTarget(e.target.value)}
            required
            disabled={loading}
            autoComplete="off"
            name="target_url_unique"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-(--db-text-muted)">Custom Slug (Optional)</label>
          <div className="flex">
            <span className="bg-(--db-text-muted) text-(--db-bg) px-3 py-2.5 text-sm font-mono font-bold flex items-center border-2 border-(--db-border) border-r-0">/</span>
            <input
              className="w-full bg-(--db-bg) border-2 border-(--db-border) px-3 py-2.5 text-sm font-bold text-(--db-text) db-input-focus placeholder:font-normal"
              placeholder="link"
              value={slug}
              onChange={(e) => onChangeSlug(e.target.value)}
              disabled={loading}
              autoComplete="off"
              name="slug_unique"
            />
          </div>
        </div>

        <div className="border-2 border-(--db-border) bg-(--db-bg) transition-all hover:bg-(--db-surface) focus-within:shadow-[4px_4px_0px_0px_var(--db-border)] focus-within:border-(--db-primary)">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 focus:outline-none hover:bg-(--db-surface) active:bg-(--db-bg) transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-(--db-text-muted)" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-(--db-text-muted)">
                        Advanced Settings {(password || expiresAt) && <span className="text-(--db-primary)">• Active</span>}
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-(--db-text)" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-(--db-text)" />
                )}
            </button>
            
            {isExpanded && (
                <div className="p-3 pt-0 grid grid-cols-1 gap-3 animate-in slide-in-from-top-1 fade-in duration-200">
                    <div className="h-px bg-(--db-border)/20 mb-1 w-full"></div>
                    
                    <div className="flex items-center gap-2 bg-(--db-surface) border-2 border-(--db-border) px-2 py-2 focus-within:shadow-[2px_2px_0px_0px_var(--db-border)] transition-shadow">
                        <Lock className="h-4 w-4 text-(--db-text) shrink-0" />
                        <input
                            type="text"
                            className="w-full bg-transparent border-none text-xs font-medium text-(--db-text) focus:ring-0 focus:outline-none p-0 placeholder:text-(--db-text-muted) db-input-focus"
                            placeholder="Password Protection (Optional)"
                            value={password}
                            onChange={(e) => onChangePassword(e.target.value)}
                            disabled={loading}
                            
                            autoComplete="new-password" 
                            name="link_lock_password_unique" 
                            data-lpignore="true" 
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 bg-(--db-surface) border-2 border-(--db-border) px-2 py-2 focus-within:shadow-[2px_2px_0px_0px_var(--db-border)] transition-shadow">
                        <Calendar className="h-4 w-4 text-(--db-text) shrink-0" />
                        <input
                            type="datetime-local"
                            className="w-full bg-transparent border-none text-xs font-medium text-(--db-text) focus:ring-0 focus:outline-none p-0 db-input-focus"
                            value={expiresAt}
                            onChange={(e) => onChangeExpiresAt(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                </div>
            )}
        </div>

        {error && (
          <div className="bg-(--db-danger) text-(--db-danger-fg) text-[10px] lg:text-xs font-bold p-2 lg:p-3 border-2 border-(--db-border) shadow-[2px_2px_0px_0px_var(--db-border)] animate-error-shake">
            ❌ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !targetUrl}
          className="w-full bg-(--db-primary) text-(--db-primary-fg) border-2 border-(--db-border) py-3 lg:py-4 font-black text-xs lg:text-sm uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--db-border)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_var(--db-border)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin"/> : <><ArrowRight className="h-5 w-5" /> SHORTEN IT!</>}
        </button>
      </form>
    </div>
  );
}
