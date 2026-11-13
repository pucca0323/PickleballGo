"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import { CheckCircle2, Clock, AlertCircle, SlidersHorizontal, Bell, Users, X, MapPin, Share } from "lucide-react";

export default function FindGamesPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [courtsList, setCourtsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [phone, setPhone] = useState("");
  const [lineNickname, setLineNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myJoinedMap, setMyJoinedMap] = useState<Record<string, string>>({});
  const [bookingResult, setBookingResult] = useState<any | null>(null);
  const [createdPlayerId, setCreatedPlayerId] = useState<any | null>(null);

  const [selectedPayment, setSelectedPayment] = useState<string>("");
  const [last5, setLast5] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const [datesList, setDatesList] = useState<{ date: string; display: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filterRegion, setFilterRegion] = useState<string>("全部");
  const [filterTime, setFilterTime] = useState<string>("全部");
  const [filterLevel, setFilterLevel] = useState<string>("全部");

  const listRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    const today = new Date();
    const dates = [];
    const days = ["日", "一", "二", "三", "四", "五", "六"];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const isoDate = d.toISOString().split("T")[0];
      let display = `${d.getMonth() + 1}/${d.getDate()}`;
      if (i === 0) display = "今天"; else if (i === 1) display = "明天"; else display += ` (${days[d.getDay()]})`;
      dates.push({ date: isoDate, display });
    }
    setDatesList(dates);
    setSelectedDate(dates[0].date);

    try {
      const savedProfile = localStorage.getItem("picklego_user_profile");
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.lineNickname) setLineNickname(parsed.lineNickname);
      }
      const savedJoined = localStorage.getItem("picklego_joined_sessions");
      if (savedJoined) setMyJoinedMap(JSON.parse(savedJoined));
    } catch (e) { }

    fetchData();
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const deepLinkId = params.get("session");
      if (deepLinkId) {
        const target = sessions.find(s => s.id === deepLinkId);
        if (target) {
          setSelectedDate(target.session_date);
          setSelectedSession(target);
          setTimeout(() => {
            const el = document.getElementById(`session-${target.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }
      }
    }
  }, [sessions]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => (prev && prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const fetchData = async () => {
    const { data: courtsData } = await supabase.from("courts").select("id, name");
    if (courtsData) setCourtsList(courtsData);
    const { data } = await supabase.from("open_play_sessions").select(`*, courts(name), open_play_players(id, status, phone, line_nickname)`).eq("status", "open").order("session_date", { ascending: true }).order("start_time", { ascending: true });
    if (data) setSessions(data);
    setLoading(false);
  };

  const getCourtNames = (session: any) => session.courts?.name || "場地 1";

  const handleBooking = async (e: React.FormEvent, session: any) => {
    e.preventDefault();
    if (!phone.trim() || !lineNickname.trim()) return alert("請填寫 LINE 暱稱與手機號碼！");
    setIsSubmitting(true);
    try {
      localStorage.setItem("picklego_user_profile", JSON.stringify({ phone: phone.trim(), lineNickname: lineNickname.trim(), displayName: lineNickname.trim() }));
      const { data, error } = await supabase.rpc("register_open_play", { p_session_id: session.id, p_name: lineNickname.trim(), p_phone: phone.trim(), p_player_notes: null });
      if (error) throw error;
      if (!data.success) { alert(data.message); fetchData(); return; }

      const updatedMap = { ...myJoinedMap, [session.id]: data.status };
      setMyJoinedMap(updatedMap);
      localStorage.setItem("picklego_joined_sessions", JSON.stringify(updatedMap));

      setCreatedPlayerId(data.booking_id);
      setBookingResult({ ...session, status: data.status });

      if (data.status === "registered") setTimeLeft(600);
      setSelectedPayment(""); setLast5(""); setSelectedSession(null); fetchData();
    } catch (error: any) { alert("報名失敗！錯誤原因：" + error.message); } finally { setIsSubmitting(false); }
  };

  const handleReportPayment = async () => {
    if (!selectedPayment) return alert("請先選擇付款方式！");
    if (selectedPayment === "bank" && !/^[0-9]{5}$/.test(last5.trim())) return alert("轉帳請填寫帳號末五碼！");

    setIsSubmitting(true);
    try {
      const finalLast5 = selectedPayment === "bank" ? last5.trim() : "TWQR";
      const { data, error } = await supabase.rpc("user_report_open_play_payment", {
        p_player_id: createdPlayerId, p_phone: phone.trim(), p_method: selectedPayment, p_line_nickname: lineNickname.trim(), p_last5: finalLast5, p_display_name: lineNickname.trim()
      });
      if (error) throw error;
      if (!data.success) {
        alert(data.message);
        if (data.message.includes("逾時") || data.message.includes("失效")) { setBookingResult(null); setTimeLeft(null); fetchData(); }
        return;
      }
      alert("✅ 付款回報已送出！名額已為您保留，待建立者核對款項。");
      setBookingResult(null); setTimeLeft(null); fetchData();
    } catch (error: any) { alert("回報失敗：" + error.message); } finally { setIsSubmitting(false); }
  };

  const handleShare = (e: React.MouseEvent, session: any) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?session=${session.id}`;
    const locStr = `${session.city || ''}${session.district || ''} ${session.address || ''} ${session.title}`.trim();
    const text = `🎾 PickleGo 臨打邀請\n【時間】${session.session_date} ${session.start_time?.slice(0, 5)}-${session.end_time?.slice(0, 5)}\n【地點】${locStr} (${getCourtNames(session)})\n【程度】${session.level || '不限'}\n【費用】$${session.price || 0} / 人\n👇 點擊網址快速報名：\n${url}`;
    navigator.clipboard.writeText(text);
    alert("✅ 報名資訊與網址已複製！");
  };

  const displaySessions = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedDate && s.session_date !== selectedDate) return false;
      if (filterRegion !== "全部") {
        const c = (s.city || s.title || "").toLowerCase();
        if (filterRegion === "北部" && !['台北', '新北', '基隆', '桃園', '新竹'].some(x => c.includes(x))) return false;
        if (filterRegion === "中部" && !['台中', '彰化', '苗栗', '南投', '雲林', '龍井'].some(x => c.includes(x))) return false;
        if (filterRegion === "南部" && !['台南', '高雄', '嘉義', '屏東'].some(x => c.includes(x))) return false;
      }
      if (filterTime !== "全部") {
        const startHour = parseInt(s.start_time?.split(":")[0] || "0", 10);
        if (filterTime === "早上 (00-12)" && (startHour >= 12)) return false;
        if (filterTime === "下午 (12-18)" && (startHour < 12 || startHour >= 18)) return false;
        if (filterTime === "晚上 (18-24)" && (startHour < 18)) return false;
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
          <button onClick={() => setShowFilterSheet(true)} className="flex items-center gap-1.5 bg-gray-50 text-gray-700 font-bold text-xs px-3 py-1.5 rounded-full border border-gray-200"><SlidersHorizontal size={14} /> 篩選</button>
        </div>
        <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 scrollbar-hide">
          {datesList.map((d) => (
            <button key={d.date} onClick={() => { setSelectedDate(d.date); setSelectedSession(null); }} className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedDate === d.date ? "bg-green-700 text-white shadow-2xs" : "bg-gray-100 text-gray-600"}`}>{d.display}</button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3" ref={listRef}>
        {loading ? (<p className="text-center py-12 text-sm text-gray-400">載入中...</p>) : displaySessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 mt-4"><p className="text-gray-500 font-bold mb-1">這天沒有符合的臨打 🏓</p><p className="text-gray-400 text-xs">試試看選擇其他日期，或是放寬篩選條件</p></div>
        ) : (
          displaySessions.map((session) => {
            const activePlayers = session.open_play_players?.filter((p: any) => p.status !== "cancelled") || [];
            const regCount = activePlayers.filter((p: any) => p.status === "registered").length;
            const waitCount = activePlayers.filter((p: any) => p.status === "waitlisted").length;
            const isRegFull = regCount >= session.max_players;
            const isCompletelyFull = isRegFull && waitCount >= (session.max_waitlist || 0);

            const myStatus = activePlayers.find((p: any) => p.phone === phone || p.line_nickname === lineNickname)?.status || myJoinedMap[session.id];

            let statusLabel = "我要報名"; let badgeStyle = "bg-green-100 text-green-800 hover:bg-green-200"; let canClick = true; let leftIconType = "open";
            if (myStatus === "registered") { statusLabel = "已報名"; badgeStyle = "bg-green-700 text-white"; canClick = false; leftIconType = "joined"; }
            else if (myStatus === "waitlisted") { statusLabel = "候補中"; badgeStyle = "bg-amber-100 text-amber-800"; canClick = false; leftIconType = "waitlist"; }
            else if (isCompletelyFull) { statusLabel = "已額滿"; badgeStyle = "bg-gray-200 text-gray-600"; canClick = false; leftIconType = "full"; }
            else if (isRegFull) { statusLabel = "候補報名"; badgeStyle = "bg-amber-100 text-amber-800 hover:bg-amber-200"; canClick = true; leftIconType = "waitlist"; }

            return (
              <div key={session.id} id={`session-${session.id}`} className={`bg-white rounded-2xl p-4 shadow-xs border transition-all ${selectedSession?.id === session.id ? 'border-green-600' : 'border-gray-100'}`}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="mt-1 shrink-0">
                      {leftIconType === "open" && (<div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>)}
                      {(leftIconType === "full" || leftIconType === "joined") && (<div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center"><CheckCircle2 size={15} strokeWidth={3} /></div>)}
                      {leftIconType === "waitlist" && (<div className="w-6 h-6 rounded-full bg-gray-500 text-white flex items-center justify-center"><Users size={13} /></div>)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-[15px] text-gray-900 leading-snug">{session.start_time?.slice(0, 5)}–{session.end_time?.slice(0, 5)}</p>
                      <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">{session.title}</p>
                      <p className="text-xs font-bold text-gray-500 mt-0.5">🎾 {session.level || '不限'}</p>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${session.city || ''}${session.district || ''}${session.address || ''}${session.title}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1 line-clamp-1"><MapPin size={12} /> {session.city || ''} {session.district || ''} {session.address || ''}</a>
                      <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-2">
                        <span className="font-bold text-gray-700">{regCount} / {session.max_players} 人</span>
                        <span>|</span><span>${session.price}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 items-end">
                    <button type="button" onClick={(e) => handleShare(e, session)} className="text-gray-400 hover:text-green-700 bg-gray-50 p-1.5 rounded-full border border-gray-200"><Share size={14} /></button>
                    <button disabled={!canClick} onClick={() => setSelectedSession(selectedSession?.id === session.id ? null : session)} className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition mt-2 ${badgeStyle}`}>{statusLabel}</button>
                  </div>
                </div>

                {selectedSession?.id === session.id && (
                  <div className="mt-4 pt-3 border-t border-gray-100 animate-in fade-in">
                    <form onSubmit={(e) => handleBooking(e, session)} className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" required placeholder="LINE 暱稱 (必填)" className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl px-3 py-2.5 text-xs" value={lineNickname} onChange={(e) => setLineNickname(e.target.value)} />
                        <input type="tel" required placeholder="手機號碼 (10碼)" pattern="[0-9]{10}" className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl px-3 py-2.5 text-xs" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => setSelectedSession(null)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs">取消</button>
                        <button type="submit" disabled={isSubmitting} className={`flex-[2] text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50 ${isRegFull ? 'bg-amber-600' : 'bg-green-700'}`}>{isSubmitting ? "處理中..." : (isRegFull ? "確認排入候補" : "確認報名")}</button>
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
          <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={() => setShowFilterSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-3xl z-50 p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center mb-5"><h2 className="text-lg font-extrabold text-gray-900">進階篩選</h2><button onClick={() => setShowFilterSheet(false)} className="p-1 text-gray-400 bg-gray-100 rounded-full"><X size={18} /></button></div>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">📍 地區</label>
                <div className="grid grid-cols-4 gap-2">
                  {["全部", "北部", "中部", "南部"].map(r => (<button key={r} onClick={() => setFilterRegion(r)} className={`py-2 rounded-xl text-xs font-bold border transition ${filterRegion === r ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200"}`}>{r}</button>))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">⏰ 時段</label>
                <div className="grid grid-cols-2 gap-2">
                  {["全部", "早上 (00-12)", "下午 (12-18)", "晚上 (18-24)"].map(t => (<button key={t} onClick={() => setFilterTime(t)} className={`py-2 rounded-xl text-xs font-bold border transition ${filterTime === t ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200"}`}>{t}</button>))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">🎾 程度</label>
                <div className="grid grid-cols-4 gap-2">
                  {["全部", "新手", "2.0", "2.5", "3.0", "3.5", "4.0+"].map(l => (<button key={l} onClick={() => setFilterLevel(l)} className={`py-2 rounded-xl text-xs font-bold border transition ${filterLevel === l ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-600 border-gray-200"}`}>{l}</button>))}
                </div>
              </div>
            </div>
            <button onClick={() => setShowFilterSheet(false)} className="w-full mt-8 bg-gray-900 text-white font-bold py-3.5 rounded-xl text-sm active:scale-95">顯示符合場次</button>
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
                <p className="text-sm text-gray-600 mb-4">若有正取球友取消，系統將自動依序遞補，屆時將更新您的狀態。</p>
                <button onClick={() => { setBookingResult(null); fetchData(); }} className="w-full bg-gray-100 text-gray-800 font-bold py-3 rounded-xl">我知道了</button>
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
                      <div className="text-red-600 font-bold text-xs"><AlertCircle size={20} className="mx-auto mb-1" />保留時間已逾時，名額釋出</div>
                    ) : (
                      <><p className="text-xs font-bold text-gray-700 flex items-center justify-center gap-1 mb-0.5"><Clock size={14} /> 請於限時內完成付款回報</p><p className="text-2xl font-black font-mono text-red-600">{timeLeft !== null ? formatTime(timeLeft) : "10:00"}</p></>
                    )}
                  </div>
                  {timeLeft !== 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setSelectedPayment("bank")} className={`py-2.5 rounded-xl font-bold text-xs border ${selectedPayment === "bank" ? "border-gray-800 bg-gray-100 text-gray-900" : "border-gray-200 text-gray-600"}`}>銀行轉帳</button>
                        <button onClick={() => setSelectedPayment("line")} className={`py-2.5 rounded-xl font-bold text-xs border ${selectedPayment === "line" ? "border-[#06C755] bg-[#06C755]/10 text-[#06C755]" : "border-gray-200 text-gray-600"}`}>TWQR / 付款碼</button>
                      </div>
                      {selectedPayment && (
                        <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl space-y-3">
                          {selectedPayment === "bank" ? (
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">轉出帳號末五碼（必填）</label><input type="text" inputMode="numeric" maxLength={5} className="w-full bg-white border border-gray-300 rounded-lg p-2.5 text-xs mb-2.5" value={last5} onChange={(e) => setLast5(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))} /></div>
                          ) : (
                            <p className="text-xs text-gray-600 font-bold text-center py-2">點擊下方按鈕，系統將自動記錄回報時間以利開團者對帳。</p>
                          )}
                          <button onClick={handleReportPayment} disabled={isSubmitting} className="w-full bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50">{isSubmitting ? "送出中..." : "我已完成付款"}</button>
                        </div>
                      )}
                    </>
                  )}
                  <button onClick={() => { setBookingResult(null); setTimeLeft(null); }} className="w-full text-gray-400 text-xs font-bold py-1.5">稍後至「我的臨打」處理</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}