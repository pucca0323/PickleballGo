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
    Lock,
    ShieldCheck,
    LogOut,
} from "lucide-react";

// 取得台灣本地 YYYY-MM-DD，避免 UTC 8 小時時差問題
const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

// 原生 Web Crypto API SHA-256 加鹽雜湊加密 (結合手機號碼作為動態 Salt，防範彩虹表反查)
async function hashPin(phone: string, pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const saltedData = encoder.encode(`picklego_salt_${phone.trim()}_${pin.trim()}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", saltedData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ProfilePage() {
    const [lineNickname, setLineNickname] = useState("Pickle 玩家");
    const [phone, setPhone] = useState("");
    const [pinCode, setPinCode] = useState("");
    const [isVerified, setIsVerified] = useState(false);

    const [paymentLink, setPaymentLink] = useState("");
    const [bankAccount, setBankAccount] = useState("");
    const [socialLink, setSocialLink] = useState("");

    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authPhone, setAuthPhone] = useState("");
    const [authPin, setAuthPin] = useState("");
    const [authNickname, setAuthNickname] = useState("");
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    const [editingField, setEditingField] = useState<
        "line" | "qr" | "bank" | "social" | null
    >(null);
    const [tempValue, setTempValue] = useState("");

    const [historyTab, setHistoryTab] = useState<"hosted" | "joined">("hosted");
    const [myHostedSessions, setMyHostedSessions] = useState<any[]>([]);
    const [myJoinedSessions, setMyJoinedSessions] = useState<any[]>([]);

    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState<"hosted" | "joined">("hosted");
    const [exportStartDate, setExportStartDate] = useState("");
    const [exportEndDate, setExportEndDate] = useState("");
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        let currentPhone = "";
        let currentLine = "";
        try {
            const saved = localStorage.getItem("picklego_user_profile");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.lineNickname) {
                    setLineNickname(parsed.lineNickname);
                    currentLine = parsed.lineNickname;
                }
                if (parsed.phone) {
                    setPhone(parsed.phone);
                    currentPhone = parsed.phone;
                }
                if (parsed.pinCode) {
                    setPinCode(parsed.pinCode);
                    setIsVerified(true);
                }
                if (parsed.paymentLink) setPaymentLink(parsed.paymentLink);
                if (parsed.bankAccount) setBankAccount(parsed.bankAccount);
                if (parsed.socialLink) setSocialLink(parsed.socialLink);
            }
        } catch (e) {
            console.error(e);
        }

        fetchHistory(currentPhone, currentLine);

        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        setExportEndDate(getLocalDateStr(today));
        setExportStartDate(getLocalDateStr(thirtyDaysAgo));
    }, []);

    const fetchHistory = async (targetPhone: string, targetLine: string) => {
        const { data } = await supabase
            .from("open_play_sessions")
            .select("*, courts(name), open_play_players(*)")
            .order("session_date", { ascending: false });

        if (data) {
            let hostedIds: string[] = [];
            try {
                const savedHosted = localStorage.getItem("picklego_hosted_sessions");
                if (savedHosted) hostedIds = JSON.parse(savedHosted);
            } catch (e) { }

            const hosted = data.filter(
                (s) =>
                    (targetPhone && s.host_phone === targetPhone) ||
                    hostedIds.includes(s.id)
            );
            setMyHostedSessions(hosted);

            const joined = data.filter((s) => {
                if (!s.open_play_players) return false;
                return s.open_play_players.some(
                    (player: any) =>
                        (targetPhone && player.phone === targetPhone) ||
                        (targetLine &&
                            (player.line_nickname === targetLine ||
                                player.display_name === targetLine))
                );
            });
            setMyJoinedSessions(joined);
        }
    };

    // 結合加鹽 SHA-256 雜湊加密、舊明文自動升級、以及本機開團紀錄自動認領的同步邏輯
    const handleVerifyAndSync = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!/^[0-9]{10}$/.test(authPhone.trim()))
            return alert("請輸入正確的 10 碼手機號碼！");
        if (!/^[0-9]{4}$/.test(authPin.trim()))
            return alert("請設定或輸入 4 位數字 PIN 碼！");

        setIsAuthLoading(true);
        try {
            const cleanPhone = authPhone.trim();
            const cleanPin = authPin.trim();

            // 產生加鹽後的 SHA-256 雜湊值
            const saltedHash = await hashPin(cleanPhone, cleanPin);

            // 相容舊版未加鹽雜湊 (若剛才已測試過未加鹽版本，也能順利通過並自動升級)
            const legacyUnsaltedBuffer = await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(cleanPin)
            );
            const legacyUnsaltedHash = Array.from(new Uint8Array(legacyUnsaltedBuffer))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");

            const { data: existingUser } = await supabase
                .from("users")
                .select("*")
                .eq("phone", cleanPhone)
                .maybeSingle();

            let finalProfile: any = null;

            if (existingUser) {
                const storedPin = existingUser.pin_code;
                const isMatch =
                    !storedPin ||
                    storedPin === saltedHash ||
                    storedPin === legacyUnsaltedHash ||
                    storedPin === cleanPin; // 相容最初的 4 碼明文並自動升級

                if (!isMatch) {
                    alert("❌ 4 碼 PIN 碼不正確！無法載入該手機號碼的個人資料。");
                    setIsAuthLoading(false);
                    return;
                }

                const nextNickname =
                    authNickname.trim() ||
                    existingUser.line_nickname ||
                    existingUser.name ||
                    lineNickname;

                // 自動將資料庫更新為最安全的加鹽雜湊值
                await supabase
                    .from("users")
                    .update({ pin_code: saltedHash, line_nickname: nextNickname, name: nextNickname })
                    .eq("phone", cleanPhone);

                finalProfile = {
                    phone: cleanPhone,
                    pinCode: saltedHash,
                    lineNickname: nextNickname,
                    paymentLink: existingUser.payment_link || paymentLink,
                    bankAccount: existingUser.bank_account || bankAccount,
                    socialLink: existingUser.social_link || socialLink,
                };
            } else {
                const finalNick = authNickname.trim() || lineNickname || "Pickle 玩家";
                finalProfile = {
                    phone: cleanPhone,
                    pinCode: saltedHash,
                    lineNickname: finalNick,
                    paymentLink,
                    bankAccount,
                    socialLink,
                };

                await supabase.from("users").upsert({
                    phone: cleanPhone,
                    name: finalNick,
                    line_nickname: finalNick,
                    pin_code: saltedHash,
                    payment_link: paymentLink || null,
                    bank_account: bankAccount || null,
                    social_link: socialLink || null,
                });
            }

            // 將本機曾經建立過但尚未綁定電話的開團紀錄，自動綁定到此手機號碼
            try {
                const savedHosted = localStorage.getItem("picklego_hosted_sessions");
                if (savedHosted) {
                    const hostedIds: string[] = JSON.parse(savedHosted);
                    if (hostedIds.length > 0) {
                        await supabase
                            .from("open_play_sessions")
                            .update({ host_phone: cleanPhone, host_name: finalProfile.lineNickname })
                            .in("id", hostedIds)
                            .is("host_phone", null);
                    }
                }
            } catch (e) { }

            setPhone(finalProfile.phone);
            setPinCode(finalProfile.pinCode);
            setLineNickname(finalProfile.lineNickname);
            setPaymentLink(finalProfile.paymentLink);
            setBankAccount(finalProfile.bankAccount);
            setSocialLink(finalProfile.socialLink);
            setIsVerified(true);

            localStorage.setItem("picklego_user_profile", JSON.stringify(finalProfile));
            await fetchHistory(cleanPhone, finalProfile.lineNickname);
            setShowAuthModal(false);
            alert("✅ 身分驗證與加密同步完成！您的開團與報名紀錄已全面綁定。");
        } catch (err: any) {
            alert("同步失敗：" + err.message);
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleLogout = () => {
        if (
            !confirm(
                "確定要在此裝置登出嗎？（雲端資料仍會保留，下次輸入手機與 PIN 碼即可取回）"
            )
        )
            return;
        localStorage.removeItem("picklego_user_profile");
        setPhone("");
        setPinCode("");
        setLineNickname("Pickle 玩家");
        setPaymentLink("");
        setBankAccount("");
        setSocialLink("");
        setIsVerified(false);
        setMyHostedSessions([]);
        setMyJoinedSessions([]);
    };

    const saveProfileField = async () => {
        if (editingField === "line" && !tempValue.trim()) {
            return alert("LINE 暱稱為必填！");
        }

        const nextProfile = {
            lineNickname: editingField === "line" ? tempValue.trim() : lineNickname,
            phone,
            pinCode,
            paymentLink: editingField === "qr" ? tempValue.trim() : paymentLink,
            bankAccount: editingField === "bank" ? tempValue.trim() : bankAccount,
            socialLink: editingField === "social" ? tempValue.trim() : socialLink,
        };

        setLineNickname(nextProfile.lineNickname);
        setPaymentLink(nextProfile.paymentLink);
        setBankAccount(nextProfile.bankAccount);
        setSocialLink(nextProfile.socialLink);

        localStorage.setItem("picklego_user_profile", JSON.stringify(nextProfile));

        if (nextProfile.phone) {
            await supabase.from("users").upsert({
                phone: nextProfile.phone,
                name: nextProfile.lineNickname,
                line_nickname: nextProfile.lineNickname,
                pin_code: nextProfile.pinCode || null,
                payment_link: nextProfile.paymentLink || null,
                bank_account: nextProfile.bankAccount || null,
                social_link: nextProfile.socialLink || null,
            });
        }

        setEditingField(null);
    };

    const formatDateWithDay = (dateStr: string) => {
        if (!dateStr) return "";
        const [y, m, d] = dateStr.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        const days = ["日", "一", "二", "三", "四", "五", "六"];
        return `${m}/${d} (${days[dateObj.getDay()]})`;
    };

    const getROCDateString = (dateStr: string) => {
        if (!dateStr) return "";
        const [y, m, d] = dateStr.split("-").map(Number);
        const rocYear = y - 1911;
        return `${rocYear}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
    };

    const formatDateTime = (isoStr: string) => {
        if (!isoStr) return "";
        const d = new Date(isoStr);
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(
            d.getHours()
        ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    const handleExportCSV = async () => {
        setIsExporting(true);
        try {
            const sourceData =
                exportType === "hosted" ? myHostedSessions : myJoinedSessions;
            const filteredSessions = sourceData.filter((s) => {
                return (
                    s.session_date >= exportStartDate && s.session_date <= exportEndDate
                );
            });

            if (filteredSessions.length === 0) {
                alert("所選區間內沒有資料可匯出！");
                setIsExporting(false);
                return;
            }

            let csvContent = "";
            if (exportType === "hosted") {
                csvContent +=
                    "活動日期,活動時間,場地,活動費用,報名狀態,球友暱稱,球友手機,付款方式,系統對帳碼,球友回報時間\n";
                filteredSessions.forEach((session) => {
                    const rocDate = getROCDateString(session.session_date);
                    const players = session.open_play_players || [];
                    if (players.length === 0) {
                        csvContent += `${session.session_date},${session.start_time?.slice(
                            0,
                            5
                        )},${session.courts?.name || session.title},${session.price || 0
                            },無人報名,---,---,---,---,---\n`;
                    } else {
                        players.forEach((p: any) => {
                            let reconcileCode = "---";
                            if (p.payment_method === "bank" && p.payment_account_last5) {
                                reconcileCode = `${rocDate}-${p.payment_account_last5}`;
                            } else if (
                                p.payment_method === "line" ||
                                p.payment_account_last5 === "TWQR"
                            ) {
                                const phoneSuffix = p.phone ? p.phone.slice(-3) : "000";
                                reconcileCode = `${rocDate}-${phoneSuffix}`;
                            }
                            const reportTime = p.payment_report_time
                                ? formatDateTime(p.payment_report_time)
                                : "尚未回報";
                            const statusName =
                                p.status === "registered"
                                    ? "正取"
                                    : p.status === "waitlisted"
                                        ? "候補"
                                        : "取消";
                            const safeName = (
                                p.display_name ||
                                p.line_nickname ||
                                "球友"
                            ).replace(/,/g, "，");
                            const safeCourt = (
                                session.courts?.name ||
                                session.title ||
                                "場地"
                            ).replace(/,/g, "，");

                            csvContent += `${session.session_date},${session.start_time?.slice(
                                0,
                                5
                            )},${safeCourt},${session.price || 0},${statusName},${safeName},${p.phone || "---"
                                },${p.payment_method || "---"},${reconcileCode},${reportTime}\n`;
                        });
                    }
                });
            } else {
                csvContent += "活動日期,活動時間,場地,活動費用,我的報名狀態\n";
                filteredSessions.forEach((session) => {
                    const safeCourt = (
                        session.courts?.name ||
                        session.title ||
                        "場地"
                    ).replace(/,/g, "，");
                    const myRecord = (session.open_play_players || []).find(
                        (p: any) => p.phone === phone || p.line_nickname === lineNickname
                    );
                    const statusName = myRecord
                        ? myRecord.status === "registered"
                            ? "已報名"
                            : myRecord.status === "waitlisted"
                                ? "候補中"
                                : "已取消"
                        : "未知";
                    csvContent += `${session.session_date},${session.start_time?.slice(
                        0,
                        5
                    )},${safeCourt},${session.price || 0},${statusName}\n`;
                });
            }

            const blob = new Blob(["\uFEFF" + csvContent], {
                type: "text/csv;charset=utf-8;",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute(
                "download",
                `PickleGo_${exportType === "hosted" ? "開團對帳" : "報名紀錄"
                }_${exportStartDate}_${exportEndDate}.csv`
            );
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setShowExportModal(false);
        } catch (err) {
            alert("匯出失敗，請稍後再試！");
        } finally {
            setIsExporting(false);
        }
    };

    const currentDisplaySessions =
        historyTab === "hosted" ? myHostedSessions : myJoinedSessions;

    return (
        <div className="w-full min-h-full bg-[#F8F9FA] pb-16">
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
                <div
                    className={`rounded-2xl p-4 border shadow-2xs flex items-center justify-between gap-3 ${isVerified
                            ? "bg-green-50/70 border-green-200"
                            : "bg-amber-50 border-amber-200"
                        }`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isVerified
                                    ? "bg-green-700 text-white"
                                    : "bg-amber-500 text-white"
                                }`}
                        >
                            {isVerified ? <ShieldCheck size={20} /> : <Lock size={18} />}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-extrabold text-gray-900">
                                {isVerified ? `已安全加密綁定 (${phone})` : "尚未綁定加密 PIN 碼"}
                            </p>
                            <p className="text-[11px] text-gray-600 mt-0.5">
                                {isVerified
                                    ? "PIN 碼已透過加鹽 SHA-256 保護，跨裝置輸入即可同步"
                                    : "設定手機與 4 碼 PIN，支援安全跨裝置同步"}
                            </p>
                        </div>
                    </div>
                    {isVerified ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={() => {
                                    setAuthPhone(phone);
                                    setAuthPin("");
                                    setAuthNickname(lineNickname);
                                    setShowAuthModal(true);
                                }}
                                className="text-xs font-bold text-green-800 bg-white px-2.5 py-1.5 rounded-xl border border-green-300"
                            >
                                切換帳號
                            </button>
                            <button
                                onClick={handleLogout}
                                className="p-1.5 text-gray-400 hover:text-red-500"
                                title="登出此裝置"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                setAuthPhone(phone);
                                setAuthPin("");
                                setAuthNickname(lineNickname);
                                setShowAuthModal(true);
                            }}
                            className="shrink-0 bg-gray-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl"
                        >
                            驗證 / 綁定
                        </button>
                    )}
                </div>

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
                            setAuthPhone(phone);
                            setAuthPin("");
                            setAuthNickname(lineNickname);
                            setShowAuthModal(true);
                        }}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                                <Phone size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">
                                    手機號碼 ＆ 安全 PIN <span className="text-red-500">*</span>
                                </p>
                                <p className="text-xs text-gray-600 truncate mt-0.5">
                                    {phone ? `${phone} (已加密保護)` : "點擊綁定手機號碼與加密 PIN"}
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>

                    <button
                        onClick={() => {
                            setEditingField("social");
                            setTempValue(socialLink);
                        }}
                        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                                <LinkIcon size={16} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900">社群連結 (選填)</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                    {socialLink || "可貼上 IG、FB 或個人網站連結"}
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
                                    {paymentLink || "TWQR收款碼例如街口、全支付、悠遊付、台灣PAY"}
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
                        <button
                            onClick={() => setHistoryTab("hosted")}
                            className={`py-2 rounded-lg text-xs font-extrabold transition-all ${historyTab === "hosted"
                                    ? "bg-green-700 text-white shadow-2xs"
                                    : "text-gray-600"
                                }`}
                        >
                            開團紀錄 ({myHostedSessions.length})
                        </button>
                        <button
                            onClick={() => setHistoryTab("joined")}
                            className={`py-2 rounded-lg text-xs font-extrabold transition-all ${historyTab === "joined"
                                    ? "bg-green-700 text-white shadow-2xs"
                                    : "text-gray-600"
                                }`}
                        >
                            報名紀錄 ({myJoinedSessions.length})
                        </button>
                    </div>

                    <div className="space-y-2.5">
                        {currentDisplaySessions.length === 0 ? (
                            <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-xs border border-gray-100">
                                目前尚無屬於您的紀錄
                            </div>
                        ) : (
                            currentDisplaySessions.map((s) => {
                                const regCount =
                                    s.open_play_players?.filter(
                                        (p: any) => p.status === "registered"
                                    ).length || 0;
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
                                                    {s.title} | {s.courts?.name || "1號場地"}
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
                                                                ? "開團滿團"
                                                                : "我開的團"
                                                            : "已參加"}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
                        <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-1.5">
                            <ShieldCheck size={20} className="text-green-700" />
                            身分驗證與安全加密同步
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            輸入您的<strong>手機號碼</strong>與<strong>專屬 4 碼 PIN 碼</strong>。系統會以加鹽 SHA-256 進行不可逆加密後再存入資料庫，確保您的密碼絕對安全。
                        </p>
                        <form onSubmit={handleVerifyAndSync} className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-gray-700 block mb-1">
                                    手機號碼 (10碼) *
                                </label>
                                <input
                                    type="tel"
                                    required
                                    placeholder="例：0912345678"
                                    maxLength={10}
                                    value={authPhone}
                                    onChange={(e) =>
                                        setAuthPhone(e.target.value.replace(/[^0-9]/g, ""))
                                    }
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-gray-700 block mb-1">
                                    個人專屬 4 碼 PIN 碼 (數字) *
                                </label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    required
                                    placeholder="請輸入 4 位數字密碼 (如 8888)"
                                    maxLength={4}
                                    value={authPin}
                                    onChange={(e) =>
                                        setAuthPin(e.target.value.replace(/[^0-9]/g, ""))
                                    }
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 tracking-widest font-bold"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-gray-700 block mb-1">
                                    LINE 暱稱 (首次綁定可填)
                                </label>
                                <input
                                    type="text"
                                    placeholder="您的稱呼或 LINE 暱稱"
                                    value={authNickname}
                                    onChange={(e) => setAuthNickname(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAuthModal(false)}
                                    className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAuthLoading}
                                    className="flex-[2] bg-green-700 text-white font-bold py-2.5 rounded-xl disabled:opacity-50"
                                >
                                    {isAuthLoading ? "加密驗證同步中..." : "確認安全驗證 / 同步"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {editingField && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3 shadow-2xl">
                        <h3 className="font-extrabold text-base text-gray-900">
                            {editingField === "line" && "設定 LINE 暱稱"}
                            {editingField === "qr" && "設定付款碼連結"}
                            {editingField === "bank" && "設定銀行帳戶"}
                            {editingField === "social" && "設定社群連結"}
                        </h3>
                        {editingField === "qr" && (
                            <p className="text-xs text-gray-500 -mt-1 mb-2">
                                可貼上街口、全支付、悠遊付、台灣PAY 等 TWQR 通用收款連結。
                            </p>
                        )}
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
                        <div className="flex gap-2 pt-1">
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

            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
                        <h3 className="font-extrabold text-lg text-gray-900 flex items-center gap-1.5">
                            <Download size={20} className="text-green-700" /> 匯出資料報表 (CSV)
                        </h3>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-gray-700 block mb-1">
                                    1. 報表類型
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setExportType("hosted")}
                                        className={`py-2 rounded-xl font-bold border transition ${exportType === "hosted"
                                                ? "bg-green-700 text-white border-green-700"
                                                : "bg-gray-50 text-gray-600 border-gray-200"
                                            }`}
                                    >
                                        開團對帳報表
                                    </button>
                                    <button
                                        onClick={() => setExportType("joined")}
                                        className={`py-2 rounded-xl font-bold border transition ${exportType === "joined"
                                                ? "bg-green-700 text-white border-green-700"
                                                : "bg-gray-50 text-gray-600 border-gray-200"
                                            }`}
                                    >
                                        個人報名紀錄
                                    </button>
                                </div>
                                {exportType === "hosted" && (
                                    <p className="text-gray-500 mt-1.5">
                                        💡 開團報表會自動產生對帳碼與回報時間，方便您使用 Excel 快速對帳。
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="font-bold text-gray-700 block mb-1">
                                    2. 時間區間 (活動日期)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900"
                                    />
                                    <span className="text-gray-400 font-bold">至</span>
                                    <input
                                        type="date"
                                        value={exportEndDate}
                                        onChange={(e) => setExportEndDate(e.target.value)}
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-gray-900"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl text-xs"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleExportCSV}
                                disabled={isExporting}
                                className="flex-[2] bg-green-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                                {isExporting ? "產生中..." : "下載 CSV"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}