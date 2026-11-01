import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "揪居家",
  description: "讓不同住的子女，也能顧好爸媽家的居安規劃",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
