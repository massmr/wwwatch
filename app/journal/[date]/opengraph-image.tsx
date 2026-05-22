/**
 * Per-edition OG image — 1200×630, center-safe layout.
 */
import { ImageResponse } from 'next/og';

import { formatDay } from '@/lib/format';
import { loadOgFonts, type OgFont } from '@/lib/og-utils';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ date: string }> };

export default async function Image({ params }: Props) {
  const { date } = await params;
  const { interBold, mono } = await loadOgFonts();

  const fonts: OgFont[] = [];
  if (interBold) fonts.push({ name: 'Inter', data: interBold, style: 'normal', weight: 700 });
  if (mono) fonts.push({ name: 'JetBrains Mono', data: mono, style: 'normal', weight: 400 });

  const fontSans = fonts.some((f) => f.name === 'Inter') ? 'Inter, sans-serif' : 'sans-serif';
  const fontMono = fonts.some((f) => f.name === 'JetBrains Mono') ? 'JetBrains Mono, monospace' : 'monospace';
  const accent = '#94A3B8';

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
          padding: '60px 300px',
        }}
      >
        <span style={{ fontFamily: fontMono, color: '#6B7280', fontSize: 18, letterSpacing: 3, marginBottom: 32 }}>
          wwwatch
        </span>

        <div style={{ width: 48, height: 3, backgroundColor: accent, marginBottom: 24 }} />

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
          {formatDay(date)}
        </span>

        <span style={{ fontFamily: fontMono, color: accent, fontSize: 13, letterSpacing: 3 }}>
          DAILY JOURNAL
        </span>
      </div>
    ),
    { ...size, fonts },
  );
}
