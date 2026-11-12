"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  CheckCircle2,
  Copy,
  Clock,
  AlertCircle,
  Search,
  SlidersHorizontal,
  Bell,
  Users,
} from "lucide-react";

export default function FindGamesPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [courtsList, setCourtsList] = useState<any[]>([]);
  const [venueName, setVenueName] = useState("龍井運動中心");
  const [loading, setLoading] = useState(true);

  // 搜尋與 Tab 切換狀態
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<"upcoming" | "ended">("upcoming");

  // 選中準備報名的場次
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  // 表單欄位（支援 localStorage 自動記憶）
  const [phone, setPhone] = useState("");
  const [lineNickname, setLineNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [playerNotes, setPlayerNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 已報名場次本地追蹤 (session_id -> 'registered' | 'waitlisted')
  const [myJoinedMap, setMyJoinedMap] = useState<Record<string, string>>({});

  // 報名結果與付款回報 Modal
  const [bookingResult, setBookingResult] = useState<any | null>(null);
  const [createdPlayerId, setCreatedPlayerId] = useState<any | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string>("");
  const [last5, setLast5] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [paymentSettings, setPaymentSettings] = useState({
    line: "",
    jko: "",
    twqr: "",
    bank: "",
  });

  // 讀取本地儲存的個人資料與報名紀錄
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem("picklego_user_profile");
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.lineNickname) setLineNickname(parsed.lineNickname);
        if (parsed.displayName) setDisplayName(parsed.displayName);
      }
      const savedJoined = localStorage.getItem("picklego_joined_sessions");
      if (savedJoined) {
        setMyJoinedMap(JSON.parse(savedJoined));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 10 分鐘付款倒數計時器
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const closeBookingResult = () => {
    setBookingResult(null);
    setTimeLeft(null);
  };

  const fetchData = async () => {
    const { data: settingData } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [
        "venue_name",
        "payment_line",
        "payment_jko",
        "payment_twqr",
        "payment_bank",
      ]);

    if (settingData) {
      const settingsMap: Record<string, string> = {};
      settingData.forEach((item) => {
        settingsMap[item.key] = item.value;
      });
      if (settingsMap["venue_name"]) setVenueName(settingsMap["venue_name"]);
      setPaymentSettings({
        line: settingsMap["payment_line"] || "",
        jko: settingsMap["payment_jko"] || "",
        twqr: settingsMap["payment_twqr"] || "",
        bank: settingsMap["payment_bank"] || "",
      });
    }

    const { data: courtsData } = await supabase.from("courts").select("id, name");
    if (courtsData) setCourtsList(courtsData);

    const { data } = await supabase
      .from("open_play_sessions")
      .select(
        `
        *, 
        courts(name),
        open_play_players(id, status, player_notes, created_at, display_name, line_nickname)
      `
      )
      .eq("status", "open")
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (data) setSessions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const isSessionExpired = (sessionDate: string, startTime: string) => {
    if (!sessionDate || !startTime) return false;
    const now = new Date();
    const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .split("T")[0];
    if (sessionDate < todayStr) return true;
    if (sessionDate === todayStr) {
      const currentHours = now.getHours().toString().padStart(2, "0");
      const currentMins = now.getMinutes().toString().padStart(2, "0");
      const currentTimeStr = `${currentHours}:${currentMins}`;
      if (startTime.slice(0, 5) <= currentTimeStr) return true;
    }
    return false;
  };

  const formatDateWithDay = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const days = ["日", "一", "二", "三", "四", "五", "六"];
    return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
  };

  const getCourtNames = (session: any) => {
    if (session.court_ids && session.court_ids.length > 0) {
      return session.court_ids
        .map((id: string) => courtsList.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join("、");
    }
    return session.courts?.name || "場地 1";
  };

  // 提交報名（100% 沿用既有 RPC 邏輯）
  const handleBooking = async (e: React.FormEvent, session: any) => {
    e.preventDefault();
    if (!phone.trim() || !lineNickname.trim()) {
      return alert("請填寫 LINE 暱稱與手機號碼！");
    }
    setIsSubmitting(true);
    const finalDisplayName = displayName.trim() || lineNickname.trim() || "球友";

    try {
      // 儲存使用者習慣至本地，下次免重填
      localStorage.setItem(
        "picklego_user_profile",
        JSON.stringify({
          phone: phone.trim(),
          lineNickname: lineNickname.trim(),
          displayName: finalDisplayName,
        })
      );

      const { data, error } = await supabase.rpc("register_open_play", {
        p_session_id: session.id,
        p_name: finalDisplayName,
        p_phone: phone.trim(),
        p_player_notes: playerNotes.trim() || null,
      });

      if (error) throw error;
      if (!data.success) {
        alert(data.message);
        fetchData();
        return;
      }

      // 紀錄本機報名狀態以即時反應在卡片上
      const updatedMap = { ...myJoinedMap, [session.id]: data.status };
      setMyJoinedMap(updatedMap);
      localStorage.setItem("picklego_joined_sessions", JSON.stringify(updatedMap));

      setCreatedPlayerId(data.booking_id);
      setBookingResult({
        sessionTitle: session.title,
        sessionDate: session.session_date,
        sessionTime: `${session.start_time?.slice(0, 5)}-${session.end_time?.slice(0, 5)}`,
        level: session.level,
        price: session.price,
        status: data.status,
      });

      if (data.status === "registered") setTimeLeft(600);

      setSelectedPayment("");
      setLast5("");
      setSelectedSession(null);
      fetchData();
    } catch (error: any) {
      alert("報名失敗！錯誤原因：" + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPayment = (method: string) => {
    if (method !== selectedPayment) setLast5("");
    setSelectedPayment(method);
  };

  // 送出付款回報（100% 沿用既有 RPC 邏輯）
  const handleReportPayment = async () => {
    if (!selectedPayment) return alert("請先選擇付款方式！");
    if (selectedPayment === "bank" && !/^[0-9]{5}$/.test(last5.trim())) {
      return alert("請填寫轉出帳號末五碼（5 位數字）！");
    }
    if (selectedPayment === "line" && !last5.trim()) {
      return alert("請填寫 LINE Pay 付款識別碼 / 交易序號！");
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("user_report_open_play_payment", {
        p_player_id: createdPlayerId,
        p_phone: phone.trim(),
        p_method: selectedPayment,
        p_line_nickname: lineNickname.trim(),
        p_last5:
          selectedPayment === "bank" || selectedPayment === "line"
            ? last5.trim()
            : "NA",
        p_display_name: displayName.trim() || lineNickname.trim() || "球友",
      });

      if (error) throw error;
      if (!data.success) {
        alert(data.message);
        if (data.message.includes("逾時") || data.message.includes("失效")) {
          closeBookingResult();
          fetchData();
        }
        return;
      }

      alert("✅ 付款回報已送出！名額已為您保留，待建立者核對款項。");
      closeBookingResult();
      fetchData();
    } catch (error: any) {
      alert("回報失敗：" + (error.message || "系統錯誤"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyBankAccount = async () => {
    try {
      await navigator.clipboard.writeText(paymentSettings.bank);
      alert("✅ 銀行帳號已複製！");
    } catch {
      alert("複製失敗，請手動選取複製。");
    }
  };

  // 依據搜尋字串過濾（場地、日期、時段、標題）
  const filteredBySearch = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const courtStr = getCourtNames(s).toLowerCase();
    const dateStr = (s.session_date || "").toLowerCase();
    const titleStr = (s.title || "").toLowerCase();
    const timeStr = `${s.start_time || ""}-${s.end_time || ""}`;
    return (
      courtStr.includes(q) ||
      dateStr.includes(q) ||
      titleStr.includes(q) ||
      timeStr.includes(q) ||
      venueName.toLowerCase().includes(q)
    );
  });

  const upcomingSessions = filteredBySearch.filter(
    (s) => !isSessionExpired(s.session_date, s.start_time)
  );
  const endedSessions = filteredBySearch.filter((s) =>
    isSessionExpired(s.session_date, s.start_time)
  );
  const displaySessions = timeFilter === "upcoming" ? upcomingSessions : endedSessions;

  return (
    <div className="w-full min-h-full bg-[#F8F9FA] pb-10">
      {/* 頂部品牌與頁面標題區 */}
      <div className="bg-white px-4 pt-3 pb-2 sticky top-0 z-30 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div className="w-6" />
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-[#F3C84B] border border-gray-800 flex items-center justify-center text-[10px] font-black">
              🎾
            </span>
            <span className="font-extrabold text-base tracking-tight text-gray-900">
              PickleGo
            </span>
          </div>
          <button className="text-gray-600 p-1">
            <Bell size={18} />
          </button>
        </div>

        <h1 className="text-xl font-extrabold text-gray-900 mb-3">找球打</h1>

        {/* 搜尋框與篩選按鈕 */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="找尋場地、日期或時段"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 text-gray-900 placeholder-gray-400 text-sm rounded-full pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600/20"
            />
          </div>
          <button
            type="button"
            className="p-2 rounded-xl border border-gray-200 text-gray-600 bg-white active:scale-95"
            title="篩選條件"
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {/* 即將開始 / 已結束 切換列 */}
        <div className="flex border-b border-gray-200 -mx-4 px-4">
          <button
            onClick={() => setTimeFilter("upcoming")}
            className={`flex-1 pb-2.5 text-sm font-bold text-center border-b-2 transition-colors ${timeFilter === "upcoming"
                ? "border-green-700 text-green-700"
                : "border-transparent text-gray-400"
              }`}
          >
            即將開始 ({upcomingSessions.length})
          </button>
          <button
            onClick={() => setTimeFilter("ended")}
            className={`flex-1 pb-2.5 text-sm font-bold text-center border-b-2 transition-colors ${timeFilter === "ended"
                ? "border-green-700 text-green-700"
                : "border-transparent text-gray-400"
              }`}
          >
            已結束
          </button>
        </div>
      </div>

      {/* 活動卡片列表 */}
      <div className="p-4 space-y-3">
        {loading ? (
          <p className="text-center py-12 text-sm font-medium text-gray-400 animate-pulse">
            載入臨打場次中...
          </p>
        ) : displaySessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-gray-400 text-sm">目前沒有符合條件的臨打場次</p>
          </div>
        ) : (
          displaySessions.map((session) => {
            const activePlayers =
              session.open_play_players?.filter((p: any) => p.status !== "cancelled") || [];
            const regCount = activePlayers.filter((p: any) => p.status === "registered").length;
            const waitCount = activePlayers.filter((p: any) => p.status === "waitlisted").length;

            const isRegFull = regCount >= session.max_players;
            const isWaitFull = waitCount >= (session.max_waitlist || 0);
            const isCompletelyFull = isRegFull && isWaitFull;

            // 檢查使用者自己是否已在名單內（比對 localStorage 紀錄或 LINE 暱稱）
            const myPlayerRecord = activePlayers.find(
              (p: any) =>
                (lineNickname && p.line_nickname === lineNickname) ||
                (displayName && p.display_name === displayName)
            );
            const myStatus = myPlayerRecord?.status || myJoinedMap[session.id];

            // 決定卡片右側單一狀態按鈕與左側圖示（嚴格不顯示待核帳等後台資訊）
            let statusLabel = "我要報名";
            let badgeStyle = "bg-green-100 text-green-800 hover:bg-green-200";
            let canClick = true;
            let leftIconType: "open" | "full" | "waitlist" | "joined" = "open";

            if (timeFilter === "ended") {
              statusLabel = "已結束";
              badgeStyle = "bg-gray-100 text-gray-400";
              canClick = false;
              leftIconType = "full";
            } else if (myStatus === "registered") {
              statusLabel = "已報名";
              badgeStyle = "bg-green-700 text-white";
              canClick = false;
              leftIconType = "joined";
            } else if (myStatus === "waitlisted") {
              statusLabel = "候補中";
              badgeStyle = "bg-amber-100 text-amber-800";
              canClick = false;
              leftIconType = "waitlist";
            } else if (isCompletelyFull) {
              statusLabel = "已額滿";
              badgeStyle = "bg-gray-200 text-gray-600";
              canClick = false;
              leftIconType = "full";
            } else if (isRegFull) {
              statusLabel = "候補報名";
              badgeStyle = "bg-green-100 text-green-800 hover:bg-green-200";
              canClick = true;
              leftIconType = "waitlist";
            }

            const courtDisplay = getCourtNames(session);
            const locationTitle = session.title || venueName;

            return (
              <div
                key={session.id}
                className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* 左側狀態圓形圖示 + 中間核心資訊 */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-1 shrink-0">
                      {leftIconType === "open" && (
                        <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-2xs">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      )}
                      {(leftIconType === "full" || leftIconType === "joined") && (
                        <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center">
                          <CheckCircle2 size={15} strokeWidth={3} />
                        </div>
                      )}
                      {leftIconType === "waitlist" && (
                        <div className="w-6 h-6 rounded-full bg-gray-500 text-white flex items-center justify-center">
                          <Users size={13} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-[15px] text-gray-900 leading-snug">
                        {formatDateWithDay(session.session_date)}{" "}
                        {session.start_time?.slice(0, 5)}–{session.end_time?.slice(0, 5)}
                      </p>
                      <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">
                        {locationTitle}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{courtDisplay}</span>
                        <span>|</span>
                        <span className="font-semibold text-gray-700">
                          {regCount} / {session.max_players} 人
                        </span>
                        {session.price ? (
                          <>
                            <span>|</span>
                            <span>${session.price}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </div>

                  {/* 右側單一狀態膠囊按鈕 */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      disabled={!canClick}
                      onClick={() =>
                        setSelectedSession(
                          selectedSession?.id === session.id ? null : session
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition active:scale-95 disabled:active:scale-100 ${badgeStyle}`}
                    >
                      {statusLabel}
                    </button>
                  </div>
                </div>

                {/* 點擊「我要報名 / 候補報名」展開極簡填寫表單 */}
                {selectedSession?.id === session.id && (
                  <div className="mt-4 pt-3 border-t border-gray-100 animate-in fade-in">
                    <form onSubmit={(e) => handleBooking(e, session)} className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="LINE 暱稱 (必填)"
                          className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-green-600 focus:bg-white"
                          value={lineNickname}
                          onChange={(e) => setLineNickname(e.target.value)}
                        />
                        <input
                          type="tel"
                          required
                          placeholder="手機號碼 (10碼)"
                          pattern="[0-9]{10}"
                          className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-green-600 focus:bg-white"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedSession(null)}
                          className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-[2] bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
                        >
                          {isSubmitting ? "處理中..." : "確認報名"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 報名成功與付款回報 Modal (完全保留既有功能) */}
      {bookingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div
              className="p-5 text-center"
              style={{
                backgroundColor:
                  bookingResult.status === "registered" ? "#15803D" : "#F59E0B",
              }}
            >
              <CheckCircle2 size={42} className="mx-auto text-white mb-1.5" />
              <h2 className="text-lg font-bold text-white">報名成功！</h2>
              <p className="text-white/90 text-xs mt-0.5">
                狀態：【{bookingResult.status === "registered" ? "已報名" : "候補中"}】
              </p>
            </div>

            <div className="p-5">
              {bookingResult.status === "waitlisted" ? (
                <div className="text-center space-y-4">
                  <p className="text-gray-600 text-sm">
                    目前為候補名額，請勿先行付款。
                    <br />
                    遞補成功時將另行通知！
                  </p>
                  <button
                    onClick={closeBookingResult}
                    className="w-full font-bold py-2.5 rounded-xl bg-gray-100 text-gray-800 text-sm"
                  >
                    我知道了
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl text-center bg-amber-50 border border-amber-200">
                    {timeLeft === 0 ? (
                      <div className="text-red-600 font-bold text-xs flex flex-col items-center gap-1">
                        <AlertCircle size={20} />
                        <p>保留時間已逾時，名額已自動釋出。</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-gray-700 flex items-center justify-center gap-1 mb-0.5">
                          <Clock size={14} /> 請於限時內完成付款回報
                        </p>
                        <p className="text-2xl font-black font-mono text-red-600">
                          {timeLeft !== null ? formatTime(timeLeft) : "10:00"}
                        </p>
                      </>
                    )}
                  </div>

                  {timeLeft !== 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {paymentSettings.line && (
                          <button
                            onClick={() => handleSelectPayment("line")}
                            className={`py-2.5 rounded-xl font-bold text-xs border transition ${selectedPayment === "line"
                                ? "border-[#06C755] bg-[#06C755]/10 text-[#06C755]"
                                : "border-gray-200 text-gray-600"
                              }`}
                          >
                            LINE Pay / 付款碼
                          </button>
                        )}
                        {paymentSettings.bank && (
                          <button
                            onClick={() => handleSelectPayment("bank")}
                            className={`py-2.5 rounded-xl font-bold text-xs border transition ${selectedPayment === "bank"
                                ? "border-gray-800 bg-gray-100 text-gray-900"
                                : "border-gray-200 text-gray-600"
                              }`}
                          >
                            銀行轉帳
                          </button>
                        )}
                      </div>

                      {selectedPayment && (
                        <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl space-y-3">
                          {selectedPayment === "line" && (
                            <a
                              href={paymentSettings.line}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-center bg-[#06C755] text-white font-bold py-2.5 rounded-lg text-xs"
                            >
                              開啟收款連結
                            </a>
                          )}
                          {selectedPayment === "bank" && (
                            <div className="bg-white p-2.5 rounded-lg border border-gray-200 flex justify-between items-center">
                              <p className="text-xs font-mono font-bold text-gray-800">
                                {paymentSettings.bank}
                              </p>
                              <button
                                onClick={handleCopyBankAccount}
                                className="text-gray-500 p-1"
                              >
                                <Copy size={15} />
                              </button>
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              {selectedPayment === "bank"
                                ? "轉出帳號末五碼（必填）"
                                : "交易序號 / 備註（必填）"}
                            </label>
                            <input
                              type="text"
                              inputMode={selectedPayment === "bank" ? "numeric" : "text"}
                              maxLength={selectedPayment === "bank" ? 5 : undefined}
                              className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs mb-2.5"
                              value={last5}
                              onChange={(e) =>
                                setLast5(
                                  selectedPayment === "bank"
                                    ? e.target.value.replace(/[^0-9]/g, "").slice(0, 5)
                                    : e.target.value
                                )
                              }
                            />
                            <button
                              onClick={handleReportPayment}
                              disabled={isSubmitting}
                              className="w-full bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
                            >
                              {isSubmitting ? "送出中..." : "我已完成付款"}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <button
                    onClick={closeBookingResult}
                    className="w-full text-gray-400 text-xs font-bold py-1.5"
                  >
                    稍後至「我的臨打」處理
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}