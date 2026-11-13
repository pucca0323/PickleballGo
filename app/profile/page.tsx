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
    Link as LinkIcon,
    Download,
} from "lucide-react";

export default function ProfilePage() {
    // 個人資料狀態
    const [lineNickname, setLineNickname] = useState("Pickle 玩家");
    const [phone, setPhone] = useState("");
    const [paymentLink, setPaymentLink] = useState("");
    const [bankAccount, setBankAccount] = useState("");
    const [socialLink, setSocialLink] = useState(""); // 新增社群連結狀態

    // Modal 狀態
    const [editingField, setEditingField] = useState<
        "line" | "phone" | "qr" | "bank" | "social" | null
    >(null);
    const [tempValue, setTempValue] = useState("");

    // 歷史紀錄切換
    const [historyTab, setHistoryTab] = useState<"hosted" | "joined">("hosted");
    const [sessions, setSessions] = useState<any[]>([]);
    const [myJoinedSessions, setMyJoinedSessions] = useState<any[]>([]);

    // 匯出 CSV 狀態
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState<"hosted" | "joined">("hosted");
    const [exportStartDate, setExportStartDate] = useState("");
    const [exportEndDate, setExportEndDate] = useState("");
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem("picklego_user_profile");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.lineNickname) setLineNickname(parsed.lineNickname);
                if (parsed.phone) setPhone(parsed.phone);
                if (parsed.paymentLink) setPaymentLink(parsed.paymentLink);
                if (parsed.bankAccount) setBankAccount(parsed.bankAccount);
                if (parsed.socialLink) setSocialLink(parsed.socialLink);
            }
        } catch (e) {
            console.error(e);
        }

        const fetchHistory = async () => {
            const { data } = await supabase
                .from("open_play_sessions")
                .select("*, courts(name), open_play_players(*)")
                .order("session_date", { ascending: false });

            if (data) {
                // 為了展示方便，這裡在前端區分。實際環境若資料大，應透過 API 篩選。
                // 目前先簡易抓取。
                const hosted = data.slice(0, 15); // 暫時抓前 15 筆作展示
                setSessions(hosted);

                // 取得自己報名的場次 (透過比對手機或暱稱，與其他頁面邏輯一致)
                const savedProfile = localStorage.getItem("picklego_user_profile");
                let myPhone = "";
                let myLine = "";
                if (savedProfile) {
                    const p = JSON.parse(savedProfile);
                    myPhone = p.phone;
                    myLine = p.lineNickname;
                }

                const joined = data.filter(s => {
                    if (!s.open_play_players) return false;
                    return s.open_play_players.some((player: any) =>
                        (myPhone && player.phone === myPhone) ||
                        (myLine && player.line_nickname === myLine)
                    );
                });
                setMyJoinedSessions(joined);
            }
        };
        fetchHistory();

        // 預設匯出時間為最近 30 天
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        setExportEndDate(today.toISOString().split("T")[0]);
        setExportStartDate(thirtyDaysAgo.toISOString().split("T")[0]);

    }, []);

    const saveProfileField = async () => {
        const nextProfile = {
            lineNickname: editingField === "line" ? tempValue.trim() : lineNickname,
            phone: editingField === "phone" ? tempValue.trim() : phone,
            paymentLink: editingField === "qr" ? tempValue.trim() : paymentLink,
            bankAccount: editingField === "bank" ? tempValue.trim() : bankAccount,
            socialLink: editingField === "social" ? tempValue.trim() : socialLink,
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
        setSocialLink(nextProfile.socialLink);

        localStorage.setItem("picklego_user_profile", JSON.stringify(nextProfile));

        if (nextProfile.phone) {
            await supabase
                .from("users")
                .update({
                    name: nextProfile.lineNickname,
                    line_nickname: nextProfile.lineNickname,
                    payment_link: nextProfile.paymentLink || null,
                    bank_account: nextProfile.bankAccount || null,
                    // social_link 欄位若資料庫未建，此處先不更新，仰賴 localStorage 記憶
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

    // 生成民國年月日 (如 1151117)
    const getROCDateString = (dateStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const rocYear = d.getFullYear() - 1911;
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${rocYear}${month}${day}`;
    };

    const formatDateTime = (isoStr: string) => {
        if (!isoStr) return "";
        const d = new Date(isoStr);
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    // 匯出 CSV 邏輯
    const handleExportCSV = async () => {
        setIsExporting(true);
        try {
            // 1. 決定資料來源
            const sourceData = exportType === "hosted" ? sessions : myJoinedSessions;

            // 2. 依日期區間過濾
            const start = new Date(exportStartDate).getTime();
            const end = new Date(exportEndDate).getTime() + 86399000; // 包含結束日當天
            const filteredSessions = sourceData.filter(s => {
                const sessionTime = new Date(s.session_date).getTime();
                return sessionTime >= start && sessionTime <= end;
            });

            if (filteredSessions.length === 0) {
                alert("所選區間內沒有資料可匯出！");
                setIsExporting(false);
                return;
            }

            // 3. 準備 CSV 標頭
            let csvContent = "";
            if (exportType === "hosted") {
                // 開團報表：需展開所有報名者以利對帳
                csvContent += "活動日期,活動時間,場地,活動費用,報名狀態,球友暱稱,球友手機,付款方式,系統對帳碼,球友回報時間\n";

                filteredSessions.forEach(session => {
                    const rocDate = getROCDateString(session.session_date);
                    const players = session.open_play_players || [];

                    if (players.length === 0) {
                        csvContent += `${session.session_date},${session.start_time?.slice(0, 5)},${session.courts?.name || session.title},${session.price || 0},無人報名,---,---,---,---,---\n`;
                    } else {
                        players.forEach((p: any) => {
                            // 產生系統對帳碼
                            let reconcileCode = "---";
                            if (p.payment_method === "bank" && p.payment_account_last5) {
                                reconcileCode = `${rocDate}-${p.payment_account_last5}`;
                            } else if (p.payment_method === "line") {
                                const phoneSuffix = p.phone ? p.phone.slice(-3) : "000";
                                reconcileCode = `${rocDate}-${phoneSuffix}`;
                            } else if (p.payment_method === "cash") {
                                reconcileCode = `${rocDate}-現場`;
                            }

                            const reportTime = p.payment_report_time ? formatDateTime(p.payment_report_time) : "尚未回報";
                            const statusName = p.status === 'registered' ? '正取' : p.status === 'waitlisted' ? '候補' : '取消';

                            // 處理逗號，避免破壞 CSV 格式
                            const safeName = (p.display_name || p.line_nickname || "球友").replace(/,/g, "，");
                            const safeCourt = (session.courts?.name || session.title || "場地").replace(/,/g, "，");

                            csvContent += `${session.session_date},${session.start_time?.slice(0, 5)},${safeCourt},${session.price || 0},${statusName},${safeName},${p.phone || "---"},${p.payment_method || "---"},${reconcileCode},${reportTime}\n`;
                        });
                    }
                });
            } else {
                // 報名報表：僅需列出自己參加的場次清單
                csvContent += "活動日期,活動時間,場地,活動費用,我的報名狀態\n";
                filteredSessions.forEach(session => {
                    const safeCourt = (session.courts?.name || session.title || "場地").replace(/,/g, "，");
                    // 找自己的狀態
                    const myRecord = (session.open_play_players || []).find((p: any) => p.phone === phone || p.line_nickname === lineNickname);
                    const statusName = myRecord ? (myRecord.status === 'registered' ? '已報名' : myRecord.status === 'waitlisted' ? '候補中' : '已取消') : '未知';

                    csvContent += `${session.session_date},${session.start_time?.slice(0, 5)},${safeCourt},${session.price || 0},${statusName}\n`;
                });
            }

            // 4. 觸發下載 (加入 BOM 以支援 Excel 中文)
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `PickleGo_${exportType === 'hosted' ? '開團對帳' : '報名紀錄'}_${exportStartDate}_${exportEndDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setShowExportModal(false);
        } catch (err) {
            console.error(err);
            alert("匯出失敗，請稍後再試！");
        } finally {
            setIsExporting(false);
        }
    };

    const currentDisplaySessions = historyTab === "hosted" ? sessions : myJoinedSessions;

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

                    <button onClick={() => { setEditingField("line"); setTempValue(lineNickname); }} className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#06C755] text-white flex items-center justify-center shrink-0">
                                <MessageCircle size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">LINE 暱稱 <span className="text-red-500">*</span></p>
                                <p className="text-xs text-gray-600 truncate mt-0.5">{lineNickname || "點擊設定"}</p>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>

                    <button onClick={() => { setEditingField("phone"); setTempValue(phone); }} className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                                <Phone size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">手機號碼 <span className="text-red-500">*</span></p>
                                <p className="text-xs text-gray-600 truncate mt-0.5">{phone || "點擊設定手機號碼"}</p>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>

                    {/* 新增：社群連結 */}
                    <button onClick={() => { setEditingField("social"); setTempValue(socialLink); }} className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                                <LinkIcon size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">社群連結 (選填)</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{socialLink || "可貼上 IG、FB 或個人網站連結"}</p>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>

                    {/* 更新：付款碼輔助說明 */}
                    <button onClick={() => { setEditingField("qr"); setTempValue(paymentLink); }} className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                                <QrCode size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">付款碼連結 (選填)</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{paymentLink || "TWQR收款碼例如街口、全支付、悠遊付、台灣PAY"}</p>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>

                    <button onClick={() => { setEditingField("bank"); setTempValue(bankAccount); }} className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                                <Landmark size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">銀行帳戶 (選填)</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{bankAccount || "(未設定)"}</p>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>
                </div>

                {/* 歷史紀錄與匯出報表 */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-extrabold text-gray-900">歷史紀錄</h2>
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-full hover:bg-green-100 transition"
                        >
                            <Download size={14} /> 匯出報表
                        </button>
                    </div>

                    <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-2 gap-1">
                        <button onClick={() => setHistoryTab("hosted")} className={`py-2 rounded-lg text-xs font-extrabold transition-all ${historyTab === "hosted" ? "bg-green-700 text-white shadow-2xs" : "text-gray-600"}`}>
                            開團紀錄
                        </button>
                        <button onClick={() => setHistoryTab("joined")} className={`py-2 rounded-lg text-xs font-extrabold transition-all ${historyTab === "joined" ? "bg-green-700 text-white shadow-2xs" : "text-gray-600"}`}>
                            報名紀錄
                        </button>
                    </div>

                    <div className="space-y-2.5">
                        {currentDisplaySessions.length === 0 ? (
                            <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-xs border border-gray-100">
                                目前尚無紀錄
                            </div>
                        ) : (
                            currentDisplaySessions.map((s) => {
                                const regCount = s.open_play_players?.filter((p: any) => p.status === "registered").length || 0;
                                const isCompleted = regCount >= s.max_players;
                                return (
                                    <div key={s.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs flex items-center justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="mt-1 shrink-0">
                                                {isCompleted ? (
                                                    <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center"><CheckCircle2 size={15} strokeWidth={3} /></div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-extrabold text-sm text-gray-900">{formatDateWithDay(s.session_date)} {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</p>
                                                <p className="text-xs text-gray-600 mt-0.5">{s.title} | {s.courts?.name || "場地 1"}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {regCount} / {s.max_players} 人 | <span className={isCompleted ? "text-green-700 font-bold" : "text-gray-500"}>{historyTab === "hosted" ? (isCompleted ? "開團完成" : "已結束") : "已參加"}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* 編輯個人資料 Modal */}
            {editingField && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3 shadow-2xl">
                        <h3 className="font-extrabold text-base text-gray-900">
                            {editingField === "line" && "設定 LINE 暱稱"}
                            {editingField === "phone" && "設定手機號碼"}
                            {editingField === "qr" && "設定付款碼連結"}
                            {editingField === "bank" && "設定銀行帳戶"}
                            {editingField === "social" && "設定社群連結"}
                        </h3>
                        {editingField === "qr" && (
                            <p className="text-xs text-gray-500 -mt-1 mb-2">可貼上街口、全支付、悠遊付、台灣PAY 等 TWQR 通用收款連結。</p>
                        )}
                        <input
                            type="text"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            placeholder={editingField === "bank" ? "例：822 中國信託 123456789012" : "請輸入內容"}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
                        />
                        <div className="flex gap-2 pt-1">
                            <button onClick={() => setEditingField(null)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs">取消</button>
                            <button onClick={saveProfileField} className="flex-[2] bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs">儲存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 匯出報表 Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
                        <h3 className="font-extrabold text-lg text-gray-900 flex items-center gap-1.5">
                            <Download size={20} className="text-green-700" /> 匯出資料報表 (CSV)
                        </h3>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-gray-700 block mb-1">1. 報表類型</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setExportType("hosted")} className={`py-2 rounded-xl font-bold border transition ${exportType === "hosted" ? "bg-green-700 text-white border-green-700" : "bg-gray-50 text-gray-600 border-gray-200"}`}>開團對帳報表</button>
                                    <button onClick={() => setExportType("joined")} className={`py-2 rounded-xl font-bold border transition ${exportType === "joined" ? "bg-green-700 text-white border-green-700" : "bg-gray-50 text-gray-600 border-gray-200"}`}>個人報名紀錄</button>
                                </div>
                                {exportType === "hosted" && (
                                    <p className="text-gray-500 mt-1.5">💡 開團報表會自動產生對帳碼與回報時間，方便您使用 Excel 快速對帳。</p>
                                )}
                            </div>

                            <div>
                                <label className="font-bold text-gray-700 block mb-1">2. 時間區間 (活動日期)</label>
                                <div className="flex items-center gap-2">
                                    <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900" />
                                    <span className="text-gray-400 font-bold">至</span>
                                    <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900" />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setShowExportModal(false)} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl text-xs">取消</button>
                            <button onClick={handleExportCSV} disabled={isExporting} className="flex-[2] bg-green-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                                {isExporting ? "產生中..." : "下載 CSV"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}