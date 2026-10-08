"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import {
  ArrowLeft,
  UserCircle,
  CheckCircle2,
  QrCode,
  Copy,
  MessageCircle,
  MapPin
} from "lucide-react";

// 🌟 安全關聯讀取函式：相容物件或單一陣列物件
const getRel = (obj: any) => (Array.isArray(obj) ? obj[0] : obj);

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [needPaddle, setNeedPaddle] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // 付費彈窗狀態
  const [bookingResult, setBookingResult] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<'select' | 'online' | 'onsite'>('select');
  const [createdBookingId, setCreatedBookingId] = useState<number | null>(null);
  const [lineUrl, setLineUrl] = useState("https://lin.ee/your_line_id");

  const fetchClasses = async () => {
    // 取得官方 LINE 連結
    const { data: settingData } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "line_url")
      .maybeSingle();

    if (settingData?.value) {
      setLineUrl(settingData.value);
    }

    // 🌟 資安加固：僅抓取場地名稱與報名 status 統計人數，嚴禁洩露其他球友個資
    const { data, error } = await supabase
      .from("classes")
      .select(`
        *,
        courts (name),
        class_bookings (status)
      `)
      .eq("status", "open")
      .order("class_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (!error && data) {
      const formattedClasses = data.map((cls) => ({
        ...cls,
        enrolledCount: cls.class_bookings?.filter((b: any) => b.status === 'booked').length || 0,
      }));
      setClasses(formattedClasses);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  // 檢查場次是否已過期
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

  const resetForm = () => {
    setSelectedClass(null);
    setName("");
    setPhone("");
    setNeedPaddle(false);
    setNotes("");
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!selectedClass || !cleanName || !cleanPhone) {
      return alert("請填寫完整資訊！");
    }

    if (!/^09\d{8}$/.test(cleanPhone)) {
      return alert("請輸入正確的 10 碼台灣手機號碼 (09xxxxxxxx)！");
    }

    setIsSubmitting(true);

    try {
      // 呼叫資料庫安全交易函式，防止 Race Condition 超額報名
      const { data, error } = await supabase.rpc("register_class", {
        p_class_id: selectedClass.id,
        p_name: cleanName,
        p_phone: cleanPhone,
        p_notes: notes.trim() || null,
        p_need_paddle: needPaddle,
      });

      if (error) throw error;

      if (!data.success) {
        alert(`⚠️ ${data.message}`);
        setIsSubmitting(false);
        fetchClasses();
        resetForm();
        return;
      }

      const courtName = getRel(selectedClass.courts)?.name || "1號場地";

      setCreatedBookingId(data.booking_id);
      setBookingResult({
        classTitle: selectedClass.title,
        coach: selectedClass.coach,
        courtName: courtName,
        date: selectedClass.class_date,
        time: `${selectedClass.start_time?.slice(0, 5)} - ${selectedClass.end_time?.slice(0, 5)}`,
        price: selectedClass.price,
        name: cleanName,
        phone: cleanPhone,
      });

      setPaymentMode('select');
      resetForm();
      fetchClasses();
    } catch (error: any) {
      alert("報名失敗，請稍後再試！錯誤：" + (error.message || "系統錯誤"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePaymentMethod = async (method: 'online' | 'onsite') => {
    setPaymentMode(method);
    if (createdBookingId) {
      await supabase
        .from("class_bookings")
        .update({ payment_method: method })
        .eq("id", createdBookingId);
    }
  };

  const handleCopyText = async () => {
    const text = `【匹克球館 - 體驗課繳費回報】
👤 學員：${bookingResult.name} (${bookingResult.phone})
📅 日期：${bookingResult.date} | ${bookingResult.time}
📍 場地：${bookingResult.courtName}
🏷️ 課程：${bookingResult.classTitle} (教練: ${bookingResult.coach})
💰 應繳金額：$${bookingResult.price}
———————————
✅ 我已完成線上掃碼付款！
📱 支付方式：LINE Pay / TWQR
🆔 我的LINE暱稱：＿＿＿＿＿ (請填寫)`;

    try {
      await navigator.clipboard.writeText(text);
      alert("✅ 回報文案已複製！請貼上至官方 LINE 並填寫您的暱稱。");
    } catch {
      alert("複製失敗，請手動選取複製。");
    }
  };

  const activeClasses = classes.filter(cls => !isSessionExpired(cls.class_date, cls.start_time));

  return (
    <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col pb-10">
      {/* 修改處：加上 w-full 確保寬度填滿，並移除 relative 如果不需要 */}
      <header className="w-full text-white p-4 flex items-center shadow-md bg-orange-600 z-10">
        <Link href="/" className="mr-4 p-2 rounded-full transition bg-white/15">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold">體驗 / 教學課</h1>
      </header>

      <div className="p-5 space-y-4">
        {successMsg && (
          <div className="bg-orange-100 border border-orange-400 text-orange-800 px-4 py-3 rounded-xl flex items-center mb-4">
            <CheckCircle2 className="mr-2 shrink-0" />
            <p className="font-bold text-sm">{successMsg}</p>
          </div>
        )}

        {loading ? (
          <p className="text-center mt-10 font-bold animate-pulse text-gray-500">尋找課程中...</p>
        ) : activeClasses.length === 0 ? (
          <p className="text-center mt-10 text-gray-500">目前沒有開放的課程</p>
        ) : (
          activeClasses.map((cls) => {
            const isFull = cls.enrolledCount >= cls.max_players;
            const courtName = getRel(cls.courts)?.name || "1號場地";

            return (
              <div key={cls.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-start border-b pb-3 mb-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-orange-100 text-orange-800">
                        新手友善
                      </span>
                      {/* 🌟 清楚顯示場地標籤 */}
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-gray-100 text-gray-700 flex items-center gap-1">
                        <MapPin size={11} className="text-orange-600" />
                        {courtName}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-gray-800">{cls.title}</h2>
                    <p className="text-sm mt-1 flex items-center text-gray-600 font-medium">
                      <UserCircle size={14} className="mr-1 text-gray-400" /> 教練：{cls.coach || '確認中'}
                    </p>
                    <p className="text-sm mt-0.5 text-gray-500">
                      📅 {cls.class_date} | {cls.start_time?.slice(0, 5)} - {cls.end_time?.slice(0, 5)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-orange-600">${cls.price}</p>
                  </div>
                </div>

                {cls.notes && (
                  <div className="mb-4 bg-orange-50 text-orange-800 text-xs px-3 py-2 rounded-lg border border-orange-100">
                    <span className="font-bold">📝 館方備註：</span>{cls.notes}
                  </div>
                )}

                <div className="flex gap-4 mb-4 text-sm">
                  <div className="flex-1 bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                    <p className="text-xs text-gray-500 mb-0.5">報名進度</p>
                    <p className={`font-bold ${isFull ? 'text-red-500' : 'text-orange-600'}`}>
                      {cls.enrolledCount} / {cls.max_players} 人
                    </p>
                  </div>
                </div>

                {selectedClass?.id !== cls.id && (
                  <button
                    disabled={isFull}
                    onClick={() => {
                      setSelectedClass(cls);
                      setSuccessMsg("");
                    }}
                    className={`w-full font-bold py-3 rounded-xl transition-all shadow-md ${isFull
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        : 'text-white bg-orange-600 active:scale-95 cursor-pointer'
                      }`}
                  >
                    {isFull ? '已額滿' : '我要報名'}
                  </button>
                )}

                {selectedClass?.id === cls.id && (
                  <div className="mt-4 p-4 rounded-xl border-2 animate-in fade-in slide-in-from-top-2 border-orange-600 bg-orange-50">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-sm text-orange-900">填寫報名資料</h3>
                      <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
                        場地：{courtName}
                      </span>
                    </div>

                    <form onSubmit={handleBooking} className="space-y-3">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="姓名 / 暱稱"
                          className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                      <div>
                        <input
                          type="tel"
                          required
                          placeholder="手機號碼 (例如: 0912345678)"
                          pattern="[0-9]{10}"
                          className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center py-1">
                        <input
                          type="checkbox"
                          id={`paddle-${cls.id}`}
                          className="w-4 h-4 rounded border-gray-300 accent-orange-600"
                          checked={needPaddle}
                          onChange={(e) => setNeedPaddle(e.target.checked)}
                        />
                        <label htmlFor={`paddle-${cls.id}`} className="ml-2 text-sm font-medium text-gray-600">
                          我需要向場館借用球拍 (免費)
                        </label>
                      </div>

                      <div>
                        <textarea
                          rows={2}
                          placeholder="請簡述您的球齡，或是否有需要教練注意的運動舊傷？（選填）"
                          className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        ></textarea>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={resetForm}
                          className="flex-1 bg-white border border-gray-300 font-bold py-2.5 rounded-lg text-sm text-gray-600"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex-1 text-white font-bold py-2.5 rounded-lg text-sm shadow-sm bg-orange-600 disabled:opacity-50"
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

      {/* 課程報名成功付款 Modal */}
      {bookingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-in fade-in overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 my-auto">
            <div className="p-5 text-center bg-orange-600">
              <CheckCircle2 size={48} className="mx-auto text-white mb-2" />
              <h2 className="text-xl font-bold text-white">報名成功！</h2>
              <p className="text-white/90 text-sm mt-1">
                {bookingResult.classTitle} ｜ {bookingResult.courtName}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {paymentMode === 'select' && (
                <>
                  <h3 className="font-bold text-center text-gray-800 mb-2">請選擇付款方式</h3>
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
                <div className="text-center space-y-4">
                  <p className="text-gray-600 font-medium">
                    您已選擇現場付款，<br />
                    請於上課當日至櫃檯完成現金付款！
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
                <div className="space-y-3">
                  <div className="bg-gray-100 rounded-xl aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 p-4 mb-2">
                    <QrCode size={48} className="text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 font-bold">請於此處放置館方的</p>
                    <p className="text-sm text-gray-500 font-bold">LINE Pay / TWQR 條碼圖</p>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg text-sm text-orange-800 text-center mb-2">
                    應繳金額：
                    <span className="font-bold text-lg text-orange-600">${bookingResult.price}</span>
                  </div>

                  <button
                    onClick={handleCopyText}
                    className="w-full flex items-center justify-center gap-2 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition bg-orange-600"
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
          </div>
        </div>
      )}
    </main>
  );
}