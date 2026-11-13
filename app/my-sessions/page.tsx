"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
    Plus,
    RotateCcw,
    CheckCircle2,
    XCircle,
    ChevronLeft,
    Check,
    Edit3,
    Trash2,
    MapPin,
    Share,
    Undo2,
    Users,
    Lock,
} from "lucide-react";

const TAIWAN_CITIES: Record<string, string[]> = {
    台北市: ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"],
    新北市: ["板橋區", "新莊區", "中和區", "永和區", "土城區", "樹林區", "三峽區", "鶯歌區", "三重區", "蘆洲區", "五股區", "泰山區", "林口區", "淡水區", "汐止區", "新店區"],
    桃園市: ["桃園區", "中壢區", "大溪區", "楊梅區", "蘆竹區", "大園區", "龜山區", "八德區", "龍潭區", "平鎮區"],
    台中市: ["中區", "東區", "南區", "西區", "北區", "北屯區", "西屯區", "南屯區", "太平區", "大里區", "霧峰區", "烏日區", "豐原區", "沙鹿區", "龍井區", "清水區", "大甲區"],
    台南市: ["中西區", "東區", "南區", "北區", "安平區", "安南區", "永康區", "歸仁區", "新營區", "仁德區"],
    高雄市: ["楠梓區", "左營區", "鼓山區", "三民區", "苓雅區", "前鎮區", "小港區", "鳳山區", "大寮區", "岡山區"],
    基隆市: ["仁愛區", "信義區", "中正區", "中山區", "安樂區", "暖暖區", "七堵區"],
    新竹市: ["東區", "北區", "香山區"],
    新竹縣: ["竹北市", "竹東鎮", "新豐鄉", "湖口鄉"],
    彰化縣: ["彰化市", "員林市", "鹿港鎮", "和美鎮"],
    其他: ["苗栗縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣", "台東縣", "澎湖縣", "金門縣", "連江縣"],
};

