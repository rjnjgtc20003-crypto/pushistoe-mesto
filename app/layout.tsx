import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Пушистое место',
  description: 'Трёхмерный пушистик, которого можно погладить, похлопать по голове и потискать.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
