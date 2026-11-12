"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
    Bell,
    Plus,
    RotateCcw,
    CheckCircle2,
    XCircle,
    Users,
    ChevronLeft,
    Copy,
    Check,
    Edit3,
    Trash2,
} from "lucide-react";

export default function MySessionsPage() {
    const [activeTab, setActiveTab] = useState<"hosting" | "joined">("hosting");
    const [loading, setLoading] = useState(true);

    // 使用者本地識別資料
    const [userProfile, setUserProfile] = useState({
        phone: "",
        lineNickname: "",
        paymentLink: "",
        bankAccount: "",
    });
    const [hostedIds, setHostedIds] = useState<string[]>([]);
    const [joinedMap, setJoinedMap] = useState<Record<string, string>>({});

    // 資料庫場次與場地
    const [sessions, setSessions] = useState<any[]>([]);
    const [courtsList, setCourtsList] = useState<any[]>([]);

    // 單一場次管理 (點進開團卡片)
    const [managingSessionId, setManagingSessionId] = useState<string | null>(null);
    const [isEditingSession, setIsEditingSession] = useState(false);

    // 開一場臨打 Modal 與表單狀態
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formLocation, setFormLocation] = useState("龍井運動中心");
    const [formDate, setFormDate] = useState("");
    const [formStartTime, setFormStartTime] = useState("19:00");
    const [formEndTime, setFormEndTime] = useState("21:00");
    const [formCourt, setFormCourt] = useState("場地 1");
    const [formMaxPlayers, setFormMaxPlayers] = useState(16);
    const [formPrice, setFormPrice] = useState(150);
    const [formPaymentMethod, setFormPaymentMethod] = useState("轉帳 / 付款碼");
    const [formPaymentLink, setFormPaymentLink] = useState("");
    const [formBankAccount, setFormBankAccount] = useState("");
    const [formCancelRule, setFormCancelRule] = useState("開打前 24 小時內取消不予退費");

    // 報名資訊：回報付款 Modal
    const [payingRecord, setPayingRecord] = useState<any | null>(null);
    const [payMethod, setPayMethod] = useState<"line" | "bank">("bank");
    const [payLast5, setPayLast5] = useState("");

    // 初始化讀取本地個人設定與紀錄
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
        } catch (e) {
            console.error(e);
        }

        const tomorrow = new Date(Date.now() + 86400000);
        setFormDate(tomorrow.toISOString().split("T")[0]);
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        const { data: courtsData } = await supabase.from("courts").select("id, name");
        if (courtsData) setCourtsList(courtsData);

        const { data } = await supabase
            .from("open_play_sessions")
            .select(
                `
        *,
        courts(name),
        open_play_players(*)
      `
            )
            .order("session_date", { ascending: true })
            .order("start_time", { ascending: true });

        if (data) setSessions(data);
        setLoading(false);
    };

    const formatDateWithDay = (dateStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const days = ["日", "一", "二", "三", "四", "五", "六"];
        return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
    };

    const getCourtLabel = (session: any) => {
        if (session.courts?.name) return session.courts.name;
        if (session.notes && session.notes.includes("【場地")) {
            const match = session.notes.match(/【(場地\s*\d+)】/);
            if (match) return match[1];
        }
        return "場地 1";
    };

    // 套用上一次開團設定
    const handleApplyLastSession = () => {
        try {
            const savedLast = localStorage.getItem("picklego_last_session_template");
            if (savedLast) {
                const t = JSON.parse(savedLast);
                setFormLocation(t.location || "龍井運動中心");
                setFormStartTime(t.startTime || "19:00");
                setFormEndTime(t.endTime || "21:00");
                setFormCourt(t.court || "場地 1");
                setFormMaxPlayers(t.maxPlayers || 16);
                setFormPrice(t.price ?? 150);
                setFormPaymentMethod(t.paymentMethod || "轉帳 / 付款碼");
                setFormPaymentLink(t.paymentLink || userProfile.paymentLink || "");
                setFormBankAccount(t.bankAccount || userProfile.bankAccount || "");
                setFormCancelRule(t.cancelRule || "開打前 24 小時內取消不予退費");
                setShowCreateModal(true);
                return;
            }
        } catch (e) {
            console.error(e);
        }

        // 若本地無紀錄，抓最新一場開團場次套用
        if (sessions.length > 0) {
            const last = sessions[sessions.length - 1];
            setFormLocation(last.title || "龍井運動中心");
            setFormStartTime(last.start_time?.slice(0, 5) || "19:00");
            setFormEndTime(last.end_time?.slice(0, 5) || "21:00");
            setFormCourt(getCourtLabel(last));
            setFormMaxPlayers(last.max_players || 16);
            setFormPrice(last.price ?? 150);
            setShowCreateModal(true);
        } else {
            alert("尚無上一次開團紀錄，請直接建立第一場臨打！");
            setShowCreateModal(true);
        }
    };

    // 建立或修改臨打場次
    const handleSaveSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formLocation.trim() || !formDate) return alert("請填寫地點與日期！");
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
                session_date: formDate,
                start_time: `${formStartTime}:00`,
                end_time: `${formEndTime}:00`,
                court_id: courtId,
                level: "不限",
                price: Number(formPrice),
                max_players: Number(formMaxPlayers),
                max_waitlist: 4,
                status: "open",
                notes: combinedNotes,
            };

            if (isEditingSession && managingSessionId) {
                const { error } = await supabase
                    .from("open_play_sessions")
                    .update(payload)
                    .eq("id", managingSessionId);
                if (error) throw error;
                alert("✅ 活動資訊已更新！");
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

                // 儲存為「上一次設定」供下次一鍵套用
                localStorage.setItem(
                    "picklego_last_session_template",
                    JSON.stringify({
                        location: formLocation.trim(),
                        startTime: formStartTime,
                        endTime: formEndTime,
                        court: formCourt,
                        maxPlayers: Number(formMaxPlayers),
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
            fetchAllData();
        } catch (err: any) {
            alert("儲存失敗：" + (err.message || "請檢查欄位"));
        } finally {
            setIsSubmitting(false);
        }
    };

    // 單一場次管理：核帳確認
    const handleConfirmPayment = async (player: any) => {
        try {
            const { error } = await supabase
                .from("open_play_players")
                .update({
                    payment_status: "paid",
                    admin_confirm_time: new Date().toISOString(),
                })
                .eq("id", player.id);

            if (error) throw error;
            fetchAllData();
        } catch (err: any) {
            alert("核帳失敗：" + err.message);
        }
    };

    // 單一場次管理：取消球友名額（並自動遞補第一位候補）
    const handleCancelPlayer = async (player: any, session: any) => {
        if (!confirm(`確定要將「${player.display_name || player.line_nickname || "球友"}」設為取消嗎？`))
            return;
        try {
            const { error } = await supabase
                .from("open_play_players")
                .update({
                    status: "cancelled",
                    cancelled_at: new Date().toISOString(),
                })
                .eq("id", player.id);
            if (error) throw error;

            // 若取消的是正取，自動將第一位候補遞補為正取
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
                        .update({
                            status: "registered",
                            promoted_at: new Date().toISOString(),
                        })
                        .eq("id", waitlisted[0].id);
                }
            }

            fetchAllData();
        } catch (err: any) {
            alert("取消失敗：" + err.message);
        }
    };

    // 報名資訊：球友送出付款回報
    const handlePlayerReportPayment = async () => {
        if (!payingRecord) return;
        if (!payLast5.trim()) return alert("請輸入帳號末五碼或交易備註！");
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from("open_play_players")
                .update({
                    payment_method: payMethod,
                    payment_account_last5: payLast5.trim(),
                    payment_status: "reported",
                    payment_report_time: new Date().toISOString(),
                })
                .eq("id", payingRecord.player.id);

            if (error) throw error;
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

    // 篩選「我開的臨打」與「我報名的臨打」
    const myHostedSessions = sessions.filter((s) =>
        hostedIds.length > 0 ? hostedIds.includes(s.id) : s.status === "open"
    );

    const myJoinedEntries = sessions
        .map((session) => {
            const players = session.open_play_players || [];
            const myRecord = players.find(
                (p: any) =>
                    (userProfile.lineNickname &&
                        (p.line_nickname === userProfile.lineNickname ||
                            p.display_name === userProfile.lineNickname)) ||
                    joinedMap[session.id]
            );
            if (!myRecord) return null;
            return { session, player: myRecord };
        })
        .filter(Boolean) as { session: any; player: any }[];

    const managingSession = sessions.find((s) => s.id === managingSessionId);

    // ==========================================
    // 視圖 A：單一場次管理頁面（點進開團卡片）
    // ==========================================
    if (managingSession) {
        const allPlayers = managingSession.open_play_players || [];
        const activePlayers = allPlayers.filter((p: any) => p.status !== "cancelled");
        const regPlayers = activePlayers.filter((p: any) => p.status === "registered");

        // 排序：待核帳排最前面 -> 待付款 -> 已確認 -> 候補 -> 已取消
        const sortedPlayers = [...allPlayers].sort((a: any, b: any) => {
            const score = (p: any) => {
                if (p.status === "cancelled") return 99;
                if (p.status === "waitlisted") return 50;
                const isPendingVerify =
                    p.payment_status === "reported" ||
                    (p.payment_account_last5 &&
                        p.payment_status !== "paid" &&
                        p.payment_status !== "confirmed");
                if (isPendingVerify) return 1; // 🟡 待核帳最優先
                if (p.payment_status === "paid" || p.payment_status === "confirmed") return 3;
                return 2;
            };
            return score(a) - score(b);
        });

        return (
            <div className="w-full min-h-full bg-[#F8F9FA] pb-16">
                <div className="bg-white px-4 py-3 sticky top-0 z-30 border-b border-gray-100 flex items-center justify-between">
                    <button
                        onClick={() => setManagingSessionId(null)}
                        className="flex items-center gap-1 text-sm font-bold text-gray-700"
                    >
                        <ChevronLeft size={18} /> 返回我的臨打
                    </button>
                    <span className="font-extrabold text-sm text-gray-900">單一場次管理</span>
                    <button
                        onClick={() => {
                            setFormLocation(managingSession.title || "龍井運動中心");
                            setFormDate(managingSession.session_date);
                            setFormStartTime(managingSession.start_time?.slice(0, 5) || "19:00");
                            setFormEndTime(managingSession.end_time?.slice(0, 5) || "21:00");
                            setFormCourt(getCourtLabel(managingSession));
                            setFormMaxPlayers(managingSession.max_players || 16);
                            setFormPrice(managingSession.price ?? 150);
                            setIsEditingSession(true);
                            setShowCreateModal(true);
                        }}
                        className="text-xs font-bold text-green-700 flex items-center gap-1"
                    >
                        <Edit3 size={14} /> 修改
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* 活動摘要卡片 */}
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
                            </div>
                            <span className="font-extrabold text-base text-green-700">
                                ${managingSession.price} / 人
                            </span>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                            <span>
                                正取人數：
                                <strong className="text-gray-900">
                                    {regPlayers.length} / {managingSession.max_players} 人
                                </strong>
                            </span>
                            <button
                                onClick={() => {
                                    const listText = regPlayers
                                        .map(
                                            (p: any, idx: number) =>
                                                `${idx + 1}. ${p.display_name || p.line_nickname || "球友"}`
                                        )
                                        .join("\n");
                                    navigator.clipboard.writeText(
                                        `【${managingSession.title} 臨打名單】\n時間：${formatDateWithDay(
                                            managingSession.session_date
                                        )} ${managingSession.start_time?.slice(0, 5)}\n${listText}`
                                    );
                                    alert("✅ 已複製場次通知與名單，可直接貼至 LINE 群組！");
                                }}
                                className="text-green-700 font-bold flex items-center gap-1"
                            >
                                <Copy size={13} /> 複製名單通知
                            </button>
                        </div>
                    </div>

                    {/* 報名與核帳名單 (紅綠燈狀態，待核帳置頂) */}
                    <div className="space-y-2.5">
                        <h3 className="text-xs font-extrabold text-gray-500 px-1">
                            報名名單與核帳管理（待核帳自動置頂）
                        </h3>

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
                                            <p className="text-xs text-gray-500 mt-1">
                                                {player.payment_account_last5
                                                    ? `回報末五碼/序號：${player.payment_account_last5}`
                                                    : "尚未回報付款資訊"}
                                            </p>
                                        </div>

                                        {player.status !== "cancelled" && (
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {!isPaid && player.status === "registered" && (
                                                    <button
                                                        onClick={() => handleConfirmPayment(player)}
                                                        className="bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 active:scale-95"
                                                    >
                                                        <Check size={13} /> 核帳
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleCancelPlayer(player, managingSession)}
                                                    className="bg-gray-100 text-gray-500 p-1.5 rounded-xl hover:text-red-600"
                                                    title="取消此球友名額"
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
    }

    // ==========================================
    // 視圖 B：我的臨打主畫面（開團資訊｜報名資訊）
    // ==========================================
    return (
        <div className="w-full min-h-full bg-[#F8F9FA] pb-16">
            {/* 頂部品牌與 Segmented Control */}
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

                <h1 className="text-xl font-extrabold text-gray-900 mb-3">我的臨打</h1>

                {/* Segmented Control：開團資訊｜報名資訊 */}
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

            {/* 內容區 */}
            <div className="p-4">
                {activeTab === "hosting" ? (
                    <div className="space-y-4">
                        {/* 頂部雙行動按鈕：＋開一場臨打 ＆ ↻套用上一次 */}
                        <div className="space-y-2">
                            <button
                                onClick={() => {
                                    setIsEditingSession(false);
                                    setShowCreateModal(true);
                                }}
                                className="w-full bg-green-700 text-white font-extrabold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 shadow-xs active:scale-98 transition"
                            >
                                <Plus size={18} strokeWidth={2.5} /> 開一場臨打
                            </button>
                            <button
                                onClick={handleApplyLastSession}
                                className="w-full bg-white text-green-800 border border-green-700 font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-98 transition"
                            >
                                <RotateCcw size={15} strokeWidth={2.5} /> 套用上一次
                            </button>
                        </div>

                        {/* 我開的臨打列表 */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <h2 className="text-sm font-extrabold text-green-800 border-b-2 border-green-700 pb-0.5">
                                    我開的臨打 ({myHostedSessions.length})
                                </h2>
                            </div>

                            {loading ? (
                                <p className="text-center py-10 text-xs text-gray-400 animate-pulse">
                                    載入開團資料中...
                                </p>
                            ) : myHostedSessions.length === 0 ? (
                                <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                                    <p className="text-gray-400 text-xs">
                                        目前還沒有建立臨打，點擊上方「＋ 開一場臨打」立即開團！
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {myHostedSessions.map((session) => {
                                        const players = session.open_play_players || [];
                                        const regPlayers = players.filter(
                                            (p: any) => p.status === "registered"
                                        );
                                        const cancelledPlayers = players.filter(
                                            (p: any) => p.status === "cancelled"
                                        );

                                        // 計算待核帳筆數（已回報末五碼或狀態為 reported，且尚未確認）
                                        const pendingVerifyCount = regPlayers.filter(
                                            (p: any) =>
                                                p.payment_status !== "paid" &&
                                                p.payment_status !== "confirmed" &&
                                                (p.payment_status === "reported" ||
                                                    Boolean(p.payment_account_last5))
                                        ).length;

                                        const isFull = regPlayers.length >= session.max_players;

                                        // 決定行動導向狀態膠囊（嚴格不使用模糊的「收款中」）
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
                                        } else if (isFull) {
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
                                                className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs flex items-center justify-between gap-3 cursor-pointer active:scale-99 transition"
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
                                                            {getCourtLabel(session)} | {regPlayers.length} /{" "}
                                                            {session.max_players} 人
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
                    /* ==========================================
                       報名資訊 Tab：我參加別人的臨打（名額與付款狀態明確分離）
                       ========================================== */
                    <div className="space-y-3">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-sm font-extrabold text-green-800 border-b-2 border-green-700 pb-0.5">
                                我報名的臨打 ({myJoinedEntries.length})
                            </h2>
                        </div>

                        {myJoinedEntries.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                                <p className="text-gray-400 text-xs">
                                    目前尚無報名紀錄，前往「找球打」挑選場次吧！
                                </p>
                            </div>
                        ) : (
                            myJoinedEntries.map(({ session, player }) => {
                                const allActive = (session.open_play_players || [])
                                    .filter((p: any) => p.status === "registered")
                                    .sort(
                                        (a: any, b: any) =>
                                            new Date(a.created_at).getTime() -
                                            new Date(b.created_at).getTime()
                                    );
                                const myRankIndex =
                                    allActive.findIndex((p: any) => p.id === player.id) + 1;

                                const waitList = (session.open_play_players || [])
                                    .filter((p: any) => p.status === "waitlisted")
                                    .sort(
                                        (a: any, b: any) =>
                                            new Date(a.created_at).getTime() -
                                            new Date(b.created_at).getTime()
                                    );
                                const myWaitIndex =
                                    waitList.findIndex((p: any) => p.id === player.id) + 1 || 1;

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
                                        className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs space-y-3"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="mt-1 shrink-0">
                                                    {player.status === "waitlisted" ? (
                                                        <div className="w-6 h-6 rounded-full bg-gray-500 text-white flex items-center justify-center">
                                                            <Users size={13} />
                                                        </div>
                                                    ) : isPendingVerify || !isPaid ? (
                                                        <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
                                                            <div className="w-2 h-2 rounded-full bg-white" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center">
                                                            <CheckCircle2 size={15} strokeWidth={3} />
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
                                                        {session.title} | {getCourtLabel(session)}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {player.status === "waitlisted"
                                                            ? `目前候補順位：第 ${myWaitIndex} 位`
                                                            : `我：第 ${myRankIndex || 1} 位 / 共 ${session.max_players
                                                            } 人`}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* 右側狀態區：明確解耦「已報名(名額)」與「待付款/待核帳/已付款(帳務)」 */}
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {player.status === "cancelled" ? (
                                                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-gray-100 text-gray-500">
                                                        已取消
                                                    </span>
                                                ) : player.status === "waitlisted" ? (
                                                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-700">
                                                        候補 {myWaitIndex}
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
                                                                🟡 待付款 (點此回報)
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

            {/* ==========================================
          Modal 1：開一場臨打 / 套用上一次（極簡表單）
         ========================================== */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm max-h-[85dvh] overflow-y-auto p-5 shadow-2xl">
                        <h2 className="text-lg font-extrabold text-gray-900 mb-3">
                            {isEditingSession ? "修改臨打活動" : "開一場臨打"}
                        </h2>
                        <form onSubmit={handleSaveSession} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-gray-700 block mb-1">
                                    1. 地點 / 場館
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formLocation}
                                    onChange={(e) => setFormLocation(e.target.value)}
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
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">
                                        3. 開始時間
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={formStartTime}
                                        onChange={(e) => setFormStartTime(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">
                                        4. 結束時間
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={formEndTime}
                                        onChange={(e) => setFormEndTime(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-gray-700 block mb-1">
                                    5. 選擇場地
                                </label>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {["場地 1", "場地 2", "場地 3", "場地 4"].map((c) => (
                                        <button
                                            type="button"
                                            key={c}
                                            onClick={() => setFormCourt(c)}
                                            className={`py-2 rounded-xl font-bold border transition ${formCourt === c
                                                    ? "bg-green-700 text-white border-green-700"
                                                    : "bg-gray-50 text-gray-700 border-gray-200"
                                                }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">
                                        6. 人數上限
                                    </label>
                                    <input
                                        type="number"
                                        min={2}
                                        max={64}
                                        value={formMaxPlayers}
                                        onChange={(e) => setFormMaxPlayers(Number(e.target.value))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-gray-700 block mb-1">
                                        7. 每人費用 ($)
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={formPrice}
                                        onChange={(e) => setFormPrice(Number(e.target.value))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-gray-700 block mb-1">
                                    8. 收款方式与帳戶（自動帶入個人設定，可臨時修改）
                                </label>
                                <div className="grid grid-cols-3 gap-1.5 mb-2">
                                    {["QR Code / 收款碼", "銀行轉帳", "現場付款"].map((m) => (
                                        <button
                                            type="button"
                                            key={m}
                                            onClick={() => setFormPaymentMethod(m)}
                                            className={`py-1.5 rounded-lg font-bold border text-[11px] ${formPaymentMethod === m
                                                    ? "border-green-700 bg-green-50 text-green-800"
                                                    : "border-gray-200 text-gray-600"
                                                }`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    placeholder="銀行帳號或收款碼連結 (選填)"
                                    value={formBankAccount || formPaymentLink}
                                    onChange={(e) => setFormBankAccount(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-gray-700 block mb-1">
                                    9. 取消規則
                                </label>
                                <input
                                    type="text"
                                    value={formCancelRule}
                                    onChange={(e) => setFormCancelRule(e.target.value)}
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
                                    {isSubmitting ? "發布中..." : "確認發布"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==========================================
          Modal 2：參加者回報付款
         ========================================== */}
            {payingRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3 shadow-2xl">
                        <h3 className="font-extrabold text-base text-gray-900">回報付款資訊</h3>
                        <p className="text-xs text-gray-500">
                            {payingRecord.session.title} · 費用 ${payingRecord.session.price}
                        </p>
                        <input
                            type="text"
                            placeholder="請輸入轉帳末五碼或 LINE Pay 序號"
                            value={payLast5}
                            onChange={(e) => setPayLast5(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPayingRecord(null)}
                                className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl text-xs"
                            >
                                取消
                            </button>
                            <button
                                onClick={handlePlayerReportPayment}
                                disabled={isSubmitting}
                                className="flex-[2] bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs"
                            >
                                送出回報
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}