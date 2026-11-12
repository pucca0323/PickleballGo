"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase"; // 確認相對路徑，應該是 ../lib/supabase
import Link from "next/link";
import { CheckCircle2, Copy, Clock, AlertCircle, Search, CalendarDays, User as UserIcon } from "lucide-react";

export default function OpenPlayPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [courtsList, setCourtsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  // 表單欄位
  const [phone, setPhone] = useState("");
  const [lineNickname, setLineNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [playerNotes, setPlayerNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bookingResult, setBookingResult] = useState<any | null>(null);
  const [createdPlayerId, setCreatedPlayerId] = useState<number | null>(null);

  // 付款狀態
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [last5, setLast5] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [paymentSettings, setPaymentSettings] = useState({ line: "", jko: "", twqr: "", bank: "" });

  // 10 分鐘倒數計時器邏輯
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    if (!bookingResult) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [bookingResult]);

  const closeBookingResult = () => {
    setBookingResult(null);
    setTimeLeft(null);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };

  const fetchData = async () => {
    const { data: settingData } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["payment_line", "payment_jko", "payment_twqr", "payment_bank"]);

    if (settingData) {
      const settingsMap: Record<string, string> = {};
      settingData.forEach(item => { settingsMap[item.key] = item.value; });
      setPaymentSettings({
        line: settingsMap["payment_line"] || "",
        jko: settingsMap["payment_jko"] || "",
        twqr: settingsMap["payment_twqr"] || "",
        bank: settingsMap["payment_bank"] || ""
      });
    }

    const { data: courtsData } = await supabase.from("courts").select("id, name");
    if (courtsData) setCourtsList(courtsData);

    const { data } = await supabase
      .from("open_play_sessions")
      .select(`
        *, 
        courts(name),
        open_play_players(id, status, player_notes, payment_method, payment_status, created_at, display_name)
      `)
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
    const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];
    if (sessionDate < todayStr) return true;
    if (sessionDate === todayStr) {
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMins = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMins}`;
      if (startTime.slice(0, 5) <= currentTimeStr) return true;
    }
    return false;
  };

  const getCourtNames = (session: any) => {
    if (session.court_ids && session.court_ids.length > 0) {
      return session.court_ids.map((id: string) => courtsList.find((c) => c.id === id)?.name).filter(Boolean).join('、');
    }
    return session.courts?.name || '未定';
  };

  // 🌟 提交報名 (邏輯保留，不更動)
  const handleBooking = async (e: React.FormEvent, session: any) => {
    e.preventDefault();
    if (!phone.trim() || !lineNickname.trim()) return alert("請填寫 LINE 暱稱與手機號碼！");
    setIsSubmitting(true);
    const finalDisplayName = displayName.trim() || "球友";

    try {
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

      setCreatedPlayerId(data.booking_id);
      setBookingResult({
        sessionTitle: session.title,
        sessionDate: session.session_date,
        sessionTime: `${session.start_time?.slice(0, 5)} - ${session.end_time?.slice(0, 5)}`,
        level: session.level,
        price: session.price,
        status: data.status,
      });

      if (data.status === 'registered') setTimeLeft(600);

      setSelectedPayment('');
      setLast5('');
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

  // 🌟 送出付款回報 (邏輯保留，不更動)
  const handleReportPayment = async () => {
    if (!selectedPayment) return alert("請先選擇付款方式！");
    if (selectedPayment === 'bank' && !/^[0-9]{5}$/.test(last5.trim())) return alert("請填寫轉出帳號末五碼（5 位數字）！");
    if (selectedPayment === 'line' && !last5.trim()) return alert("請填寫 LINE Pay 付款識別碼 / 交易序號！");

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("user_report_open_play_payment", {
        p_player_id: createdPlayerId,
        p_phone: phone.trim(),
        p_method: selectedPayment,
        p_line_nickname: lineNickname.trim(),
        p_last5: (selectedPayment === 'bank' || selectedPayment === 'line') ? last5.trim() : 'NA',
        p_display_name: displayName.trim() || "球友"
      });

      if (error) throw error;
      if (!data.success) {
        alert(data.message);
        if (data.message.includes('逾時') || data.message.includes('失效')) {
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

  const activeSessions = sessions.filter(session => !isSessionExpired(session.session_date, session.start_time));

  return (
    <main className="w-full min-w-0 min-h-screen max-w-md mx-auto flex flex-col relative max-sm:overflow-x-clip" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* 🌟 Header 重構：乾淨白底＋深灰字，移除返回鍵（因為這是主頁面） */}
      <header className="shrink-0 w-full py-4 px-4 flex items-center justify-center sticky top-0 z-10" style={{ backgroundColor: 'var(--color-background)' }}>
        <h1 className="text-lg font-bold tracking-wide" style={{ color: 'var(--color-text)' }}>找球打</h1>
      </header>

      {/* 底部導覽留白 */}
      <div className="p-4 space-y-4 min-w-0 max-sm:w-full max-sm:overflow-x-clip pb-24">
        {loading ? (
          <p className="text-center mt-10 font-bold animate-pulse text-gray-500">尋找臨打場次中...</p>
        ) : activeSessions.length === 0 ? (
          <p className="text-center mt-10 text-gray-500">目前沒有即將開始的臨打</p>
        ) : (
          activeSessions.map((session) => {
            const regCount = session.open_play_players?.filter((p: any) => p.status === 'registered').length || 0;
            const waitCount = session.open_play_players?.filter((p: any) => p.status === 'waitlisted').length || 0;
            const isRegFull = regCount >= session.max_players;
            const isWaitFull = waitCount >= session.max_waitlist;
            const isCompletelyFull = isRegFull && isWaitFull;

            // 狀態判定邏輯
            let buttonText = "我要報名";
            if (isCompletelyFull) buttonText = "已額滿";
            else if (isRegFull) buttonText = "候補報名";

            const activePlayers = session.open_play_players
              ?.filter((p: any) => p.status !== 'cancelled')
              .sort((a: any, b: any) => {
                if (a.status === 'registered' && b.status !== 'registered') return -1;
                if (a.status !== 'registered' && b.status === 'registered') return 1;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              }) || [];

            return (
              <div key={session.id} className="p-5 rounded-[16px] shadow-sm max-sm:min-w-0 max-sm:max-w-full" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex justify-between items-start border-b pb-3 mb-3 border-[#E9ECEF] max-sm:min-w-0 max-sm:gap-2">
                  <div className="max-sm:min-w-0 max-sm:flex-1">
                    <span className="text-xs px-2 py-1 rounded-md font-bold mb-2 inline-block" style={{ backgroundColor: 'var(--color-neutral-soft)', color: 'var(--color-text-secondary)' }}>
                      DUPR {session.level}
                    </span>
                    <h2 className="text-lg font-bold max-sm:break-words" style={{ color: 'var(--color-text)' }}>{session.title}</h2>
                    <p className="text-sm mt-1 max-sm:break-words" style={{ color: 'var(--color-text-secondary)' }}>
                      {session.session_date} | {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                    </p>
                  </div>
                  <div className="text-right max-sm:min-w-0 max-sm:max-w-[42%] max-sm:shrink-0">
                    <p className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>${session.price}</p>
                    <p className="text-xs mt-1 max-sm:break-words" style={{ color: 'var(--color-text-secondary)' }}>{getCourtNames(session)}</p>
                  </div>
                </div>

                {session.notes && (
                  <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-neutral-soft)', color: 'var(--color-text-secondary)' }}>
                    <span className="font-bold">📝 備註：</span>{session.notes}
                  </div>
                )}

                <div className="flex gap-2 mb-4 text-sm">
                  <div className="flex-1 p-2 rounded-lg text-center" style={{ backgroundColor: 'var(--color-background)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>正取</p>
                    <p className="font-bold text-base" style={{ color: isRegFull ? 'var(--color-danger)' : 'var(--color-text)' }}>
                      {regCount} / {session.max_players}
                    </p>
                  </div>
                  <div className="flex-1 p-2 rounded-lg text-center" style={{ backgroundColor: 'var(--color-background)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>候補</p>
                    <p className="font-bold text-base" style={{ color: 'var(--color-text-secondary)' }}>
                      {waitCount} / {session.max_waitlist}
                    </p>
                  </div>
                </div>

                {selectedSession?.id !== session.id && (
                  <button
                    onClick={() => setSelectedSession(session)}
                    disabled={isCompletelyFull}
                    className="w-full font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                    style={{
                      backgroundColor: isCompletelyFull ? 'var(--color-neutral-soft)' : 'var(--color-primary)',
                      color: isCompletelyFull ? 'var(--color-text-secondary)' : 'var(--color-text)'
                    }}
                  >
                    {buttonText}
                  </button>
                )}

                {/* 🌟 報名表單區塊重構：白底淨空，聚焦輸入 */}
                {selectedSession?.id === session.id && (
                  <div className="mt-4 p-4 rounded-xl border animate-in fade-in" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-primary)' }}>
                    <h3 className="font-bold mb-3 text-sm" style={{ color: 'var(--color-text)' }}>填寫報名資料</h3>
                    <form onSubmit={(e) => handleBooking(e, session)} className="space-y-3">
                      <input
                        type="text"
                        required
                        placeholder="您的 LINE 暱稱 (必填，供核帳用)"
                        className="w-full bg-white text-gray-900 border rounded-lg p-3 text-sm focus:outline-none focus:border-[#F3C84B] focus:ring-1 focus:ring-[#F3C84B]"
                        style={{ borderColor: 'var(--color-border)' }}
                        value={lineNickname}
                        onChange={(e) => setLineNickname(e.target.value)}
                      />
                      <input
                        type="tel"
                        required
                        placeholder="手機號碼 (必填)"
                        pattern="[0-9]{10}"
                        className="w-full bg-white text-gray-900 border rounded-lg p-3 text-sm focus:outline-none focus:border-[#F3C84B] focus:ring-1 focus:ring-[#F3C84B]"
                        style={{ borderColor: 'var(--color-border)' }}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="顯示名稱 (選填，未填顯示為球友)"
                        className="w-full bg-white text-gray-900 border rounded-lg p-3 text-sm focus:outline-none focus:border-[#F3C84B] focus:ring-1 focus:ring-[#F3C84B]"
                        style={{ borderColor: 'var(--color-border)' }}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSession(null)}
                          className="flex-1 bg-white border font-bold py-3 rounded-xl text-sm"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-[2] font-bold py-3 rounded-xl text-sm disabled:opacity-50"
                          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)' }}
                        >
                          {isSubmitting ? "處理中..." : "保留名額，前往付款"}
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

      {/* 🌟 付款/成功提示 Modal */}
      {bookingResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 animate-in fade-in overflow-y-auto pt-10 pb-10 max-sm:items-start max-sm:py-4 max-sm:overscroll-contain">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 my-auto max-sm:max-h-[calc(100dvh-2rem)] max-sm:overflow-y-auto">
            <div className={`p-6 text-center`} style={{ backgroundColor: bookingResult.status === 'registered' ? 'var(--color-success)' : '#F59E0B' }}>
              <CheckCircle2 size={48} className="mx-auto text-white mb-2" />
              <h2 className="text-xl font-bold text-white">報名成功！</h2>
              <p className="text-white/90 text-sm mt-1">您已取得【{bookingResult.status === 'registered' ? '正取' : '候補'}】名額</p>
            </div>

            <div className="p-5">
              {bookingResult.status === 'waitlisted' ? (
                <div className="text-center space-y-4">
                  <p className="text-gray-600 font-medium">目前為候補狀態，請勿先行付款。<br />若有空缺，建立者將與您聯繫！</p>
                  <button onClick={closeBookingResult} className="w-full font-bold py-3 rounded-xl bg-gray-100 text-gray-800">我知道了</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl text-center border" style={{ backgroundColor: 'var(--color-warning-soft)', borderColor: '#FDE68A' }}>
                    {timeLeft === 0 ? (
                      <div className="text-red-600 font-bold flex flex-col items-center gap-1">
                        <AlertCircle size={24} />
                        <p>保留時間已逾時！名額已被系統自動釋出。</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-bold flex items-center justify-center gap-1 mb-1" style={{ color: 'var(--color-text)' }}>
                          <Clock size={16} /> 請於限時內完成付款回報
                        </p>
                        <p className="text-3xl font-black font-mono tracking-wider" style={{ color: 'var(--color-danger)' }}>
                          {timeLeft !== null ? formatTime(timeLeft) : '10:00'}
                        </p>
                      </>
                    )}
                  </div>

                  {timeLeft !== 0 && (
                    <>
                      <h3 className="font-bold text-sm" style={{ color: 'var(--color-text)' }}>選擇付款方式</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {paymentSettings.line && (
                          <button onClick={() => handleSelectPayment('line')} className={`py-3 rounded-xl font-bold text-sm border transition ${selectedPayment === 'line' ? 'border-[#06C755] bg-[#06C755]/10 text-[#06C755]' : 'border-gray-200 text-gray-600'}`}>LINE Pay</button>
                        )}
                        {paymentSettings.bank && (
                          <button onClick={() => handleSelectPayment('bank')} className={`py-3 rounded-xl font-bold text-sm border transition ${selectedPayment === 'bank' ? 'border-gray-800 bg-gray-100 text-gray-900' : 'border-gray-200 text-gray-600'}`}>銀行轉帳</button>
                        )}
                      </div>

                      {selectedPayment && (
                        <div className="animate-in fade-in bg-white border border-gray-200 p-4 rounded-xl mt-4 space-y-4">
                          <div>
                            {selectedPayment === 'line' && <a href={paymentSettings.line} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center bg-[#06C755] text-white font-bold py-3 rounded-lg">開啟 LINE Pay</a>}
                            {selectedPayment === 'bank' && (
                              <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                                <p className="text-sm font-medium tracking-widest">{paymentSettings.bank}</p>
                                <button onClick={handleCopyBankAccount} className="text-gray-500 p-1"><Copy size={18} /></button>
                              </div>
                            )}
                          </div>
                          <div className="border-t border-gray-100 pt-3">
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                              {selectedPayment === 'bank' ? '帳號末五碼（必填）' : '付款識別碼 / 交易序號（必填）'}
                            </label>
                            <input
                              type="text"
                              inputMode={selectedPayment === 'bank' ? 'numeric' : 'text'}
                              maxLength={selectedPayment === 'bank' ? 5 : undefined}
                              className="w-full bg-white border border-gray-300 rounded-lg p-3 text-sm mb-3 focus:outline-none focus:border-[#F3C84B]"
                              value={last5}
                              onChange={(e) => setLast5(selectedPayment === 'bank' ? e.target.value.replace(/[^0-9]/g, '').slice(0, 5) : e.target.value)}
                            />
                            <button
                              onClick={handleReportPayment}
                              disabled={isSubmitting}
                              className="w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)' }}
                            >
                              {isSubmitting ? '處理中...' : <><CheckCircle2 size={18} /> 我已完成付款</>}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <button onClick={closeBookingResult} className="w-full text-gray-400 text-sm font-bold py-2">關閉視窗 (可至「我的臨打」繼續完成)</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Phase 1: MVP 底部導覽列 (Bottom Navigation) */}
      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t flex justify-around items-center pb-safe pt-2 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]" style={{ borderColor: 'var(--color-border)', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
        <Link href="/" className="flex flex-col items-center gap-1 py-1" style={{ color: 'var(--color-primary)' }}>
          <Search size={24} strokeWidth={2.5} />
          <span className="text-[10px] font-bold" style={{ color: 'var(--color-text)' }}>找球打</span>
        </Link>
        <Link href="/my-sessions" className="flex flex-col items-center gap-1 py-1 transition-opacity hover:opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
          <CalendarDays size={24} strokeWidth={2} />
          <span className="text-[10px] font-medium">我的臨打</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1 py-1 transition-opacity hover:opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
          <UserIcon size={24} strokeWidth={2} />
          <span className="text-[10px] font-medium">我的</span>
        </Link>
      </nav>
    </main>
  );
}