import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "./components/BottomNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PickleGo 匹克球臨打",
  description: "Fast, Clean, Intuitive",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="bg-gray-200 flex justify-center items-start min-h-[100dvh]">
        {/* 手機版專屬容器：鎖定高度 100dvh，內部上下固定、中間滾動 */}
        <div className="w-full max-w-md bg-[#F8F9FA] h-[100dvh] flex flex-col relative shadow-xl overflow-hidden">

          {/* 1. 頂部廣告預留版位（固定不動） */}
          <div className="shrink-0 h-11 bg-gray-100 border-b border-gray-200 flex items-center justify-center z-40">
            <span className="text-[11px] text-gray-400 tracking-widest font-medium">
              ADVERTISEMENT 廣告預留區
            </span>
          </div>

          {/* 2. 中間可滾動內容區 */}
          <main className="flex-1 overflow-y-auto overscroll-contain">
            {children}
          </main>

          {/* 3. 底部固定導覽列 */}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}