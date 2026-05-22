/**
 * Per-edition OG image — same dark card design, neutral accent.
 * Title: "wwwatch · {formatted date}".
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
  const accent = '#94A3B8'; // neutral slate for editions
  const formattedDate = formatDay(date);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          backgroundColor: '#0C0E12',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 64px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontFamily: fontMono, color: '#ECECEC', fontSize: 22, letterSpacing: 2 }}>
            wwwatch
          </span>
          <span style={{ fontFamily: fontMono, color: accent, fontSize: 13, letterSpacing: 3 }}>
            DAILY JOURNAL
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 48, height: 3, backgroundColor: accent, marginBottom: 24 }} />
          <span
            style={{
              fontFamily: fontSans,
              color: '#ECECEC',
              fontSize: 62,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: -1,
            }}
          >
            {formattedDate}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <span style={{ fontFamily: fontMono, color: '#4B5563', fontSize: 16 }}>
            {date}
          </span>
          <span style={{ fontFamily: fontMono, color: '#4B5563', fontSize: 16 }}>
            wwwatch.dev
          </span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
