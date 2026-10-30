"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import {
  ArrowLeft, Search, Calendar, Users, GraduationCap, XCircle, Edit2, Check,
  Copy, MessageCircle, Lock, CreditCard, Banknote, Clock, AlertCircle, CheckCircle2
} from "lucide-react";

const getRel = (obj: any) => (Array.isArray(obj) ? obj[0] : obj);

export default function MyBookingsPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [user, setUser] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState<'courts' | 'open_plays' | 'classes'>('courts');

  const [courtBookings, setCourtBookings] = useState<any[]>([]);
  const [openPlayBookings, setOpenPlayBookings] = useState<any[]>([]);
  const [classBookings, setClassBookings] = useState<any[]>([]);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  type PaymentInfo = {
    kind: 'court' | 'play' | 'class';
    title: string;
    date: string;
    start: string;
    end: string;
    amount: number | null;
    reference: string;
    detail?: string;
    rawBooking?: any; // 傳遞原始資料供臨打讀取到期時間等欄位
  };
  const [activePaymentModal, setActivePaymentModal] = useState<PaymentInfo | null>(null);

  // 🌟 臨打付款專用 State
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [last5, setLast5] = useState("");
  const [lineNickname, setLineNickname] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const [cancelLimitHours, setCancelLimitHours] = useState<number>(3);
  const [lineUrl, setLineUrl] = useState("https://lin.ee/your_line_id");

  const [paymentSettings, setPaymentSettings] = useState({
    line: "",
    jko: "",
    twqr: "",
    bank: ""
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .in("key", ["cancel_limit_hours", "line_url", "payment_line", "payment_jko", "payment_twqr", "payment_bank"]);

      if (data) {
        const config: Record<string, string> = {};
        data.forEach((item) => {
          config[item.key] = item.value;
        });

        if (config["cancel_limit_hours"] !== undefined) {
          setCancelLimitHours(Number(config["cancel_limit_hours"]));
        }
        if (config["line_url"]) setLineUrl(config["line_url"]);

        setPaymentSettings({
          line: config["payment_line"] || "",
          jko: config["payment_jko"] || "",
          twqr: config["payment_twqr"] || "",
          bank: config["payment_bank"] || ""
        });
      }
    };
    fetchSettings();
  }, []);

  // 🌟 臨打倒數計時器
  useEffect(() => {
    if (activePaymentModal?.kind === 'play' && activePaymentModal.rawBooking?.payment_deadline) {
      const calculateTimeLeft = () => {
        const deadline = new Date(activePaymentModal.rawBooking.payment_deadline).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((deadline - now) / 1000);
        return diff > 0 ? diff : 0;
      };
      setTimeLeft(calculateTimeLeft());
      const timer = setInterval(() => {
        setTimeLeft(calculateTimeLeft());
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activePaymentModal]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isCancellable = (dateStr: string, timeStr: string) => {
    if (cancelLimitHours === 0) return true;
    if (!dateStr || !timeStr) return false;

    const sessionDateTime = new Date(`${dateStr}T${timeStr}`);
    const now = new Date();
    const diffHours = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    return diffHours >= cancelLimitHours;
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phone.trim();
    if (!cleanPhone) return alert("請輸入手機號碼");

    setLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.rpc("get_my_bookings_by_phone", {
        p_phone: cleanPhone,
      });

      if (error) throw error;

      if (!data || !data.success) {
        setUser(null);
        setCourtBookings([]);
        setOpenPlayBookings([]);
        setClassBookings([]);
        setLoading(false);
        return;
      }

      setUser(data.user);

      const courtData = data.court_bookings || [];
      const groupedCourts = [];
      let currentGroup: any = null;

      for (const b of courtData) {
        if (!currentGroup) {
          currentGroup = { ...b, ids: [b.id], groupedPrices: [b.price] };
        } else {
          const isContiguous =
            currentGroup.booking_date === b.booking_date &&
            currentGroup.court_id === b.court_id &&
            currentGroup.status === b.status &&
            currentGroup.payment_method === b.payment_method &&
            currentGroup.end_time === b.start_time;

          if (isContiguous) {
            currentGroup.end_time = b.end_time;
            currentGroup.ids.push(b.id);
            currentGroup.groupedPrices.push(b.price);
          } else {
            groupedCourts.push(currentGroup);
            currentGroup = { ...b, ids: [b.id], groupedPrices: [b.price] };
          }
        }
      }
      if (currentGroup) groupedCourts.push(currentGroup);
      setCourtBookings(groupedCourts);

      setOpenPlayBookings(data.open_play_bookings || []);
      setClassBookings(data.class_bookings || []);
    } catch (err: any) {
      alert("查詢失敗：" + (err.message || "系統錯誤"));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (tableName: string, targetId: string | string[], dateStr: string, timeStr: string, isPlay: boolean = false) => {
    if (cancelLimitHours > 0) {
      if (!dateStr || !timeStr) return alert("無法取得場次時間，請聯繫客服！");
      const sessionDateTime = new Date(`${dateStr}T${timeStr}`);
      const now = new Date();
      const diffHours = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (diffHours < cancelLimitHours) {
        return alert(`⚠️ 為了保障其他球友權益，開打前 ${cancelLimitHours} 小時內無法自行取消預約！\n若有緊急狀況請直接聯繫館方。`);
      }
    }

    const confirmMsg = isPlay
      ? "確定要取消這筆報名嗎？\n取消成立後將釋出名額，退款將由館主另行核對。"
      : "確定要取消這筆預約嗎？\n(注意：取消後無法復原，需重新報名)";

    if (!confirm(confirmMsg)) return;

    const ids = Array.isArray(targetId) ? targetId : [targetId];

    try {
      const { data, error } = await supabase.rpc("user_cancel_booking", {
        p_phone: phone.trim(),
        p_table: tableName,
        p_target_ids: ids,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      alert("✅ " + data.message);
      handleSearch();
    } catch (err: any) {
      alert("❌ 取消失敗：" + (err.message || "系統錯誤"));
    }
  };

  const handleSaveNote = async (id: string) => {
    try {
      const { data, error } = await supabase.rpc("user_update_player_note", {
        p_phone: phone.trim(),
        p_player_id: id,
        p_notes: editNoteText.trim(),
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      setEditingNoteId(null);
      handleSearch();
    } catch (err: any) {
      alert("❌ 備註更新失敗：" + (err.message || "系統錯誤"));
    }
  };

  // 🌟 送出付款回報 (臨打專用)
  const handleReportOpenPlayPayment = async () => {
    if (!selectedPayment) return alert("請先選擇付款方式！");
    if (selectedPayment === 'bank' && !last5.trim()) return alert("請填寫轉出帳號末五碼！");
    if (!lineNickname.trim()) return alert("請填寫 LINE 暱稱供館方核帳使用！");

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("user_report_open_play_payment", {
        p_player_id: activePaymentModal!.rawBooking.id,
        p_phone: phone.trim(),
        p_method: selectedPayment,
        p_line_nickname: lineNickname.trim(),
        p_last5: selectedPayment === 'bank' ? last5.trim() : 'NA',
        p_display_name: activePaymentModal!.rawBooking.display_name || "球友"
      });

      if (error) throw error;

      if (!data.success) {
        alert(data.message);
        if (data.message.includes('逾時') || data.message.includes('失效')) {
          setActivePaymentModal(null);
          handleSearch();
        }
        return;
      }

      alert("✅ 付款回報已送出！名額已為您保留，待館主核對款項。");
      setActivePaymentModal(null);
      handleSearch();
    } catch (error: any) {
      alert("回報失敗：" + (error.message || "系統錯誤"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatMoney = (amount: number | null) =>
    amount === null ? '金額請洽館方' : `$${amount.toLocaleString('zh-TW')}`;

  const readAmount = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const getCourtPayment = (b: any): PaymentInfo => {
    const court = getRel(b.courts);
    const prices = Array.isArray(b.groupedPrices) ? b.groupedPrices.map(readAmount) : [readAmount(b.price)];
    const total = prices.every((price: number | null) => price !== null)
      ? prices.reduce((sum: number, price: number | null) => sum + (price ?? 0), 0)
      : null;
    return {
      kind: 'court', title: court?.name || '場地預約',
      date: b.booking_date, start: b.start_time?.slice(0, 5) || '',
      end: b.end_time?.slice(0, 5) || '', amount: total,
      reference: String(b.ids?.[0] || b.id || ''),
      detail: `共 ${b.ids.length * 0.5} 小時`,
    };
  };

  const getPlayPayment = (b: any): PaymentInfo => {
    const session = getRel(b.open_play_sessions);
    return {
      kind: 'play', title: session?.title || '臨打報名',
      date: session?.session_date || '',
      start: session?.start_time?.slice(0, 5) || '',
      end: session?.end_time?.slice(0, 5) || '',
      amount: readAmount(session?.price), reference: String(b.booking_no || b.id || ''),
      detail: session?.level ? `DUPR ${session.level}` : undefined,
      rawBooking: b // 傳遞原始資料
    };
  };

  const getClassPayment = (b: any): PaymentInfo => {
    const cls = getRel(b.classes);
    return {
      kind: 'class', title: cls?.title || '體驗課程',
      date: cls?.class_date || '',
      start: cls?.start_time?.slice(0, 5) || '',
      end: cls?.end_time?.slice(0, 5) || '',
      amount: readAmount(b.price ?? cls?.price), reference: String(b.id || ''),
      detail: cls?.coach ? `教練：${cls.coach}` : undefined,
    };
  };

  const handleCopyText = async (item: PaymentInfo) => {
    const category = item.kind === 'court' ? '場地預約' : item.kind === 'class' ? '體驗課程' : '報名';
    const text = `【PickleGo－${category}繳費回報】
👤 預約人：${user?.name || ''}（${user?.phone || phone.trim()}）
📅 日期時間：${item.date} ${item.start}–${item.end}
🏷️ 項目：${item.title}${item.detail ? `（${item.detail}）` : ''}
💰 應繳金額：${formatMoney(item.amount)}
——————————
✅ 我已完成線上付款
📱 支付方式：＿＿＿＿（例如：LINE Pay）
🆔 帳號後五碼/暱稱：＿＿＿＿（請填寫）`;
    try {
      await navigator.clipboard.writeText(text);
      alert('✅ 報名資訊已複製！請貼上至官方 LINE 並填寫您的匯款資訊。');
    } catch {
      alert('複製失敗，請手動選取複製。');
    }
  };

  // 🌟 複製臨打取消/退款通知
  const handleCopyCancelNotice = async (b: any, session: any) => {
    const text = `【PickleGo－臨打取消與退款查核】
報名編號：${b.booking_no || b.id}
👤 報名人：${b.display_name || '球友'} (LINE: ${b.line_nickname || '未填'}, ${user?.phone || phone.trim()})
📅 場次：${session.session_date} | ${session.start_time?.slice(0, 5)} - ${session.end_time?.slice(0, 5)}
💰 原應繳金額：$${session.price}
💳 已回報付款方式：${b.payment_method === 'bank' ? `銀行轉帳 (末五碼 ${b.payment_account_last5})` : (b.payment_method || '未回報')}
———————————
⚠️ 說明：我已取消此筆報名，請協助查核款項。若符合退款規則，請協助辦理退款，謝謝！`;
    try {
      await navigator.clipboard.writeText(text);
      alert('✅ 取消/退款通知已複製！請貼上至官方 LINE 聯繫館主。');
    } catch {
      alert('複製失敗，請手動複製。');
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

  const paymentButtons = (item: PaymentInfo, status: string) => {
    if (status !== 'paid' && status !== 'confirmed') {
      return (
        <div className="mt-3 min-w-0">
          <button type="button" onClick={() => setActivePaymentModal(item)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white shadow-md active:scale-95 transition">
            <CreditCard size={18} /> 前往付款與回報
          </button>
        </div>
      );
    }
    return null;
  };

  const paymentSummary = (item: PaymentInfo, method?: string, status?: string) => (
    <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-gray-500">應繳金額</span>
        <span className="font-bold text-gray-900">{formatMoney(item.amount)}</span>
      </div>
      {method && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500">付款方式</span>
          <span className="font-medium text-gray-700">
            {method === 'onsite' ? '現場付款' : method === 'online' ? '線上付款' : method}
          </span>
        </div>
      )}
      {status && (
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-gray-500">付款狀態</span>
          <span className={`font-bold ${status === 'paid' || status === 'confirmed' ? 'text-emerald-600' : 'text-amber-600'}`}>
            {status === 'paid' || status === 'confirmed' ? '✅ 已付款' : '⚠️ 待付款'}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <main className="w-full min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col pb-10 relative overflow-x-clip">
      <header className="w-full text-white py-4 px-4 flex items-center justify-center shadow-md bg-gray-800 relative z-10">
        <Link href="/" className="absolute left-4 p-2 rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="text-lg font-bold tracking-wide">查詢我的預約</h1>
      </header>

      <div className="p-5 space-y-5">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="font-bold text-gray-800 mb-3 text-sm">請輸入報名時的手機號碼</h2>
          <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="tel"
              required
              placeholder="例如: 0912345678"
              pattern="[0-9]{10}"
              className="w-full min-w-0 bg-white text-gray-900 border-2 border-gray-200 rounded-xl p-3 text-base sm:text-sm sm:flex-1 focus:outline-none focus:border-gray-800"
              style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-gray-800 text-white p-3 rounded-xl shadow-md disabled:opacity-50 flex items-center justify-center min-w-[3rem]"
            >
              <Search size={20} />
            </button>
          </form>
        </div>

        {loading ? (
          <p className="text-center mt-10 font-bold animate-pulse text-gray-500">正在安全調閱資料...</p>
        ) : hasSearched && !user ? (
          <div className="bg-red-50 border border-red-200 p-5 rounded-2xl text-center text-red-600">
            <p className="font-bold">找不到此手機號碼的預約紀錄</p>
          </div>
        ) : hasSearched && user ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-gray-800 text-white p-4 rounded-xl flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-center shadow-md min-w-0">
              <span className="font-bold break-words min-w-0">{user.name} 的預約紀錄</span>
              <span className="text-xs text-gray-300 break-all">{user.phone}</span>
            </div>

            <div className="flex gap-1 bg-gray-200 p-1 rounded-xl min-w-0">
              <button
                onClick={() => setActiveTab('courts')}
                className={`flex-1 min-w-0 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'courts' ? 'shadow-sm bg-white text-emerald-600' : 'opacity-60 text-gray-600'
                  }`}
              >
                <Calendar size={14} /> 場地
              </button>
              <button
                onClick={() => setActiveTab('open_plays')}
                className={`flex-1 min-w-0 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'open_plays' ? 'shadow-sm bg-white text-blue-600' : 'opacity-60 text-gray-600'
                  }`}
              >
                <Users size={14} /> 臨打
              </button>
              <button
                onClick={() => setActiveTab('classes')}
                className={`flex-1 min-w-0 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'classes' ? 'shadow-sm bg-white text-orange-600' : 'opacity-60 text-gray-600'
                  }`}
              >
                <GraduationCap size={14} /> 課程
              </button>
            </div>

            {/* 1. 場地紀錄 (不變) */}
            {activeTab === 'courts' && (
              <div className="space-y-3">
                {courtBookings.length === 0 ? (
                  <p className="text-center text-gray-500 mt-5 text-sm">無場地預約紀錄</p>
                ) : (
                  courtBookings.map((b, index) => {
                    const court = getRel(b.courts);
                    return (
                      <div
                        key={b.ids[0] + index}
                        className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${b.status === 'cancelled' ? 'border-gray-300 opacity-60' : 'border-emerald-500'
                          }`}
                      >
                        <div className="flex justify-between items-start gap-2 min-w-0 mb-2">
                          <h3 className="font-bold text-gray-800 min-w-0 break-words">{court?.name}</h3>
                          <span
                            className={`text-xs px-2 py-1 rounded font-bold shrink-0 ${b.status === 'booked' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                              }`}
                          >
                            {b.status === 'booked' ? '預約成功' : '已取消'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1 font-medium min-w-0 break-words">
                          <p>
                            📅 {b.booking_date} | {b.start_time?.slice(0, 5)} - {b.end_time?.slice(0, 5)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">共計 {b.ids.length * 0.5} 小時</p>
                        </div>
                        {b.status === 'booked' && (
                          <>
                            {paymentSummary(getCourtPayment(b), b.payment_method, b.payment_status)}
                            {paymentButtons(getCourtPayment(b), b.payment_status)}
                          </>
                        )}

                        {b.status === 'booked' && (
                          isCancellable(b.booking_date, b.start_time) ? (
                            <button
                              onClick={() =>
                                handleCancelBooking("court_bookings", b.ids, b.booking_date, b.start_time)
                              }
                              className="mt-3 flex items-center justify-center w-full gap-1 text-red-500 bg-red-50 py-2 rounded-lg text-xs font-bold transition hover:bg-red-100"
                            >
                              <XCircle size={14} /> 取消預約
                            </button>
                          ) : (
                            <div className="mt-3 flex items-center justify-center w-full gap-1 text-gray-400 bg-gray-100 py-2 rounded-lg text-xs font-bold border border-gray-200 cursor-not-allowed">
                              <Lock size={12} /> 已過最後取消期限 (開打前 {cancelLimitHours} 小時)
                            </div>
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 🌟 2. 臨打紀錄 (完全重構，符合新版限時回報邏輯) */}
            {activeTab === 'open_plays' && (
              <div className="space-y-3">
                {openPlayBookings.length === 0 ? (
                  <p className="text-center text-gray-500 mt-5 text-sm">無臨打報名紀錄</p>
                ) : (
                  openPlayBookings.map((b) => {
                    const session = getRel(b.open_play_sessions);
                    const court = getRel(session?.courts);

                    return (
                      <div
                        key={b.id}
                        className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${b.status === 'cancelled' ? 'border-gray-300 opacity-60' : 'border-blue-500'
                          }`}
                      >
                        <div className="flex justify-between items-start gap-2 min-w-0 mb-2">
                          <h3 className="font-bold text-gray-800 min-w-0 break-words">{session?.title}</h3>
                          <span
                            className={`text-xs px-2 py-1 rounded font-bold shrink-0 ${b.status === 'registered'
                              ? 'bg-blue-100 text-blue-700'
                              : b.status === 'waitlisted'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-500'
                              }`}
                          >
                            {b.status === 'registered' ? '正取' : b.status === 'waitlisted' ? '候補' : '已取消'}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mb-2">
                          📍 {court?.name || '未定'} (DUPR {session?.level})
                        </p>

                        {/* 🌟 臨打專用報名摘要方框 */}
                        <div className="text-sm text-gray-600 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100 break-all">
                          <p>👤 顯示名稱：<span className="font-medium text-gray-800">{b.display_name || '球友'}</span></p>
                          <p>💬 LINE 暱稱：<span className="font-medium text-gray-800">{b.line_nickname || '未填'}</span></p>
                          <p>📱 手機號碼：<span className="font-medium text-gray-800">{user?.phone || phone}</span></p>
                          <p>📅 活動時間：<span className="font-medium text-gray-800">{session?.session_date} | {session?.start_time?.slice(0, 5)} - {session?.end_time?.slice(0, 5)}</span></p>
                          <p>🎫 報名編號：<span className="font-medium text-gray-800">{b.booking_no || b.id}</span></p>
                          <p>🕒 報名時間：<span className="font-medium text-gray-800">{new Date(b.created_at).toLocaleString('zh-TW')}</span></p>
                          <p>💰 應付金額：<span className="font-medium text-blue-600">${session?.price}</span></p>
                        </div>

                        {/* 🌟 狀態區塊判定 */}
                        {b.status === 'registered' && b.payment_status === 'pending' && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                            <p className="text-red-600 font-bold text-sm mb-2 flex items-center gap-1">
                              <Clock size={16} /> 狀態：保留中 (待付款)
                            </p>
                            <button
                              onClick={() => {
                                setLineNickname(b.line_nickname || "");
                                setSelectedPayment("");
                                setLast5("");
                                setActivePaymentModal(getPlayPayment(b));
                              }}
                              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white shadow-md active:scale-95 transition"
                            >
                              <CreditCard size={18} /> 前往付款與回報
                            </button>
                          </div>
                        )}

                        {b.status === 'registered' && b.payment_status === 'reported' && (
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                            <p className="font-bold flex items-center gap-1 mb-1"><Check size={16} /> 付款回報已送出</p>
                            <p className="text-xs mb-2">名額已保留，待館主核對付款。</p>
                            <p className="text-xs">💳 付款方式：{b.payment_method}</p>
                            {b.payment_report_time && <p className="text-xs">🕒 回報時間：{new Date(b.payment_report_time).toLocaleString('zh-TW')}</p>}
                          </div>
                        )}

                        {b.status === 'registered' && b.payment_status === 'confirmed' && (
                          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-sm text-emerald-800">
                            <p className="font-bold flex items-center gap-1 mb-1"><CheckCircle2 size={16} /> 付款已確認</p>
                            {b.admin_confirm_time && <p className="text-xs">🕒 確認時間：{new Date(b.admin_confirm_time).toLocaleString('zh-TW')}</p>}
                          </div>
                        )}

                        {b.status === 'waitlisted' && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
                            <p className="font-bold">目前為候補狀態</p>
                            <p className="text-xs mt-1">若有空缺，館方將與您聯繫確認後再行繳費！</p>
                          </div>
                        )}

                        {b.status === 'cancelled' && (
                          <div className="mt-3 p-3 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700">
                            <p className="font-bold text-gray-900 mb-1">🚫 報名已取消，名額已釋出</p>
                            <p className="text-xs mt-2 font-bold text-gray-800 border-t border-gray-200 pt-2">
                              💰 款項處理狀態：{b.refund_status === 'refunded' ? '已退款' : '待處理 / 無需退款'}
                            </p>

                            {b.refund_status === 'refunded' && (
                              <div className="text-xs mt-1 text-gray-600 space-y-0.5">
                                <p>退款金額：${b.refund_amount}</p>
                                <p>退款方式：{b.refund_method}</p>
                                {b.refund_time && <p>退款時間：{new Date(b.refund_time).toLocaleString('zh-TW')}</p>}
                              </div>
                            )}

                            <div className="mt-3 flex gap-2">
                              <button onClick={() => handleCopyCancelNotice(b, session)} className="flex-1 bg-white border border-gray-300 py-2 rounded text-xs font-bold flex items-center justify-center gap-1 shadow-sm"><Copy size={14} /> 複製通知</button>
                              {lineUrl && lineUrl !== 'https://lin.ee/your_line_id' && (
                                <a href={lineUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#06C755] text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-1 shadow-sm"><MessageCircle size={14} /> 官方 LINE</a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 備註與取消按鈕 */}
                        {b.status !== 'cancelled' && (
                          <div className="mt-3">
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 mb-3">
                              {editingNoteId === b.id ? (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    className="flex-1 min-w-0 bg-white text-gray-900 border border-gray-300 rounded px-2 py-1 text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                                    placeholder="輸入備註 (如: 晚半小時到)"
                                    value={editNoteText}
                                    onChange={(e) => setEditNoteText(e.target.value)}
                                    autoFocus
                                  />
                                  <button onClick={() => handleSaveNote(b.id)} className="bg-blue-600 text-white p-1.5 rounded"><Check size={14} /></button>
                                  <button onClick={() => setEditingNoteId(null)} className="bg-gray-300 text-gray-700 p-1.5 rounded"><XCircle size={14} /></button>
                                </div>
                              ) : (
                                <div className="flex justify-between items-start">
                                  <p className="text-xs text-gray-600 break-words flex-1">
                                    <span className="font-bold text-gray-700">個人備註：</span>{b.player_notes || '無'}
                                  </p>
                                  <button onClick={() => { setEditingNoteId(b.id); setEditNoteText(b.player_notes || ""); }} className="text-blue-600 hover:text-blue-800 ml-2 shrink-0">
                                    <Edit2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {isCancellable(session?.session_date, session?.start_time) ? (
                              <button
                                onClick={() => handleCancelBooking("open_play_players", b.id, session?.session_date, session?.start_time, true)}
                                className="flex items-center justify-center w-full gap-1 text-red-500 bg-red-50 py-2 rounded-lg text-xs font-bold transition hover:bg-red-100"
                              >
                                <XCircle size={14} /> 取消報名
                              </button>
                            ) : (
                              <div className="flex items-center justify-center w-full gap-1 text-gray-400 bg-gray-100 py-2 rounded-lg text-xs font-bold border border-gray-200 cursor-not-allowed">
                                <Lock size={12} /> 已過最後取消期限 (開打前 {cancelLimitHours} 小時)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 3. 課程紀錄 (不變) */}
            {activeTab === 'classes' && (
              <div className="space-y-3">
                {classBookings.length === 0 ? (
                  <p className="text-center text-gray-500 mt-5 text-sm">無課程報名紀錄</p>
                ) : (
                  classBookings.map((b) => {
                    const cls = getRel(b.classes);
                    return (
                      <div
                        key={b.id}
                        className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${b.status === 'cancelled' ? 'border-gray-300 opacity-60' : 'border-orange-500'
                          }`}
                      >
                        <div className="flex justify-between items-start gap-2 min-w-0 mb-2">
                          <h3 className="font-bold text-gray-800 min-w-0 break-words">{cls?.title}</h3>
                          <span
                            className={`text-xs px-2 py-1 rounded font-bold shrink-0 ${b.status === 'booked' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                              }`}
                          >
                            {b.status === 'booked' ? '報名成功' : '已取消'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1 min-w-0 break-words">
                          <p>📅 {cls?.class_date} | {cls?.start_time?.slice(0, 5)} - {cls?.end_time?.slice(0, 5)}</p>
                          <p>🧑‍🏫 教練: {cls?.coach}</p>
                        </div>
                        {b.status === 'booked' && (
                          <>
                            {paymentSummary(getClassPayment(b), b.payment_method, b.payment_status)}
                            {paymentButtons(getClassPayment(b), b.payment_status)}
                          </>
                        )}

                        {b.status === 'booked' && (
                          isCancellable(cls?.class_date, cls?.start_time) ? (
                            <button
                              onClick={() => handleCancelBooking("class_bookings", b.id, cls?.class_date, cls?.start_time)}
                              className="mt-3 flex items-center justify-center w-full gap-1 text-red-500 bg-red-50 py-2 rounded-lg text-xs font-bold transition hover:bg-red-100"
                            >
                              <XCircle size={14} /> 取消報名
                            </button>
                          ) : (
                            <div className="mt-3 flex items-center justify-center w-full gap-1 text-gray-400 bg-gray-100 py-2 rounded-lg text-xs font-bold border border-gray-200 cursor-not-allowed">
                              <Lock size={12} /> 已過最後取消期限 (開打前 {cancelLimitHours} 小時)
                            </div>
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* 🌟 共用付款 Modal (根據來源不同呈現不同介面) */}
      {activePaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-6">
          <div role="dialog" aria-modal="true" aria-label="付款資訊"
            className="my-auto w-full max-w-sm max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-gray-900">線上付款與回報</h2>
              <button type="button" aria-label="關閉" onClick={() => setActivePaymentModal(null)} className="rounded-lg p-2 text-gray-500"><XCircle size={22} /></button>
            </div>

            {/* 🌟 若是「臨打」，走專屬的限時與回報流程 */}
            {activePaymentModal.kind === 'play' ? (
              <div className="space-y-4">
                {timeLeft === 0 ? (
                  <div className="text-red-600 font-bold text-center bg-red-50 p-4 rounded-xl border border-red-100">
                    <p className="text-lg">保留時間已逾時！</p>
                    <p className="text-xs mt-1 text-gray-600">名額已釋出。若您已匯款，請直接聯繫官方 LINE。</p>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center shadow-sm">
                    <p className="text-sm font-bold text-gray-700 flex items-center justify-center gap-1 mb-1">
                      <Clock size={16} className="text-blue-600" /> 請於限時內完成付款回報
                    </p>
                    <p className="text-3xl font-black text-red-600 font-mono tracking-wider">
                      {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
                    </p>
                  </div>
                )}

                <div className="text-center font-bold text-blue-600 text-lg border-b border-gray-100 pb-3">
                  應繳金額：${activePaymentModal.amount}
                </div>

                {timeLeft !== 0 && (
                  <>
                    <h3 className="font-bold text-gray-800 text-sm">1. 請選擇付款方式</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {paymentSettings.line && (
                        <button onClick={() => setSelectedPayment('line')} className={`py-3 rounded-xl font-bold text-sm border-2 transition ${selectedPayment === 'line' ? 'border-[#06C755] bg-[#06C755]/10 text-[#06C755]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>LINE Pay</button>
                      )}
                      {paymentSettings.jko && (
                        <button onClick={() => setSelectedPayment('jko')} className={`py-3 rounded-xl font-bold text-sm border-2 transition ${selectedPayment === 'jko' ? 'border-[#E60012] bg-[#E60012]/10 text-[#E60012]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>街口支付</button>
                      )}
                      {paymentSettings.twqr && (
                        <button onClick={() => setSelectedPayment('twqr')} className={`py-3 rounded-xl font-bold text-sm border-2 transition ${selectedPayment === 'twqr' ? 'border-[#005598] bg-[#005598]/10 text-[#005598]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>台灣 Pay</button>
                      )}
                      {paymentSettings.bank && (
                        <button onClick={() => setSelectedPayment('bank')} className={`py-3 rounded-xl font-bold text-sm border-2 transition ${selectedPayment === 'bank' ? 'border-gray-800 bg-gray-100 text-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>銀行轉帳</button>
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
                          <h3 className="font-bold text-gray-800 text-sm mb-2 flex justify-between items-center">
                            3. 確認回報
                            <span className="text-[10px] text-red-500 font-normal">付款後務必點選此按鈕</span>
                          </h3>
                          <input
                            type="text"
                            placeholder="您的 LINE 暱稱 (核帳必填)"
                            className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 mb-2"
                            value={lineNickname}
                            onChange={(e) => setLineNickname(e.target.value)}
                          />
                          {selectedPayment === 'bank' && (
                            <input
                              type="text"
                              placeholder="請輸入轉出帳號末 5 碼 (必填)"
                              maxLength={5}
                              className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-blue-500 mb-3"
                              value={last5}
                              onChange={(e) => setLast5(e.target.value)}
                            />
                          )}
                          <button
                            onClick={handleReportOpenPlayPayment}
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
              </div>
            ) : (
              /* 🌟 原有的「場地與課程」共用付款介面 (保留不動) */
              <>
                <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100 mb-4 text-center">
                  <p className="font-bold text-gray-900 break-words">{activePaymentModal.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{activePaymentModal.date} {activePaymentModal.start}–{activePaymentModal.end}</p>
                  <p className="mt-2 text-xl font-bold text-emerald-600">{formatMoney(activePaymentModal.amount)}</p>
                </div>
                <div className="space-y-3">
                  {paymentSettings.line && (
                    <a href={paymentSettings.line} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] py-3 text-sm font-bold text-white shadow hover:bg-[#05b34c] transition">使用 LINE Pay 付款</a>
                  )}
                  {paymentSettings.jko && (
                    <a href={paymentSettings.jko} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E60012] py-3 text-sm font-bold text-white shadow hover:bg-[#cc0010] transition">使用 街口支付 付款</a>
                  )}
                  {paymentSettings.twqr && (
                    <a href={paymentSettings.twqr} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#005598] py-3 text-sm font-bold text-white shadow hover:bg-[#004780] transition">使用 台灣 Pay (TWQR) 付款</a>
                  )}
                  {paymentSettings.bank && (
                    <div className="bg-gray-100 p-3 rounded-xl border border-gray-200 mt-2">
                      <p className="text-xs text-gray-500 font-bold mb-1 flex items-center gap-1"><Banknote size={14} /> 銀行轉帳帳號</p>
                      <div className="flex justify-between items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 break-all bg-white px-2 py-1.5 rounded border border-gray-300 flex-1">{paymentSettings.bank}</p>
                        <button onClick={handleCopyBankAccount} className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-1.5 rounded transition shrink-0" title="複製帳號"><Copy size={16} /></button>
                      </div>
                    </div>
                  )}
                </div>
                <hr className="my-4 border-gray-200" />
                <p className="text-xs text-center text-gray-500 font-bold mb-3">付款完成後，請務必點擊下方按鈕回報！</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleCopyText(activePaymentModal)} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-800 py-3 text-sm font-bold text-white shadow-md active:scale-95 transition"><Copy size={16} /> 複製報名資訊</button>
                  {lineUrl && lineUrl !== 'https://lin.ee/your_line_id' ? (
                    <a href={lineUrl} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#06C755] py-3 text-sm font-bold text-white shadow-md active:scale-95 transition"><MessageCircle size={16} /> 官方 LINE 回報</a>
                  ) : (
                    <div className="flex w-full items-center justify-center rounded-xl bg-gray-200 py-3 text-sm font-bold text-gray-400">LINE 尚未設定</div>
                  )}
                </div>
                <p className="mt-3 text-center text-[10px] text-gray-400 font-bold">複製回報資訊不代表付款已完成，需等待館方核對。</p>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}