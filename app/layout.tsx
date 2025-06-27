import './global.css';

export const metadata = {
  title: 'Opinion Auction Platform',
  description: 'Trade opinions in a dynamic marketplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}