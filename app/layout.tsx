import './globals.css';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';

export const metadata = { title: 'StockLooker', description: 'Internal sales lookup tool' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
