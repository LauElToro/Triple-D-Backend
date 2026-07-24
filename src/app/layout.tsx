export const metadata = {
  title: "Set-Api API",
  description: "Set-Api SaaS backend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
