import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "dawnnav-dynamic.yuchenc705.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "DawnNav · 黎明导航";
  const description = "从动态数据库实时读取的双语知识导航，搜索、筛选与管理都在同一个 Next.js 站点中完成。";

  return {
    title: { default: title, template: "%s · DawnNav" },
    description,
    metadataBase: new URL(origin),
    icons: { icon: "/images/favicon.png" },
    openGraph: {
      type: "website",
      url: origin,
      siteName: "DawnNav",
      title,
      description,
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "DawnNav 黎明导航" }]
    },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] }
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
