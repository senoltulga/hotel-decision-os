import type { ReactNode } from "react";

export const metadata = { title: "Gelir Motoru", description: "Gayrimenkul yatırım geri dönüş modeli" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f6f7f9", color: "#1a1d21" }}>
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>{children}</main>
      </body>
    </html>
  );
}
