"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, User, Copy, CreditCard, Banknote, Clock, AlertCircle } from "lucide-react";

export default function OpenPlayPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [courtsList, setCourtsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  // 🌟 表單欄位更新
  const [phone, setPhone] = useState("");
  const [lineNickname, setLineNickname] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [playerNotes, setPlayerNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bookingResult, setBookingResult] = useState<any | null>(null);
  const [createdPlayerId, setCreatedPlayerId] = useState<number | null>(null);

  // 🌟 付款相關狀態
  const [selectedPayment, setSelectedPayment] = useState<string>(''); // 'line', 'jko', 'twqr', 'bank'
  const [last5, setLast5] = useState(""); // 銀行帳號末五碼或 LINE Pay 付款識別碼 / 交易序號
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const [paymentSettings, setPaymentSettings] = useState({
    line: "",
    jko: "",
    twqr: "",
    bank: ""
  });

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
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
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
      return session.court_ids
        .map((id: string) => courtsList.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join('、');
    }
    return session.courts?.name || '未定';
  };

  // 🌟 提交報名
  const handleBooking = async (e: React.FormEvent, session: any) => {
    e.preventDefault();
    if (!phone.trim() || !lineNickname.trim()) return alert("請填寫 LINE 暱稱與手機號碼！");
    setIsSubmitting(true);

    const finalDisplayName = displayName.trim() || "球友";

    try {
      const { data, error } = await supabase.rpc("register_open_play", {
        p_session_id: session.id,
        p_name: finalDisplayName, // 儲存顯示名稱
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

      // 若為正取，啟動 10 分鐘 (600秒) 倒數計時
      if (data.status === 'registered') {
        setTimeLeft(600);
      }

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

  // 切換付款方式時清空識別資料，避免將上一種付款方式的內容送出
  const handleSelectPayment = (method: string) => {
    if (method !== selectedPayment) setLast5("");
    setSelectedPayment(method);
  };

  // 🌟 送出付款回報
  const handleReportPayment = async () => {
    if (!selectedPayment) return alert("請先選擇付款方式！");
    if (selectedPayment === 'bank' && !/^[0-9]{5}$/.test(last5.trim())) {
      return alert("請填寫轉出帳號末五碼（5 位數字）！");
    }
    if (selectedPayment === 'line' && !last5.trim()) {
      return alert("請填寫 LINE Pay 付款識別碼 / 交易序號！");
    }

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

      alert("✅ 付款回報已送出！名額已為您保留，待館主核對款項。");
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
    <main className="w-full min-w-0 min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col pb-10 relative max-sm:overflow-x-clip">
      <header className="shrink-0 w-full text-white py-4 px-4 flex items-center justify-center shadow-md relative z-10" style={{ backgroundColor: "#2563eb" }}>
        <Link href="/" className="absolute left-4 p-2 rounded-full transition bg-white/15 hover:bg-white/25 active:scale-95">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-lg font-bold tracking-wide">臨打預約</h1>
      </header>

      <div className="p-5 space-y-4 min-w-0 max-sm:w-full max-sm:overflow-x-clip">
        {loading ? (
          <p className="text-center mt-10 font-bold animate-pulse text-gray-500">尋找臨打場次中...</p>
        ) : activeSessions.length === 0 ? (
          <p className="text-center mt-10 text-gray-500">目前沒有開放的臨打場次</p>
        ) : (
          activeSessions.map((session) => {
            // 注意：因為現在狀態多了 pending, reported, confirmed，這裡的正取人數要把這三個狀態都算進去
            const regCount = session.open_play_players?.filter((p: any) => p.status === 'registered').length || 0;
            const waitCount = session.open_play_players?.filter((p: any) => p.status === 'waitlisted').length || 0;
            const isFull = regCount >= session.max_players && waitCount >= session.max_waitlist;

            const activePlayers = session.open_play_players
              ?.filter((p: any) => p.status !== 'cancelled')
              .sort((a: any, b: any) => {
                if (a.status === 'registered' && b.status !== 'registered') return -1;
                if (a.status !== 'registered' && b.status === 'registered') return 1;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              }) || [];

            return (
              <div key={session.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 max-sm:min-w-0 max-sm:max-w-full">
                <div className="flex justify-between items-start border-b pb-3 mb-3 max-sm:min-w-0 max-sm:gap-2">
                  <div className="max-sm:min-w-0 max-sm:flex-1">
                    <span className="text-xs px-2 py-1 rounded-md font-bold mb-2 inline-block bg-blue-100 text-blue-800">
                      DUPR {session.level}
                    </span>
                    <h2 className="text-lg font-bold text-gray-800 max-sm:break-words">{session.title}</h2>
                    <p className="text-sm mt-1 text-gray-500 max-sm:break-words">
                      {session.session_date} | {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                    </p>
                  </div>
                  <div className="text-right max-sm:min-w-0 max-sm:max-w-[42%] max-sm:shrink-0">
                    <p className="font-bold text-lg text-blue-600">${session.price}</p>
                    <p className="text-xs mt-1 text-gray-500 max-sm:break-words">{getCourtNames(session)}</p>
                  </div>
                </div>

                {session.notes && (
                  <div className="mb-4 bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded-lg border border-blue-100 max-sm:break-words">
                    <span className="font-bold">📝 館方備註：</span>{session.notes}
                  </div>
                )}

                <div className="flex gap-4 mb-4 text-sm">
                  <div className="flex-1 bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                    <p className="text-xs text-gray-500">正取</p>
                    <p className={`font-bold ${regCount >= session.max_players ? 'text-red-600' : 'text-blue-600'}`}>
                      {regCount} / {session.max_players}
                    </p>
                  </div>
                  <div className="flex-1 bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                    <p className="text-xs text-gray-500">候補</p>
                    <p className="font-bold text-gray-600">
                      {waitCount} / {session.max_waitlist}
                    </p>
                  </div>
                </div>

                {activePlayers.length > 0 && (
                  <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                      <User size={12} /> 已報名球友
                    </h4>
                    <div className="space-y-2">
                      {activePlayers.map((player: any) => (
                        <div key={player.id} className="flex flex-col text-sm">
                          <div className="flex items-center gap-2 max-sm:min-w-0">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${player.status === 'registered' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                }`}
                            >
                              {player.status === 'registered' ? '正取' : '候補'}
                            </span>
                            {/* 🌟 修正隱私：只顯示選填的顯示名稱，若無則顯示球友 */}
                            <span className="font-semibold text-gray-700 max-sm:min-w-0 max-sm:break-words">
                              {player.display_name || '球友'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSession?.id !== session.id && (
                  <button
                    onClick={() => setSelectedSession(session)}
                    disabled={isFull}
                    className="w-full text-white font-bold py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                    style={{ backgroundColor: isFull ? "#9ca3af" : "#2563eb" }}
                  >
                    {isFull ? "額滿，下次請早" : "我要報名"}
                  </button>
                )}

                {/* 🌟 重新設計的報名表單 */}
                {selectedSession?.id === session.id && (
                  <div className="mt-4 p-4 rounded-xl border-2 animate-in fade-in bg-blue-50 border-blue-400 max-sm:min-w-0">
                    <h3 className="font-bold mb-3 text-sm text-blue-800">填寫臨打報名資料</h3>
                    <form onSubmit={(e) => handleBooking(e, session)} className="space-y-3">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="您的 LINE 暱稱 (必填，供館方核帳用)"
                          className="w-full min-w-0 bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm max-sm:text-base focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={lineNickname}
                          onChange={(e) => setLineNickname(e.target.value)}
                        />
                      </div>
                      <div>
                        <input
                          type="tel"
                          required
                          placeholder="手機號碼 (必填)"
                          pattern="[0-9]{10}"
                          className="w-full min-w-0 bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm max-sm:text-base focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="報名顯示名稱 (選填，未填預設為球友)"
                          className="w-full min-w-0 bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm max-sm:text-base focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="個人備註 (選填，例如：晚半小時到)"
                          className="w-full min-w-0 bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm max-sm:text-base focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={playerNotes}
                          onChange={(e) => setPlayerNotes(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 pt-1 max-sm:min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedSession(null)}
                          className="flex-1 min-w-0 bg-white border border-gray-300 font-bold py-2.5 rounded-lg text-sm text-gray-600"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 min-w-0 text-white font-bold py-2.5 rounded-lg text-sm shadow-sm bg-blue-600 disabled:opacity-50"
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

      {/* 🌟 重新設計的成功與付款回報視窗 */}
      {bookingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-in fade-in overflow-y-auto pt-10 pb-10 max-sm:items-start max-sm:py-4 max-sm:overscroll-contain">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 my-auto max-sm:min-w-0 max-sm:max-w-full max-sm:my-0 max-sm:max-h-[calc(100dvh-2rem)] max-sm:overflow-y-auto">
            <div className={`p-5 text-center ${bookingResult.status === 'registered' ? 'bg-blue-600' : 'bg-amber-500'}`}>
              <CheckCircle2 size={48} className="mx-auto text-white mb-2" />
              <h2 className="text-xl font-bold text-white">報名成功！</h2>
              <p className="text-white/90 text-sm mt-1 max-sm:break-words">
                您已取得【{bookingResult.status === 'registered' ? '正取' : '候補'}】名額
              </p>
            </div>

            <div className="p-5 max-sm:p-4 max-sm:min-w-0">
              {bookingResult.status === 'waitlisted' ? (
                <div className="text-center space-y-4">
                  <p className="text-gray-600 font-medium">
                    目前為候補狀態，請勿先行付款。<br />
                    若有空缺，館方將與您聯繫確認後再行繳費！
                  </p>
                  <button
                    onClick={closeBookingResult}
                    className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl"
                  >
                    我知道了
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 🌟 10 分鐘倒數計時器 */}
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center shadow-sm">
                    {timeLeft === 0 ? (
                      <div className="text-red-600 font-bold flex flex-col items-center gap-1">
                        <AlertCircle size={24} />
                        <p>保留時間已逾時！</p>
                        <p className="text-xs mt-1">名額已被系統自動釋出。<br />若您已匯款，請直接聯繫官方 LINE。</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-gray-700 flex items-center justify-center gap-1 mb-1">
                          <Clock size={16} className="text-blue-600" /> 請於限時內完成付款回報
                        </p>
                        <p className="text-3xl font-black text-red-600 font-mono tracking-wider">
                          {timeLeft !== null ? formatTime(timeLeft) : '10:00'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">逾時未回報，系統將自動釋出名額</p>
                      </>
                    )}
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-500">應付金額</span>
                      <span className="font-bold text-blue-600">${bookingResult.price}</span>
                    </div>
                  </div>

                  {timeLeft !== 0 && (
                    <>
                      <h3 className="font-bold text-gray-800 text-sm">1. 請選擇付款方式</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {paymentSettings.line && (
                          <button onClick={() => handleSelectPayment('line')} className={`py-3 rounded-xl font-bold text-sm border-2 transition ${selectedPayment === 'line' ? 'border-[#06C755] bg-[#06C755]/10 text-[#06C755]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            LINE Pay
                          </button>
                        )}
                        {paymentSettings.jko && (
                          <button onClick={() => handleSelectPayment('jko')} className={`py-3 rounded-xl font-bold text-sm border-2 transition ${selectedPayment === 'jko' ? 'border-[#E60012] bg-[#E60012]/10 text-[#E60012]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            街口支付
                          </button>
                        )}
                        {paymentSettings.twqr && (
                          <button onClick={() => handleSelectPayment('twqr')} className={`py-3 rounded-xl font-bold text-sm border-2 transition ${selectedPayment === 'twqr' ? 'border-[#005598] bg-[#005598]/10 text-[#005598]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            台灣 Pay
                          </button>
                        )}
                        {paymentSettings.bank && (
                          <button onClick={() => handleSelectPayment('bank')} className={`py-3 rounded-xl font-bold text-sm border-2 transition ${selectedPayment === 'bank' ? 'border-gray-800 bg-gray-100 text-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            銀行轉帳
                          </button>
                        )}
                      </div>

                      {selectedPayment && (
                        <div className="animate-in fade-in slide-in-from-top-2 bg-white border border-gray-200 shadow-sm p-4 rounded-xl mt-4 space-y-4">
                          <div>
                            <h3 className="font-bold text-gray-800 text-sm mb-2">2. 前往付款</h3>
                            {selectedPayment === 'line' && <a href={paymentSettings.line} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center bg-[#06C755] text-white font-bold py-3 rounded-lg shadow-sm">開啟 LINE Pay</a>}
                            {selectedPayment === 'jko' && <a href={paymentSettings.jko} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center bg-[#E60012] text-white font-bold py-3 rounded-lg shadow-sm">開啟 街口支付</a>}
                            {selectedPayment === 'twqr' && <a href={paymentSettings.twqr} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center bg-[#005598] text-white font-bold py-3 rounded-lg shadow-sm">開啟 台灣 Pay</a>}

                            {selectedPayment === 'bank' && (
                              <div className="bg-gray-100 p-3 rounded-lg">
                                <p className="text-xs text-gray-500 font-bold mb-1">銀行轉帳帳號</p>
                                <div className="flex justify-between items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900 bg-white px-2 py-1.5 rounded border border-gray-300 flex-1">{paymentSettings.bank}</p>
                                  <button onClick={handleCopyBankAccount} className="bg-gray-200 text-gray-700 p-1.5 rounded" title="複製帳號"><Copy size={16} /></button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="border-t border-gray-100 pt-3">
                            <h3 className="font-bold text-gray-800 text-sm mb-2 flex justify-between">
                              3. 確認回報
                              <span className="text-[10px] text-red-500 font-normal">付款後務必點擊此按鈕</span>
                            </h3>
                            {(selectedPayment === 'bank' || selectedPayment === 'line') && (
                              <div className="mb-3">
                                <label htmlFor="payment-reference" className="block text-sm font-bold text-gray-700 mb-2">
                                  {selectedPayment === 'bank' ? '帳號末五碼（必填）' : '付款識別碼 / 交易序號（必填）'}
                                </label>
                                <input
                                  id="payment-reference"
                                  type="text"
                                  inputMode={selectedPayment === 'bank' ? 'numeric' : 'text'}
                                  placeholder={selectedPayment === 'bank' ? '請輸入轉出帳號末五碼' : '請輸入付款識別碼 / 交易序號'}
                                  maxLength={selectedPayment === 'bank' ? 5 : undefined}
                                  className="w-full min-w-0 bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm max-sm:text-base focus:ring-1 focus:ring-blue-500"
                                  value={last5}
                                  onChange={(e) => setLast5(selectedPayment === 'bank' ? e.target.value.replace(/[^0-9]/g, '').slice(0, 5) : e.target.value)}
                                />
                              </div>
                            )}
                            <button
                              onClick={handleReportPayment}
                              disabled={isSubmitting}
                              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isSubmitting ? '處理中...' : <><CheckCircle2 size={18} /> 我已完成付款</>}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={closeBookingResult}
                    className="w-full text-gray-400 text-sm font-bold py-2 hover:text-gray-600 mt-2"
                  >
                    關閉視窗 (可至「查詢我的預約」繼續完成)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}