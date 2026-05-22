/**
 * Per-article OG image — 1200×630, center-safe layout.
 *
 * WhatsApp crops to ~600×600 from the horizontal center of the image.
 * All critical content (title, category, brand) lives in the center 600px
 * so it survives both the full 1200×630 render (Twitter, Google Discover)
 * and the square crop (WhatsApp, iMessage).
 */
import { ImageResponse } from 'next/og';

import { getArticle } from '@/lib/db';
import { accentForCategory, loadOgFonts, truncateOgTitle, type OgFont } from '@/lib/og-utils';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ date: string; slug: string }> };

export default async function Image({ params }: Props) {
  const { date, slug } = await params;
  const [article, { interBold, mono }] = await Promise.all([
    getArticle(date, slug),
    loadOgFonts(),
  ]);

  if (!article) return new Response('Not found', { status: 404 });

  const title = truncateOgTitle(article.title);
  const category = article.category;
  const accent = accentForCategory(category);
  const categoryLabel = category.replace(/_/g, ' ').toUpperCase();

  const fonts: OgFont[] = [];
  if (interBold) fonts.push({ name: 'Inter', data: interBold, style: 'normal', weight: 700 });
  if (mono) fonts.push({ name: 'JetBrains Mono', data: mono, style: 'normal', weight: 400 });

  const fontSans = fonts.some((f) => f.name === 'Inter') ? 'Inter, sans-serif' : 'sans-serif';
  const fontMono = fonts.some((f) => f.name === 'JetBrains Mono') ? 'JetBrains Mono, monospace' : 'monospace';

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          backgroundColor: '#0C0E12',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 300px', // 300px H padding = 600px safe zone for WhatsApp crop
        }}
      >
        {/* Wordmark */}
        <span style={{ fontFamily: fontMono, color: '#6B7280', fontSize: 18, letterSpacing: 3, marginBottom: 32 }}>
          wwwatch
        </span>

        {/* Accent line */}
        <div style={{ width: 48, height: 3, backgroundColor: accent, marginBottom: 24 }} />

        {/* Title — centred, dominant */}
        <span
          style={{
            fontFamily: fontSans,
            color: '#ECECEC',
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1,
            textAlign: 'center',
            marginBottom: 28,
          }}
        >
          {title}
        </span>

        {/* Category pill */}
        <span
          style={{
            fontFamily: fontMono,
            color: accent,
            fontSize: 13,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          {categoryLabel}
        </span>
      </div>
    ),
    { ...size, fonts },
  );
}
