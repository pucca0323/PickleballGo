"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, CheckCircle2, QrCode, Copy, MessageCircle } from "lucide-react";

const generate14Days = () => {
  const days = [];
  const weekDays = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      dateStr,
      dayNum: d.getDate(),
      dayName: weekDays[d.getDay()],
      isToday: i === 0,
      dayOfWeek: d.getDay(),
    });
  }
  return days;
};

const generateTimeSlots = () => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    const hour = h.toString().padStart(2, "0");
    slots.push(`${hour}:00`);
    slots.push(`${hour}:30`);
  }
  return slots;
};

const timeToMins = (t: string) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export default function BookingPage() {
  const [dates] = useState(generate14Days());
  const [timeSlots] = useState(generateTimeSlots());

  const [selectedDate, setSelectedDate] = useState(dates[0].dateStr);
  const [courts, setCourts] = useState<any[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);

  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [specialDates, setSpecialDates] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bookingResult, setBookingResult] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<'select' | 'online' | 'onsite'>('select');
  const [createdBookingIds, setCreatedBookingIds] = useState<string[]>([]);
  const [lineUrl, setLineUrl] = useState("https://lin.ee/your_line_id");

  // 🌟 初始化時，自動從瀏覽器讀取上次記住的姓名與手機
  useEffect(() => {
    const savedName = localStorage.getItem("pickle_user_name");
    const savedPhone = localStorage.getItem("pickle_user_phone");
    if (savedName) setName(savedName);
    if (savedPhone) setPhone(savedPhone);

    const initData = async () => {
      const { data: settingData } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "line_url")
        .maybeSingle();
      if (settingData?.value) {
        setLineUrl(settingData.value);
      }

      const { data: rulesData } = await supabase.from("pricing_rules").select("*");
      if (rulesData) setPricingRules(rulesData);

      const { data: specialsData } = await supabase.from("special_dates").select("date");
      if (specialsData) {
        setSpecialDates(specialsData.map(s => s.date));
      }

      const { data: courtsData } = await supabase
        .from("courts")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (courtsData && courtsData.length > 0) {
        setCourts(courtsData);
        setSelectedCourt(String(courtsData[0].id));
      } else {
        setCourts([]);
        setSelectedCourt(null);
      }
      setLoading(false);
    };
    initData();
  }, []);

  const fetchBookings = useCallback(async () => {
    if (!selectedDate || !selectedCourt) return;

    const { data } = await supabase
      .from("court_bookings")
      .select("start_time, end_time")
      .eq("booking_date", selectedDate)
      .eq("court_id", selectedCourt)
      .eq("status", "booked");

    if (data) {
      const busySlots: string[] = [];
      data.forEach((b) => {
        const start = b.start_time.slice(0, 5);
        const end = b.end_time.slice(0, 5);
        let inRange = false;
        timeSlots.forEach((slot) => {
          if (slot === start) inRange = true;
          if (slot === end) inRange = false;
          if (inRange) busySlots.push(slot);
        });
      });
      setBookedSlots(busySlots);
    } else {
      setBookedSlots([]);
    }
    setSelectedSlots([]);
    setShowForm(false);
  }, [selectedDate, selectedCourt, timeSlots]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const toggleSlot = (time: string) => {
    if (selectedSlots.includes(time)) {
      setSelectedSlots(selectedSlots.filter((t) => t !== time));
    } else {
      setSelectedSlots([...selectedSlots, time].sort());
    }
  };

  const isSlotExpired = (dateStr: string, timeSlot: string) => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    if (dateStr !== todayStr) return false;

    const [slotH, slotM] = timeSlot.split(':').map(Number);
    const currentH = now.getHours();
    const currentM = now.getMinutes();

    if (slotH < currentH) return true;
    if (slotH === currentH && slotM <= currentM) return true;
    return false;
  };

  const getDayType = (dateStr: string) => {
    if (specialDates.includes(dateStr)) return 'weekend';
    const d = new Date(dateStr);
    const day = d.getDay();
    return (day === 0 || day === 6) ? 'weekend' : 'weekday';
  };

  const getSlotPrice = (dateStr: string, timeSlot: string) => {
    const dayType = getDayType(dateStr);
    const slotMins = timeToMins(timeSlot);

    const matchedRule = pricingRules.find(r => 
      r.day_type === dayType &&
      timeToMins(r.start_time) <= slotMins &&
      timeToMins(r.end_time) > slotMins
    );

    return matchedRule ? matchedRule.price : 250;
  };

  const totalHours = selectedSlots.length * 0.5;
  const displayTotalPrice = selectedSlots.reduce((sum, slot) => sum + getSlotPrice(selectedDate, slot), 0);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSlots.length === 0 || !name.trim() || !phone.trim() || !selectedCourt) {
      return alert("請填寫完整資訊！");
    }
    setIsSubmitting(true);

    try {
      for (const slot of selectedSlots) {
        if (isSlotExpired(selectedDate, slot)) {
          alert(`⚠️ 時段 ${slot} 已經過期，無法預約！`);
          setIsSubmitting(false);
          fetchBookings();
          return;
        }
      }

      const startTime = selectedSlots[0];
      const lastSlot = selectedSlots[selectedSlots.length - 1];
      const [lastH, lastM] = lastSlot.split(':').map(Number);
      
      const endMins = lastH * 60 + lastM + 30; 
      const endH = Math.floor(endMins / 60).toString().padStart(2, '0');
      const endM = (endMins % 60).toString().padStart(2, '0');
      const endTime = `${endH}:${endM}`;

      const cleanCourtId = String(selectedCourt);

      const { data, error } = await supabase.rpc("secure_book_court", {
        p_court_id: cleanCourtId,
        p_booking_date: selectedDate,
        p_start_time: startTime,
        p_end_time: endTime,
        p_name: name.trim(),
        p_phone: phone.trim(),
      });

      if (error) throw error;

      if (!data.success) {
        alert(`⚠️ ${data.message}`);
        fetchBookings();
        return;
      }

      // 🌟 預約成功後，將姓名與手機儲存至瀏覽器本地記憶
      localStorage.setItem("pickle_user_name", name.trim());
      localStorage.setItem("pickle_user_phone", phone.trim());

      const serverPrice = data.price !== undefined ? data.price : displayTotalPrice;
      const ids = data.booking_ids || []; 
      setCreatedBookingIds(ids);

      const currentCourt = courts.find((c) => String(c.id) === cleanCourtId);
      
      setBookingResult({
        courtName: currentCourt?.name || '場地',
        date: selectedDate,
        timeRange: `${startTime} - ${endTime}`,
        totalHours: selectedSlots.length * 0.5,
        totalPrice: serverPrice,
        name: name.trim(),
        phone: phone.trim(),
      });

      setPaymentMode('select');
      setSelectedSlots([]);
      setShowForm(false);
      fetchBookings();
    } catch (error: any) {
      alert("預約失敗，錯誤：" + (error.message || "系統錯誤"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePaymentMethod = async (method: 'online' | 'onsite') => {
    setPaymentMode(method);
    if (createdBookingIds.length > 0) {
      await supabase.rpc("update_my_payment_method", {
        p_table_name: "court_bookings",
        p_booking_ids: createdBookingIds.map(String),
        p_phone: phone.trim(),
        p_payment_method: method
      });
    }
  };

  const handleCopyText = async () => {
    const text = `【匹克球館 - 場地預約繳費回報】
👤 預約人：${bookingResult.name} (${bookingResult.phone})
📅 日期：${bookingResult.date}
📍 場地：${bookingResult.courtName} (${bookingResult.totalHours}小時)
💰 應繳金額：$${bookingResult.totalPrice}
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

  return (
    <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col relative pb-32">
      <header className="bg-emerald-600 text-white p-4 flex items-center shadow-md relative z-10">
        <Link href="/" className="mr-4 hover:bg-emerald-700 p-2 rounded-full transition">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold">場地預約 (動態費率)</h1>
      </header>

      {/* 1. 日期選擇 */}
      <div className="bg-white py-4 border-b border-gray-200">
        <div className="flex items-center text-sm font-bold text-gray-700 mb-3 px-4">
          <CalendarDays size={16} className="mr-2 text-emerald-600" /> 選擇預約日期
        </div>
        <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          {dates.map((d) => {
            const isSpecial = specialDates.includes(d.dateStr);
            const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6 || isSpecial;
            const isSelected = selectedDate === d.dateStr;

            let btnBgClass = "bg-white text-gray-600 border-gray-200 hover:border-emerald-400";
            if (isSelected) {
              btnBgClass = "bg-emerald-600 text-white border-emerald-600 shadow-md";
            } else if (isWeekend) {
              btnBgClass = "bg-amber-50 text-amber-900 border-amber-200 hover:border-amber-400 shadow-sm";
            }

            return (
              <button
                key={d.dateStr}
                onClick={() => setSelectedDate(d.dateStr)}
                className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-2xl border transition-all relative ${btnBgClass}`}
              >
                <span className={`text-xs mb-1 ${isSelected ? 'text-emerald-100' : isWeekend ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>
                  {d.isToday ? '今天' : d.dayName}
                </span>
                <span className="text-xl font-bold">{d.dayNum}</span>
              </button>
            );
          })}
          <div className="w-1 flex-shrink-0"></div>
        </div>
      </div>

      {/* 2. 場地選擇 */}
      <div className="bg-white py-4 shadow-sm mb-4">
        <div className="flex items-center text-sm font-bold text-gray-700 mb-3 px-4">
          <MapPin size={16} className="mr-2 text-emerald-600" /> 選擇場地
        </div>
        {courts.length === 0 ? (
          <p className="text-xs text-gray-500 px-4">目前無開放中的球場</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
            {courts.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCourt(String(c.id))}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold flex items-center transition-all ${
                  selectedCourt === String(c.id)
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-gray-100 text-gray-500 border border-transparent'
                }`}
              >
                <MapPin size={14} className="mr-1" /> {c.name}
              </button>
            ))}
            <div className="w-1 flex-shrink-0"></div>
          </div>
        )}
      </div>

      {/* 3. 時段選擇 */}
      <div className="px-5 pb-5">
        <h2 className="font-bold text-gray-800 mb-3 text-sm flex justify-between items-center">
          <span>選擇時段 (可複選)</span>
          <span className="text-xs font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {specialDates.includes(selectedDate) ? '國定假日費率' : getDayType(selectedDate) === 'weekend' ? '假日費率' : '平日費率'}
          </span>
        </h2>
        {loading ? (
          <p className="text-center text-gray-500 animate-pulse mt-5">讀取時段中...</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {timeSlots.map((time) => {
              const isBooked = bookedSlots.includes(time);
              const isExpired = isSlotExpired(selectedDate, time);
              const isSelected = selectedSlots.includes(time);
              const slotPrice = getSlotPrice(selectedDate, time);

              return (
                <button
                  key={time}
                  disabled={isBooked || isExpired || courts.length === 0}
                  onClick={() => toggleSlot(time)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center ${
                    isBooked || isExpired || courts.length === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-100'
                      : isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-inner scale-95'
                      : 'bg-white text-emerald-700 border-emerald-200 shadow-sm active:scale-95 hover:border-emerald-500'
                  }`}
                >
                  <span className="text-sm font-black">{time}</span>
                  <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-gray-400'}`}>
                    ${slotPrice}/半小時
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部動態計費與報名表單 */}
      {selectedSlots.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1)] z-20 animate-in slide-in-from-bottom-5">
          <div className="p-4">
            {showForm ? (
              <form onSubmit={handleBooking} className="space-y-3 mb-2">
                <input
                  type="text"
                  required
                  placeholder="姓名 / 暱稱"
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  type="tel"
                  required
                  placeholder="手機號碼 (例如: 0912345678)"
                  pattern="[0-9]{10}"
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl"
                  >
                    返回
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-md disabled:bg-gray-400"
                  >
                    {isSubmitting ? "處理中..." : "確認送出"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    預估費用 <span className="font-bold text-gray-800">{totalHours}</span> 小時
                  </p>
                  <p className="text-2xl font-black text-emerald-600">${displayTotalPrice}</p>
                </div>
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-gray-900 text-white px-8 py-3.5 rounded-xl font-bold shadow-md hover:bg-black transition-colors active:scale-95"
                >
                  下一步
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 預約成功付款 Modal */}
      {bookingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-in fade-in overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 my-auto">
            <div className="p-5 text-center bg-emerald-600">
              <CheckCircle2 size={48} className="mx-auto text-white mb-2" />
              <h2 className="text-xl font-bold text-white">預約成功！</h2>
              <p className="text-white/90 text-sm mt-1">{bookingResult.courtName}</p>
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
                <div className="space-y-3">
                  <div className="bg-gray-100 rounded-xl aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 p-4 mb-2">
                    <QrCode size={48} className="text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 font-bold">請於此處放置館方的</p>
                    <p className="text-sm text-gray-500 font-bold">LINE Pay / TWQR 條碼圖</p>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-sm text-emerald-800 text-center mb-2">
                    應繳金額：
                    <span className="font-bold text-lg text-emerald-600">${bookingResult.totalPrice}</span>
                  </div>

                  <button
                    onClick={handleCopyText}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition"
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