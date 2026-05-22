/**
 * Default site OG image — used for /, /about, /journal.
 * Same dark card design with brand tagline.
 */
import { ImageResponse } from 'next/og';

import { loadOgFonts, type OgFont } from '@/lib/og-utils';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const { interBold, mono } = await loadOgFonts();

  const fonts: OgFont[] = [];
  if (interBold) fonts.push({ name: 'Inter', data: interBold, style: 'normal', weight: 700 });
  if (mono) fonts.push({ name: 'JetBrains Mono', data: mono, style: 'normal', weight: 400 });

  const fontSans = fonts.some((f) => f.name === 'Inter') ? 'Inter, sans-serif' : 'sans-serif';
  const fontMono = fonts.some((f) => f.name === 'JetBrains Mono') ? 'JetBrains Mono, monospace' : 'monospace';
  const accent = '#4ADE80'; // brand green for the default card

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
            AI JOURNAL
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 48, height: 3, backgroundColor: accent, marginBottom: 24 }} />
          <span
            style={{
              fontFamily: fontSans,
              color: '#ECECEC',
              fontSize: 58,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: -1,
            }}
          >
            The AI stack moves too fast to follow.
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <span style={{ fontFamily: fontMono, color: '#4B5563', fontSize: 16 }}>
            Daily. Sourced. No hype.
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
