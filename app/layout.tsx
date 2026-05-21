import type { Metadata } from 'next';
import './_styles/globals.scss';

export const metadata: Metadata = {
  title: 'wwwatch — AI intel for product engineers',
  description:
    'A daily journal of what moved in AI — models, tools, research, funding. Curated for builders, not hype-followers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