export default function MySessionsPage() {
    const [activeTab, setActiveTab] = useState<"hosting" | "joined">("hosting");
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState({
        phone: "",
        lineNickname: "",
        paymentLink: "",
        bankAccount: "",
    });
    const [hostedIds, setHostedIds] = useState<string[]>([]);
    const [joinedMap, setJoinedMap] = useState<Record<string, string>>({});
    const [sessions, setSessions] = useState<any[]>([]);
    const [managingSessionId, setManagingSessionId] = useState<string | null>(null);
    const [isEditingSession, setIsEditingSession] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ==================== 開團表單狀態 ====================
    const [formCity, setFormCity] = useState("台中市");
    const [formDistrict, setFormDistrict] = useState("龍井區");
    const [formLocation, setFormLocation] = useState("");
    const [formAddress, setFormAddress] = useState("");
    const [formCourtName, setFormCourtName] = useState("1號場地");
    const [formDate, setFormDate] = useState("");
    const [formStartTime, setFormStartTime] = useState("19:00");
    const [formEndTime, setFormEndTime] = useState("21:00");
    const [formLevel, setFormLevel] = useState("不限");
    const [formMaxPlayers, setFormMaxPlayers] = useState(16);
    const [formWaitlist, setFormWaitlist] = useState(2);
    const [formPrice, setFormPrice] = useState(150);

    // 取消限制狀態：'unlimited' (不限: -1) | 'no_cancel' (不可取消: 0) | 'custom' (自訂小時: >0)
    const [cancelLimitMode, setCancelLimitMode] = useState<"unlimited" | "no_cancel" | "custom">("custom");
    const [customCancelHours, setCustomCancelHours] = useState<number>(24);

    // 備註與收款資訊
    const [formNotes, setFormNotes] = useState("");
    const [formBankAccount, setFormBankAccount] = useState("");
    const [formPaymentLink, setFormPaymentLink] = useState("");

    // ==================== 球友補付款 / 回報 Modal 狀態 ====================
    const [payingRecord, setPayingRecord] = useState<any | null>(null);
    const [payMethod, setPayMethod] = useState<"bank" | "line" | "cash">("bank");
    const [payLast5, setPayLast5] = useState("");

    useEffect(() => {
        try {
            const savedProfile = localStorage.getItem("picklego_user_profile");
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                setUserProfile({
                    phone: parsed.phone || "",
                    lineNickname: parsed.lineNickname || "",
                    paymentLink: parsed.paymentLink || "",
                    bankAccount: parsed.bankAccount || "",
                });
                setFormBankAccount(parsed.bankAccount || "");
                setFormPaymentLink(parsed.paymentLink || "");
            }
            const savedHosted = localStorage.getItem("picklego_hosted_sessions");
            if (savedHosted) setHostedIds(JSON.parse(savedHosted));
            const savedJoined = localStorage.getItem("picklego_joined_sessions");
            if (savedJoined) setJoinedMap(JSON.parse(savedJoined));
        } catch (e) { }

        const tomorrow = new Date(Date.now() + 86400000);
        const y = tomorrow.getFullYear();
        const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
        const d = String(tomorrow.getDate()).padStart(2, "0");
        setFormDate(`${y}-${m}-${d}`);
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("open_play_sessions")
            .select("*, courts(name), open_play_players(*)")
            .order("session_date", { ascending: true })
            .order("start_time", { ascending: true });

        if (error) {
            const { data: fallback } = await supabase
                .from("open_play_sessions")
                .select("*, open_play_players(*)")
                .order("session_date", { ascending: true })
                .order("start_time", { ascending: true });
            if (fallback) setSessions(fallback);
        } else if (data) {
            setSessions(data);
        }
        setLoading(false);
    };

    const formatDateWithDay = (dateStr: string) => {
        if (!dateStr) return "";
        const [y, m, d] = dateStr.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        const days = ["日", "一", "二", "三", "四", "五", "六"];
        return `${m}/${d} (${days[dateObj.getDay()]})`;
    };

    const formatDateTime = (iso: string) => {
        if (!iso) return "";
        const d = new Date(iso);
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    const getCourtLabel = (session: any) => {
        if (session.court_name) return session.court_name;
        if (session.courts?.name) return session.courts.name;
        return "1號場地";
    };

    const getCancelLimitDisplay = (session: any) => {
        const hrs = session.cancel_limit_hours;
        if (hrs === 0) return "報名後不可取消";
        if (hrs !== null && hrs !== undefined && hrs > 0) return `開打前 ${hrs} 小時不可取消`;
        return "不限 (隨時可取消)";
    };

    const parseSessionPaymentInfo = (session: any) => {
        try {
            if (session.payment_info) return JSON.parse(session.payment_info);
        } catch (e) { }
        return { bank: "", link: "" };
    };

    // 套用上一次開團範本
    const handleApplyLastSession = () => {
        try {
            const savedLast = localStorage.getItem("picklego_last_session_template");
            if (savedLast) {
                const t = JSON.parse(savedLast);
                setFormCity(t.city || "台中市");
                setFormDistrict(t.district || "龍井區");
                setFormLocation(t.location || "");
                setFormAddress(t.address || "");
                setFormCourtName(t.courtName || "1號場地");
                setFormStartTime(t.startTime || "19:00");
                setFormEndTime(t.endTime || "21:00");
                setFormLevel(t.level || "不限");
                setFormMaxPlayers(t.maxPlayers || 16);
                setFormWaitlist(t.waitlist || 2);
                setFormPrice(t.price ?? 150);
                setCancelLimitMode(t.cancelLimitMode || "custom");
                setCustomCancelHours(t.customCancelHours || 24);
                setFormNotes(t.notes || "");
                setFormBankAccount(t.bankAccount || userProfile.bankAccount || "");
                setFormPaymentLink(t.paymentLink || userProfile.paymentLink || "");
                setIsEditingSession(false);
                setShowCreateModal(true);
                return;
            }
        } catch (e) { }
        alert("尚無上一次的開團紀錄可套用，請直接填寫！");
        setIsEditingSession(false);
        setShowCreateModal(true);
    };

    // 儲存或修改開團
    const handleSaveSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formLocation.trim() || !formDate || !formCity || !formDistrict) {
            return alert("請完整填寫地點與日期！");
        }
        if (!formCourtName.trim()) {
            return alert("請填寫第幾號場地（例如：1號場地、A場）！");
        }
        if (cancelLimitMode === "custom" && (!customCancelHours || customCancelHours < 1)) {
            return alert("請輸入有效的取消限制小時數（至少 1 小時）！");
        }

        setIsSubmitting(true);
        try {
            const finalCancelHours =
                cancelLimitMode === "unlimited"
                    ? -1
                    : cancelLimitMode === "no_cancel"
                        ? 0
                        : Number(customCancelHours);

            const paymentInfoJson = JSON.stringify({
                bank: formBankAccount.trim(),
                link: formPaymentLink.trim(),
            });

            const payload: any = {
                title: formLocation.trim(),
                city: formCity,
                district: formDistrict,
                address: formAddress.trim() || null,
                court_name: formCourtName.trim(),
                host_phone: userProfile.phone || null,
                host_name: userProfile.lineNickname || null,
                session_date: formDate,
                start_time: `${formStartTime.slice(0, 5)}:00`,
                end_time: `${formEndTime.slice(0, 5)}:00`,
                level: formLevel,
                price: Number(formPrice),
                max_players: Number(formMaxPlayers),
                max_waitlist: Number(formWaitlist),
                cancel_limit_hours: finalCancelHours,
                notes: formNotes.trim() || null,
                payment_info: paymentInfoJson,
                status: "open",
            };

            if (isEditingSession && managingSessionId) {
                const { error } = await supabase
                    .from("open_play_sessions")
                    .update(payload)
                    .eq("id", managingSessionId);
                if (error) throw error;
                alert("✅ 開團內容已成功更新！");
                setIsEditingSession(false);
            } else {
                const { data, error } = await supabase
                    .from("open_play_sessions")
                    .insert([payload])
                    .select()
                    .single();
                if (error) throw error;
                if (data?.id) {
                    const nextHosted = Array.from(new Set([data.id, ...hostedIds]));
                    setHostedIds(nextHosted);
                    localStorage.setItem("picklego_hosted_sessions", JSON.stringify(nextHosted));
                }
                localStorage.setItem(
                    "picklego_last_session_template",
                    JSON.stringify({
                        city: formCity,
                        district: formDistrict,
                        location: formLocation.trim(),
                        address: formAddress.trim(),
                        courtName: formCourtName.trim(),
                        startTime: formStartTime,
                        endTime: formEndTime,
                        level: formLevel,
                        maxPlayers: Number(formMaxPlayers),
                        waitlist: Number(formWaitlist),
                        price: Number(formPrice),
                        cancelLimitMode,
                        customCancelHours: Number(customCancelHours),
                        notes: formNotes.trim(),
                        bankAccount: formBankAccount.trim(),
                        paymentLink: formPaymentLink.trim(),
                    })
                );
                alert("✅ 臨打活動已成功發布！");
            }
            setShowCreateModal(false);
            await fetchAllData();
        } catch (err: any) {
            alert("儲存失敗：" + (err.message || "請確認已執行第一步的 Supabase SQL 擴充指令"));
        } finally {
            setIsSubmitting(false);
        }
    };

    // 主辦人核帳
    const handleConfirmPayment = async (player: any) => {
        try {
            await supabase
                .from("open_play_players")
                .update({ payment_status: "paid", admin_confirm_time: new Date().toISOString() })
                .eq("id", player.id);
            fetchAllData();
        } catch (err: any) {
            alert("核帳失敗：" + err.message);
        }
    };

    // 主辦人復原核帳
    const handleUndoPayment = async (player: any) => {
        if (!confirm(`確定要將「${player.display_name || player.line_nickname}」退回待核帳狀態嗎？`)) return;
        try {
            await supabase
                .from("open_play_players")
                .update({ payment_status: "reported", admin_confirm_time: null })
                .eq("id", player.id);
            fetchAllData();
        } catch (err: any) {
            alert("復原失敗：" + err.message);
        }
    };

    // 取消報名（主辦人強制取消 或 球友在時限內自行取消）
    const handleCancelPlayer = async (player: any, session: any, isSelfCancel = false) => {
        const confirmMsg = isSelfCancel
            ? `確定要取消您在「${session.title}」的報名嗎？`
            : `確定要取消球友「${player.display_name || player.line_nickname}」的報名嗎？`;
        if (!confirm(confirmMsg)) return;

        try {
            await supabase
                .from("open_play_players")
                .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
                .eq("id", player.id);

            // 若原本是正取，自動將候補第一順位遞補為正取
            if (player.status === "registered") {
                const waitlisted = (session.open_play_players || [])
                    .filter((p: any) => p.status === "waitlisted")
                    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                if (waitlisted.length > 0) {
                    await supabase
                        .from("open_play_players")
                        .update({ status: "registered", promoted_at: new Date().toISOString() })
                        .eq("id", waitlisted[0].id);
                }
            }
            if (isSelfCancel) alert("已取消您的報名。");
            fetchAllData();
        } catch (err: any) {
            alert("取消失敗：" + err.message);
        }
    };

    // 球友在「報名資訊」中補付款 / 回報
    const handlePlayerReportPayment = async () => {
        if (!payingRecord) return;
        if (payMethod === "bank" && !/^[0-9]{5}$/.test(payLast5.trim())) {
            return alert("銀行轉帳請輸入完整的 5 碼轉出帳號末五碼！");
        }
        setIsSubmitting(true);
        try {
            const finalLast5 =
                payMethod === "line" ? "TWQR" : payMethod === "cash" ? "現場付款" : payLast5.trim();

            const { error } = await supabase
                .from("open_play_players")
                .update({
                    payment_method: payMethod,
                    payment_account_last5: finalLast5,
                    payment_status: "reported",
                    payment_report_time: new Date().toISOString(),
                })
                .eq("id", payingRecord.player.id);

            if (error) throw error;
            alert("✅ 付款方式已回報成功！等待主辦人核帳。");
            setPayingRecord(null);
            setPayLast5("");
            fetchAllData();
        } catch (err: any) {
            alert("回報失敗：" + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleShare = (e: React.MouseEvent, session: any) => {
        e.stopPropagation();
        const url = `${window.location.origin}/?session=${session.id}`;
        const courtText = getCourtLabel(session);
        const locStr = `${session.city || ""}${session.district || ""} ${session.address || ""} ${session.title} (${courtText})`.trim();
        const limitStr = getCancelLimitDisplay(session);
        const noteStr = session.notes ? `\n【備註】${session.notes}` : "";
        const text = `🎾 PickleGo 臨打邀請\n【時間】${formatDateWithDay(session.session_date)} ${session.start_time?.slice(0, 5)}-${session.end_time?.slice(0, 5)}\n【地點】${locStr}\n【程度】${session.level || "不限"}\n【費用】$${session.price || 0} / 人\n【取消規範】${limitStr}${noteStr}\n👇 點擊連結快速報名：\n${url}`;
        navigator.clipboard.writeText(text);
        alert("✅ 報名資訊與專屬網址已複製！");
    };

    const myHostedSessions = sessions.filter((s) => {
        if (userProfile.phone && s.host_phone === userProfile.phone) return true;
        if (hostedIds.includes(s.id)) return true;
        if (!userProfile.phone && hostedIds.length === 0) return s.status === "open";
        return false;
    });

    const myJoinedEntries = sessions
        .map((session) => {
            const myRecord = (session.open_play_players || []).find(
                (p: any) =>
                    (userProfile.phone && p.phone === userProfile.phone) ||
                    (userProfile.lineNickname &&
                        (p.line_nickname === userProfile.lineNickname ||
                            p.display_name === userProfile.lineNickname)) ||
                    joinedMap[session.id]
            );
            return myRecord ? { session, player: myRecord } : null;
        })
        .filter(Boolean) as { session: any; player: any }[];

    const managingSession = sessions.find((s) => s.id === managingSessionId);

    // 點擊「修改內容」時載入該場次完整設定
    const openEditModal = (targetSession: any) => {
        setFormCity(targetSession.city || "台中市");
        setFormDistrict(targetSession.district || "龍井區");
        setFormLocation(targetSession.title || "");
        setFormAddress(targetSession.address || "");
        setFormCourtName(getCourtLabel(targetSession));
        setFormDate(targetSession.session_date);
        setFormStartTime(targetSession.start_time?.slice(0, 5) || "19:00");
        setFormEndTime(targetSession.end_time?.slice(0, 5) || "21:00");
        setFormMaxPlayers(targetSession.max_players || 16);
        setFormPrice(targetSession.price ?? 150);
        setFormLevel(targetSession.level || "不限");
        setFormWaitlist(targetSession.max_waitlist || 2);

        const hrs = targetSession.cancel_limit_hours;
        if (hrs === 0) {
            setCancelLimitMode("no_cancel");
        } else if (hrs !== null && hrs !== undefined && hrs > 0) {
            setCancelLimitMode("custom");
            setCustomCancelHours(hrs);
        } else {
            setCancelLimitMode("unlimited");
        }

        setFormNotes(targetSession.notes || "");
        const payInfo = parseSessionPaymentInfo(targetSession);
        setFormBankAccount(payInfo.bank || userProfile.bankAccount || "");
        setFormPaymentLink(payInfo.link || userProfile.paymentLink || "");

        setIsEditingSession(true);
        setShowCreateModal(true);
    };

    return (
        <div className="w-full min-h-full bg-[#F8F9FA] pb-16">
            {managingSession ? (
                // ==================== 單一場次管理視圖 (主辦視角) ====================
                (() => {
                    const allPlayers = managingSession.open_play_players || [];
                    const activePlayers = allPlayers.filter((p: any) => p.status !== "cancelled");
                    const regPlayers = activePlayers.filter((p: any) => p.status === "registered");
                    const sortedPlayers = [...allPlayers].sort((a: any, b: any) => {
                        const score = (p: any) => {
                            if (p.status === "cancelled") return 99;
                            if (p.status === "waitlisted") return 50;
                            const isPendingVerify =
                                p.payment_status === "reported" ||
                                (p.payment_account_last5 && p.payment_status !== "paid" && p.payment_status !== "confirmed");
                            if (isPendingVerify) return 1;
                            if (p.payment_status === "paid" || p.payment_status === "confirmed") return 3;
                            return 2;
                        };
                        return score(a) - score(b);
                    });

                    const courtText = getCourtLabel(managingSession);
                    const limitText = getCancelLimitDisplay(managingSession);

                    return (
                        <div>
                            <div className="bg-white px-4 py-3 sticky top-0 z-30 border-b border-gray-100 flex items-center justify-between">
                                <button
                                    onClick={() => setManagingSessionId(null)}
                                    className="flex items-center gap-1 text-sm font-bold text-gray-700"
                                >
                                    <ChevronLeft size={18} /> 返回
                                </button>
                                <span className="font-extrabold text-sm text-gray-900">單一場次管理</span>
                                <button
                                    onClick={() => openEditModal(managingSession)}
                                    className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1"
                                >
                                    <Edit3 size={13} /> 修改內容
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-extrabold text-base text-gray-900">
                                                {formatDateWithDay(managingSession.session_date)}{" "}
                                                {managingSession.start_time?.slice(0, 5)}–{managingSession.end_time?.slice(0, 5)}
                                            </p>
                                            <p className="text-sm font-bold text-gray-800 mt-0.5">
                                                {managingSession.title} · <span className="text-green-700">{courtText}</span>
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                📍 {managingSession.city || ""}{managingSession.district || ""} {managingSession.address || ""}
                                            </p>
                                            <p className="text-xs font-bold text-gray-600 mt-1">
                                                🎾 程度：{managingSession.level || "不限"} | 🛡️ {limitText}
                                            </p>
                                        </div>
                                        <span className="font-extrabold text-base text-green-700">${managingSession.price}</span>
                                    </div>

                                    {managingSession.notes && (
                                        <div className="mt-3 bg-amber-50/70 p-2.5 rounded-xl text-xs text-gray-700 border border-amber-100">
                                            <span className="font-bold text-amber-900">📝 備註：</span>
                                            {managingSession.notes}
                                        </div>
                                    )}

                                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                                        <span>
                                            正取：<strong className="text-gray-900">{regPlayers.length} / {managingSession.max_players} 人</strong>
                                        </span>
                                        <button
                                            onClick={(e) => handleShare(e, managingSession)}
                                            className="text-green-700 font-bold flex items-center gap-1"
                                        >
                                            <Share size={13} /> 分享報名
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    {sortedPlayers.length === 0 ? (
                                        <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-xs">目前尚無球友報名</div>
                                    ) : (
                                        sortedPlayers.map((player: any) => {
                                            const isPaid = player.payment_status === "paid" || player.payment_status === "confirmed";
                                            const isPendingVerify = !isPaid && (player.payment_status === "reported" || Boolean(player.payment_account_last5));
                                            let lightBadge = "🟡 待付款";
                                            let badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                                            if (player.status === "cancelled") {
                                                lightBadge = "🔴 已取消";
                                                badgeClass = "bg-red-50 text-red-600 border-red-200";
                                            } else if (player.status === "waitlisted") {
                                                lightBadge = "候補中";
                                                badgeClass = "bg-gray-100 text-gray-600 border-gray-200";
                                            } else if (isPaid) {
                                                lightBadge = "🟢 已確認";
                                                badgeClass = "bg-green-50 text-green-700 border-green-200";
                                            } else if (isPendingVerify) {
                                                lightBadge = "🟡 待核帳";
                                                badgeClass = "bg-[#FEF3C7] text-amber-900 border-amber-300";
                                            }

                                            // 顯示球友的付款方式與對帳碼
                                            let paymentMethodStr = "尚未回報";
                                            if (player.payment_method === "cash" || player.payment_account_last5 === "現場付款") {
                                                paymentMethodStr = "💵 現場付款";
                                            } else if (player.payment_method === "line" || player.payment_account_last5 === "TWQR") {
                                                paymentMethodStr = `📱 TWQR 付款碼 (手機末三碼 ${player.phone ? player.phone.slice(-3) : "---"})`;
                                            } else if (player.payment_account_last5) {
                                                paymentMethodStr = `🏦 銀行轉帳 (末五碼 ${player.payment_account_last5})`;
                                            }

                                            return (
                                                <div
                                                    key={player.id}
                                                    className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-2xs flex items-center justify-between gap-2"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-extrabold text-sm text-gray-900 truncate">
                                                                {player.display_name || player.line_nickname || "球友"}
                                                            </span>
                                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                                                                {lightBadge}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-600 mt-1.5 space-y-0.5">
                                                            <p>📞 電話：<strong className="text-gray-800">{player.phone || "未提供"}</strong></p>
                                                            <p>💳 付款方式：<strong className="text-gray-900">{paymentMethodStr}</strong></p>
                                                            <p>
                                                                🕒 回報時間：
                                                                {player.payment_report_time
                                                                    ? formatDateTime(player.payment_report_time)
                                                                    : player.created_at
                                                                        ? `${formatDateTime(player.created_at)} (報名)`
                                                                        : "尚未回報"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {player.status !== "cancelled" && (
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {!isPaid && player.status === "registered" && (
                                                                <button
                                                                    onClick={() => handleConfirmPayment(player)}
                                                                    className="bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1"
                                                                >
                                                                    <Check size={13} /> 核帳
                                                                </button>
                                                            )}
                                                            {isPaid && player.status === "registered" && (
                                                                <button
                                                                    onClick={() => handleUndoPayment(player)}
                                                                    className="bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 hover:bg-amber-100 transition"
                                                                    title="點錯復原為待核帳"
                                                                >
                                                                    <Undo2 size={13} /> 復原
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleCancelPlayer(player, managingSession, false)}
                                                                className="bg-gray-100 text-gray-500 p-1.5 rounded-xl hover:bg-red-50 hover:text-red-500 transition"
                                                                title="取消此球友"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
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
                // ==================== 列表視圖 (開團資訊 & 報名資訊) ====================
                <>
                    <div className="bg-white px-4 pt-3 pb-3 sticky top-0 z-30 border-b border-gray-100">
                        <h1 className="text-xl font-extrabold text-gray-900 mb-3">我的臨打</h1>
                        <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-2 gap-1">
                            <button
                                onClick={() => setActiveTab("hosting")}
                                className={`py-2 rounded-lg text-xs font-extrabold transition-all ${activeTab === "hosting" ? "bg-green-700 text-white shadow-2xs" : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                開團資訊
                            </button>
                            <button
                                onClick={() => setActiveTab("joined")}
                                className={`py-2 rounded-lg text-xs font-extrabold transition-all ${activeTab === "joined" ? "bg-green-700 text-white shadow-2xs" : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                報名資訊
                            </button>
                        </div>
                    </div>

                    <div className="p-4">
                        {activeTab === "hosting" ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <button
                                        onClick={() => {
                                            setIsEditingSession(false);
                                            setFormLocation("");
                                            setFormAddress("");
                                            setFormCourtName("1號場地");
                                            setCancelLimitMode("custom");
                                            setCustomCancelHours(24);
                                            setFormNotes("");
                                            setFormBankAccount(userProfile.bankAccount || "");
                                            setFormPaymentLink(userProfile.paymentLink || "");
                                            setShowCreateModal(true);
                                        }}
                                        className="w-full bg-green-700 text-white font-extrabold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                        <Plus size={18} strokeWidth={2.5} /> 開一場臨打
                                    </button>
                                    <button
                                        onClick={handleApplyLastSession}
                                        className="w-full bg-white text-green-800 border border-green-700 font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                                    >
                                        <RotateCcw size={15} strokeWidth={2.5} /> 套用上一次
                                    </button>
                                </div>

                                <div>
                                    <h2 className="text-sm font-extrabold text-green-800 border-b-2 border-green-700 pb-0.5 mb-2.5">
                                        我開的臨打 ({myHostedSessions.length})
                                    </h2>
                                    {myHostedSessions.length === 0 ? (
                                        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                                            <p className="text-gray-400 text-xs">目前還沒有建立臨打</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {myHostedSessions.map((session) => {
                                                const regPlayers = (session.open_play_players || []).filter((p: any) => p.status === "registered");
                                                const cancelledPlayers = (session.open_play_players || []).filter((p: any) => p.status === "cancelled");
                                                const pendingVerifyCount = regPlayers.filter(
                                                    (p: any) =>
                                                        p.payment_status !== "paid" &&
                                                        p.payment_status !== "confirmed" &&
                                                        (p.payment_status === "reported" || Boolean(p.payment_account_last5))
                                                ).length;

                                                let actionBadge = `${regPlayers.length} / ${session.max_players} 人`;
                                                let badgeStyle = "bg-gray-100 text-gray-700";
                                                let iconType: "yellow" | "green" | "cancel" = "green";

                                                if (pendingVerifyCount > 0) {
                                                    actionBadge = `${pendingVerifyCount} 筆待核帳`;
                                                    badgeStyle = "bg-[#FDE68A] text-amber-900";
                                                    iconType = "yellow";
                                                } else if (cancelledPlayers.length > 0) {
                                                    actionBadge = `${cancelledPlayers.length} 人取消`;
                                                    badgeStyle = "bg-red-100 text-red-700";
                                                    iconType = "cancel";
                                                } else if (regPlayers.length >= session.max_players) {
                                                    actionBadge = "已額滿";
                                                    badgeStyle = "bg-gray-200 text-gray-700";
                                                    iconType = "green";
                                                } else if (
                                                    regPlayers.length > 0 &&
                                                    regPlayers.every((p: any) => p.payment_status === "paid" || p.payment_status === "confirmed")
                                                ) {
                                                    actionBadge = "收款已確認";
                                                    badgeStyle = "bg-green-100 text-green-800";
                                                    iconType = "green";
                                                }

                                                return (
                                                    <div
                                                        key={session.id}
                                                        onClick={() => setManagingSessionId(session.id)}
                                                        className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs flex items-center justify-between gap-3 cursor-pointer hover:border-green-300 transition"
                                                    >
                                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                                            <div className="mt-1 shrink-0">
                                                                {iconType === "yellow" && (
                                                                    <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
                                                                        <div className="w-2 h-2 rounded-full bg-white" />
                                                                    </div>
                                                                )}
                                                                {iconType === "green" && (
                                                                    <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center">
                                                                        <CheckCircle2 size={15} strokeWidth={3} />
                                                                    </div>
                                                                )}
                                                                {iconType === "cancel" && (
                                                                    <div className="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center">
                                                                        <XCircle size={15} strokeWidth={2.5} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-extrabold text-[15px] text-gray-900">
                                                                    {formatDateWithDay(session.session_date)} {session.start_time?.slice(0, 5)}–{session.end_time?.slice(0, 5)}
                                                                </p>
                                                                <p className="text-sm font-bold text-gray-800 mt-0.5 truncate">
                                                                    {session.title} · {getCourtLabel(session)}
                                                                </p>
                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    🎾 {session.level || "不限"} | 🛡️ {getCancelLimitDisplay(session)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0">
                                                            <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold ${badgeStyle}`}>
                                                                {actionBadge}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            // ==================== 報名資訊視圖 (球友視角大升級) ====================
                            <div className="space-y-3">
                                <h2 className="text-sm font-extrabold text-green-800 border-b-2 border-green-700 pb-0.5 mb-1">
                                    我報名的臨打 ({myJoinedEntries.length})
                                </h2>
                                {myJoinedEntries.length === 0 ? (
                                    <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                                        <p className="text-gray-400 text-xs">目前尚無報名紀錄</p>
                                    </div>
                                ) : (
                                    myJoinedEntries.map(({ session, player }) => {
                                        const activePlayers = (session.open_play_players || []).filter((p: any) => p.status !== "cancelled");
                                        const regCount = activePlayers.filter((p: any) => p.status === "registered").length;
                                        const waitCount = activePlayers.filter((p: any) => p.status === "waitlisted").length;

                                        const isPaid = player.payment_status === "paid" || player.payment_status === "confirmed";
                                        const isReported = player.payment_status === "reported" || Boolean(player.payment_account_last5);

                                        let leftIconType = "joined";
                                        let statusBadge = "已報名";
                                        let statusStyle = "bg-green-700 text-white";
                                        if (player.status === "cancelled") {
                                            leftIconType = "cancel";
                                            statusBadge = "已取消";
                                            statusStyle = "bg-gray-200 text-gray-500";
                                        } else if (player.status === "waitlisted") {
                                            leftIconType = "waitlist";
                                            statusBadge = "候補中";
                                            statusStyle = "bg-amber-100 text-amber-800";
                                        }

                                        const courtText = getCourtLabel(session);
                                        const fullAddress = `${session.city || ""}${session.district || ""}${session.address || ""}`.trim();
                                        const mapQuery = `${fullAddress} ${session.title || ""}`.trim();
                                        const limitText = getCancelLimitDisplay(session);

                                        // 系統強制防呆 (做法 B)：計算現在時間與開打時間差
                                        const [y, m, d] = (session.session_date || "2026-01-01").split("-").map(Number);
                                        const [hh, mm] = (session.start_time || "00:00").split(":").map(Number);
                                        const sessionStartObj = new Date(y, m - 1, d, hh, mm, 0);
                                        const diffHours = (sessionStartObj.getTime() - Date.now()) / (1000 * 60 * 60);

                                        const limitHrs = session.cancel_limit_hours;
                                        let isCancelLocked = false;
                                        if (limitHrs === 0) {
                                            isCancelLocked = true;
                                        } else if (limitHrs !== null && limitHrs !== undefined && limitHrs > 0) {
                                            if (diffHours <= limitHrs) {
                                                isCancelLocked = true;
                                            }
                                        }

                                        // 明確顯示付款狀態與方式字串
                                        let paymentStatusText = "";
                                        if (isPaid) {
                                            paymentStatusText = "🟢 主辦人已確認收款";
                                        } else if (player.payment_method === "cash" || player.payment_account_last5 === "現場付款") {
                                            paymentStatusText = "✅ 已回報：現場付款";
                                        } else if (player.payment_method === "line" || player.payment_account_last5 === "TWQR") {
                                            paymentStatusText = "✅ 已回報：TWQR 付款碼";
                                        } else if (player.payment_account_last5) {
                                            paymentStatusText = `✅ 已回報：銀行轉帳 (末五碼 ${player.payment_account_last5})`;
                                        }

                                        return (
                                            <div key={player.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs space-y-3">
                                                {/* 與找球打首頁完全對齊的卡片上半部 */}
                                                <div className="flex justify-between items-start gap-3">
                                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                                        <div className="mt-1 shrink-0">
                                                            {leftIconType === "joined" && (
                                                                <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center">
                                                                    <CheckCircle2 size={15} strokeWidth={3} />
                                                                </div>
                                                            )}
                                                            {leftIconType === "waitlist" && (
                                                                <div className="w-6 h-6 rounded-full bg-gray-500 text-white flex items-center justify-center">
                                                                    <Users size={13} />
                                                                </div>
                                                            )}
                                                            {leftIconType === "cancel" && (
                                                                <div className="w-6 h-6 rounded-full bg-gray-300 text-white flex items-center justify-center">
                                                                    <XCircle size={15} strokeWidth={2.5} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-extrabold text-[15px] text-gray-900 leading-snug">
                                                                {formatDateWithDay(session.session_date)}{" "}
                                                                {session.start_time?.slice(0, 5)}–{session.end_time?.slice(0, 5)}
                                                            </p>
                                                            <p className="text-sm font-bold text-gray-800 mt-0.5 truncate">
                                                                {session.title} · <span className="text-green-700">{courtText}</span>
                                                            </p>
                                                            <p className="text-xs font-bold text-gray-500 mt-0.5">
                                                                🎾 程度：{session.level || "不限"} | 🛡️ {limitText}
                                                            </p>
                                                            <a
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1 hover:underline"
                                                            >
                                                                <MapPin size={12} className="shrink-0" />
                                                                <span className="truncate">{fullAddress || session.title} (點擊導航)</span>
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

                                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleShare(e, session)}
                                                            className="text-gray-400 hover:text-green-700 bg-gray-50 p-1.5 rounded-full border border-gray-200"
                                                        >
                                                            <Share size={14} />
                                                        </button>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${statusStyle}`}>
                                                            {statusBadge}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* 備註顯示 */}
                                                {session.notes && (
                                                    <div className="bg-amber-50/70 p-2.5 rounded-xl text-xs text-gray-700 border border-amber-100">
                                                        <span className="font-bold text-amber-900">📝 備註：</span>
                                                        {session.notes}
                                                    </div>
                                                )}

                                                {/* 付款狀態橫幅 + 補付款與防呆取消按鈕 */}
                                                {player.status !== "cancelled" && (
                                                    <div className="pt-3 border-t border-gray-100 space-y-2.5">
                                                        {player.status === "registered" && (
                                                            <div>
                                                                {isReported || isPaid ? (
                                                                    <div
                                                                        className={`px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center justify-between ${isPaid
                                                                                ? "bg-green-50 border-green-200 text-green-800"
                                                                                : "bg-gray-50 border-gray-200 text-gray-800"
                                                                            }`}
                                                                    >
                                                                        <span>{paymentStatusText}</span>
                                                                        {!isPaid && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setPayingRecord({ session, player });
                                                                                    setPayMethod(
                                                                                        (player.payment_method as any) || "bank"
                                                                                    );
                                                                                    setPayLast5(
                                                                                        player.payment_account_last5 &&
                                                                                            player.payment_account_last5 !== "TWQR" &&
                                                                                            player.payment_account_last5 !== "現場付款"
                                                                                            ? player.payment_account_last5
                                                                                            : ""
                                                                                    );
                                                                                }}
                                                                                className="text-[11px] text-green-700 underline font-bold ml-2 shrink-0"
                                                                            >
                                                                                修改付款方式
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => {
                                                                            setPayingRecord({ session, player });
                                                                            setPayMethod("bank");
                                                                            setPayLast5("");
                                                                        }}
                                                                        className="w-full bg-green-700 hover:bg-green-800 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-2xs transition"
                                                                    >
                                                                        💰 我要付款 / 回報
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* 做法 B：強制鎖定防呆取消按鈕 */}
                                                        {isCancelLocked ? (
                                                            <button
                                                                disabled
                                                                className="w-full bg-gray-100 text-gray-400 border border-gray-200 font-bold py-2 rounded-xl text-xs cursor-not-allowed flex items-center justify-center gap-1"
                                                            >
                                                                <Lock size={13} /> 已過取消時限，請聯繫主辦人
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleCancelPlayer(player, session, true)}
                                                                className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-2 rounded-xl text-xs transition"
                                                            >
                                                                取消報名
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ==================== 開團 / 修改臨打 Modal ==================== */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm max-h-[88dvh] overflow-y-auto p-5 shadow-2xl">
                        <h2 className="text-lg font-extrabold text-gray-900 mb-3">
                            {isEditingSession ? "修改臨打活動" : "開一場臨打"}
                        </h2>
                        <form onSubmit={handleSaveSession} className="space-y-3.5 text-xs">
                            {/* 1. 地點與第幾號場地 */}
                            <div className="space-y-2">
                                <label className="font-bold text-gray-800 block">1. 地點與場地編號 (必填)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        value={formCity}
                                        onChange={(e) => {
                                            setFormCity(e.target.value);
                                            setFormDistrict(TAIWAN_CITIES[e.target.value]?.[0] || "");
                                        }}
                                        className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900 font-medium"
                                    >
                                        {Object.keys(TAIWAN_CITIES).map((city) => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={formDistrict}
                                        onChange={(e) => setFormDistrict(e.target.value)}
                                        className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900 font-medium"
                                    >
                                        {(TAIWAN_CITIES[formCity] || []).map((dist) => (
                                            <option key={dist} value={dist}>{dist}</option>
                                        ))}
                                    </select>
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder="場館名稱 (如: 享動羽球匹克球智能館)"
                                    value={formLocation}
                                    onChange={(e) => setFormLocation(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                                />
                                <input
                                    type="text"
                                    placeholder="詳細地址 (如: 觀光路135巷1號，供 Google 導航)"
                                    value={formAddress}
                                    onChange={(e) => setFormAddress(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                                />
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">第幾號場地 *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="例：1號場地、A場、第1,2場"
                                        value={formCourtName}
                                        onChange={(e) => setFormCourtName(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 font-bold"
                                    />
                                </div>
                            </div>

                            {/* 2~4. 日期與時間 */}
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="font-bold text-gray-800 block mb-1">2. 日期</label>
                                    <input
                                        type="date"
                                        required
                                        value={formDate}
                                        onChange={(e) => setFormDate(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-1.5 py-2 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-gray-800 block mb-1">3. 開始</label>
                                    <input
                                        type="time"
                                        required
                                        value={formStartTime}
                                        onChange={(e) => setFormStartTime(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-1.5 py-2 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-gray-800 block mb-1">4. 結束</label>
                                    <input
                                        type="time"
                                        required
                                        value={formEndTime}
                                        onChange={(e) => setFormEndTime(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-1.5 py-2 text-gray-900"
                                    />
                                </div>
                            </div>

                            {/* 5. 程度要求 */}
                            <div>
                                <label className="font-bold text-gray-800 block mb-1">5. 程度要求</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {["不限", "新手", "2.0", "2.5", "3.0", "3.5", "4.0+"].map((l) => (
                                        <button
                                            type="button"
                                            key={l}
                                            onClick={() => setFormLevel(l)}
                                            className={`py-1.5 px-2.5 rounded-lg font-bold border transition ${formLevel === l
                                                    ? "bg-green-700 text-white border-green-700"
                                                    : "bg-gray-50 text-gray-700 border-gray-200"
                                                }`}
                                        >
                                            {l}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 6~7. 人數與候補 */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="font-bold text-gray-800 block mb-1">6. 正取人數上限</label>
                                    <input
                                        type="number"
                                        min={2}
                                        value={formMaxPlayers}
                                        onChange={(e) => setFormMaxPlayers(Number(e.target.value))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-gray-800 block mb-1">7. 候補名額</label>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4].map((w) => (
                                            <button
                                                type="button"
                                                key={w}
                                                onClick={() => setFormWaitlist(w)}
                                                className={`flex-1 py-2 rounded-lg font-bold border ${formWaitlist === w
                                                        ? "bg-gray-800 text-white border-gray-800"
                                                        : "bg-gray-50 text-gray-600 border-gray-200"
                                                    }`}
                                            >
                                                {w}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 8. 費用與收款資訊 */}
                            <div className="space-y-2">
                                <div>
                                    <label className="font-bold text-gray-800 block mb-1">8. 每人費用 ($)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={formPrice}
                                        onChange={(e) => setFormPrice(Number(e.target.value))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                                    />
                                </div>
                                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-2">
                                    <p className="text-[11px] font-bold text-gray-600">收款設定 (供球友轉帳或點擊 TWQR 付款)</p>
                                    <input
                                        type="text"
                                        placeholder="銀行轉帳帳號 (例: 822 中信 123456789)"
                                        value={formBankAccount}
                                        onChange={(e) => setFormBankAccount(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900"
                                    />
                                    <input
                                        type="text"
                                        placeholder="TWQR / 付款碼連結 (選填)"
                                        value={formPaymentLink}
                                        onChange={(e) => setFormPaymentLink(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-900"
                                    />
                                </div>
                            </div>

                            {/* 9. 取消限制 (做法 B：三選一 + 自訂小時數) */}
                            <div className="space-y-2">
                                <label className="font-bold text-gray-800 block">9. 取消限制 (到時自動鎖定取消按鈕)</label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setCancelLimitMode("unlimited")}
                                        className={`py-2 px-1 rounded-xl font-bold border text-[11px] transition ${cancelLimitMode === "unlimited"
                                                ? "bg-green-700 text-white border-green-700"
                                                : "bg-gray-50 text-gray-700 border-gray-200"
                                            }`}
                                    >
                                        不限
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCancelLimitMode("no_cancel")}
                                        className={`py-2 px-1 rounded-xl font-bold border text-[11px] transition ${cancelLimitMode === "no_cancel"
                                                ? "bg-green-700 text-white border-green-700"
                                                : "bg-gray-50 text-gray-700 border-gray-200"
                                            }`}
                                    >
                                        報名後不可取消
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCancelLimitMode("custom")}
                                        className={`py-2 px-1 rounded-xl font-bold border text-[11px] transition ${cancelLimitMode === "custom"
                                                ? "bg-green-700 text-white border-green-700"
                                                : "bg-gray-50 text-gray-700 border-gray-200"
                                            }`}
                                    >
                                        開打前設定時限
                                    </button>
                                </div>

                                {cancelLimitMode === "custom" && (
                                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                                        <span className="font-bold text-amber-900">開打前</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={720}
                                            required
                                            value={customCancelHours}
                                            onChange={(e) => setCustomCancelHours(Number(e.target.value))}
                                            className="w-16 bg-white border border-amber-300 rounded-lg px-2 py-1 text-center font-extrabold text-gray-900"
                                        />
                                        <span className="font-bold text-amber-900">小時內不可取消</span>
                                    </div>
                                )}
                            </div>

                            {/* 10. 備註欄 */}
                            <div>
                                <label className="font-bold text-gray-800 block mb-1">10. 備註欄 (選填)</label>
                                <textarea
                                    rows={2}
                                    placeholder="例如：提供比賽級用球、場館有冷氣與飲水機、請穿淺色鞋底球鞋..."
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 resize-none"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-[2] bg-green-700 text-white font-bold py-2.5 rounded-xl disabled:opacity-50"
                                >
                                    {isSubmitting ? "儲存中..." : isEditingSession ? "確認修改" : "確認發布"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== 球友補付款 / 回報三選一 Modal ==================== */}
            {payingRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
                        <h3 className="font-extrabold text-base text-gray-900">
                            選擇付款方式並回報 (${payingRecord.session.price})
                        </h3>

                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setPayMethod("bank")}
                                className={`py-2.5 rounded-xl font-bold text-xs border ${payMethod === "bank"
                                        ? "border-gray-900 bg-gray-900 text-white"
                                        : "border-gray-200 text-gray-600 bg-gray-50"
                                    }`}
                            >
                                銀行轉帳
                            </button>
                            <button
                                type="button"
                                onClick={() => setPayMethod("line")}
                                className={`py-2.5 rounded-xl font-bold text-xs border ${payMethod === "line"
                                        ? "border-[#06C755] bg-[#06C755] text-white"
                                        : "border-gray-200 text-gray-600 bg-gray-50"
                                    }`}
                            >
                                TWQR / 付款碼
                            </button>
                            <button
                                type="button"
                                onClick={() => setPayMethod("cash")}
                                className={`py-2.5 rounded-xl font-bold text-xs border ${payMethod === "cash"
                                        ? "border-amber-600 bg-amber-600 text-white"
                                        : "border-gray-200 text-gray-600 bg-gray-50"
                                    }`}
                            >
                                現場付款
                            </button>
                        </div>

                        {(() => {
                            const payInfo = parseSessionPaymentInfo(payingRecord.session);
                            return (
                                <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl space-y-2.5 text-xs">
                                    {payMethod === "bank" && (
                                        <>
                                            {payInfo.bank && (
                                                <div className="bg-white p-2.5 rounded-lg border border-gray-200">
                                                    <p className="text-gray-500 font-bold mb-0.5">主辦人收款帳號：</p>
                                                    <p className="font-extrabold text-gray-900 select-all">{payInfo.bank}</p>
                                                </div>
                                            )}
                                            <div>
                                                <label className="block font-bold text-gray-700 mb-1">
                                                    請輸入您的轉出帳號末五碼 *
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={5}
                                                    placeholder="例如：12345"
                                                    value={payLast5}
                                                    onChange={(e) =>
                                                        setPayLast5(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))
                                                    }
                                                    className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {payMethod === "line" && (
                                        <div className="space-y-2 text-center py-1">
                                            {payInfo.link ? (
                                                <a
                                                    href={payInfo.link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-block w-full bg-[#06C755] text-white font-bold py-2 rounded-lg"
                                                >
                                                    點擊開啟主辦人 TWQR / 收款碼
                                                </a>
                                            ) : null}
                                            <p className="text-gray-600 font-bold">
                                                完成掃碼付款後點擊下方按鈕，系統將自動記錄回報時間與手機末三碼供主辦人對帳。
                                            </p>
                                        </div>
                                    )}

                                    {payMethod === "cash" && (
                                        <p className="text-gray-700 font-bold text-center py-2">
                                            💵 確認選擇「現場付款」，請於活動當天將現金交給主辦人。
                                        </p>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => setPayingRecord(null)}
                                className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs"
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                onClick={handlePlayerReportPayment}
                                disabled={isSubmitting}
                                className="flex-[2] bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
                            >
                                {isSubmitting
                                    ? "送出中..."
                                    : payMethod === "cash"
                                        ? "確認選擇現場付款"
                                        : "我已完成付款，送出回報"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}