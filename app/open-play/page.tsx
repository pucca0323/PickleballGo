"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, User, Copy, QrCode, MessageCircle } from "lucide-react";

export default function OpenPlayPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [courtsList, setCourtsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [playerNotes, setPlayerNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bookingResult, setBookingResult] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<'select' | 'online' | 'onsite'>('select');
  const [createdPlayerId, setCreatedPlayerId] = useState<number | null>(null);
  const [lineUrl, setLineUrl] = useState("https://lin.ee/your_line_id");

  const fetchData = async () => {
    const { data: settingData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "line_url")
      .maybeSingle();
    if (settingData?.value) {
      setLineUrl(settingData.value);
    }

    const { data: courtsData } = await supabase.from("courts").select("id, name");
    if (courtsData) setCourtsList(courtsData);

    const { data } = await supabase
      .from("open_play_sessions")
      .select(`
        *, 
        courts(name),
        open_play_players(id, status, player_notes, payment_method, payment_status, created_at, users(name))
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

      const sessionStartTime = startTime.slice(0, 5);
      if (sessionStartTime <= currentTimeStr) return true;
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

  const handleBooking = async (e: React.FormEvent, session: any) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return alert("請填寫完整資訊！");
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("register_open_play", {
        p_session_id: session.id,
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_player_notes: playerNotes.trim() || null,
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.message);
        fetchData();
        return;
      }

      const assignedStatus = data.status;
      setCreatedPlayerId(data.booking_id);

      setBookingResult({
        sessionTitle: session.title,
        sessionDate: session.session_date,
        sessionTime: `${session.start_time?.slice(0, 5)} - ${session.end_time?.slice(0, 5)}`,
        level: session.level,
        price: session.price,
        name: name.trim(),
        phone: phone.trim(),
        status: assignedStatus,
      });

      setPaymentMode('select');
      setSelectedSession(null);
      setName("");
      setPhone("");
      setPlayerNotes("");

      fetchData();
    } catch (error: any) {
      alert("報名失敗！錯誤原因：" + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePaymentMethod = async (method: 'online' | 'onsite') => {
    setPaymentMode(method);
    if (createdPlayerId) {
      await supabase
        .from("open_play_players")
        .update({ payment_method: method })
        .eq("id", createdPlayerId);
      fetchData();
    }
  };

  const handleCopyText = async () => {
    const text = `【匹克球館 - 繳費回報】
👤 報名人：${bookingResult.name} (${bookingResult.phone})
📅 場次：${bookingResult.sessionDate} | ${bookingResult.sessionTime}
🏷️ 項目：${bookingResult.sessionTitle} (DUPR ${bookingResult.level})
💰 應繳金額：$${bookingResult.price}
———————————
✅ 我已完成線上掃碼付款！
📱 支付方式：LINE Pay / TWQR
🆔 我的LINE暱稱：＿＿＿＿＿ (請填寫)`;

    try {
      await navigator.clipboard.writeText(text);
      alert("✅ 回報文案已複製！\n\n請點擊下方的「前往官方 LINE 回報」按鈕，貼上訊息並填寫您的暱稱。");
    } catch {
      alert("複製失敗，請手動選取複製。");
    }
  };

  const activeSessions = sessions.filter(session => !isSessionExpired(session.session_date, session.start_time));

  return (
    <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col pb-32 relative overflow-x-hidden">
      <header className="text-white h-16 flex items-center justify-center shadow-md relative z-10 w-full" style={{ backgroundColor: "#2563eb" }}>
        <Link href="/" className="absolute left-4 p-2 rounded-full transition z-20" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold px-12 truncate">臨打預約</h1>
      </header>

      <div className="p-5 space-y-4">
        {loading ? (
          <p className="text-center mt-10 font-bold animate-pulse text-gray-500">尋找臨打場次中...</p>
        ) : activeSessions.length === 0 ? (
          <p className="text-center mt-10 text-gray-500">目前沒有開放的臨打場次</p>
        ) : (
          activeSessions.map((session) => {
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
              <div key={session.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-start border-b pb-3 mb-3">
                  <div>
                    <span className="text-xs px-2 py-1 rounded-md font-bold mb-2 inline-block bg-blue-100 text-blue-800">
                      DUPR {session.level}
                    </span>
                    <h2 className="text-lg font-bold text-gray-800">{session.title}</h2>
                    <p className="text-sm mt-1 text-gray-500">
                      {session.session_date} | {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-blue-600">${session.price}</p>
                    <p className="text-xs mt-1 text-gray-500">{getCourtNames(session)}</p>
                  </div>
                </div>

                {session.notes && (
                  <div className="mb-4 bg-blue-50 text-blue-800 text-xs px-3 py-2 rounded-lg border border-blue-100">
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
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${player.status === 'registered' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                }`}
                            >
                              {player.status === 'registered' ? '正取' : '候補'}
                            </span>
                            <span className="font-semibold text-gray-700">{player.users?.name}</span>
                          </div>
                          {player.player_notes && (
                            <p className="text-xs text-gray-500 ml-10 mt-0.5 break-words">💬 {player.player_notes}</p>
                          )}
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

                {selectedSession?.id === session.id && (
                  <div className="mt-4 p-4 rounded-xl border-2 animate-in fade-in bg-blue-50 border-blue-400">
                    <h3 className="font-bold mb-3 text-sm text-blue-800">填寫臨打報名資料</h3>
                    <form onSubmit={(e) => handleBooking(e, session)} className="space-y-3">
                      <input
                        type="text"
                        required
                        placeholder="姓名 / 暱稱"
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <input
                        type="tel"
                        required
                        placeholder="手機號碼 (例如: 0912345678)"
                        pattern="[0-9]{10}"
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="個人備註 (例如：會晚半小時到)"
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={playerNotes}
                        onChange={(e) => setPlayerNotes(e.target.value)}
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedSession(null)}
                          className="flex-1 bg-white border border-gray-300 font-bold py-2.5 rounded-lg text-sm text-gray-600"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 text-white font-bold py-2.5 rounded-lg text-sm shadow-sm bg-blue-600 disabled:opacity-50"
                        >
                          {isSubmitting ? "送出中..." : "確認報名"}
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

      {bookingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-in fade-in overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 my-auto">
            <div className={`p-5 text-center ${bookingResult.status === 'registered' ? 'bg-blue-600' : 'bg-amber-500'}`}>
              <CheckCircle2 size={48} className="mx-auto text-white mb-2" />
              <h2 className="text-xl font-bold text-white">報名成功！</h2>
              <p className="text-white/90 text-sm mt-1">
                您已取得【{bookingResult.status === 'registered' ? '正取' : '候補'}】名額
              </p>
            </div>

            <div className="p-6">
              {bookingResult.status === 'waitlisted' ? (
                <div className="text-center space-y-4">
                  <p className="text-gray-600 font-medium">
                    目前為候補狀態，請勿先行付款。<br />
                    若有正取球友取消，系統將自動遞補您的名額！
                  </p>
                  <button
                    onClick={() => setBookingResult(null)}
                    className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl"
                  >
                    我知道了
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {paymentMode === 'select' && (
                    <>
                      <h3 className="font-bold text-center text-gray-800 mb-4">請選擇付款方式</h3>
                      <button
                        onClick={() => updatePaymentMethod('online')}
                        className="w-full flex items-center justify-center gap-2 bg-green-50 text-green-700 border-2 border-green-500 font-bold py-3.5 rounded-xl hover:bg-green-100 transition"
                      >
                        <QrCode size={20} /> 線上掃碼 (LINE Pay / TWQR)
                      </button>
                      <button
                        onClick={() => updatePaymentMethod('onsite')}
                        className="w-full flex items-center justify-center gap-2 bg-gray-50 text-gray-700 border-2 border-gray-300 font-bold py-3.5 rounded-xl hover:bg-gray-100 transition"
                      >
                        現場付款
                      </button>
                    </>
                  )}

                  {paymentMode === 'onsite' && (
                    <div className="text-center space-y-4 animate-in slide-in-from-right-4">
                      <p className="text-gray-600 font-medium">
                        您已選擇現場付款，<br />
                        請於開打前 10 分鐘至櫃檯完成現金付款！
                      </p>
                      <button
                        onClick={() => setBookingResult(null)}
                        className="w-full bg-gray-800 text-white font-bold py-3 rounded-xl"
                      >
                        完成
                      </button>
                    </div>
                  )}

                  {paymentMode === 'online' && (
                    <div className="space-y-3 animate-in slide-in-from-right-4">
                      <div className="bg-gray-100 rounded-xl aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 p-4 mb-2">
                        <QrCode size={48} className="text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 font-bold">請於此處放置館方的</p>
                        <p className="text-sm text-gray-500 font-bold">LINE Pay / TWQR 條碼圖</p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800 text-center mb-2">
                        付款金額：<span className="font-bold text-lg text-blue-600">${bookingResult.price}</span>
                      </div>

                      <button
                        onClick={handleCopyText}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition"
                      >
                        <Copy size={18} /> 一鍵複製回報訊息
                      </button>

                      <a
                        href={lineUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-[#06C755] text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition"
                      >
                        <MessageCircle size={18} /> 前往官方 LINE 回報
                      </a>

                      <button
                        onClick={() => setBookingResult(null)}
                        className="w-full text-gray-500 font-bold py-2 hover:text-gray-800 mt-2"
                      >
                        關閉視窗
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}