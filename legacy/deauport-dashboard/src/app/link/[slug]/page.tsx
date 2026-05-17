"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, H1, Subtle } from '@/components/ui';
import { Shell } from '@/components/shell';
import { Skeleton } from '@/components/skeleton';

type ShortLink = {
  slug: string;
  targetUrl: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export default function LinkPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [link, setLink] = useState<ShortLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!slug) return;

    async function fetchLink() {
      try {
        const res = await fetch(`${API_BASE}/api/shortlinks/${slug}`);
        if (!res.ok) {
          throw new Error('Link tidak ditemukan atau tidak aktif.');
        }
        const data: ShortLink = await res.json();
        setLink(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Terjadi error yang tidak diketahui.');
        }
      }
    }

    fetchLink();
  }, [slug]);

  useEffect(() => {
    if (link && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (link && countdown === 0) {
      window.location.href = link.targetUrl;
    }
  }, [link, countdown]);

  const renderContent = () => {
    if (error) {
      return (
        <Card className="text-center">
          <H1>Error</H1>
          <p className="mt-2 text-subtle">{error}</p>
        </Card>
      );
    }

    if (!link) {
      return (
        <Card>
          <Skeleton className="h-8 w-1/2 mb-4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-12 w-1/3 mt-6 mx-auto" />
        </Card>
      );
    }

    return (
      <Card className="text-center">
        <H1>Anda akan diarahkan</H1>
        <Subtle className="mt-2">
          Anda akan segera dialihkan ke tujuan berikut:
        </Subtle>
        <div className="my-4 p-2 bg-[var(--surface-2)] rounded-md text-sm truncate">
          {link.targetUrl}
        </div>
        <a 
          href={link.targetUrl} 
          className="btn btn-primary inline-flex"
        >
          Lanjutkan Sekarang ({countdown})
        </a>
      </Card>
    );
  };
  
  return (
    <Shell>
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-lg">
          {renderContent()}
        </div>
      </div>
    </Shell>
  );
}