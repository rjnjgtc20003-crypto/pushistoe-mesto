import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Пушистое место',
  description: 'Тихое место, где можно просто побыть рядом с грустным пушистиком.',
  openGraph: {
    title: 'Пушистое место',
    description: 'Здесь не нужно быть в порядке',
    images: [{ url: '/og.png', width: 1732, height: 908, alt: 'Пушистое место' }],
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Пушистое место',
    description: 'Здесь не нужно быть в порядке',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
