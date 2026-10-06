"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";
import { Calendar, Users, GraduationCap, ArrowRight, Search, User, Bell } from "lucide-react";

export default function HomePage() {
  const [venueName, setVenueName] = useState("匹克球館");
  const [announcement, setAnnouncement] = useState({ active: false, text: "" });
  const [latestSession, setLatestSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      // 1. 從 Supabase settings 抓取場館名稱與公告
      const { data: settingData } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["venue_name", "announcement_active", "announcement_text"]);

      if (settingData) {
        const configMap: Record<string, string> = {};
        settingData.forEach((item) => {
          configMap[item.key] = item.value;
        });

        if (configMap["venue_name"]) setVenueName(configMap["venue_name"]);
        
        setAnnouncement({
          active: configMap["announcement_active"] === "true",
          text: configMap["announcement_text"] || "",
        });
      }

      // 2. 抓取尚未過期的最新開放臨打場次 (資安防護：open_play_players 嚴格限制僅讀取 users(name)，防止手機外洩)
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      const { data: sessions } = await supabase
        .from("open_play_sessions")
        .select(`
          id,
          title,
          level,
          session_date,
          start_time,
          end_time,
          price,
          max_players,
          max_waitlist,
          notes,
          status,
          courts (name),
          open_play_players (
            id,
            status,
            player_notes,
            users (name)
          )
        `)
        .eq("status", "open")
        .gte("session_date", today)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(5);

      if (sessions && sessions.length > 0) {
        const currentTimeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:00`;
        const upcoming = sessions.find((s) => {
          if (s.session_date > today) return true;
          return s.start_time >= currentTimeStr;
        });

        setLatestSession(upcoming || sessions[0] || null);
      } else {
        setLatestSession(null);
      }

      setLoading(false);
    };

    fetchHomeData();
  }, []);

  const formatSessionDate = (dateString: string) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    const days = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  };

  return (
    <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col relative pb-20">
      <div className="bg-emerald-600 text-white p-6 rounded-b-3xl shadow-md text-center">
        <h1 className="text-2xl font-bold tracking-wider">{venueName}</h1>
      </div>

      {/* 🌟 動態公告橫幅 */}
      {announcement.active && announcement.text && (
        <div className="px-5 mt-4 animate-in slide-in-from-top-2">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-start gap-3 shadow-sm">
            <Bell size={18} className="text-amber-500 mt-0.5 shrink-0 animate-pulse" />
            <p className="text-sm font-medium leading-relaxed">{announcement.text}</p>
          </div>
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 mt-2">
        <Link
          href="/booking"
          className="bg-white border-2 border-emerald-500 rounded-2xl p-4 flex items-center justify-between shadow-sm active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-4">
            <div className="bg-emerald-100 text-emerald-600 p-3 rounded-full">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-lg">場地預約</h2>
              <p className="text-xs text-gray-500 mt-0.5">查看空場地，立即預約</p>
            </div>
          </div>
          <ArrowRight className="text-emerald-500" size={20} />
        </Link>

        <Link
          href="/open-play"
          className="bg-white border-2 border-blue-500 rounded-2xl p-4 flex items-center justify-between shadow-sm active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
              <Users size={24} />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-lg">臨打預約</h2>
              <p className="text-xs text-gray-500 mt-0.5">零星時間，隨時開打</p>
            </div>
          </div>
          <ArrowRight className="text-blue-500" size={20} />
        </Link>

        <Link
          href="/classes"
          className="bg-white border-2 border-orange-500 rounded-2xl p-4 flex items-center justify-between shadow-sm active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-4">
            <div className="bg-orange-100 text-orange-600 p-3 rounded-full">
              <GraduationCap size={24} />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-lg">體驗 / 教學課</h2>
              <p className="text-xs text-gray-500 mt-0.5">新手入門，教練指導</p>
            </div>
          </div>
          <ArrowRight className="text-orange-500" size={20} />
        </Link>

        <Link
          href="/my-bookings"
          className="bg-gray-100 border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-sm active:scale-95 transition-transform mt-2"
        >
          <div className="flex items-center gap-4">
            <div className="bg-gray-200 text-gray-600 p-3 rounded-full">
              <Search size={24} />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-base">查詢我的預約</h2>
              <p className="text-xs text-gray-500 mt-0.5">輸入手機號碼，快速查詢 / 取消</p>
            </div>
          </div>
          <ArrowRight className="text-gray-400" size={20} />
        </Link>

        <div className="mt-6">
          <div className="flex justify-between items-end mb-3 px-1">
            <h3 className="font-bold text-gray-800 text-lg">最新臨打場次</h3>
            <Link href="/open-play" className="text-blue-600 text-sm font-bold hover:underline">
              查看全部
            </Link>
          </div>

          {loading ? (
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm text-center">
              <p className="text-gray-500 text-sm animate-pulse">載入最新場次中...</p>
            </div>
          ) : !latestSession ? (
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm text-center">
              <p className="text-gray-500 text-sm">目前尚無即將開放的臨打場次</p>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-800 mb-1">
                    {formatSessionDate(latestSession.session_date)}
                  </p>
                  <p className="font-bold text-xl text-gray-900">
                    {latestSession.start_time?.slice(0, 5)} ~ {latestSession.end_time?.slice(0, 5)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-1">{latestSession.courts?.name || "1號場地"}</p>
                  <p className="font-bold text-lg text-gray-900">${latestSession.price}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                  DUPR {latestSession.level}
                </span>
              </div>

              {/* 🌟 館方備註顯示區塊 (與臨打預約頁面樣式完全統一) */}
              {latestSession.notes && (
                <div className="mb-4 bg-amber-50 text-amber-800 text-xs px-3 py-2 rounded-xl border border-amber-200 flex items-start gap-1.5 font-medium animate-in fade-in">
                  <span>🏷️ 館方備註：{latestSession.notes}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                  <p className="text-xs text-gray-500 mb-0.5">正取</p>
                  {(() => {
                    const regCount =
                      latestSession.open_play_players?.filter((p: any) => p.status === "registered").length || 0;
                    return (
                      <p className="font-bold text-emerald-600">
                        {regCount} / {latestSession.max_players}
                      </p>
                    );
                  })()}
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                  <p className="text-xs text-gray-500 mb-0.5">候補</p>
                  {(() => {
                    const waitCount =
                      latestSession.open_play_players?.filter((p: any) => p.status === "waitlisted").length || 0;
                    return (
                      <p className="font-bold text-gray-600">
                        {waitCount} / {latestSession.max_waitlist}
                      </p>
                    );
                  })()}
                </div>
              </div>

              {(() => {
                const activePlayers =
                  latestSession.open_play_players?.filter((p: any) => p.status !== "cancelled") || [];
                if (activePlayers.length === 0) return null;

                return (
                  <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                      <User size={12} /> 已報名球友
                    </h4>
                    <div className="space-y-2">
                      {activePlayers.map((player: any) => (
                        <div key={player.id} className="flex flex-col text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                player.status === "registered"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {player.status === "registered" ? "正取" : "候補"}
                            </span>
                            <span className="font-semibold text-gray-700">{player.users?.name}</span>
                          </div>
                          {player.player_notes && (
                            <p className="text-xs text-gray-500 ml-10 mt-0.5 break-words">
                              💬 {player.player_notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <Link
                href="/open-play"
                className="block w-full bg-gray-900 text-white text-center font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                立即報名
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-6 w-full text-center">
        <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          🔒 館主登入後台
        </Link>
      </div>
    </main>
  );
}