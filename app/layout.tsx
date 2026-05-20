import type { Metadata } from 'next';
import './_styles/tokens.scss';
import './_styles/globals.scss';

export const metadata: Metadata = {
  title: 'wwwatch — La veille IA pour product engineers',
  description:
    "Une newsletter hebdo, triée par un product engineer pour les product engineers. Modèles, outils, papers : ce qui change vraiment ta stack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
