"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
    Bell,
    MessageCircle,
    Phone,
    QrCode,
    Landmark,
    ChevronRight,
    CheckCircle2,
} from "lucide-react";

export default function ProfilePage() {
    const [lineNickname, setLineNickname] = useState("Pickle 玩家");
    const [phone, setPhone] = useState("");
    const [paymentLink, setPaymentLink] = useState("");
    const [bankAccount, setBankAccount] = useState("");

    const [editingField, setEditingField] = useState<
        "line" | "phone" | "qr" | "bank" | null
    >(null);
    const [tempValue, setTempValue] = useState("");

    // 歷史紀錄切換：開團紀錄｜報名紀錄
    const [historyTab, setHistoryTab] = useState<"hosted" | "joined">("hosted");
    const [sessions, setSessions] = useState<any[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem("picklego_user_profile");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.lineNickname) setLineNickname(parsed.lineNickname);
                if (parsed.phone) setPhone(parsed.phone);
                if (parsed.paymentLink) setPaymentLink(parsed.paymentLink);
                if (parsed.bankAccount) setBankAccount(parsed.bankAccount);
            }
        } catch (e) {
            console.error(e);
        }

        const fetchHistory = async () => {
            const { data } = await supabase
                .from("open_play_sessions")
                .select("*, courts(name), open_play_players(*)")
                .order("session_date", { ascending: false })
                .limit(10);
            if (data) setSessions(data);
        };
        fetchHistory();
    }, []);

    const saveProfileField = async () => {
        const nextProfile = {
            lineNickname: editingField === "line" ? tempValue.trim() : lineNickname,
            phone: editingField === "phone" ? tempValue.trim() : phone,
            paymentLink: editingField === "qr" ? tempValue.trim() : paymentLink,
            bankAccount: editingField === "bank" ? tempValue.trim() : bankAccount,
        };

        if (editingField === "line" && !nextProfile.lineNickname) {
            return alert("LINE 暱稱為必填！");
        }
        if (editingField === "phone" && !nextProfile.phone) {
            return alert("手機號碼為必填！");
        }

        setLineNickname(nextProfile.lineNickname);
        setPhone(nextProfile.phone);
        setPaymentLink(nextProfile.paymentLink);
        setBankAccount(nextProfile.bankAccount);

        localStorage.setItem("picklego_user_profile", JSON.stringify(nextProfile));

        // 若 users 表中有對應手機號碼的資料，同步更新至資料庫（最小修改、不破壞既有結構）
        if (nextProfile.phone) {
            await supabase
                .from("users")
                .update({
                    name: nextProfile.lineNickname,
                    line_nickname: nextProfile.lineNickname,
                    payment_link: nextProfile.paymentLink || null,
                    bank_account: nextProfile.bankAccount || null,
                })
                .eq("phone", nextProfile.phone);
        }

        setEditingField(null);
    };

    const formatDateWithDay = (dateStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const days = ["日", "一", "二", "三", "四", "五", "六"];
        return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
    };

    return (
        <div className="w-full min-h-full bg-[#F8F9FA] pb-16">
            {/* 頂部標題區 */}
            <div className="bg-white px-4 pt-3 pb-3 sticky top-0 z-30 border-b border-gray-100">
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

                <h1 className="text-xl font-extrabold text-gray-900">我的</h1>
            </div>

            <div className="p-4 space-y-5">
                {/* 個人資料與預設收款設定卡片 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-2xs divide-y divide-gray-100 overflow-hidden">
                    <button
                        onClick={() => {
                            setEditingField("line");
                            setTempValue(lineNickname);
                        }}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#06C755] text-white flex items-center justify-center shrink-0">
                                <MessageCircle size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">
                                    LINE 暱稱 <span className="text-red-500">*</span>
                                </p>
                                <p className="text-xs text-gray-600 truncate mt-0.5">
                                    {lineNickname || "點擊設定"}
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>

                    <button
                        onClick={() => {
                            setEditingField("phone");
                            setTempValue(phone);
                        }}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                                <Phone size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">
                                    手機號碼 <span className="text-red-500">*</span>
                                </p>
                                <p className="text-xs text-gray-600 truncate mt-0.5">
                                    {phone || "點擊設定手機號碼"}
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>

                    <button
                        onClick={() => {
                            setEditingField("qr");
                            setTempValue(paymentLink);
                        }}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                                <QrCode size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">付款碼連結 (選填)</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                    {paymentLink || "可貼上 LINE Pay、街口收款連結"}
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>

                    <button
                        onClick={() => {
                            setEditingField("bank");
                            setTempValue(bankAccount);
                        }}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                                <Landmark size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">銀行帳戶 (選填)</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                    {bankAccount || "(未設定)"}
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>
                </div>

                {/* 歷史紀錄：開團紀錄｜報名紀錄 */}
                <div className="space-y-3">
                    <h2 className="text-base font-extrabold text-gray-900">歷史紀錄</h2>

                    <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-2 gap-1">
                        <button
                            onClick={() => setHistoryTab("hosted")}
                            className={`py-2 rounded-lg text-xs font-extrabold transition-all ${historyTab === "hosted"
                                    ? "bg-green-700 text-white shadow-2xs"
                                    : "text-gray-600"
                                }`}
                        >
                            開團紀錄
                        </button>
                        <button
                            onClick={() => setHistoryTab("joined")}
                            className={`py-2 rounded-lg text-xs font-extrabold transition-all ${historyTab === "joined"
                                    ? "bg-green-700 text-white shadow-2xs"
                                    : "text-gray-600"
                                }`}
                        >
                            報名紀錄
                        </button>
                    </div>

                    <div className="space-y-2.5">
                        {sessions.map((s) => {
                            const regCount =
                                s.open_play_players?.filter((p: any) => p.status === "registered")
                                    .length || 0;
                            const isCompleted = regCount >= s.max_players;
                            return (
                                <div
                                    key={s.id}
                                    className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="mt-1 shrink-0">
                                            {isCompleted ? (
                                                <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center">
                                                    <CheckCircle2 size={15} strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
                                                    <div className="w-2 h-2 rounded-full bg-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-extrabold text-sm text-gray-900">
                                                {formatDateWithDay(s.session_date)}{" "}
                                                {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                                            </p>
                                            <p className="text-xs text-gray-600 mt-0.5">
                                                {s.title} | {s.courts?.name || "場地 1"}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {regCount} / {s.max_players} 人 |{" "}
                                                <span
                                                    className={
                                                        isCompleted
                                                            ? "text-green-700 font-bold"
                                                            : "text-gray-500"
                                                    }
                                                >
                                                    {historyTab === "hosted"
                                                        ? isCompleted
                                                            ? "開團完成"
                                                            : "已結束"
                                                        : "已參加"}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-400 shrink-0" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 編輯欄位 Modal */}
            {editingField && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3 shadow-2xl">
                        <h3 className="font-extrabold text-base text-gray-900">
                            {editingField === "line" && "設定 LINE 暱稱"}
                            {editingField === "phone" && "設定手機號碼"}
                            {editingField === "qr" && "設定付款碼連結 (選填)"}
                            {editingField === "bank" && "設定銀行帳戶 (選填)"}
                        </h3>
                        <input
                            type="text"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            placeholder={
                                editingField === "bank"
                                    ? "例：822 中國信託 123456789012"
                                    : "請輸入內容"
                            }
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setEditingField(null)}
                                className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs"
                            >
                                取消
                            </button>
                            <button
                                onClick={saveProfileField}
                                className="flex-[2] bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs"
                            >
                                儲存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}