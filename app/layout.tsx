import './globals.css';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';

export const metadata = { title: 'StockLooker', description: 'Internal sales lookup tool' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="page-background page-foreground">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
