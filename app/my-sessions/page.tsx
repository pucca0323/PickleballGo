"use client";

import { useState, useEffect } from "react";
// import { supabase } from "../../lib/supabase"; // 實作時請解除註解並確認路徑
import Link from "next/link";
import { Search, CalendarDays, User as UserIcon, Plus, RefreshCw, ChevronRight } from "lucide-react";

export default function MySessionsPage() {
    // 🌟 Phase 3: Segmented Control 狀態 (host: 開團資訊, join: 報名資訊)
    const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
    const [loading, setLoading] = useState(false); // 模擬載入狀態

    // 模擬從 Supabase 取得的資料
    const mockHostedSessions = [
        {
            id: 1,
            title: "龍井運動中心 歡樂臨打",
            date: "11/12 (三)",
            time: "19:00-21:00",
            court: "場地 1",
            joined: 12,
            max: 16,
            actionStatus: "3 筆待核帳", // 行動導向狀態
            statusType: "warning" // warning(黃), success(綠), danger(紅), neutral(灰)
        },
        {
            id: 2,
            title: "沙鹿運動中心 新手友善",
            date: "11/15 (六)",
            time: "14:00-16:00",
            court: "場地 2",
            joined: 16,
            max: 16,
            actionStatus: "已額滿",
            statusType: "neutral"
        }
    ];

    const mockJoinedSessions = [
        {
            id: 3,
            title: "龍井運動中心 歡樂臨打",
            date: "11/13 (四)",
            time: "19:00-21:00",
            court: "場地 2",
            quotaStatus: "已報名", // 名額狀態
            paymentStatus: "待核帳", // 帳務狀態
            quotaType: "success",
            paymentType: "warning",
            myOrder: 5,
            totalPlayers: 16
        },
        {
            id: 4,
            title: "沙鹿運動中心",
            date: "11/20 (四)",
            time: "19:00-21:00",
            court: "場地 3",
            quotaStatus: "候補 1",
            paymentStatus: null,
            quotaType: "warning",
            myOrder: 1,
            totalPlayers: 16
        }
    ];

    // 取得對應的色彩 CSS Variable
    const getStatusColor = (type: string) => {
        switch (type) {
            case 'warning': return { bg: 'var(--color-warning-soft)', text: '#B45309' }; // 深黃字
            case 'success': return { bg: 'var(--color-success-soft)', text: 'var(--color-success)' };
            case 'danger': return { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)' };
            default: return { bg: 'var(--color-neutral-soft)', text: 'var(--color-text-secondary)' };
        }
    };

    return (
        <main className="w-full min-w-0 min-h-screen max-w-md mx-auto flex flex-col relative max-sm:overflow-x-clip" style={{ backgroundColor: 'var(--color-background)' }}>
            {/* 🌟 Header */}
            <header className="shrink-0 w-full py-4 px-4 flex flex-col items-center justify-center sticky top-0 z-10 bg-opacity-95 backdrop-blur-sm" style={{ backgroundColor: 'var(--color-background)' }}>
                <h1 className="text-lg font-bold tracking-wide mb-3" style={{ color: 'var(--color-text)' }}>我的臨打</h1>

                {/* Segmented Control (一鍵切換) */}
                <div className="flex w-full p-1 rounded-xl" style={{ backgroundColor: 'var(--color-border)' }}>
                    <button
                        onClick={() => setActiveTab('host')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'host' ? 'shadow-sm' : ''}`}
                        style={{
                            backgroundColor: activeTab === 'host' ? 'var(--color-surface)' : 'transparent',
                            color: activeTab === 'host' ? 'var(--color-text)' : 'var(--color-text-secondary)'
                        }}
                    >
                        開團資訊
                    </button>
                    <button
                        onClick={() => setActiveTab('join')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'join' ? 'shadow-sm' : ''}`}
                        style={{
                            backgroundColor: activeTab === 'join' ? 'var(--color-surface)' : 'transparent',
                            color: activeTab === 'join' ? 'var(--color-text)' : 'var(--color-text-secondary)'
                        }}
                    >
                        報名資訊
                    </button>
                </div>
            </header>

            {/* 內容區塊留白 (對應 Bottom Nav) */}
            <div className="p-4 space-y-4 min-w-0 max-sm:w-full max-sm:overflow-x-clip pb-24">

                {/* ===================== 開團資訊 (Phase 4) ===================== */}
                {activeTab === 'host' && (
                    <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                        {/* 頂部操作按鈕 */}
                        <div className="flex gap-3 mb-6">
                            <button className="flex-[2] py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform" style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)' }}>
                                <Plus size={18} /> 開一場臨打
                            </button>
                            <button className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1 border active:scale-95 transition-transform bg-white" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                                <RefreshCw size={16} /> 套用上次
                            </button>
                        </div>

                        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>我開的臨打 ({mockHostedSessions.length})</h2>

                        <div className="space-y-3">
                            {mockHostedSessions.map(session => {
                                const colors = getStatusColor(session.statusType);
                                return (
                                    <div key={session.id} className="p-4 rounded-2xl shadow-sm bg-white border flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-success)' }}></span>
                                                <p className="text-sm font-bold text-gray-900">{session.date} {session.time}</p>
                                            </div>
                                            <p className="text-xs text-gray-500 mb-2">{session.title} | {session.court}</p>
                                            <p className="text-xs font-medium text-gray-700">{session.joined} / {session.max} 人</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {/* 行動導向標籤 */}
                                            <span className="text-xs px-2.5 py-1 rounded-md font-bold" style={{ backgroundColor: colors.bg, color: colors.text }}>
                                                {session.actionStatus}
                                            </span>
                                            <ChevronRight size={18} className="text-gray-400" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ===================== 報名資訊 (Phase 5) ===================== */}
                {activeTab === 'join' && (
                    <div className="animate-in fade-in slide-in-from-right-2 duration-300">
                        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--color-text)' }}>我報名的臨打 ({mockJoinedSessions.length})</h2>

                        <div className="space-y-3">
                            {mockJoinedSessions.map(session => {
                                const quotaColors = getStatusColor(session.quotaType);
                                const paymentColors = session.paymentType ? getStatusColor(session.paymentType) : null;

                                return (
                                    <div key={session.id} className="p-4 rounded-2xl shadow-sm bg-white border" style={{ borderColor: 'var(--color-border)' }}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-success)' }}></span>
                                                <p className="text-sm font-bold text-gray-900">{session.date} {session.time}</p>
                                            </div>
                                            {/* 名額狀態 (已報名/候補/取消) */}
                                            <span className="text-xs px-2.5 py-1 rounded-md font-bold" style={{ backgroundColor: quotaColors.bg, color: quotaColors.text }}>
                                                {session.quotaStatus}
                                            </span>
                                        </div>

                                        <p className="text-xs text-gray-500 mb-2">{session.title} | {session.court}</p>

                                        <div className="flex justify-between items-end mt-3 pt-3 border-t border-gray-100">
                                            <p className="text-xs font-medium text-gray-700">我: 第 {session.myOrder} 位 / 共 {session.totalPlayers} 人</p>

                                            {/* 帳務狀態 (待核帳/待付款/已付款) - 與名額狀態脫鉤 */}
                                            {session.paymentStatus && paymentColors && (
                                                <span className="text-xs font-bold" style={{ color: paymentColors.text }}>
                                                    {session.paymentStatus}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* 🌟 底部導覽列 (與找球打頁面共用元件邏輯) */}
            <nav className="fixed bottom-0 w-full max-w-md bg-white border-t flex justify-around items-center pb-safe pt-2 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]" style={{ borderColor: 'var(--color-border)', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
                <Link href="/" className="flex flex-col items-center gap-1 py-1 transition-opacity hover:opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
                    <Search size={24} strokeWidth={2} />
                    <span className="text-[10px] font-medium">找球打</span>
                </Link>
                <Link href="/my-bookings" className="flex flex-col items-center gap-1 py-1" style={{ color: 'var(--color-primary)' }}>
                    <CalendarDays size={24} strokeWidth={2.5} />
                    <span className="text-[10px] font-bold" style={{ color: 'var(--color-text)' }}>我的臨打</span>
                </Link>
                <Link href="/profile" className="flex flex-col items-center gap-1 py-1 transition-opacity hover:opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
                    <UserIcon size={24} strokeWidth={2} />
                    <span className="text-[10px] font-medium">我的</span>
                </Link>
            </nav>
        </main>
    );
}