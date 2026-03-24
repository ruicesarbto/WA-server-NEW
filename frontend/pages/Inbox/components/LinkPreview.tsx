'use client';

import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { api } from '@/lib/api';

interface PreviewData {
    title: string;
    description: string;
    image: string;
    url: string;
    domain: string;
}

// Simple in-memory cache so the same URL is only fetched once per page load
const cache = new Map<string, PreviewData | null>();

interface LinkPreviewProps {
    url: string;
    isOut: boolean;
}

const LinkPreview: React.FC<LinkPreviewProps> = ({ url, isOut }) => {
    const [data, setData] = useState<PreviewData | null>(cache.has(url) ? cache.get(url)! : undefined as any);
    const [loading, setLoading] = useState(!cache.has(url));

    useEffect(() => {
        if (cache.has(url)) {
            setData(cache.get(url) ?? null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        api.get(`/link-preview?url=${encodeURIComponent(url)}`)
            .then((d: PreviewData) => {
                if (cancelled) return;
                const value = d?.title ? d : null;
                cache.set(url, value);
                setData(value);
            })
            .catch(() => {
                if (!cancelled) {
                    cache.set(url, null);
                    setData(null);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [url]);

    if (loading) {
        return (
            <div className={`mt-2 rounded-xl overflow-hidden border animate-pulse ${isOut ? 'border-green-200' : 'border-gray-100'}`}>
                <div className={`h-24 ${isOut ? 'bg-green-100' : 'bg-gray-100'}`} />
                <div className="p-2.5 space-y-1.5">
                    <div className={`h-2 rounded w-1/3 ${isOut ? 'bg-green-200' : 'bg-gray-200'}`} />
                    <div className={`h-3 rounded w-4/5 ${isOut ? 'bg-green-200' : 'bg-gray-200'}`} />
                    <div className={`h-2 rounded w-3/5 ${isOut ? 'bg-green-100' : 'bg-gray-100'}`} />
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`mt-2 block rounded-xl overflow-hidden border transition-all hover:shadow-md active:scale-[0.98] no-underline ${isOut
                ? 'border-green-200 bg-white/70 hover:bg-white/90'
                : 'border-gray-200 bg-gray-50 hover:bg-white'
                }`}
        >
            {data.image && (
                <img
                    src={data.image}
                    alt={data.title}
                    className="w-full max-h-[160px] object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
            )}
            <div className="px-3 py-2.5">
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    <Globe className="w-3 h-3 shrink-0" />
                    <span className="truncate">{data.domain}</span>
                </div>
                {data.title && (
                    <p className="text-[13px] font-bold text-gray-800 leading-tight line-clamp-2">
                        {data.title}
                    </p>
                )}
                {data.description && (
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                        {data.description}
                    </p>
                )}
            </div>
        </a>
    );
};

// URL extraction helper (exported for use in MessageBubble)
const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]{4,}/;
export const extractFirstUrl = (text: string | null | undefined): string | null => {
    if (!text) return null;
    const m = text.match(URL_RE);
    return m ? m[0] : null;
};

// Renders plain text with URLs converted to clickable <a> tags
export const renderTextWithLinks = (text: string): React.ReactNode[] => {
    const parts = text.split(/(https?:\/\/[^\s<>"{}|\\^`[\]]{4,})/g);
    return parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
            return (
                <a
                    key={i}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 underline break-all hover:text-blue-700"
                >
                    {part}
                </a>
            );
        }
        return <span key={i}>{part}</span>;
    });
};

export default LinkPreview;
