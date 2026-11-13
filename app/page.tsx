"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  SlidersHorizontal,
  Bell,
  Users,
  X,
  MapPin,
  Share,
} from "lucide-react";

const getLocalDateStr = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; };  export default function FindGamesPage() { const [sessions, setSessions] = useState<any[]>([]); const [loading, setLoading] = useState(true);  const [selectedSession, setSelectedSession] = useState<any \vert{} null>(null); const [phone, setPhone] = useState(""); const [lineNickname, setLineNickname] = useState(""); const [isSubmitting, setIsSubmitting] = useState(false); const [myJoinedMap, setMyJoinedMap] = useState<Record<string, string>>({}); const [bookingResult, setBookingResult] = useState<any \vert{} null>(null); const [createdPlayerId, setCreatedPlayerId] = useState<any \vert{} null>(null);  const [selectedPayment, setSelectedPayment] = useState<string>(""); const [last5, setLast5] = useState(""); const [timeLeft, setTimeLeft] = useState<number \vert{} null>(null);  const [datesList, setDatesList] = useState<{ date: string; display: string }[]>([]); const [selectedDate, setSelectedDate] = useState<string>("ALL"); const [hasAutoSelectedDate, setHasAutoSelectedDate] = useState(false);  const [showFilterSheet, setShowFilterSheet] = useState(false); const [filterRegion, setFilterRegion] = useState<string>("全部"); const [filterTime, setFilterTime] = useState<string>("全部"); const [filterLevel, setFilterLevel] = useState<string>("全部");  const listRef = useRef<HTMLDivElement>(null);  const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60).toString().padStart(2, "0"); const s = (seconds \% 60).toString().padStart(2, "0"); return `${m}:${s}`; };  const formatDateWithDay = (dateStr: string) => { if (!dateStr) return ""; const [y, m, d] = dateStr.split("-").map(Number); const dateObj = new Date(y, m - 1, d); const days = ["日", "一", "二", "三", "四", "五", "六"]; return `${m}/${d} (${days[dateObj.getDay()]})`;
  };

  useEffect(() => {
    const today = new Date();
    const dates = [{ date: "ALL", display: "全部近期" }];
    const days = ["日", "一", "二", "三", "四", "五", "六"];

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const isoDate = getLocalDateStr(d);
      let display = `${d.getMonth() + 1}/${d.getDate()}`;
      if (i === 0) display = "今天";
      else if (i === 1) display = "明天";
      else display += ` (${days[d.getDay()]})`; dates.push({ date: isoDate, display }); } setDatesList(dates);  try { const savedProfile = localStorage.getItem("picklego_user_profile"); if (savedProfile) { const parsed = JSON.parse(savedProfile); if (parsed.phone) setPhone(parsed.phone); if (parsed.lineNickname) setLineNickname(parsed.lineNickname); } const savedJoined = localStorage.getItem("picklego_joined_sessions"); if (savedJoined) setMyJoinedMap(JSON.parse(savedJoined)); } catch (e) {}  fetchData(); }, []);  useEffect(() => { if (sessions.length > 0) { const params = new URLSearchParams(window.location.search); const deepLinkId = params.get("session"); if (deepLinkId) { const target = sessions.find((s) => s.id === deepLinkId); if (target) { setSelectedDate(target.session_date); setSelectedSession(target); setHasAutoSelectedDate(true); setTimeout(() => { const el = document.getElementById(`session-${target.id}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 300);
          return;
        }
      }

      if (!hasAutoSelectedDate) {
        const todayStr = getLocalDateStr(new Date());
        const hasToday = sessions.some((s) => s.session_date === todayStr);
        if (hasToday) {
          setSelectedDate(todayStr);
        } else {
          const upcoming = sessions.find((s) => s.session_date >= todayStr);
          setSelectedDate(upcoming ? upcoming.session_date : "ALL");
        }
        setHasAutoSelectedDate(true);
      }
    }
  }, [sessions, hasAutoSelectedDate]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(
      () => setTimeLeft((prev) => (prev && prev > 0 ? prev - 1 : 0)),
      1000
    );
    return () => clearInterval(timer);
  }, [timeLeft]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("open_play_sessions")
      .select(`*, courts(name), open_play_players(id, status, phone, line_nickname, display_name)`)
      .eq("status", "open")
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      const { data: fallbackData } = await supabase
        .from("open_play_sessions")
        .select("*")
        .eq("status", "open")
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (fallbackData) setSessions(fallbackData);
    } else if (data) {
      setSessions(data);
    }
    setLoading(false);
  };

  const getCourtLabel = (session: any) => {
    if (session.court_name) return session.court_name;
    if (session.courts?.name) return session.courts.name;
    if (session.notes && session.notes.includes("【")) {
      const match = session.notes.match(/【(.*?)】/);
      if (match) return match[1];
    }
    return "";
  };

  const handleBooking = async (e: React.FormEvent, session: any) => {
    e.preventDefault();
    if (!phone.trim() || !lineNickname.trim())
      return alert("請填寫 LINE 暱稱與手機號碼！");
    setIsSubmitting(true);
    try {
      const existingStr = localStorage.getItem("picklego_user_profile");
      const existing = existingStr ? JSON.parse(existingStr) : {};
      localStorage.setItem(
        "picklego_user_profile",
        JSON.stringify({
          ...existing,
          phone: phone.trim(),
          lineNickname: lineNickname.trim(),
          displayName: lineNickname.trim(),
        })
      );

      const { data, error } = await supabase.rpc("register_open_play", {
        p_session_id: session.id,
        p_name: lineNickname.trim(),
        p_phone: phone.trim(),
        p_player_notes: null,
      });
      if (error) throw error;
      if (!data.success) {
        alert(data.message);
        fetchData();
        return;
      }

      const updatedMap = { ...myJoinedMap, [session.id]: data.status };
      setMyJoinedMap(updatedMap);
      localStorage.setItem("picklego_joined_sessions", JSON.stringify(updatedMap));

      setCreatedPlayerId(data.booking_id);
      setBookingResult({ ...session, status: data.status });

      if (data.status === "registered") setTimeLeft(600);
      setSelectedPayment("");
      setLast5("");
      setSelectedSession(null);
      fetchData();
    } catch (error: any) {
      alert("報名失敗！錯誤原因：" + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportPayment = async () => {
    if (!selectedPayment) return alert("請先選擇付款方式！");
    if (selectedPayment === "bank" && !/^[0-9]{5}$/.test(last5.trim()))
      return alert("轉帳請填寫帳號末五碼！");

    setIsSubmitting(true);
    try {
      const finalLast5 = selectedPayment === "bank" ? last5.trim() : (selectedPayment === "cash" ? "現場付款" : "TWQR");
      const { data, error } = await supabase.rpc("user_report_open_play_payment", {
        p_player_id: createdPlayerId,
        p_phone: phone.trim(),
        p_method: selectedPayment,
        p_line_nickname: lineNickname.trim(),
        p_last5: finalLast5,
        p_display_name: lineNickname.trim(),
      });
      if (error) throw error;
      if (!data.success) {
        alert(data.message);
        if (data.message.includes("逾時") || data.message.includes("失效")) {
          setBookingResult(null);
          setTimeLeft(null);
          fetchData();
        }
        return;
      }
      alert("✅ 付款回報已送出！名額已為您保留。");
      setBookingResult(null);
      setTimeLeft(null);
      fetchData();
    } catch (error: any) {
      alert("回報失敗：" + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = (e: React.MouseEvent, session: any) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?session=${session.id}`;
    const courtText = getCourtLabel(session) ? `· ${getCourtLabel(session)}` : ""; const locStr = `${session.city || ""}${session.district \vert{}\vert{} ""} ${session.address || ""} ${session.title}${courtText}`.trim();
    const text = `🎾 PickleGo 臨打邀請\n【時間】${formatDateWithDay(session.session_date)}${session.start_time?.slice(0, 5)}-${session.end_time?.slice(0, 5)}\n【地點】${locStr}\n【程度】${session.level \vert{}\vert{} "不限"}\n【費用】$${session.price || 0} / 人\n👇 點擊網址快速報名：\n${url}`; navigator.clipboard.writeText(text); alert("✅ 報名資訊與網址已複製！"); };  const datesWithSessions = useMemo(() => { const set = new Set<string>(); sessions.forEach((s) => { if (s.session_date) set.add(s.session_date); }); return set; }, [sessions]);  const displaySessions = useMemo(() => { const todayStr = getLocalDateStr(new Date()); return sessions.filter((s) => { if (selectedDate === "ALL") { if (s.session_date < todayStr) return false; } else if (selectedDate && s.session_date !== selectedDate) { return false; }  if (filterRegion !== "全部") { const c = `${s.city || ""}${s.district \vert{}\vert{} ""}${s.title || ""}`.toLowerCase();
        if (filterRegion === "北部" && !["台北", "新北", "基隆", "桃園", "新竹", "宜蘭"].some((x) => c.includes(x))) return false;
        if (filterRegion === "中部" && !["台中", "彰化", "苗栗", "南投", "雲林", "龍井", "沙鹿", "清水"].some((x) => c.includes(x))) return false;
        if (filterRegion === "南部" && !["台南", "高雄", "嘉義", "屏東"].some((x) => c.includes(x))) return false;
      }

      if (filterTime !== "全部") {
        const startHour = parseInt(s.start_time?.split(":")[0] || "0", 10);
        if (filterTime === "早上 (00-12)" && startHour >= 12) return false;
        if (filterTime === "下午 (12-18)" && (startHour < 12 || startHour >= 18)) return false;
        if (filterTime === "晚上 (18-24)" && startHour < 18) return false;
      }

      if (filterLevel !== "全部" && s.level && s.level !== "不限" && !s.level.includes(filterLevel)) return false;
      return true;
    });
  }, [sessions, selectedDate, filterRegion, filterTime, filterLevel]);

  return (
    <div className="w-full min-h-full bg-[#F8F9FA] pb-10">
      <div className="bg-white px-4 pt-3 pb-3 sticky top-0 z-30 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-extrabold text-gray-900">找球打</h1>
          <button
            onClick={() => setShowFilterSheet(true)}
            className="flex items-center gap-1.5 bg-gray-50 text-gray-700 font-bold text-xs px-3 py-1.5 rounded-full border border-gray-200"
          >
            <SlidersHorizontal size={14} /> 篩選
          </button>
        </div>
        <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 scrollbar-hide">
          {datesList.map((d) => {
            const hasGame = d.date === "ALL" ? sessions.length > 0 : datesWithSessions.has(d.date);
            const isSelected = selectedDate === d.date;
            return (
              <button
                key={d.date}
                onClick={() => {
                  setSelectedDate(d.date);
                  setSelectedSession(null);
                }}
                className={`relative shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-green-700 text-white shadow-2xs"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <span>{d.display}</span>
                {hasGame && d.date !== "ALL" && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${ isSelected ? "bg-[#F3C84B]" : "bg-green-600" }`} /> )} </button> ); })} </div> </div>  <div className="p-4 space-y-3" ref={listRef}> {loading ? ( <p className="text-center py-12 text-sm text-gray-400">載入中...</p> ) : displaySessions.length === 0 ? ( <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 mt-4 space-y-3"> <p className="text-gray-500 font-bold">這天沒有符合的臨打 🏓</p> <p className="text-gray-400 text-xs"> 上方有綠點的日期代表有開團，或點擊下方按鈕查看全部 </p> {selectedDate !== "ALL" && ( <button onClick={() => setSelectedDate("ALL")} className="inline-block bg-green-50 text-green-700 font-bold text-xs px-4 py-2 rounded-full border border-green-200" > 查看全部近期臨打 ({sessions.length}) </button> )} </div> ) : ( displaySessions.map((session) => { const activePlayers = session.open_play_players?.filter((p: any) => p.status !== "cancelled") \vert{}\vert{} []; const regCount = activePlayers.filter((p: any) => p.status === "registered").length; const waitCount = activePlayers.filter((p: any) => p.status === "waitlisted").length; const isRegFull = regCount >= session.max_players; const isCompletelyFull = isRegFull && waitCount >= (session.max_waitlist \vert{}\vert{} 0);  const myStatus = activePlayers.find( (p: any) => (phone && p.phone === phone) \vert{}\vert{} (lineNickname && (p.line_nickname === lineNickname \vert{}\vert{} p.display_name === lineNickname)) )?.status \vert{}\vert{} myJoinedMap[session.id];  let statusLabel = "我要報名"; let badgeStyle = "bg-green-100 text-green-800 hover:bg-green-200"; let canClick = true; let leftIconType = "open"; if (myStatus === "registered") { statusLabel = "已報名"; badgeStyle = "bg-green-700 text-white"; canClick = false; leftIconType = "joined"; } else if (myStatus === "waitlisted") { statusLabel = "候補中"; badgeStyle = "bg-amber-100 text-amber-800"; canClick = false; leftIconType = "waitlist"; } else if (isCompletelyFull) { statusLabel = "已額滿"; badgeStyle = "bg-gray-200 text-gray-600"; canClick = false; leftIconType = "full"; } else if (isRegFull) { statusLabel = "候補報名"; badgeStyle = "bg-amber-100 text-amber-800 hover:bg-amber-200"; canClick = true; leftIconType = "waitlist"; }  const courtText = getCourtLabel(session); const fullAddress = `${session.city || ""}${session.district \vert{}\vert{} ""}${session.address || ""}`.trim();
            const mapQuery = `${fullAddress}${session.title || ""}`.trim();
            
            let limitText = "取消無時限";
            if (session.cancel_limit_hours === 0) limitText = "報名後不可取消";
            else if (session.cancel_limit_hours > 0) limitText = `開打前 ${session.cancel_limit_hours}h 不可取消`;  return ( <div key={session.id} id={`session-${session.id}`}
                className={`bg-white rounded-2xl p-4 shadow-xs border transition-all ${
                  selectedSession?.id === session.id ? "border-green-600" : "border-gray-100"
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-1 shrink-0">
                      {leftIconType === "open" && (
                        <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
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
                      <p className="text-sm font-bold text-gray-800 mt-0.5 truncate">
                        {session.title} {courtText && `· ${courtText}`} </p> <p className="text-xs font-bold text-gray-500 mt-0.5"> 🎾 {session.level \vert{}\vert{} "不限"} \vert{} 🛡️ {limitText} </p> <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1 hover:underline"
                      >
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">
                          {fullAddress || session.title} (導航)
                        </span>
                      </a>
                      <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-2">
                        <span className="font-bold text-gray-700">
                          {regCount} / {session.max_players} 人
                        </span>
                        {waitCount > 0 && (
                          <span className="text-amber-700 font-bold">(候補 {waitCount})</span>
                        )}
                        <span>|</span>
                        <span className="font-bold text-green-700">${session.price}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 items-end">
                    <button
                      type="button"
                      onClick={(e) => handleShare(e, session)}
                      className="text-gray-400 hover:text-green-700 bg-gray-50 p-1.5 rounded-full border border-gray-200"
                    >
                      <Share size={14} />
                    </button>
                    <button
                      disabled={!canClick}
                      onClick={() => setSelectedSession(selectedSession?.id === session.id ? null : session)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition mt-2 ${badgeStyle}`}
                    >
                      {statusLabel}
                    </button>
                  </div>
                </div>
                
                {session.additional_notes && (
                  <div className="mt-3 bg-amber-50/50 p-2.5 rounded-lg text-xs text-gray-700 border border-amber-100">
                    <span className="font-bold">📝 備註：</span>{session.additional_notes}
                  </div>
                )}

                {selectedSession?.id === session.id && (
                  <div className="mt-4 pt-3 border-t border-gray-100 animate-in fade-in">
                    <form onSubmit={(e) => handleBooking(e, session)} className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="LINE 暱稱 (必填)"
                          className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl px-3 py-2.5 text-xs"
                          value={lineNickname}
                          onChange={(e) => setLineNickname(e.target.value)}
                        />
                        <input
                          type="tel"
                          required
                          placeholder="手機號碼 (10碼)"
                          pattern="[0-9]{10}"
                          className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl px-3 py-2.5 text-xs"
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
                          className={`flex-[2] text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50 ${
                            isRegFull ? "bg-amber-600" : "bg-green-700"
                          }`}
                        >
                          {isSubmitting ? "處理中..." : isRegFull ? "確認排入候補" : "確認報名"}
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

      {showFilterSheet && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 transition-opacity"
            onClick={() => setShowFilterSheet(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-3xl z-50 p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-extrabold text-gray-900">進階篩選</h2>
              <button
                onClick={() => setShowFilterSheet(false)}
                className="p-1 text-gray-400 bg-gray-100 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">📍 地區</label>
                <div className="grid grid-cols-4 gap-2">
                  {["全部", "北部", "中部", "南部"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setFilterRegion(r)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        filterRegion === r
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-white text-gray-600 border-gray-200"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">⏰ 時段</label>
                <div className="grid grid-cols-2 gap-2">
                  {["全部", "早上 (00-12)", "下午 (12-18)", "晚上 (18-24)"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterTime(t)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        filterTime === t
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-white text-gray-600 border-gray-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">🎾 程度</label>
                <div className="grid grid-cols-4 gap-2">
                  {["全部", "新手", "2.0", "2.5", "3.0", "3.5", "4.0+"].map((l) => (
                    <button
                      key={l}
                      onClick={() => setFilterLevel(l)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        filterLevel === l
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-white text-gray-600 border-gray-200"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowFilterSheet(false)}
              className="w-full mt-8 bg-gray-900 text-white font-bold py-3.5 rounded-xl text-sm active:scale-95"
            >
              顯示符合場次
            </button>
          </div>
        </>
      )}

      {bookingResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            {bookingResult.status === "waitlisted" ? (
              <div className="p-5 text-center">
                <CheckCircle2 size={42} className="mx-auto text-amber-500 mb-2" />
                <h2 className="text-lg font-bold text-gray-900 mb-1">已排入候補名單</h2>
                <p className="text-sm text-gray-600 mb-4">
                  若有正取球友取消，系統將自動依序遞補，屆時將更新您的狀態。
                </p>
                <button
                  onClick={() => {
                    setBookingResult(null);
                    fetchData();
                  }}
                  className="w-full bg-gray-100 text-gray-800 font-bold py-3 rounded-xl"
                >
                  我知道了
                </button>
              </div>
            ) : (
              <>
                <div className="p-4 text-center bg-green-700">
                  <CheckCircle2 size={36} className="mx-auto text-white mb-1" />
                  <h2 className="text-base font-bold text-white">報名成功！已保留名額</h2>
                </div>
                <div className="p-5 space-y-4">
                  <div className="p-3 rounded-xl text-center bg-amber-50 border border-amber-200">
                    {timeLeft === 0 ? (
                      <div className="text-red-600 font-bold text-xs">
                        <AlertCircle size={20} className="mx-auto mb-1" />
                        保留時間已逾時，名額釋出
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
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setSelectedPayment("bank")}
                          className={`py-2 rounded-xl font-bold text-[11px] border ${
                            selectedPayment === "bank"
                              ? "border-gray-800 bg-gray-100 text-gray-900"
                              : "border-gray-200 text-gray-600"
                          }`}
                        >
                          銀行轉帳
                        </button>
                        <button
                          onClick={() => setSelectedPayment("line")}
                          className={`py-2 rounded-xl font-bold text-[11px] border ${
                            selectedPayment === "line"
                              ? "border-[#06C755] bg-[#06C755]/10 text-[#06C755]"
                              : "border-gray-200 text-gray-600"
                          }`}
                        >
                          TWQR
                        </button>
                        <button
                          onClick={() => setSelectedPayment("cash")}
                          className={`py-2 rounded-xl font-bold text-[11px] border ${ selectedPayment === "cash" ? "border-amber-600 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-600" }`} > 現場付款 </button> </div>  {selectedPayment && ( <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl space-y-3"> {selectedPayment === "bank" ? ( <div> <label className="block text-xs font-bold text-gray-700 mb-1"> 轉出帳號末五碼（必填） </label> <input type="text" inputMode="numeric" maxLength={5} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs mb-2.5" value={last5} onChange={(e) => setLast5(e.target.value.replace(/[^0-9]/g, "").slice(0, 5)) } /> </div> ) : selectedPayment === "cash" ? ( <p className="text-xs text-gray-600 font-bold text-center py-2"> 屆時請於活動現場將現金繳交給主辦人。 </p> ) : ( <p className="text-xs text-gray-600 font-bold text-center py-2"> 點擊下方按鈕，系統將自動記錄回報時間以利開團者對帳。 </p> )} <button onClick={handleReportPayment} disabled={isSubmitting} className="w-full bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50" > {isSubmitting ? "送出中..." : (selectedPayment === "cash" ? "確認選擇現場付款" : "我已完成付款")} </button> </div> )} </> )} <button onClick={() => { setBookingResult(null); setTimeLeft(null); }} className="w-full text-gray-400 text-xs font-bold py-1.5" > 稍後至「我的臨打」處理 </button> </div> </> )} </div> </div> )} </div> ); } ``` </Step>  <Step title="第三步：替換 app/my-sessions/page.tsx (我的臨打管理)"> **升級重點**：開團表單加入「場地編號、取消限制、備註」。報名資訊 (Joined) 卡片大幅豐富，並結合「防呆取消按鈕」與「補付款回報」。 請將 **`app/my-sessions/page.tsx`** 全部清空，替換為以下程式碼：  ```tsx "use client";  import { useState, useEffect } from "react"; import { supabase } from "../../lib/supabase"; import { Plus, RotateCcw, CheckCircle2, XCircle, ChevronLeft, Check, Edit3, Trash2, MapPin, Share, Undo2, Users } from "lucide-react";  const TAIWAN_CITIES: Record<string, string[]> = { 台北市: ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"], 新北市: ["板橋區", "新莊區", "中和區", "永和區", "土城區", "樹林區", "三峽區", "鶯歌區", "三重區", "蘆洲區", "五股區", "泰山區", "林口區", "淡水區", "汐止區", "新店區"], 桃園市: ["桃園區", "中壢區", "大溪區", "楊梅區", "蘆竹區", "大園區", "龜山區", "八德區", "龍潭區", "平鎮區"], 台中市: ["中區", "東區", "南區", "西區", "北區", "北屯區", "西屯區", "南屯區", "太平區", "大里區", "霧峰區", "烏日區", "豐原區", "沙鹿區", "龍井區", "清水區", "大甲區"], 台南市: ["中西區", "東區", "南區", "北區", "安平區", "安南區", "永康區", "歸仁區", "新營區", "仁德區"], 高雄市: ["楠梓區", "左營區", "鼓山區", "三民區", "苓雅區", "前鎮區", "小港區", "鳳山區", "大寮區", "岡山區"], 基隆市: ["仁愛區", "信義區", "中正區", "中山區", "安樂區", "暖暖區", "七堵區"], 新竹市: ["東區", "北區", "香山區"], 新竹縣: ["竹北市", "竹東鎮", "新豐鄉", "湖口鄉"], 彰化縣: ["彰化市", "員林市", "鹿港鎮", "和美鎮"], 其他: ["苗栗縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "台東縣", "澎湖縣", "金門縣", "連江縣"], };  export default function MySessionsPage() { const [activeTab, setActiveTab] = useState<"hosting" \vert{} "joined">("hosting"); const [loading, setLoading] = useState(true); const [userProfile, setUserProfile] = useState({ phone: "", lineNickname: "", paymentLink: "", bankAccount: "", }); const [hostedIds, setHostedIds] = useState<string[]>([]); const [joinedMap, setJoinedMap] = useState<Record<string, string>>({}); const [sessions, setSessions] = useState<any[]>([]); const [managingSessionId, setManagingSessionId] = useState<string \vert{} null>(null); const [isEditingSession, setIsEditingSession] = useState(false); const [showCreateModal, setShowCreateModal] = useState(false); const [isSubmitting, setIsSubmitting] = useState(false);  // 表單狀態擴充 const [formCity, setFormCity] = useState("台中市"); const [formDistrict, setFormDistrict] = useState("龍井區"); const [formLocation, setFormLocation] = useState(""); const [formAddress, setFormAddress] = useState(""); const [formCourtName, setFormCourtName] = useState(""); const [formDate, setFormDate] = useState(""); const [formStartTime, setFormStartTime] = useState("19:00"); const [formEndTime, setFormEndTime] = useState("21:00"); const [formLevel, setFormLevel] = useState("不限"); const [formMaxPlayers, setFormMaxPlayers] = useState(16); const [formWaitlist, setFormWaitlist] = useState(2); const [formPrice, setFormPrice] = useState(150); const [formCancelLimit, setFormCancelLimit] = useState<number \vert{} null>(null); const [formAdditionalNotes, setFormAdditionalNotes] = useState(""); const [formBankAccount, setFormBankAccount] = useState("");  const [payingRecord, setPayingRecord] = useState<any \vert{} null>(null); const [payMethod, setPayMethod] = useState<"line" \vert{} "bank" \vert{} "cash">("bank"); const [payLast5, setPayLast5] = useState("");  useEffect(() => { try { const savedProfile = localStorage.getItem("picklego_user_profile"); if (savedProfile) { const parsed = JSON.parse(savedProfile); setUserProfile({ phone: parsed.phone \vert{}\vert{} "", lineNickname: parsed.lineNickname \vert{}\vert{} "", paymentLink: parsed.paymentLink \vert{}\vert{} "", bankAccount: parsed.bankAccount \vert{}\vert{} "", }); setFormBankAccount(parsed.bankAccount \vert{}\vert{} ""); } const savedHosted = localStorage.getItem("picklego_hosted_sessions"); if (savedHosted) setHostedIds(JSON.parse(savedHosted)); const savedJoined = localStorage.getItem("picklego_joined_sessions"); if (savedJoined) setJoinedMap(JSON.parse(savedJoined)); } catch (e) {} const tomorrow = new Date(Date.now() + 86400000); const y = tomorrow.getFullYear(); const m = String(tomorrow.getMonth() + 1).padStart(2, "0"); const d = String(tomorrow.getDate()).padStart(2, "0"); setFormDate(`${y}-${m}-${d}`);
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("open_play_sessions")
      .select("*, courts(name), open_play_players(*)")
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (data) setSessions(data);
    setLoading(false);
  };

  const formatDateWithDay = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const days = ["日", "一", "二", "三", "四", "五", "六"];
    return `${m}/${d} (${days[dateObj.getDay()]})`; };  const formatDateTime = (iso: string) => { if (!iso) return ""; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };  const getCourtLabel = (session: any) => { if (session.court_name) return session.court_name; if (session.courts?.name) return session.courts.name; if (session.notes && session.notes.includes("【")) { const match = session.notes.match(/【(.*?)】/); if (match) return match[1]; } return ""; };  const handleApplyLastSession = () => { try { const savedLast = localStorage.getItem("picklego_last_session_template"); if (savedLast) { const t = JSON.parse(savedLast); setFormCity(t.city \vert{}\vert{} "台中市"); setFormDistrict(t.district \vert{}\vert{} "龍井區"); setFormLocation(t.location \vert{}\vert{} ""); setFormAddress(t.address \vert{}\vert{} ""); setFormCourtName(t.courtName \vert{}\vert{} ""); setFormStartTime(t.startTime \vert{}\vert{} "19:00"); setFormEndTime(t.endTime \vert{}\vert{} "21:00"); setFormLevel(t.level \vert{}\vert{} "不限"); setFormMaxPlayers(t.maxPlayers \vert{}\vert{} 16); setFormWaitlist(t.waitlist \vert{}\vert{} 2); setFormPrice(t.price ?? 150); setFormCancelLimit(t.cancelLimit ?? null); setFormAdditionalNotes(t.additionalNotes \vert{}\vert{} ""); setFormBankAccount(t.bankAccount \vert{}\vert{} userProfile.bankAccount \vert{}\vert{} ""); setIsEditingSession(false); setShowCreateModal(true); return; } } catch (e) {} setIsEditingSession(false); setShowCreateModal(true); };  const handleSaveSession = async (e: React.FormEvent) => { e.preventDefault(); if (!formLocation.trim() \vert{}\vert{} !formDate \vert{}\vert{} !formCity \vert{}\vert{} !formDistrict) return alert("請完整填寫地點與日期！"); setIsSubmitting(true); try { let combinedNotes = ""; if (formBankAccount) combinedNotes += `收款帳號：${formBankAccount}`;

      const payload: any = {
        title: formLocation.trim(),
        city: formCity,
        district: formDistrict,
        address: formAddress.trim() || null,
        court_name: formCourtName.trim() || null,
        host_phone: userProfile.phone || null,
        host_name: userProfile.lineNickname || null,
        session_date: formDate,
        start_time: `${formStartTime.slice(0, 5)}:00`, end_time: `${formEndTime.slice(0, 5)}:00`,
        level: formLevel,
        price: Number(formPrice),
        max_players: Number(formMaxPlayers),
        max_waitlist: Number(formWaitlist),
        cancel_limit_hours: formCancelLimit,
        additional_notes: formAdditionalNotes.trim() || null,
        status: "open",
        notes: combinedNotes || null,
      };

      if (isEditingSession && managingSessionId) {
        const { error } = await supabase.from("open_play_sessions").update(payload).eq("id", managingSessionId);
        if (error) throw error;
        alert("✅ 活動資訊已成功修改！");
        setIsEditingSession(false);
      } else {
        const { data, error } = await supabase.from("open_play_sessions").insert([payload]).select().single();
        if (error) throw error;
        if (data?.id) {
          const nextHosted = Array.from(new Set([data.id, ...hostedIds]));
          setHostedIds(nextHosted);
          localStorage.setItem("picklego_hosted_sessions", JSON.stringify(nextHosted));
        }
        localStorage.setItem(
          "picklego_last_session_template",
          JSON.stringify({
            city: formCity, district: formDistrict, location: formLocation.trim(),
            address: formAddress.trim(), courtName: formCourtName.trim(),
            startTime: formStartTime, endTime: formEndTime, level: formLevel,
            maxPlayers: Number(formMaxPlayers), waitlist: Number(formWaitlist),
            price: Number(formPrice), cancelLimit: formCancelLimit,
            additionalNotes: formAdditionalNotes.trim(), bankAccount: formBankAccount,
          })
        );
        alert("✅ 臨打活動已發布！");
      }
      setShowCreateModal(false);
      await fetchAllData();
    } catch (err: any) {
      alert("儲存失敗：" + (err.message || "請確認已執行擴充欄位 SQL"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPayment = async (player: any) => {
    try {
      await supabase.from("open_play_players").update({ payment_status: "paid", admin_confirm_time: new Date().toISOString() }).eq("id", player.id);
      fetchAllData();
    } catch (err: any) { alert("核帳失敗：" + err.message); }
  };

  const handleUndoPayment = async (player: any) => {
    if (!confirm(`確定要將「${player.display_name \vert{}\vert{} player.line_nickname}」退回待核帳狀態嗎？`)) return; try { await supabase.from("open_play_players").update({ payment_status: "reported", admin_confirm_time: null }).eq("id", player.id); fetchAllData(); } catch (err: any) { alert("復原失敗：" + err.message); } };  const handleCancelPlayer = async (player: any, session: any) => { if (!confirm(`確定要取消「${player.display_name || player.line_nickname}」嗎？`)) return;
    try {
      await supabase.from("open_play_players").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", player.id);
      if (player.status === "registered") {
        const waitlisted = (session.open_play_players || [])
          .filter((p: any) => p.status === "waitlisted")
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        if (waitlisted.length > 0) {
          await supabase.from("open_play_players").update({ status: "registered", promoted_at: new Date().toISOString() }).eq("id", waitlisted[0].id);
        }
      }
      fetchAllData();
    } catch (err: any) { alert("取消失敗：" + err.message); }
  };

  const handlePlayerReportPayment = async () => {
    if (!payingRecord) return;
    if (payMethod === "bank" && !payLast5.trim()) return alert("請輸入轉帳末五碼！");
    setIsSubmitting(true);
    try {
      const finalLast5 = payMethod === "line" ? "TWQR" : (payMethod === "cash" ? "現場付款" : payLast5.trim());
      await supabase.from("open_play_players")
        .update({
          payment_method: payMethod,
          payment_account_last5: finalLast5,
          payment_status: "reported",
          payment_report_time: new Date().toISOString(),
        })
        .eq("id", payingRecord.player.id);
      alert("✅ 已送出付款回報，等待建立者核帳！");
      setPayingRecord(null);
      setPayLast5("");
      fetchAllData();
    } catch (err: any) { alert("回報失敗：" + err.message); } finally { setIsSubmitting(false); }
  };

  const handleShare = (e: React.MouseEvent, session: any) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?session=${session.id}`;
    const courtText = getCourtLabel(session) ? `· ${getCourtLabel(session)}` : ""; const locStr = `${session.city || ""}${session.district \vert{}\vert{} ""} ${session.address || ""} ${session.title}${courtText}`.trim();
    const text = `🎾 PickleGo 臨打邀請\n【時間】${formatDateWithDay(session.session_date)}${session.start_time?.slice(0, 5)}-${session.end_time?.slice(0, 5)}\n【地點】${locStr}\n【程度】${session.level \vert{}\vert{} "不限"}\n【費用】$${session.price || 0} / 人\n👇 點擊連結快速報名：\n${url}`; navigator.clipboard.writeText(text); alert("✅ 報名資訊與專屬網址已複製！"); };  const myHostedSessions = sessions.filter((s) => { if (userProfile.phone && s.host_phone === userProfile.phone) return true; if (hostedIds.includes(s.id)) return true; if (!userProfile.phone && hostedIds.length === 0) return s.status === "open"; return false; });  const myJoinedEntries = sessions.map((session) => { const myRecord = (session.open_play_players \vert{}\vert{} []).find((p: any) => (userProfile.phone && p.phone === userProfile.phone) \vert{}\vert{} (userProfile.lineNickname && (p.line_nickname === userProfile.lineNickname \vert{}\vert{} p.display_name === userProfile.lineNickname)) \vert{}\vert{} joinedMap[session.id] ); return myRecord ? { session, player: myRecord } : null; }).filter(Boolean) as { session: any; player: any }[];  const managingSession = sessions.find((s) => s.id === managingSessionId);  const openEditModal = (targetSession: any) => { setFormCity(targetSession.city \vert{}\vert{} "台中市"); setFormDistrict(targetSession.district \vert{}\vert{} "龍井區"); setFormLocation(targetSession.title \vert{}\vert{} ""); setFormAddress(targetSession.address \vert{}\vert{} ""); setFormCourtName(getCourtLabel(targetSession)); setFormDate(targetSession.session_date); setFormStartTime(targetSession.start_time?.slice(0, 5) \vert{}\vert{} "19:00"); setFormEndTime(targetSession.end_time?.slice(0, 5) \vert{}\vert{} "21:00"); setFormMaxPlayers(targetSession.max_players \vert{}\vert{} 16); setFormPrice(targetSession.price ?? 150); setFormLevel(targetSession.level \vert{}\vert{} "不限"); setFormWaitlist(targetSession.max_waitlist \vert{}\vert{} 2); setFormCancelLimit(targetSession.cancel_limit_hours ?? null); setFormAdditionalNotes(targetSession.additional_notes \vert{}\vert{} ""); setIsEditingSession(true); setShowCreateModal(true); };  return ( <div className="w-full min-h-full bg-[#F8F9FA] pb-16"> {managingSession ? ( (() => { const allPlayers = managingSession.open_play_players \vert{}\vert{} []; const activePlayers = allPlayers.filter((p: any) => p.status !== "cancelled"); const regPlayers = activePlayers.filter((p: any) => p.status === "registered"); const sortedPlayers = [...allPlayers].sort((a: any, b: any) => { const score = (p: any) => { if (p.status === "cancelled") return 99; if (p.status === "waitlisted") return 50; const isPendingVerify = p.payment_status === "reported" \vert{}\vert{} (p.payment_account_last5 && p.payment_status !== "paid" && p.payment_status !== "confirmed"); if (isPendingVerify) return 1; if (p.payment_status === "paid" \vert{}\vert{} p.payment_status === "confirmed") return 3; return 2; }; return score(a) - score(b); });  const courtText = getCourtLabel(managingSession); let limitText = "取消無時限"; if (managingSession.cancel_limit_hours === 0) limitText = "報名後不可取消"; else if (managingSession.cancel_limit_hours > 0) limitText = `開打前 ${managingSession.cancel_limit_hours}h 不可取消`;

          return (
            <div>
              <div className="bg-white px-4 py-3 sticky top-0 z-30 border-b border-gray-100 flex items-center justify-between">
                <button onClick={() => setManagingSessionId(null)} className="flex items-center gap-1 text-sm font-bold text-gray-700"><ChevronLeft size={18} /> 返回</button>
                <span className="font-extrabold text-sm text-gray-900">單一場次管理</span>
                <button onClick={() => openEditModal(managingSession)} className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1"><Edit3 size={13} /> 修改</button>
              </div>

              <div className="p-4 space-y-4">
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-extrabold text-base text-gray-900">{formatDateWithDay(managingSession.session_date)} {managingSession.start_time?.slice(0, 5)}–{managingSession.end_time?.slice(0, 5)}</p>
                      <p className="text-sm font-bold text-gray-700 mt-0.5">{managingSession.title} {courtText && `· ${courtText}`}</p> <p className="text-xs text-gray-500 mt-0.5">📍 {managingSession.city \vert{}\vert{} ""}{managingSession.district \vert{}\vert{} ""} {managingSession.address \vert{}\vert{} ""}</p> <p className="text-xs font-bold text-gray-500 mt-0.5">🎾 程度：{managingSession.level \vert{}\vert{} "不限"} \vert{} 🛡️ {limitText}</p> </div> <span className="font-extrabold text-base text-green-700">${managingSession.price}</span> </div> {managingSession.additional_notes && ( <div className="mt-3 bg-amber-50/50 p-2.5 rounded-lg text-xs text-gray-700 border border-amber-100"> <span className="font-bold">📝 備註：</span>{managingSession.additional_notes} </div> )} <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600"> <span>正取：<strong className="text-gray-900">{regPlayers.length} / {managingSession.max_players} 人</strong></span> <button onClick={(e) => handleShare(e, managingSession)} className="text-green-700 font-bold flex items-center gap-1"><Share size={13} /> 分享報名</button> </div> </div>  <div className="space-y-2.5"> {sortedPlayers.length === 0 ? ( <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-xs">目前尚無球友報名</div> ) : ( sortedPlayers.map((player: any) => { const isPaid = player.payment_status === "paid" \vert{}\vert{} player.payment_status === "confirmed"; const isPendingVerify = !isPaid && (player.payment_status === "reported" \vert{}\vert{} Boolean(player.payment_account_last5)); let lightBadge = "🟡 待付款"; let badgeClass = "bg-amber-50 text-amber-700 border-amber-200"; if (player.status === "cancelled") { lightBadge = "🔴 已取消"; badgeClass = "bg-red-50 text-red-600 border-red-200"; } else if (player.status === "waitlisted") { lightBadge = "候補中"; badgeClass = "bg-gray-100 text-gray-600 border-gray-200"; } else if (isPaid) { lightBadge = "🟢 已確認"; badgeClass = "bg-green-50 text-green-700 border-green-200"; } else if (isPendingVerify) { lightBadge = "🟡 待核帳"; badgeClass = "bg-[#FEF3C7] text-amber-900 border-amber-300"; }  const d = new Date(managingSession.session_date); const rocDate = `${d.getFullYear() - 1911}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
                      let reconcileStr = player.payment_account_last5 || "尚未回報";
                      
                      if (player.payment_account_last5 === "TWQR") reconcileStr = `TWQR (${rocDate}-${player.phone ? player.phone.slice(-3) : "000"})`;
                      else if (player.payment_account_last5 === "現場付款") reconcileStr = "現場繳交現金";
                      else if (player.payment_account_last5) reconcileStr = `${rocDate}-${player.payment_account_last5}`;

                      return (
                        <div key={player.id} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-2xs flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-gray-900 truncate">{player.display_name || player.line_nickname || "球友"}</span>
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>{lightBadge}</span> </div> <div className="text-xs text-gray-600 mt-1.5 space-y-0.5"> <p>📞 電話：{player.phone \vert{}\vert{} "未提供"}</p> <p>💳 對帳碼：<strong className="text-gray-900">{reconcileStr}</strong></p> <p>🕒 回報時間：{player.payment_report_time ? formatDateTime(player.payment_report_time) : player.created_at ? `${formatDateTime(player.created_at)} (報名)` : "尚未回報"}</p>
                            </div>
                          </div>
                          {player.status !== "cancelled" && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!isPaid && player.status === "registered" && (
                                <button onClick={() => handleConfirmPayment(player)} className="bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"><Check size={13} /> 核帳</button>
                              )}
                              {isPaid && player.status === "registered" && (
                                <button onClick={() => handleUndoPayment(player)} className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 hover:bg-amber-100 transition" title="點錯復原為待核帳"><Undo2 size={13} /> 復原</button>
                              )}
                              <button onClick={() => handleCancelPlayer(player, managingSession)} className="bg-gray-100 text-gray-500 p-1.5 rounded-xl hover:bg-red-50 hover:text-red-500 transition" title="取消此球友"><Trash2 size={15} /></button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        <>
          <div className="bg-white px-4 pt-3 pb-3 sticky top-0 z-30 border-b border-gray-100">
            <h1 className="text-xl font-extrabold text-gray-900 mb-3">我的臨打</h1>
            <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-2 gap-1">
              <button onClick={() => setActiveTab("hosting")} className={`py-2 rounded-lg text-xs font-extrabold transition-all ${activeTab === "hosting" ? "bg-green-700 text-white shadow-2xs" : "text-gray-600 hover:text-gray-900"}`}>開團資訊</button>
              <button onClick={() => setActiveTab("joined")} className={`py-2 rounded-lg text-xs font-extrabold transition-all ${activeTab === "joined" ? "bg-green-700 text-white shadow-2xs" : "text-gray-600 hover:text-gray-900"}`}>報名資訊</button> </div> </div>  <div className="p-4"> {activeTab === "hosting" ? ( <div className="space-y-4"> <div className="space-y-2"> <button onClick={() => { setIsEditingSession(false); setFormLocation(""); setFormAddress(""); setFormCourtName(""); setShowCreateModal(true); }} className="w-full bg-green-700 text-white font-extrabold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-xs"><Plus size={18} strokeWidth={2.5} /> 開一場臨打</button> <button onClick={handleApplyLastSession} className="w-full bg-white text-green-800 border border-green-700 font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"><RotateCcw size={15} strokeWidth={2.5} /> 套用上一次</button> </div> <div> <h2 className="text-sm font-extrabold text-green-800 border-b-2 border-green-700 pb-0.5 mb-2.5">我開的臨打 ({myHostedSessions.length})</h2> {myHostedSessions.length === 0 ? ( <div className="bg-white rounded-2xl p-8 text-center border border-gray-100"><p className="text-gray-400 text-xs">目前還沒有建立臨打</p></div> ) : ( <div className="space-y-3"> {myHostedSessions.map((session) => { const regPlayers = (session.open_play_players \vert{}\vert{} []).filter((p: any) => p.status === "registered"); const cancelledPlayers = (session.open_play_players \vert{}\vert{} []).filter((p: any) => p.status === "cancelled"); const pendingVerifyCount = regPlayers.filter((p: any) => p.payment_status !== "paid" && p.payment_status !== "confirmed" && (p.payment_status === "reported" \vert{}\vert{} Boolean(p.payment_account_last5))).length;  let actionBadge = `${regPlayers.length} / ${session.max_players} 人`; let badgeStyle = "bg-gray-100 text-gray-700"; let iconType: "yellow" \vert{} "green" \vert{} "cancel" = "green";  if (pendingVerifyCount > 0) { actionBadge = `${pendingVerifyCount} 筆待核帳`; badgeStyle = "bg-[#FDE68A] text-amber-900"; iconType = "yellow"; }
                        else if (cancelledPlayers.length > 0) { actionBadge = `${cancelledPlayers.length} 人取消`; badgeStyle = "bg-red-100 text-red-700"; iconType = "cancel"; } else if (regPlayers.length >= session.max_players) { actionBadge = "已額滿"; badgeStyle = "bg-gray-200 text-gray-700"; iconType = "green"; } else if (regPlayers.length > 0 && regPlayers.every((p: any) => p.payment_status === "paid" \vert{}\vert{} p.payment_status === "confirmed")) { actionBadge = "收款已確認"; badgeStyle = "bg-green-100 text-green-800"; iconType = "green"; }  const courtText = getCourtLabel(session);  return ( <div key={session.id} onClick={() => setManagingSessionId(session.id)} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs flex items-center justify-between gap-3 cursor-pointer hover:border-green-300 transition"> <div className="flex items-start gap-3 min-w-0 flex-1"> <div className="mt-1 shrink-0"> {iconType === "yellow" && (<div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>)} {iconType === "green" && (<div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center"><CheckCircle2 size={15} strokeWidth={3} /></div>)} {iconType === "cancel" && (<div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center"><XCircle size={15} strokeWidth={2.5} /></div>)} </div> <div className="min-w-0 flex-1"> <p className="font-extrabold text-[15px] text-gray-900">{formatDateWithDay(session.session_date)} {session.start_time?.slice(0, 5)}–{session.end_time?.slice(0, 5)}</p> <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">{session.title}</p> <p className="text-xs text-gray-500 mt-1">🎾 {session.level \vert{}\vert{} "不限"} {courtText && `\vert{} ${courtText}`}</p>
                              </div>
                            </div>
                            <div className="shrink-0"><span className={`px-3 py-1.5 rounded-full text-xs font-extrabold ${badgeStyle}`}>{actionBadge}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-extrabold text-green-800 border-b-2 border-green-700 pb-0.5 mb-1">我報名的臨打 ({myJoinedEntries.length})</h2>
                {myJoinedEntries.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-gray-100"><p className="text-gray-400 text-xs">目前尚無報名紀錄</p></div>
                ) : (
                  myJoinedEntries.map(({ session, player }) => {
                    const isPaid = player.payment_status === "paid" || player.payment_status === "confirmed";
                    const isReported = player.payment_status === "reported" || Boolean(player.payment_account_last5);
                    
                    let leftIconType = "open";
                    let statusBadge = "";
                    let statusStyle = "";
                    if (player.status === "cancelled") { leftIconType = "cancel"; statusBadge = "已取消"; statusStyle = "bg-gray-100 text-gray-500"; }
                    else if (player.status === "waitlisted") { leftIconType = "waitlist"; statusBadge = "候補中"; statusStyle = "bg-amber-100 text-amber-800"; }
                    else { leftIconType = "joined"; statusBadge = "已報名"; statusStyle = "bg-green-700 text-white"; }
                    
                    const courtText = getCourtLabel(session);
                    const fullAddress = `${session.city \vert{}\vert{} ""}${session.district || ""}${session.address \vert{}\vert{} ""}`.trim(); const mapQuery = `${fullAddress} ${session.title \vert{}\vert{} ""}`.trim();  // 取消時限防呆計算 const sessionDateTime = new Date(`${session.session_date}T${session.start_time}`);
                    const now = new Date();
                    const diffHours = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                    let canCancel = true;
                    let cancelReason = "取消報名";
                    let limitText = "取消無時限";
                    if (session.cancel_limit_hours === 0) {
                      canCancel = false; cancelReason = "報名後不可取消"; limitText = "報名後不可取消";
                    } else if (session.cancel_limit_hours !== null) {
                      limitText = `開打前 ${session.cancel_limit_hours}h 不可取消`;
                      if (diffHours <= session.cancel_limit_hours) { canCancel = false; cancelReason = `已過取消時限 (${session.cancel_limit_hours}h前)`; } }  // 付款狀態顯示字串 let payDisplay = ""; if (isPaid) payDisplay = "🟢 主辦已確認收款"; else if (player.payment_account_last5 === "現場付款" \vert{}\vert{} player.payment_method === "cash") payDisplay = "✅ 已回報：現場繳交現金"; else if (player.payment_account_last5 === "TWQR" \vert{}\vert{} player.payment_method === "line") payDisplay = "✅ 已回報：TWQR"; else if (player.payment_account_last5) payDisplay = `✅ 已回報轉帳 (*${player.payment_account_last5})`;

                    return (
                      <div key={player.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="mt-1 shrink-0">
                              {leftIconType === "joined" && (<div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center"><CheckCircle2 size={15} strokeWidth={3} /></div>)}
                              {leftIconType === "waitlist" && (<div className="w-6 h-6 rounded-full bg-gray-500 text-white flex items-center justify-center"><Users size={13} /></div>)}
                              {leftIconType === "cancel" && (<div className="w-6 h-6 rounded-full bg-gray-300 text-white flex items-center justify-center"><XCircle size={15} strokeWidth={3} /></div>)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-extrabold text-[15px] text-gray-900 leading-snug">
                                {formatDateWithDay(session.session_date)} {session.start_time?.slice(0, 5)}–{session.end_time?.slice(0, 5)}
                              </p>
                              <p className="text-sm font-bold text-gray-800 mt-0.5 truncate">{session.title} {courtText && `· ${courtText}`}</p> <p className="text-xs font-bold text-gray-500 mt-0.5">🎾 {session.level \vert{}\vert{} "不限"} \vert{} 🛡️ {limitText}</p> <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1 hover:underline"><MapPin size={12} className="shrink-0"/> {fullAddress || session.title} (導航)</a>
                              <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-2">
                                <span className="font-bold text-green-700">${session.price}</span>
                                {player.status !== "cancelled" && (
                                  <><span>|</span><span className={`px-2 py-0.5 rounded-full font-bold ${statusStyle}`}>{statusBadge}</span></>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {session.additional_notes && (
                          <div className="mt-3 bg-amber-50/50 p-2.5 rounded-lg text-xs text-gray-700 border border-amber-100">
                            <span className="font-bold">📝 備註：</span>{session.additional_notes}
                          </div>
                        )}

                        {/* 球友操作區塊 */}
                        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                          {player.status !== "cancelled" && (
                            <button onClick={() => canCancel ? handleCancelPlayer(player, session) : alert(cancelReason)} className={`flex-1 min-w-[45%] py-2 rounded-xl text-xs font-bold transition ${canCancel ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                              {canCancel ? "取消報名" : cancelReason}
                            </button>
                          )}
                          
                          {player.status === "registered" && !isReported && (
                            <button onClick={() => setPayingRecord({ session, player })} className="flex-1 min-w-[45%] bg-green-700 hover:bg-green-800 text-white py-2 rounded-xl text-xs font-bold transition">
                              💰 補付款 / 回報
                            </button>
                          )}
                          
                          {player.status === "registered" && isReported && (
                            <div className="flex-1 min-w-[45%] bg-gray-50 text-gray-700 flex flex-col justify-center items-center rounded-xl text-xs font-bold border border-gray-200 py-1.5 px-2">
                              {payDisplay}
                              {!isPaid && (
                                <button onClick={() => setPayingRecord({ session, player })} className="text-green-700 underline mt-0.5 font-bold text-[11px]">更改付款方式</button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85dvh] overflow-y-auto p-5 shadow-2xl">
            <h2 className="text-lg font-extrabold text-gray-900 mb-3">
              {isEditingSession ? "修改臨打活動" : "開一場臨打"}
            </h2>
            <form onSubmit={handleSaveSession} className="space-y-3 text-xs">
              <div className="space-y-2">
                <label className="font-bold text-gray-700 block">1. 地點 (必填)</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={formCity} onChange={(e) => { setFormCity(e.target.value); setFormDistrict(TAIWAN_CITIES[e.target.value]?.[0] || ""); }} className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900">
                    {Object.keys(TAIWAN_CITIES).map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                  <select value={formDistrict} onChange={(e) => setFormDistrict(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900">
                    {(TAIWAN_CITIES[formCity] || []).map((dist) => <option key={dist} value={dist}>{dist}</option>)}
                  </select>
                </div>
                <input type="text" required placeholder="場館名稱 (如: 龍井運動中心)" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900" />
                <input type="text" placeholder="詳細地址 (如: 中華路一段... 導航更精準)" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900" />
                <input type="text" placeholder="場地編號 (如: A場地、1號場)" value={formCourtName} onChange={(e) => setFormCourtName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="font-bold text-gray-700 block mb-1">2. 日期</label><input type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-1 py-2 text-gray-900" /></div>
                <div><label className="font-bold text-gray-700 block mb-1">3. 開始</label><input type="time" required value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-1 py-2 text-gray-900" /></div>
                <div><label className="font-bold text-gray-700 block mb-1">4. 結束</label><input type="time" required value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-1 py-2 text-gray-900" /></div>
              </div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">5. 程度要求</label>
                <div className="flex flex-wrap gap-1.5">
                  {["不限", "新手", "2.0", "2.5", "3.0", "3.5", "4.0+"].map((l) => (
                    <button type="button" key={l} onClick={() => setFormLevel(l)} className={`py-1.5 px-2.5 rounded-lg font-bold border transition ${formLevel === l ? "bg-green-700 text-white border-green-700" : "bg-gray-50 text-gray-700 border-gray-200"}`}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="font-bold text-gray-700 block mb-1">6. 正取上限</label><input type="number" min={2} value={formMaxPlayers} onChange={(e) => setFormMaxPlayers(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900" /></div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">7. 候補名額</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((w) => (
                      <button type="button" key={w} onClick={() => setFormWaitlist(w)} className={`flex-1 py-2 rounded-lg font-bold border ${formWaitlist === w ? "bg-gray-800 text-white border-gray-800" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{w}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div><label className="font-bold text-gray-700 block mb-1">8. 每人費用 ($)</label><input type="number" min={0} value={formPrice} onChange={(e) => setFormPrice(Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900" /></div>
              
              <div>
                <label className="font-bold text-gray-700 block mb-1">9. 取消報名限制</label>
                <select value={formCancelLimit === null ? "null" : formCancelLimit} onChange={(e) => setFormCancelLimit(e.target.value === "null" ? null : Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900">
                  <option value="null">不限 (隨時可取消)</option>
                  <option value="0">報名後不可取消</option>
                  <option value="12">開打前 12 小時不可取消</option>
                  <option value="24">開打前 24 小時不可取消</option>
                  <option value="48">開打前 48 小時不可取消</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">10. 其他備註 (選填)</label>
                <textarea placeholder="例如：提供比賽用球、場地有冷氣飲水機..." rows={2} value={formAdditionalNotes} onChange={(e) => setFormAdditionalNotes(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 resize-none" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl">取消</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] bg-green-700 text-white font-bold py-2.5 rounded-xl disabled:opacity-50">{isSubmitting ? "儲存中..." : isEditingSession ? "確認修改" : "確認發布"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-base text-gray-900">回報付款</h3>
            
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setPayMethod("bank")} className={`py-2 rounded-xl font-bold text-[11px] border ${payMethod === "bank" ? "border-gray-800 bg-gray-100 text-gray-900" : "border-gray-200 text-gray-500"}`}>銀行轉帳</button>
              <button onClick={() => setPayMethod("line")} className={`py-2 rounded-xl font-bold text-[11px] border ${payMethod === "line" ? "border-[#06C755] bg-[#06C755]/10 text-[#06C755]" : "border-gray-200 text-gray-500"}`}>TWQR / 付款碼</button>
              <button onClick={() => setPayMethod("cash")} className={`py-2 rounded-xl font-bold text-[11px] border ${payMethod === "cash" ? "border-amber-600 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500"}`}>現場付款</button>
            </div>
            
            {payMethod === "bank" && (
              <input type="text" placeholder="請輸入轉出帳號末五碼" value={payLast5} onChange={(e) => setPayLast5(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-bold" />
            )}
            {payMethod === "cash" && (
              <p className="text-xs text-gray-600 font-bold text-center">屆時請於活動現場將現金繳交給主辦人。</p>
            )}
            
            <div className="flex gap-2 pt-2">
              <button onClick={() => setPayingRecord(null)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs">取消</button>
              <button onClick={handlePlayerReportPayment} disabled={isSubmitting} className="flex-[2] bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50">{isSubmitting ? "送出中..." : (payMethod === "cash" ? "確認選擇現場付款" : "我已完成付款")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}