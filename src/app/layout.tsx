export const metadata = {
  title: "Triple D API",
  description: "Triple D SaaS backend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
