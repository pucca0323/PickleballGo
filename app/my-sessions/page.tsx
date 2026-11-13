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
    const [courtsList, setCourtsList] = useState<any[]>([]);
    const [managingSessionId, setManagingSessionId] = useState<string | null>(null);
    const [isEditingSession, setIsEditingSession] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formCity, setFormCity] = useState("台中市");
    const [formDistrict, setFormDistrict] = useState("龍井區");
    const [formLocation, setFormLocation] = useState("");
    const [formAddress, setFormAddress] = useState("");
    const [formDate, setFormDate] = useState("");
    const [formStartTime, setFormStartTime] = useState("19:00");
    const [formEndTime, setFormEndTime] = useState("21:00");
    const [formCourt, setFormCourt] = useState("1號場地");
    const [formLevel, setFormLevel] = useState("不限");
    const [formMaxPlayers, setFormMaxPlayers] = useState(16);
    const [formWaitlist, setFormWaitlist] = useState(2);
    const [formPrice, setFormPrice] = useState(150);
    const [formPaymentMethod, setFormPaymentMethod] = useState("轉帳 / 付款碼");
    const [formPaymentLink, setFormPaymentLink] = useState("");
    const [formBankAccount, setFormBankAccount] = useState("");
    const [formCancelRule, setFormCancelRule] = useState("開打前 24 小時內取消不予退費");

    const [payingRecord, setPayingRecord] = useState<any | null>(null);
    const [payMethod, setPayMethod] = useState<"line" | "bank">("bank");
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
                setFormPaymentLink(parsed.paymentLink || "");
                setFormBankAccount(parsed.bankAccount || "");
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
        const { data: courtsData } = await supabase.from("courts").select("id, name");
        if (courtsData) setCourtsList(courtsData);
        const { data } = await supabase
            .from("open_play_sessions")
            .select("*, courts(name), open_play_players(*)")
            .order("session_date", { ascending: true })
            .order("start_time", { ascending: true });
        if (data) setSessions(data);
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
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(
            2,
            "0"
        )}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    const getCourtLabel = (session: any) => {
        if (session.courts?.name) return session.courts.name;
        if (session.notes && session.notes.includes("【")) {
            const match = session.notes.match(/【(.*?)】/);
            if (match) return match[1];
        }
        return "1號場地";
    };

    const handleApplyLastSession = () => {
        try {
            const savedLast = localStorage.getItem("picklego_last_session_template");
            if (savedLast) {
                const t = JSON.parse(savedLast);
                setFormCity(t.city || "台中市");
                setFormDistrict(t.district || "龍井區");
                setFormLocation(t.location || "");
                setFormAddress(t.address || "");
                setFormStartTime(t.startTime || "19:00");
                setFormEndTime(t.endTime || "21:00");
                setFormCourt(t.court || "1號場地");
                setFormLevel(t.level || "不限");
                setFormMaxPlayers(t.maxPlayers || 16);
                setFormWaitlist(t.waitlist || 2);
                setFormPrice(t.price ?? 150);
                setFormPaymentMethod(t.paymentMethod || "轉帳 / 付款碼");
                setFormPaymentLink(t.paymentLink || userProfile.paymentLink || "");
                setFormBankAccount(t.bankAccount || userProfile.bankAccount || "");
                setFormCancelRule(t.cancelRule || "開打前 24 小時內取消不予退費");
                setIsEditingSession(false);
                setShowCreateModal(true);
                return;
            }
        } catch (e) { }
        setIsEditingSession(false);
        setShowCreateModal(true);
    };

    const handleSaveSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formLocation.trim() || !formDate || !formCity || !formDistrict)
            return alert("請完整填寫地點與日期！");
        setIsSubmitting(true);
        try {
            const matchedCourt = courtsList.find(
                (c) => c.name === formCourt || c.name === formCourt.replace(/\s+/g, "")
            );
            const courtId = matchedCourt ? matchedCourt.id : courtsList[0]?.id || null;
            const combinedNotes = `【${formCourt}】取消規則：${formCancelRule}${formBankAccount ? ` | 收款帳號：${formBankAccount}` : ""
                }`;

            const payload: any = {
                title: formLocation.trim(),
                city: formCity,
                district: formDistrict,
                address: formAddress.trim() || null,
                host_phone: userProfile.phone || null,
                host_name: userProfile.lineNickname || null,
                session_date: formDate,
                start_time: `${formStartTime.slice(0, 5)}:00`,
                end_time: `${formEndTime.slice(0, 5)}:00`,
                court_id: courtId,
                level: formLevel,
                price: Number(formPrice),
                max_players: Number(formMaxPlayers),
                max_waitlist: Number(formWaitlist),
                status: "open",
                notes: combinedNotes,
            };

            if (isEditingSession && managingSessionId) {
                const { error } = await supabase
                    .from("open_play_sessions")
                    .update(payload)
                    .eq("id", managingSessionId);
                if (error) throw error;
                alert("✅ 活動資訊已成功修改！");
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
                        startTime: formStartTime,
                        endTime: formEndTime,
                        court: formCourt,
                        level: formLevel,
                        maxPlayers: Number(formMaxPlayers),
                        waitlist: Number(formWaitlist),
                        price: Number(formPrice),
                        paymentMethod: formPaymentMethod,
                        paymentLink: formPaymentLink,
                        bankAccount: formBankAccount,
                        cancelRule: formCancelRule,
                    })
                );
                alert("✅ 臨打活動已發布！");
            }
            setShowCreateModal(false);
            await fetchAllData();
        } catch (err: any) {
            alert(
                "儲存失敗：" +
                (err.message || "請確認已執行 Supabase SQL 新增 address 與 host_phone 欄位")
            );
        } finally {
            setIsSubmitting(false);
        }
    };

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

    // 復原核帳功能 (點錯可退回待核帳)
    const handleUndoPayment = async (player: any) => {
        if (
            !confirm(
                `確定要將「${player.display_name || player.line_nickname || "球友"}」退回待核帳狀態嗎？`
            )
        )
            return;
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

    const handleCancelPlayer = async (player: any, session: any) => {
        if (!confirm(`確定要取消「${player.display_name || player.line_nickname || "球友"}」嗎？`))
            return;
        try {
            await supabase
                .from("open_play_players")
                .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
                .eq("id", player.id);
            if (player.status === "registered") {
                const waitlisted = (session.open_play_players || [])
                    .filter((p: any) => p.status === "waitlisted")
                    .sort(
                        (a: any, b: any) =>
                            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                if (waitlisted.length > 0) {
                    await supabase
                        .from("open_play_players")
                        .update({ status: "registered", promoted_at: new Date().toISOString() })
                        .eq("id", waitlisted[0].id);
                }
            }
            fetchAllData();
        } catch (err: any) {
            alert("取消失敗：" + err.message);
        }
    };

    const handlePlayerReportPayment = async () => {
        if (!payingRecord) return;
        if (payMethod === "bank" && !payLast5.trim()) return alert("請輸入轉帳末五碼！");
        setIsSubmitting(true);
        try {
            const finalLast5 = payMethod === "line" ? "TWQR" : payLast5.trim();
            await supabase
                .from("open_play_players")
                .update({
                    payment_method: payMethod,
                    payment_account_last5: finalLast5,
                    payment_status: "reported",
                    payment_report_time: new Date().toISOString(),
                })
                .eq("id", payingRecord.player.id);
            alert("✅ 已送出付款回報，等待建立者核帳！");
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
        const locStr = `${session.city || ""}${session.district || ""} ${session.address || ""
            } ${session.title}`.trim();
        const text = `🎾 PickleGo 臨打邀請\n【時間】${formatDateWithDay(
            session.session_date
        )} ${session.start_time?.slice(0, 5)}-${session.end_time?.slice(
            0,
            5
        )}\n【地點】${locStr} (${getCourtLabel(session)})\n【程度】${session.level || "不限"
            }\n【費用】$${session.price || 0} / 人\n👇 點擊連結快速報名：\n${url}`;
        navigator.clipboard.writeText(text);
        alert("✅ 報名資訊與專屬網址已複製，可直接貼上 LINE 群組！");
    };

    // 透過手機號碼、本機開團紀錄雙重比對，確保跨裝置也能抓到自己開的團
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

    const openEditModal = (targetSession: any) => {
        setFormCity(targetSession.city || "台中市");
        setFormDistrict(targetSession.district || "龍井區");
        setFormLocation(targetSession.title || "");
        setFormAddress(targetSession.address || "");
        setFormDate(targetSession.session_date);
        setFormStartTime(targetSession.start_time?.slice(0, 5) || "19:00");
        setFormEndTime(targetSession.end_time?.slice(0, 5) || "21:00");
        setFormCourt(getCourtLabel(targetSession));
        setFormMaxPlayers(targetSession.max_players || 16);
        setFormPrice(targetSession.price ?? 150);
        setFormLevel(targetSession.level || "不限");
        setFormWaitlist(targetSession.max_waitlist || 2);
        setIsEditingSession(true);
        setShowCreateModal(true);
    };

    return (
        <div className="w-full min-h-full bg-[#F8F9FA] pb-16">
            {managingSession ? (
                // ==================== 單一場次管理視圖 ====================
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
                                (p.payment_account_last5 &&
                                    p.payment_status !== "paid" &&
                                    p.payment_status !== "confirmed");
                            if (isPendingVerify) return 1;
                            if (p.payment_status === "paid" || p.payment_status === "confirmed")
                                return 3;
                            return 2;
                        };
                        return score(a) - score(b);
                    });

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
                                                {managingSession.start_time?.slice(0, 5)}–
                                                {managingSession.end_time?.slice(0, 5)}
                                            </p>
                                            <p className="text-sm font-bold text-gray-700 mt-0.5">
                                                {managingSession.title} · {getCourtLabel(managingSession)}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                📍 {managingSession.city || ""}
                                                {managingSession.district || ""} {managingSession.address || ""}
                                            </p>
                                            <p className="text-xs font-bold text-gray-500 mt-0.5">
                                                🎾 程度：{managingSession.level || "不限"}
                                            </p>
                                        </div>
                                        <span className="font-extrabold text-base text-green-700">
                                            ${managingSession.price}
                                        </span>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                                        <span>
                                            正取：
                                            <strong className="text-gray-900">
                                                {regPlayers.length} / {managingSession.max_players} 人
                                            </strong>
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
                                        <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-xs">
                                            目前尚無球友報名
                                        </div>
                                    ) : (
                                        sortedPlayers.map((player: any) => {
                                            const isPaid =
                                                player.payment_status === "paid" ||
                                                player.payment_status === "confirmed";
                                            const isPendingVerify =
                                                !isPaid &&
                                                (player.payment_status === "reported" ||
                                                    Boolean(player.payment_account_last5));
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

                                            // 組合智慧對帳碼顯示
                                            const d = new Date(managingSession.session_date);
                                            const rocDate = `${d.getFullYear() - 1911}${String(
                                                d.getMonth() + 1
                                            ).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
                                            let reconcileStr = player.payment_account_last5 || "尚未回報";
                                            if (player.payment_account_last5 === "TWQR") {
                                                reconcileStr = `TWQR (${rocDate}-${player.phone ? player.phone.slice(-3) : "000"
                                                    })`;
                                            } else if (player.payment_account_last5) {
                                                reconcileStr = `${rocDate}-${player.payment_account_last5}`;
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
                                                            <span
                                                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}
                                                            >
                                                                {lightBadge}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-gray-600 mt-1.5 space-y-0.5">
                                                            <p>📞 電話：{player.phone || "未提供"}</p>
                                                            <p>
                                                                💳 對帳碼：
                                                                <strong className="text-gray-900">{reconcileStr}</strong>
                                                            </p>
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
                                                                onClick={() => handleCancelPlayer(player, managingSession)}
                                                                className="bg-gray-100 text-gray-500 p-1.5 rounded-xl hover:bg-red-50 hover:text-red-500 transition"
                                                                title="取消此球友報名"
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
                // ==================== 列表視圖 ====================
                <>
                    <div className="bg-white px-4 pt-3 pb-3 sticky top-0 z-30 border-b border-gray-100">
                        <h1 className="text-xl font-extrabold text-gray-900 mb-3">我的臨打</h1>
                        <div className="bg-gray-100 p-1 rounded-xl grid grid-cols-2 gap-1">
                            <button
                                onClick={() => setActiveTab("hosting")}
                                className={`py-2 rounded-lg text-xs font-extrabold transition-all ${activeTab === "hosting"
                                        ? "bg-green-700 text-white shadow-2xs"
                                        : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                開團資訊
                            </button>
                            <button
                                onClick={() => setActiveTab("joined")}
                                className={`py-2 rounded-lg text-xs font-extrabold transition-all ${activeTab === "joined"
                                        ? "bg-green-700 text-white shadow-2xs"
                                        : "text-gray-600 hover:text-gray-900"
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
                                                const regPlayers = (session.open_play_players || []).filter(
                                                    (p: any) => p.status === "registered"
                                                );
                                                const cancelledPlayers = (session.open_play_players || []).filter(
                                                    (p: any) => p.status === "cancelled"
                                                );
                                                const pendingVerifyCount = regPlayers.filter(
                                                    (p: any) =>
                                                        p.payment_status !== "paid" &&
                                                        p.payment_status !== "confirmed" &&
                                                        (p.payment_status === "reported" ||
                                                            Boolean(p.payment_account_last5))
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
                                                    regPlayers.every(
                                                        (p: any) =>
                                                            p.payment_status === "paid" ||
                                                            p.payment_status === "confirmed"
                                                    )
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
                                                                    {formatDateWithDay(session.session_date)}{" "}
                                                                    {session.start_time?.slice(0, 5)}–
                                                                    {session.end_time?.slice(0, 5)}
                                                                </p>
                                                                <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">
                                                                    {session.title}
                                                                </p>
                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    🎾 {session.level || "不限"} | {getCourtLabel(session)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="shrink-0">
                                                            <span
                                                                className={`px-3 py-1.5 rounded-full text-xs font-extrabold ${badgeStyle}`}
                                                            >
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
                                        const isPaid =
                                            player.payment_status === "paid" ||
                                            player.payment_status === "confirmed";
                                        const isPendingVerify =
                                            !isPaid &&
                                            (player.payment_status === "reported" ||
                                                Boolean(player.payment_account_last5));
                                        return (
                                            <div
                                                key={player.id}
                                                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs"
                                            >
                                                <div className="flex justify-between items-start gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-extrabold text-[15px] text-gray-900">
                                                            {formatDateWithDay(session.session_date)}{" "}
                                                            {session.start_time?.slice(0, 5)}–
                                                            {session.end_time?.slice(0, 5)}
                                                        </p>
                                                        <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">
                                                            {session.title}
                                                        </p>
                                                        <a
                                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                                                `${session.city || ""}${session.district || ""}${session.address || ""
                                                                }${session.title || ""}`
                                                            )}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-xs font-bold text-blue-600 mt-1 flex items-center gap-1"
                                                        >
                                                            <MapPin size={12} /> Map導航
                                                        </a>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                                        {player.status === "cancelled" ? (
                                                            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-gray-100 text-gray-500">
                                                                已取消
                                                            </span>
                                                        ) : player.status === "waitlisted" ? (
                                                            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-700">
                                                                候補中
                                                            </span>
                                                        ) : (
                                                            <>
                                                                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-green-100 text-green-800">
                                                                    已報名
                                                                </span>
                                                                {isPaid ? (
                                                                    <span className="text-[11px] font-bold text-green-700">
                                                                        🟢 已付款
                                                                    </span>
                                                                ) : isPendingVerify ? (
                                                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#FDE68A] text-amber-900">
                                                                        🟡 待核帳
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setPayingRecord({ session, player })}
                                                                        className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 underline"
                                                                    >
                                                                        🟡 待付款 (回報)
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 建立與修改臨打 Modal (置於最外層，確保管理頁點擊修改時能正常彈出) */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85dvh] overflow-y-auto p-5 shadow-2xl">
                        <h2 className="text-lg font-extrabold text-gray-900 mb-3">
                            {isEditingSession ? "修改臨打活動" : "開一場臨打"}
                        </h2>
                        <form onSubmit={handleSaveSession} className="space-y-3 text-xs">
                            <div className="space-y-2">
                                <label className="font-bold text-gray-700 block">1. 地點 (必填)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        value={formCity}
                                        onChange={(e) => {
                                            setFormCity(e.target.value);
                                            setFormDistrict(TAIWAN_CITIES[e.target.value]?.[0] || "");
                                        }}
                                        className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900"
                                    >
                                        {Object.keys(TAIWAN_CITIES).map((city) => (
                                            <option key={city} value={city}>
                                                {city}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={formDistrict}
                                        onChange={(e) => setFormDistrict(e.target.value)}
                                        className="bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900"
                                    >
                                        {(TAIWAN_CITIES[formCity] || []).map((dist) => (
                                            <option key={dist} value={dist}>
                                                {dist}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder="場館名稱 (如: 龍井運動中心)"
                                    value={formLocation}
                                    onChange={(e) => setFormLocation(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                                />
                                <input
                                    type="text"
                                    placeholder="詳細地址 (如: 中華路一段... 導航更精準)"
                                    value={formAddress}
                                    onChange={(e) => setFormAddress(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">2. 日期</label>
                                    <input
                                        type="date"
                                        required
                                        value={formDate}
                                        onChange={(e) => setFormDate(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-1 py-2 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">3. 開始</label>
                                    <input
                                        type="time"
                                        required
                                        value={formStartTime}
                                        onChange={(e) => setFormStartTime(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-1 py-2 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">4. 結束</label>
                                    <input
                                        type="time"
                                        required
                                        value={formEndTime}
                                        onChange={(e) => setFormEndTime(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-1 py-2 text-gray-900"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="font-bold text-gray-700 block mb-1">5. 程度要求</label>
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
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">
                                        6. 正取人數上限
                                    </label>
                                    <input
                                        type="number"
                                        min={2}
                                        value={formMaxPlayers}
                                        onChange={(e) => setFormMaxPlayers(Number(e.target.value))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">7. 候補名額</label>
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
                            <div>
                                <label className="font-bold text-gray-700 block mb-1">
                                    8. 每人費用 ($)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formPrice}
                                    onChange={(e) => setFormPrice(Number(e.target.value))}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
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
                                    {isSubmitting
                                        ? "儲存中..."
                                        : isEditingSession
                                            ? "確認修改"
                                            : "確認發布"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {payingRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
                        <h3 className="font-extrabold text-base text-gray-900">回報付款</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setPayMethod("bank")}
                                className={`py-2 rounded-xl font-bold border ${payMethod === "bank"
                                        ? "border-gray-800 bg-gray-100 text-gray-900"
                                        : "border-gray-200 text-gray-500"
                                    }`}
                            >
                                銀行轉帳
                            </button>
                            <button
                                onClick={() => setPayMethod("line")}
                                className={`py-2 rounded-xl font-bold border ${payMethod === "line"
                                        ? "border-[#06C755] bg-[#06C755]/10 text-[#06C755]"
                                        : "border-gray-200 text-gray-500"
                                    }`}
                            >
                                TWQR / 付款碼
                            </button>
                        </div>
                        {payMethod === "bank" && (
                            <input
                                type="text"
                                placeholder="請輸入轉出帳號末五碼"
                                value={payLast5}
                                onChange={(e) =>
                                    setPayLast5(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))
                                }
                                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-bold"
                            />
                        )}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setPayingRecord(null)}
                                className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs"
                            >
                                取消
                            </button>
                            <button
                                onClick={handlePlayerReportPayment}
                                disabled={isSubmitting}
                                className="flex-[2] bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs disabled:opacity-50"
                            >
                                {isSubmitting ? "送出中..." : "我已完成付款"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}