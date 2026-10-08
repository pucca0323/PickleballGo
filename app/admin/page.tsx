"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  Plus,
  X,
  Edit,
  Trash2,
  CheckCircle,
  DollarSign,
  Calendar,
  CreditCard,
  AlertCircle,
  Download,
  Settings,
  Copy,
  UserPlus,
  Wrench,
  Search,
  UserCheck,
  Clock,
  Eye,
  MousePointerClick,
  CalendarPlus,
} from "lucide-react";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputUsername, setInputUsername] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'courts' | 'classes' | 'open_plays' | 'settings'>('dashboard');

  const [courtsList, setCourtsList] = useState<any[]>([]);
  const [courtBookings, setCourtBookings] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [openPlaySessions, setOpenPlaySessions] = useState<any[]>([]);

  // 現場核銷搜尋關鍵字
  const [checkInKeyword, setCheckInKeyword] = useState("");

  // 資料庫持久化設定
  const [venueName, setVenueName] = useState("匹克球館");
  const [adminUser, setAdminUser] = useState("admin");
  const [adminPass, setAdminPass] = useState("888");
  const [lineUrl, setLineUrl] = useState("https://lin.ee/your_line_id");
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [cancelLimitHours, setCancelLimitHours] = useState("3");

  const [tempVenueName, setTempVenueName] = useState("匹克球館");
  const [tempAdminUser, setTempAdminUser] = useState("admin");
  const [tempAdminPass, setTempAdminPass] = useState("888");
  const [tempLineUrl, setTempLineUrl] = useState("https://lin.ee/your_line_id");
  const [tempAnnouncementActive, setTempAnnouncementActive] = useState(false);
  const [tempAnnouncementText, setTempAnnouncementText] = useState("");
  const [tempCancelLimitHours, setTempCancelLimitHours] = useState("3");

  // 🌟 動態費率與特殊日狀態
  const [pricingRules, setPricingRules] = useState<any[]>([]);
  const [specialDates, setSpecialDates] = useState<any[]>([]);
  const [newSpecialDate, setNewSpecialDate] = useState("");
  const [newSpecialDesc, setNewSpecialDesc] = useState("");

  // 新增費率規則表單狀態
  const [newRuleDayType, setNewRuleDayType] = useState("weekday");
  const [newRuleStart, setNewRuleStart] = useState("08:00");
  const [newRuleEnd, setNewRuleEnd] = useState("18:00");
  const [newRulePrice, setNewRulePrice] = useState(250);

  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split("T")[0]);

  const [isAddingClass, setIsAddingClass] = useState(false);
  const [isAddingOpenPlay, setIsAddingOpenPlay] = useState(false);

  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingOpenPlayId, setEditingOpenPlayId] = useState<string | null>(null);

  // 視覺化快選功能狀態
  const [showVisualSchedule, setShowVisualSchedule] = useState(false);
  const [visualDate, setVisualDate] = useState(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    return new Date(tmrw.getTime() - tmrw.getTimezoneOffset() * 60000).toISOString().split("T")[0];
  });
  const [selectedGrid, setSelectedGrid] = useState<string[]>([]);

  // 代客登記臨打 Modal 狀態
  const [agentBookingSession, setAgentBookingSession] = useState<any | null>(null);
  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentStatus, setAgentStatus] = useState<'registered' | 'waitlisted'>('registered');
  const [agentPaymentStatus, setAgentPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [agentNotes, setAgentNotes] = useState("");
  const [isAgentSubmitting, setIsAgentSubmitting] = useState(false);

  const [newClass, setNewClass] = useState({
    title: '',
    coach: '',
    class_date: '',
    start_time: '14:00',
    end_time: '16:00',
    price: 800,
    max_players: 4,
    court_id: '',
    notes: '',
  });

  const [newOpenPlay, setNewOpenPlay] = useState({
    title: '',
    level: ['2.5'],
    session_date: '',
    start_time: '19:00',
    end_time: '21:00',
    price: 200,
    max_players: 8,
    max_waitlist: 2,
    court_ids: [] as string[],
    notes: '',
  });

  const [editClass, setEditClass] = useState({
    title: '',
    coach: '',
    class_date: '',
    start_time: '',
    end_time: '',
    price: 800,
    max_players: 4,
    court_id: '',
    notes: '',
  });

  const [editOpenPlay, setEditOpenPlay] = useState({
    title: '',
    level: [] as string[],
    session_date: '',
    start_time: '',
    end_time: '',
    price: 200,
    max_players: 8,
    max_waitlist: 2,
    court_ids: [] as string[],
    notes: '',
  });

  const fetchSettings = async () => {
    const { data, error } = await supabase.from("settings").select("*");
    if (!error && data) {
      const configMap: Record<string, string> = {};
      data.forEach((item: { key: string; value: string }) => {
        configMap[item.key] = item.value;
      });

      const fetchedVenue = configMap["venue_name"] || "匹克球館";
      const fetchedUser = configMap["admin_username"] || "admin";
      const fetchedPass = configMap["admin_password"] || "888";
      const fetchedLine = configMap["line_url"] || "https://lin.ee/your_line_id";
      const fetchedAnnounceActive = configMap["announcement_active"] === "true";
      const fetchedAnnounceText = configMap["announcement_text"] || "";
      const fetchedCancelLimit = configMap["cancel_limit_hours"] || "3";

      setVenueName(fetchedVenue);
      setAdminUser(fetchedUser);
      setAdminPass(fetchedPass);
      setLineUrl(fetchedLine);
      setAnnouncementActive(fetchedAnnounceActive);
      setAnnouncementText(fetchedAnnounceText);
      setCancelLimitHours(fetchedCancelLimit);

      setTempVenueName(fetchedVenue);
      setTempAdminUser(fetchedUser);
      setTempAdminPass(fetchedPass);
      setTempLineUrl(fetchedLine);
      setTempAnnouncementActive(fetchedAnnounceActive);
      setTempAnnouncementText(fetchedAnnounceText);
      setTempCancelLimitHours(fetchedCancelLimit);
      return { fetchedUser, fetchedPass };
    }
    return { fetchedUser: adminUser, fetchedPass: adminPass };
  };

  useEffect(() => {
    const init = async () => {
      await fetchSettings();
      const auth = sessionStorage.getItem("pickle_admin_auth");
      if (auth === "true") {
        setIsAuthenticated(true);
        fetchAllData();
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { fetchedUser, fetchedPass } = await fetchSettings();

    if (inputUsername.trim() === fetchedUser && inputPassword.trim() === fetchedPass) {
      sessionStorage.setItem("pickle_admin_auth", "true");
      setIsAuthenticated(true);
      fetchAllData();
    } else {
      alert("帳號或密碼錯誤！");
      setInputPassword("");
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("pickle_admin_auth");
    setIsAuthenticated(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    const updates = [
      { key: "venue_name", value: tempVenueName.trim(), updated_at: new Date().toISOString() },
      { key: "admin_username", value: tempAdminUser.trim(), updated_at: new Date().toISOString() },
      { key: "admin_password", value: tempAdminPass.trim(), updated_at: new Date().toISOString() },
      { key: "line_url", value: tempLineUrl.trim(), updated_at: new Date().toISOString() },
      { key: "announcement_active", value: tempAnnouncementActive ? "true" : "false", updated_at: new Date().toISOString() },
      { key: "announcement_text", value: tempAnnouncementText.trim(), updated_at: new Date().toISOString() },
      { key: "cancel_limit_hours", value: tempCancelLimitHours.trim(), updated_at: new Date().toISOString() },
    ];

    const { error } = await supabase.from("settings").upsert(updates);

    if (error) {
      alert("設定儲存失敗：" + error.message);
    } else {
      setVenueName(tempVenueName.trim());
      setAdminUser(tempAdminUser.trim());
      setAdminPass(tempAdminPass.trim());
      setLineUrl(tempLineUrl.trim());
      setAnnouncementActive(tempAnnouncementActive);
      setAnnouncementText(tempAnnouncementText.trim());
      setCancelLimitHours(tempCancelLimitHours.trim());
      alert("✅ 設定已成功同步至資料庫！");
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    const { data: courtsOptions } = await supabase.from("courts").select("*").order("name");
    if (courtsOptions) setCourtsList(courtsOptions);

    // 🌟 撈取動態費率規則
    const { data: rulesData } = await supabase.from("pricing_rules").select("*").order("day_type").order("start_time");
    if (rulesData) setPricingRules(rulesData);

    // 🌟 撈取特殊日 / 國定假日
    const { data: specialsData } = await supabase.from("special_dates").select("*").order("date", { ascending: true });
    if (specialsData) setSpecialDates(specialsData);

    const { data: courtsData } = await supabase
      .from("court_bookings")
      .select(`*, users (name, phone), courts (name)`)
      .order("booking_date", { ascending: false })
      .order("court_id", { ascending: true })
      .order("user_id", { ascending: true })
      .order("start_time", { ascending: true });

    if (courtsData) {
      const groupedCourts = [];
      let currentGroup: any = null;

      for (const b of courtsData) {
        if (!currentGroup) {
          currentGroup = { ...b, ids: [b.id], totalPrice: b.price || 250 };
        } else {
          const isContiguous =
            currentGroup.booking_date === b.booking_date &&
            currentGroup.court_id === b.court_id &&
            currentGroup.user_id === b.user_id &&
            currentGroup.status === b.status &&
            currentGroup.payment_method === b.payment_method &&
            currentGroup.payment_status === b.payment_status &&
            currentGroup.end_time === b.start_time;

          if (isContiguous) {
            currentGroup.end_time = b.end_time;
            currentGroup.ids.push(b.id);
            currentGroup.totalPrice += b.price || 250;
          } else {
            groupedCourts.push(currentGroup);
            currentGroup = { ...b, ids: [b.id], totalPrice: b.price || 250 };
          }
        }
      }
      if (currentGroup) groupedCourts.push(currentGroup);
      setCourtBookings(groupedCourts);
    }

    const { data: classesData } = await supabase
      .from("classes")
      .select(`
        *,
        courts (name),
        class_bookings (id, status, notes, need_paddle, payment_method, payment_status, is_checked_in, users (name, phone))
      `)
      .order("class_date", { ascending: false });
    if (classesData) setClassesList(classesData);

    const { data: openPlaysData } = await supabase
      .from("open_play_sessions")
      .select(`*, courts(name), open_play_players (id, status, created_at, player_notes, payment_method, payment_status, is_checked_in, users (name, phone))`)
      .order("session_date", { ascending: false });
    if (openPlaysData) setOpenPlaySessions(openPlaysData);

    setLoading(false);
  };

  // 🌟 特殊日新增與刪除 Handler
  const handleAddSpecialDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpecialDate) return alert("請選擇日期！");

    const { error } = await supabase.from("special_dates").insert([
      { date: newSpecialDate, description: newSpecialDesc.trim() || '國定假日' }
    ]);

    if (error) {
      alert("新增失敗 (可能該日期已存在)：" + error.message);
    } else {
      setNewSpecialDate("");
      setNewSpecialDesc("");
      alert("✅ 國定假日新增成功！");
      fetchAllData();
    }
  };

  const handleDeleteSpecialDate = async (dateStr: string) => {
    if (!confirm(`確定要刪除 ${dateStr} 這個國定假日設定嗎？`)) return;
    const { error } = await supabase.from("special_dates").delete().eq("date", dateStr);
    if (error) alert("刪除失敗：" + error.message);
    else fetchAllData();
  };

  // 🌟 費率規則新增與刪除 Handler
  const handleAddPricingRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("pricing_rules").insert([
      { day_type: newRuleDayType, start_time: newRuleStart, end_time: newRuleEnd, price: Number(newRulePrice) }
    ]);

    if (error) {
      alert("新增費率失敗：" + error.message);
    } else {
      alert("✅ 費率規則新增成功！");
      fetchAllData();
    }
  };

  const handleDeletePricingRule = async (ruleId: string) => {
    if (!confirm("確定要刪除這條費率規則嗎？")) return;
    const { error } = await supabase.from("pricing_rules").delete().eq("id", ruleId);
    if (error) alert("刪除失敗：" + error.message);
    else fetchAllData();
  };

  // 時間字串轉分鐘，方便比較時段
  const timeToMins = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const minsToTime = (mins: number) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let i = 8; i < 24; i++) {
      slots.push(`${i.toString().padStart(2, '0')}:00`);
      slots.push(`${i.toString().padStart(2, '0')}:30`);
    }
    return slots;
  }, []);

  const checkIsOccupied = (courtId: string, timeSlot: string) => {
    const slotMins = timeToMins(timeSlot);

    const cBooking = courtBookings.find(b =>
      b.status === 'booked' &&
      b.booking_date === visualDate &&
      b.court_id === courtId &&
      timeToMins(b.start_time) <= slotMins &&
      timeToMins(b.end_time) > slotMins
    );
    if (cBooking) return { occupied: true, label: '私人預約' };

    const classBooking = classesList.find(c =>
      c.status !== 'cancelled' &&
      c.class_date === visualDate &&
      c.court_id === courtId &&
      timeToMins(c.start_time) <= slotMins &&
      timeToMins(c.end_time) > slotMins
    );
    if (classBooking) return { occupied: true, label: '課程' };

    const opBooking = openPlaySessions.find(op =>
      op.status !== 'cancelled' &&
      op.session_date === visualDate &&
      op.court_ids?.includes(courtId) &&
      timeToMins(op.start_time) <= slotMins &&
      timeToMins(op.end_time) > slotMins
    );
    if (opBooking) return { occupied: true, label: '臨打' };

    return { occupied: false, label: '' };
  };

  const toggleCellSelection = (cellKey: string) => {
    setSelectedGrid(prev =>
      prev.includes(cellKey) ? prev.filter(k => k !== cellKey) : [...prev, cellKey]
    );
  };

  const handleQuickConvertOpenPlay = () => {
    if (selectedGrid.length === 0) return alert("請先點擊綠色格子選擇空檔！");

    const courts = new Set<string>();
    let minMins = 9999;
    let maxMins = 0;

    selectedGrid.forEach(cell => {
      const [cIdStr, timeStr] = cell.split('_');
      courts.add(cIdStr);
      const mins = timeToMins(timeStr);
      if (mins < minMins) minMins = mins;
      if (mins > maxMins) maxMins = mins;
    });

    const startTime = minsToTime(minMins);
    const endTime = minsToTime(maxMins + 30);

    setNewOpenPlay({
      title: '歡樂臨打團',
      level: ['2.5'],
      session_date: visualDate,
      start_time: startTime,
      end_time: endTime,
      price: 200,
      max_players: courts.size * 6,
      max_waitlist: 2,
      court_ids: Array.from(courts),
      notes: '',
    });

    setShowVisualSchedule(false);
    setIsAddingOpenPlay(true);
    setSelectedGrid([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const todayCheckInList = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const list: any[] = [];

    openPlaySessions.forEach((session) => {
      if (session.session_date === today) {
        session.open_play_players?.forEach((p: any) => {
          if (p.status === "registered") {
            list.push({
              id: p.id,
              tableName: "open_play_players",
              type: "臨打",
              title: session.title,
              time: `${session.start_time?.slice(0, 5)} - ${session.end_time?.slice(0, 5)}`,
              name: p.users?.name || "未填寫",
              phone: p.users?.phone || "",
              price: session.price || 0,
              paymentStatus: p.payment_status,
              paymentMethod: p.payment_method,
              isCheckedIn: !!p.is_checked_in,
              notes: p.player_notes,
            });
          }
        });
      }
    });

    classesList.forEach((cls) => {
      if (cls.class_date === today) {
        cls.class_bookings?.forEach((b: any) => {
          if (b.status !== "cancelled") {
            list.push({
              id: b.id,
              tableName: "class_bookings",
              type: "課程",
              title: cls.title,
              time: `${cls.start_time?.slice(0, 5)} - ${cls.end_time?.slice(0, 5)}`,
              name: b.users?.name || "未填寫",
              phone: b.users?.phone || "",
              price: cls.price || 0,
              paymentStatus: b.payment_status,
              paymentMethod: b.payment_method,
              isCheckedIn: !!b.is_checked_in,
              notes: b.need_paddle ? "🏓 需租借球拍" : b.notes,
            });
          }
        });
      }
    });

    courtBookings.forEach((b) => {
      if (b.booking_date === today && b.status === "booked") {
        list.push({
          id: b.ids[0],
          ids: b.ids,
          tableName: "court_bookings",
          type: "場地",
          title: b.courts?.name || "球場",
          time: `${b.start_time?.slice(0, 5)} - ${b.end_time?.slice(0, 5)}`,
          name: b.users?.name || "未填寫",
          phone: b.users?.phone || "",
          price: b.totalPrice || 250,
          paymentStatus: b.payment_status,
          paymentMethod: b.payment_method,
          isCheckedIn: !!b.is_checked_in,
          notes: `${b.ids.length * 0.5}h`,
        });
      }
    });

    if (!checkInKeyword.trim()) return list;

    const kw = checkInKeyword.trim().toLowerCase();
    return list.filter(
      (item) => item.name.toLowerCase().includes(kw) || item.phone.includes(kw)
    );
  }, [openPlaySessions, classesList, courtBookings, checkInKeyword]);

  const handleToggleCheckIn = async (tableName: string, id: string | number) => {
    try {
      const { data, error } = await supabase.rpc("toggle_check_in", {
        p_table_name: tableName,
        p_booking_id: String(id),
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      fetchAllData();
    } catch (err: any) {
      alert("簽到狀態切換失敗：" + (err.message || "系統錯誤"));
    }
  };

  const isInDateRange = (dateStr: string) => {
    if (!dateStr) return false;
    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();

    if (dateFilter === 'today') return dateStr === todayStr;

    const targetDate = new Date(dateStr);
    if (dateFilter === 'week') {
      const diffTime = targetDate.getTime() - now.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    if (dateFilter === 'month') {
      return targetDate.getMonth() === now.getMonth() && targetDate.getFullYear() === now.getFullYear();
    }
    if (dateFilter === 'custom') {
      return dateStr >= customStartDate && dateStr <= customEndDate;
    }
    return true;
  };

  const calculateMetrics = () => {
    let totalEstimated = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let courtRev = 0;
    let classRev = 0;
    let openPlayRev = 0;

    let courtPendingCount = 0;
    let classPendingCount = 0;
    let openPlayPendingCount = 0;

    courtBookings.forEach((b) => {
      if (b.status === 'booked' && isInDateRange(b.booking_date)) {
        const amt = b.totalPrice || 0;
        totalEstimated += amt;
        courtRev += amt;
        if (b.payment_status === 'paid') {
          totalCollected += amt;
        } else {
          totalPending += amt;
          courtPendingCount += 1;
        }
      }
    });

    classesList.forEach((cls) => {
      if (isInDateRange(cls.class_date)) {
        const price = cls.price || 0;
        cls.class_bookings?.forEach((cb: any) => {
          if (cb.status !== 'cancelled') {
            totalEstimated += price;
            classRev += price;
            if (cb.payment_status === 'paid') {
              totalCollected += price;
            } else {
              totalPending += price;
              classPendingCount += 1;
            }
          }
        });
      }
    });

    openPlaySessions.forEach((session) => {
      if (isInDateRange(session.session_date)) {
        const price = session.price || 0;
        session.open_play_players?.forEach((p: any) => {
          if (p.status === 'registered') {
            totalEstimated += price;
            openPlayRev += price;
            if (p.payment_status === 'paid') {
              totalCollected += price;
            } else {
              totalPending += price;
              openPlayPendingCount += 1;
            }
          }
        });
      }
    });

    return {
      totalEstimated,
      totalCollected,
      totalPending,
      courtRev,
      classRev,
      openPlayRev,
      courtPendingCount,
      classPendingCount,
      openPlayPendingCount,
    };
  };

  const metrics = calculateMetrics();

  const handleExportCSV = () => {
    const csvRows = [];
    csvRows.push(["日期", "類別", "項目名稱", "姓名", "電話", "付款方式", "金額", "收款狀態"]);

    courtBookings.forEach((b) => {
      if (b.status === 'booked' && isInDateRange(b.booking_date)) {
        csvRows.push([
          b.booking_date,
          "場地租借",
          `${b.courts?.name} (${b.start_time?.slice(0, 5)}-${b.end_time?.slice(0, 5)})`,
          b.users?.name || '',
          b.users?.phone || '',
          b.payment_method === 'online' ? '線上付款' : '現場付款',
          b.totalPrice || 250,
          b.payment_status === 'paid' ? '已收款' : '待收款',
        ]);
      }
    });

    classesList.forEach((cls) => {
      if (isInDateRange(cls.class_date)) {
        cls.class_bookings?.forEach((cb: any) => {
          if (cb.status !== 'cancelled') {
            csvRows.push([
              cls.class_date,
              "體驗課程",
              cls.title,
              cb.users?.name || '',
              cb.users?.phone || '',
              cb.payment_method === 'online' ? '線上付款' : '現場付款',
              cls.price || 0,
              cb.payment_status === 'paid' ? '已收款' : '待收款',
            ]);
          }
        });
      }
    });

    openPlaySessions.forEach((session) => {
      if (isInDateRange(session.session_date)) {
        session.open_play_players?.forEach((p: any) => {
          if (p.status === 'registered') {
            csvRows.push([
              session.session_date,
              "臨打活動",
              session.title,
              p.users?.name || '',
              p.users?.phone || '',
              p.payment_method === 'online' ? '線上付款' : '現場付款',
              session.price || 0,
              p.payment_status === 'paid' ? '已收款' : '待收款',
            ]);
          }
        });
      }
    });

    const csvContent = "\uFEFF" + csvRows.map((e) => e.map((val) => `"${val}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `revenue_report_${dateFilter === 'custom' ? `${customStartDate}_to_${customEndDate}` : dateFilter}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleCourtPayment = async (ids: string[], currentStatus: string) => {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    await supabase.from("court_bookings").update({ payment_status: nextStatus }).in("id", ids);
    fetchAllData();
  };

  const handleToggleClassPayment = async (bookingId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    await supabase.from("class_bookings").update({ payment_status: nextStatus }).eq("id", bookingId);
    fetchAllData();
  };

  const handleToggleOpenPlayPayment = async (playerId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    await supabase.from("open_play_players").update({ payment_status: nextStatus }).eq("id", playerId);
    fetchAllData();
  };

  const handleCancelCourt = async (targetId: string | string[]) => {
    if (!confirm("確定要取消這筆場地預約嗎？")) return;
    const ids = Array.isArray(targetId) ? targetId : [targetId];
    await supabase.from("court_bookings").update({ status: "cancelled" }).in("id", ids);
    fetchAllData();
  };

  const handleToggleCourtStatus = async (courtId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'maintenance' : 'active';
    const msg = nextStatus === 'maintenance' ? '確定要將此場地設為「維修中」嗎？(前台將無法預約)' : '確定要重新開放此場地嗎？';
    if (!confirm(msg)) return;

    await supabase.from("courts").update({ status: nextStatus }).eq("id", courtId);
    fetchAllData();
  };

  const submitNewClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...newClass, status: 'open', court_id: newClass.court_id === '' ? null : newClass.court_id };
    await supabase.from("classes").insert([payload]);
    alert("🎉 課程新增成功！");
    setIsAddingClass(false);
    setNewClass({
      title: '',
      coach: '',
      class_date: '',
      start_time: '14:00',
      end_time: '16:00',
      price: 800,
      max_players: 4,
      court_id: '',
      notes: '',
    });
    fetchAllData();
  };

  const submitEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...editClass, court_id: editClass.court_id === '' ? null : editClass.court_id };
    await supabase.from("classes").update(payload).eq("id", editingClassId);
    alert("✏️ 課程修改成功！");
    setEditingClassId(null);
    fetchAllData();
  };

  const startEditingClass = (cls: any) => {
    setEditClass({
      title: cls.title,
      coach: cls.coach,
      class_date: cls.class_date,
      start_time: cls.start_time,
      end_time: cls.end_time,
      price: cls.price,
      max_players: cls.max_players,
      court_id: cls.court_id || '',
      notes: cls.notes || '',
    });
    setEditingClassId(cls.id);
  };

  const handleDuplicateClass = (cls: any) => {
    setNewClass({
      title: cls.title,
      coach: cls.coach,
      class_date: '',
      start_time: cls.start_time?.slice(0, 5) || '14:00',
      end_time: cls.end_time?.slice(0, 5) || '16:00',
      price: cls.price,
      max_players: cls.max_players,
      court_id: cls.court_id || '',
      notes: cls.notes || '',
    });
    setIsAddingClass(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelClassBooking = async (bookingId: string) => {
    if (!confirm("確定要取消這位學生的報名嗎？")) return;
    await supabase.from("class_bookings").update({ status: "cancelled" }).eq("id", bookingId);
    fetchAllData();
  };

  const handleDeleteClassSession = async (classId: string) => {
    if (!confirm("⚠️ 確定要刪除這個課程場次嗎？")) return;
    await supabase.from("class_bookings").delete().eq("class_id", classId);
    await supabase.from("classes").delete().eq("id", classId);
    fetchAllData();
  };

  const submitNewOpenPlay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOpenPlay.level.length === 0) return alert("請至少選擇一個 DUPR 等級");
    if (newOpenPlay.court_ids.length === 0) return alert("請至少選擇一個開放場地");

    try {
      const { data, error } = await supabase.rpc("create_open_play_session", {
        p_title: newOpenPlay.title,
        p_level: newOpenPlay.level.join(', '),
        p_session_date: newOpenPlay.session_date,
        p_start_time: newOpenPlay.start_time,
        p_end_time: newOpenPlay.end_time,
        p_price: newOpenPlay.price,
        p_max_players: newOpenPlay.max_players,
        p_max_waitlist: newOpenPlay.max_waitlist,
        p_court_ids: newOpenPlay.court_ids,
        p_notes: newOpenPlay.notes || null,
      });

      if (error) throw error;

      if (!data.success) {
        alert(`⚠️ ${data.message}`);
        return;
      }

      alert("🎉 臨打場次新增成功！");
      setIsAddingOpenPlay(false);
      setNewOpenPlay({
        title: '',
        level: ['2.5'],
        session_date: '',
        start_time: '19:00',
        end_time: '21:00',
        price: 200,
        max_players: 8,
        max_waitlist: 2,
        court_ids: [],
        notes: '',
      });
      fetchAllData();
    } catch (err: any) {
      alert("❌ 新增失敗：" + (err.message || "系統錯誤"));
    }
  };

  const submitEditOpenPlay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editOpenPlay.level.length === 0) return alert("請至少選擇一個 DUPR 等級");
    if (editOpenPlay.court_ids.length === 0) return alert("請至少選擇一個開放場地");

    const payload = {
      title: editOpenPlay.title,
      level: editOpenPlay.level.join(', '),
      session_date: editOpenPlay.session_date,
      start_time: editOpenPlay.start_time,
      end_time: editOpenPlay.end_time,
      price: editOpenPlay.price,
      max_players: editOpenPlay.max_players,
      max_waitlist: editOpenPlay.max_waitlist,
      court_ids: editOpenPlay.court_ids,
      court_id: editOpenPlay.court_ids[0],
      notes: editOpenPlay.notes,
    };

    const { error } = await supabase.from("open_play_sessions").update(payload).eq("id", editingOpenPlayId);

    if (error) {
      alert("❌ 修改失敗！\n錯誤訊息：" + error.message);
      return;
    }

    alert("✏️ 臨打場次修改成功！");
    setEditingOpenPlayId(null);
    fetchAllData();
  };

  const startEditingOpenPlay = (session: any) => {
    setEditOpenPlay({
      title: session.title,
      level: session.level ? session.level.split(',').map((l: string) => l.trim()) : ['2.5'],
      session_date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
      price: session.price,
      max_players: session.max_players,
      max_waitlist: session.max_waitlist,
      court_ids: session.court_ids || (session.court_id ? [session.court_id] : []),
      notes: session.notes || '',
    });
    setEditingOpenPlayId(session.id);
  };

  const handleDuplicateOpenPlay = (session: any) => {
    setNewOpenPlay({
      title: session.title,
      level: session.level ? session.level.split(',').map((l: string) => l.trim()) : ['2.5'],
      session_date: '',
      start_time: session.start_time?.slice(0, 5) || '19:00',
      end_time: session.end_time?.slice(0, 5) || '21:00',
      price: session.price,
      max_players: session.max_players,
      max_waitlist: session.max_waitlist,
      court_ids: session.court_ids || (session.court_id ? [session.court_id] : []),
      notes: session.notes || '',
    });
    setIsAddingOpenPlay(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitAgentBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim() || !agentPhone.trim() || !agentBookingSession) {
      return alert("請填寫姓名與手機號碼！");
    }
    setIsAgentSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("admin_register_open_play", {
        p_session_id: agentBookingSession.id,
        p_name: agentName.trim(),
        p_phone: agentPhone.trim(),
        p_status: agentStatus,
        p_payment_method: 'onsite',
        p_payment_status: agentPaymentStatus,
        p_player_notes: agentNotes.trim() || null,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      alert(`✅ 代客報名成功！已登記為【${agentStatus === 'registered' ? '正取' : '候補'}】`);
      setAgentBookingSession(null);
      setAgentName("");
      setAgentPhone("");
      setAgentNotes("");
      fetchAllData();
    } catch (err: any) {
      alert("代客報名失敗：" + (err.message || "系統錯誤"));
    } finally {
      setIsAgentSubmitting(false);
    }
  };

  const handlePromotePlayer = async (playerId: string, sessionId: string) => {
    const session = openPlaySessions.find((s) => s.id === sessionId);
    if (!session) return;
    const regCount = session.open_play_players?.filter((p: any) => p.status === 'registered').length || 0;

    if (regCount >= session.max_players) {
      alert("⚠️ 正取名額已滿！\n請先將某位正取球友「取消」，才能手動將候補轉為正取。");
      return;
    }

    if (!confirm("確定要將這位候補玩家轉為「正取」嗎？")) return;

    // 🌟 更新狀態並更新 created_at 為當前時間，確保排在正取名單的最後面
    const { error } = await supabase.from("open_play_players").update({
      status: "registered",
      created_at: new Date().toISOString()
    }).eq("id", playerId);

    if (error) {
      alert("轉正失敗：" + error.message);
    } else {
      alert("✅ 已成功轉為正取！");
      fetchAllData();
    }
  };

  const handleCancelOpenPlayPlayer = async (playerId: string) => {
    if (!confirm("確定要取消這位玩家嗎？\n(若取消正取，系統將自動遞補第一順位候補)")) return;

    const { data: targetPlayer } = await supabase
      .from("open_play_players")
      .select("session_id, status")
      .eq("id", playerId)
      .single();

    const { error } = await supabase.from("open_play_players").update({ status: "cancelled" }).eq("id", playerId);
    if (error) {
      alert("取消失敗：" + error.message);
      return;
    }

    if (targetPlayer && targetPlayer.status === 'registered') {
      const { data: nextWaitlisted } = await supabase
        .from("open_play_players")
        .select("id")
        .eq("session_id", targetPlayer.session_id)
        .eq("status", "waitlisted")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextWaitlisted) {
        // 🌟 自動遞補時同步更新 created_at，確保排在正取最後面
        await supabase.from("open_play_players").update({
          status: "registered",
          created_at: new Date().toISOString()
        }).eq("id", nextWaitlisted.id);
        alert("✅ 玩家已取消！系統已自動將第一順位候補球友遞補為正取。");
      } else {
        alert("✅ 玩家已取消！目前無人候補。");
      }
    } else {
      alert("✅ 候補玩家已成功取消。");
    }

    fetchAllData();
  };

  const handleDeleteOpenPlaySession = async (sessionId: string) => {
    if (!confirm("⚠️ 確定要刪除這個臨打場次嗎？")) return;
    await supabase.from("open_play_players").delete().eq("session_id", sessionId);
    await supabase.from("open_play_sessions").delete().eq("id", sessionId);
    fetchAllData();
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

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col justify-center px-6 pb-20">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 space-y-6">
          <div className="text-center space-y-2">
            <div className="bg-emerald-100 text-emerald-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
              <Lock size={24} />
            </div>
            <h1 className="text-xl font-bold text-gray-800">{venueName} - 後台登入</h1>
            <p className="text-xs text-gray-400">請輸入管理員帳號與密碼</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="管理員帳號"
              className="w-full bg-white text-gray-900 border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none"
              style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="管理員密碼"
              className="w-full bg-white text-gray-900 border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none"
              style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-bold py-3 rounded-xl shadow-md bg-gray-800 disabled:opacity-50"
            >
              {loading ? "驗證中..." : "登入後台"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-md mx-auto bg-gray-50 flex flex-col pb-10">
      {/* 修改處：加上 w-full 確保寬度填滿滿，並移除 relative 如果不需要 */}
      <header className="w-full text-white p-4 flex items-center justify-between shadow-md bg-gray-800 z-10">
        <div className="flex items-center">
          <Link href="/" className="mr-3 p-2 rounded-full bg-white/10">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold">{venueName} - 後台</h1>
        </div>
        <button onClick={handleLogout} className="text-xs px-3 py-1.5 rounded-lg text-white font-bold bg-gray-700">
          登出
        </button>
      </header>

      <div className="p-5 space-y-4">
        {/* 後台主分頁 */}
        <div className="grid grid-cols-5 gap-1 bg-gray-200 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'dashboard' ? 'shadow-sm bg-white text-gray-900' : 'opacity-60 text-gray-600'
              }`}
          >
            📊 營收
          </button>
          <button
            onClick={() => setActiveTab('courts')}
            className={`py-2 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'courts' ? 'shadow-sm bg-white text-emerald-600' : 'opacity-60 text-gray-600'
              }`}
          >
            場地
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`py-2 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'classes' ? 'shadow-sm bg-white text-orange-600' : 'opacity-60 text-gray-600'
              }`}
          >
            課程
          </button>
          <button
            onClick={() => setActiveTab('open_plays')}
            className={`py-2 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'open_plays' ? 'shadow-sm bg-white text-blue-600' : 'opacity-60 text-gray-600'
              }`}
          >
            臨打
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-2 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'settings' ? 'shadow-sm bg-white text-purple-600' : 'opacity-60 text-gray-600'
              }`}
          >
            ⚙️ 設定
          </button>
        </div>

        {loading ? (
          <p className="text-center mt-10 font-bold animate-pulse text-gray-500">調閱資料中...</p>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                      <UserCheck size={18} className="text-emerald-600" />
                      今日現場快速簽到 / 核銷
                    </h3>
                    <span className="text-[11px] text-gray-400 font-bold">
                      今日共 {todayCheckInList.length} 筆
                    </span>
                  </div>

                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="輸入姓名或手機號碼 (末三碼可)..."
                      className="w-full bg-gray-50 text-gray-900 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={checkInKeyword}
                      onChange={(e) => setCheckInKeyword(e.target.value)}
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-gray-50">
                    {todayCheckInList.length === 0 ? (
                      <p className="text-center text-xs text-gray-400 py-3">今日無符合條件的預約紀錄</p>
                    ) : (
                      todayCheckInList.map((item) => (
                        <div key={item.tableName + item.id} className="pt-2 flex items-center justify-between gap-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${item.type === "臨打"
                                    ? "bg-blue-100 text-blue-700"
                                    : item.type === "課程"
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                              >
                                {item.type}
                              </span>
                              <span className="font-bold text-gray-900 truncate">{item.name}</span>
                              <span className="text-gray-400 text-[11px]">({item.phone?.slice(-4) || '無手機'})</span>
                            </div>
                            <p className="text-gray-500 text-[11px] mt-0.5 truncate">
                              {item.title} | {item.time} | ${item.price}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleToggleCheckIn(item.tableName, item.id)}
                              className={`text-[11px] font-bold w-14 py-1.5 rounded-lg border transition flex items-center justify-center ${item.isCheckedIn
                                  ? "bg-gray-800 text-white border-gray-900 shadow-sm"
                                  : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
                                }`}
                            >
                              {item.isCheckedIn ? "已簽到" : "簽到"}
                            </button>

                            <button
                              onClick={() => {
                                if (item.tableName === "court_bookings") handleToggleCourtPayment(item.ids, item.paymentStatus);
                                else if (item.tableName === "class_bookings") handleToggleClassPayment(item.id, item.paymentStatus);
                                else handleToggleOpenPlayPayment(item.id, item.paymentStatus);
                              }}
                              className={`text-[11px] font-bold w-14 py-1.5 rounded-lg border transition flex items-center justify-center ${item.paymentStatus === "paid"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm"
                                  : "bg-amber-50 text-amber-800 border-amber-300 shadow-sm"
                                }`}
                            >
                              {item.paymentStatus === "paid" ? "已收" : "未收"}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                  <button
                    onClick={() => setDateFilter('today')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${dateFilter === 'today' ? 'bg-gray-900 text-white' : 'text-gray-600'
                      }`}
                  >
                    今日
                  </button>
                  <button
                    onClick={() => setDateFilter('week')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${dateFilter === 'week' ? 'bg-gray-900 text-white' : 'text-gray-600'
                      }`}
                  >
                    本週
                  </button>
                  <button
                    onClick={() => setDateFilter('month')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${dateFilter === 'month' ? 'bg-gray-900 text-white' : 'text-gray-600'
                      }`}
                  >
                    本月
                  </button>
                  <button
                    onClick={() => setDateFilter('custom')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${dateFilter === 'custom' ? 'bg-gray-900 text-white' : 'text-gray-600'
                      }`}
                  >
                    自訂
                  </button>
                </div>

                {dateFilter === 'custom' && (
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2 animate-in fade-in">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-2 text-xs text-gray-900 focus:outline-none"
                      style={{ colorScheme: "light" }}
                    />
                    <span className="text-gray-400 text-xs font-bold">至</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-2 text-xs text-gray-900 focus:outline-none"
                      style={{ colorScheme: "light" }}
                    />
                  </div>
                )}

                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-sm hover:bg-emerald-700 transition active:scale-95 text-sm"
                >
                  <Download size={16} /> 匯出當前報表 (Google 試算表格式)
                </button>

                <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
                      <AlertCircle size={16} className="text-amber-600" /> 待收款
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div
                      onClick={() => setActiveTab('courts')}
                      className="bg-white p-2.5 rounded-xl border border-amber-200 text-center cursor-pointer hover:bg-amber-100/50 transition"
                    >
                      <p className="text-[11px] text-gray-500 font-bold">場地租借</p>
                      <p className="text-base font-black text-amber-700 mt-0.5">
                        {metrics.courtPendingCount} <span className="text-xs font-normal">筆</span>
                      </p>
                    </div>

                    <div
                      onClick={() => setActiveTab('classes')}
                      className="bg-white p-2.5 rounded-xl border border-amber-200 text-center cursor-pointer hover:bg-amber-100/50 transition"
                    >
                      <p className="text-[11px] text-gray-500 font-bold">體驗課程</p>
                      <p className="text-base font-black text-amber-700 mt-0.5">
                        {metrics.classPendingCount} <span className="text-xs font-normal">筆</span>
                      </p>
                    </div>

                    <div
                      onClick={() => setActiveTab('open_plays')}
                      className="bg-white p-2.5 rounded-xl border border-amber-200 text-center cursor-pointer hover:bg-amber-100/50 transition"
                    >
                      <p className="text-[11px] text-gray-500 font-bold">臨打活動</p>
                      <p className="text-base font-black text-amber-700 mt-0.5">
                        {metrics.openPlayPendingCount} <span className="text-xs font-normal">筆</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-5 rounded-2xl shadow-lg space-y-2">
                  <div className="text-gray-400 text-xs">總營收</div>
                  <p className="text-3xl font-black tracking-tight">${metrics.totalEstimated}</p>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-700/60 mt-3">
                    <div>
                      <p className="text-[11px] text-emerald-400 font-bold">🟢 已入帳</p>
                      <p className="text-lg font-bold">${metrics.totalCollected}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-amber-400 font-bold">🟠 待收款</p>
                      <p className="text-lg font-bold">${metrics.totalPending}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                      <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <Calendar size={16} /> 場地租借
                      </span>
                      <span className="font-extrabold text-emerald-700">${metrics.courtRev}</span>
                    </div>

                    <div className="flex justify-between items-center bg-orange-50 p-3 rounded-xl border border-orange-100">
                      <span className="font-bold text-orange-900 flex items-center gap-1.5">
                        <CreditCard size={16} /> 體驗課程
                      </span>
                      <span className="font-extrabold text-orange-700">${metrics.classRev}</span>
                    </div>

                    <div className="flex justify-between items-center bg-blue-50 p-3 rounded-xl border border-blue-100">
                      <span className="font-bold text-blue-900 flex items-center gap-1.5">
                        <DollarSign size={16} /> 臨打活動
                      </span>
                      <span className="font-extrabold text-blue-700">${metrics.openPlayRev}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'courts' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                    <Wrench size={16} className="text-emerald-600" /> 球場狀態設定 (維修中前台將隱藏)
                  </h3>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {courtsList.map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-lg border flex justify-between items-center bg-gray-50"
                      >
                        <div>
                          <p className="text-xs font-bold text-gray-800">{c.name}</p>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}
                          >
                            {c.status === 'active' ? '使用中' : '維修中'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleToggleCourtStatus(c.id, c.status)}
                          className="text-xs font-bold px-2 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                          切換
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {courtBookings.length === 0 ? (
                    <p className="text-center text-gray-500 mt-5 text-sm">無預約紀錄</p>
                  ) : (
                    courtBookings.map((b, index) => (
                      <div
                        key={b.ids[0] + index}
                        className={`bg-white p-4 rounded-xl shadow-sm border border-gray-200 ${b.status === 'cancelled' ? 'opacity-60 bg-gray-50' : ''
                          }`}
                      >
                        <div className="flex justify-between items-center border-b pb-2 mb-2">
                          <span className="font-bold text-gray-800 text-lg">{b.courts?.name}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${b.payment_method === 'online'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-200 text-gray-700'
                                }`}
                            >
                              {b.payment_method === 'online' ? '📱 線上付款' : '💵 現場付款'}
                            </span>
                            <span
                              className={`font-bold text-lg ${b.status === 'cancelled' ? 'text-gray-400 line-through' : 'text-emerald-600'
                                }`}
                            >
                              ${b.totalPrice}
                            </span>
                          </div>
                        </div>

                        <div className="text-sm text-gray-600 space-y-1">
                          <p className="flex items-center">
                            📅 {b.booking_date} | {b.start_time?.slice(0, 5)}-{b.end_time?.slice(0, 5)}
                            <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">
                              {b.ids.length * 0.5}h
                            </span>
                          </p>
                          <p>
                            👤 {b.users?.name} ({b.users?.phone})
                          </p>
                        </div>

                        <div className="flex gap-2 mt-3 pt-2 border-t border-gray-100">
                          {b.status === 'booked' && (
                            <button
                              onClick={() => handleToggleCourtPayment(b.ids, b.payment_status)}
                              className={`flex-1 text-xs font-bold py-2 rounded-lg border transition flex items-center justify-center gap-1 ${b.payment_status === 'paid'
                                  ? 'bg-emerald-500 text-white border-emerald-600'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                                }`}
                            >
                              <DollarSign size={14} />
                              {b.payment_status === 'paid' ? '已收款' : '待收款'}
                            </button>
                          )}

                          {b.status === 'booked' ? (
                            <button
                              onClick={() => handleCancelCourt(b.ids)}
                              className="flex-1 text-red-600 bg-red-50 hover:bg-red-100 py-2 rounded-lg text-sm font-bold border border-red-200 transition"
                            >
                              取消預約
                            </button>
                          ) : (
                            <div className="w-full text-center text-gray-400 bg-gray-100 py-2 rounded-lg text-sm font-bold">
                              已取消
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'classes' && (
              <div className="space-y-4">
                <button
                  onClick={() => setIsAddingClass(!isAddingClass)}
                  className="w-full py-3 bg-orange-100 text-orange-700 font-bold rounded-xl flex justify-center items-center gap-2 border border-orange-200"
                >
                  {isAddingClass ? (
                    <>
                      <X size={18} /> 取消新增
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> 新增體驗課程
                    </>
                  )}
                </button>

                {isAddingClass && (
                  <form
                    onSubmit={submitNewClass}
                    className="bg-white p-4 rounded-xl border-2 border-orange-400 space-y-3 shadow-md animate-in fade-in"
                  >
                    <div className="flex justify-between items-center border-b pb-2">
                      <h4 className="font-bold text-orange-800 text-sm">新增課程場次</h4>
                      <button
                        type="button"
                        onClick={() => setIsAddingClass(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="課程名稱"
                      required
                      className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                      style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                      value={newClass.title}
                      onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                    />

                    <select
                      className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                      style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                      value={newClass.court_id}
                      onChange={(e) => setNewClass({ ...newClass, court_id: e.target.value })}
                    >
                      <option value="">選擇場地 (保留未定)</option>
                      {courtsList.map((court) => (
                        <option key={court.id} value={court.id}>
                          {court.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="教練名稱"
                      required
                      className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                      style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                      value={newClass.coach}
                      onChange={(e) => setNewClass({ ...newClass, coach: e.target.value })}
                    />
                    <input
                      type="date"
                      required
                      className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                      style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                      value={newClass.class_date}
                      onChange={(e) => setNewClass({ ...newClass, class_date: e.target.value })}
                    />

                    <div className="flex gap-2">
                      <input
                        type="time"
                        required
                        className="flex-1 bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={newClass.start_time}
                        onChange={(e) => setNewClass({ ...newClass, start_time: e.target.value })}
                      />
                      <input
                        type="time"
                        required
                        className="flex-1 bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={newClass.end_time}
                        onChange={(e) => setNewClass({ ...newClass, end_time: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">人數上限</label>
                        <input
                          type="number"
                          required
                          className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={newClass.max_players}
                          onChange={(e) => setNewClass({ ...newClass, max_players: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">價格 (元)</label>
                        <input
                          type="number"
                          required
                          className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={newClass.price}
                          onChange={(e) => setNewClass({ ...newClass, price: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="備註 (選填)"
                      className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                      style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                      value={newClass.notes}
                      onChange={(e) => setNewClass({ ...newClass, notes: e.target.value })}
                    />

                    <button type="submit" className="w-full bg-orange-600 text-white font-bold py-2 rounded-lg shadow">
                      確認新增
                    </button>
                  </form>
                )}

                {classesList.length === 0 ? (
                  <p className="text-center text-gray-500 mt-10">無課程場次</p>
                ) : (
                  classesList.map((cls) => {
                    const activeBookings = cls.class_bookings?.filter((b: any) => b.status !== 'cancelled') || [];

                    if (editingClassId === cls.id) {
                      return (
                        <form
                          key={cls.id}
                          onSubmit={submitEditClass}
                          className="bg-orange-50 p-4 rounded-xl border-2 border-orange-400 space-y-3 shadow-md animate-in fade-in"
                        >
                          <h4 className="font-bold text-orange-800 border-b border-orange-200 pb-2">✏️ 編輯體驗課程</h4>

                          <input
                            type="text"
                            placeholder="課程名稱"
                            required
                            className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                            style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                            value={editClass.title}
                            onChange={(e) => setEditClass({ ...editClass, title: e.target.value })}
                          />

                          <select
                            className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                            style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                            value={editClass.court_id}
                            onChange={(e) => setEditClass({ ...editClass, court_id: e.target.value })}
                          >
                            <option value="">選擇場地 (保留未定)</option>
                            {courtsList.map((court) => (
                              <option key={court.id} value={court.id}>
                                {court.name}
                              </option>
                            ))}
                          </select>

                          <input
                            type="text"
                            placeholder="教練名稱"
                            required
                            className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                            style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                            value={editClass.coach}
                            onChange={(e) => setEditClass({ ...editClass, coach: e.target.value })}
                          />
                          <input
                            type="date"
                            required
                            className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                            style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                            value={editClass.class_date}
                            onChange={(e) => setEditClass({ ...editClass, class_date: e.target.value })}
                          />

                          <div className="flex gap-2">
                            <input
                              type="time"
                              required
                              className="flex-1 bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                              style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                              value={editClass.start_time}
                              onChange={(e) => setEditClass({ ...editClass, start_time: e.target.value })}
                            />
                            <input
                              type="time"
                              required
                              className="flex-1 bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                              style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                              value={editClass.end_time}
                              onChange={(e) => setEditClass({ ...editClass, end_time: e.target.value })}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">人數上限</label>
                              <input
                                type="number"
                                required
                                className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                                style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                                value={editClass.max_players}
                                onChange={(e) => setEditClass({ ...editClass, max_players: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">價格 (元)</label>
                              <input
                                type="number"
                                required
                                className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                                style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                                value={editClass.price}
                                onChange={(e) => setEditClass({ ...editClass, price: Number(e.target.value) })}
                              />
                            </div>
                          </div>

                          <input
                            type="text"
                            placeholder="備註 (選填)"
                            className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                            style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                            value={editClass.notes}
                            onChange={(e) => setEditClass({ ...editClass, notes: e.target.value })}
                          />

                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setEditingClassId(null)}
                              className="flex-1 bg-white border border-gray-300 text-gray-600 font-bold py-2 rounded-lg text-sm"
                            >
                              取消
                            </button>
                            <button
                              type="submit"
                              className="flex-1 bg-orange-600 text-white font-bold py-2 rounded-lg text-sm shadow"
                            >
                              儲存修改
                            </button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div key={cls.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded mb-1 inline-block">
                              教練：{cls.coach}
                            </span>
                            <h3 className="font-bold text-gray-800 text-base">{cls.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              📅 {cls.class_date} | {cls.start_time?.slice(0, 5)}-{cls.end_time?.slice(0, 5)}
                            </p>
                            <p className="text-xs text-orange-600 font-bold mt-1">
                              💰 ${cls.price} / 人 (上限 {cls.max_players} 人)
                            </p>
                            {cls.notes && <p className="text-xs text-gray-500 mt-1">📝 館方備註：{cls.notes}</p>}
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-xs font-bold text-orange-700 bg-orange-200 px-2 py-1 rounded">
                              {cls.courts?.name || '未定'}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={() => handleDuplicateClass(cls)}
                                title="複製為新場次"
                                className="flex items-center gap-0.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-300 px-1.5 py-1 rounded"
                              >
                                <Copy size={12} /> 複製
                              </button>
                              <button
                                onClick={() => startEditingClass(cls)}
                                className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-800"
                              >
                                <Edit size={14} /> 編輯
                              </button>
                              <button
                                onClick={() => handleDeleteClassSession(cls.id)}
                                className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={14} /> 刪除
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          {activeBookings.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center">目前無人報名</p>
                          ) : (
                            activeBookings.map((booking: any) => (
                              <div
                                key={booking.id}
                                className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm bg-gray-50 p-3 rounded-xl border border-gray-100 gap-2"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-orange-100 text-orange-700">
                                      已報名
                                    </span>
                                    <span className="font-semibold text-gray-800">{booking.users?.name}</span>
                                    <span className="text-gray-500 text-xs">({booking.users?.phone})</span>

                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${booking.payment_method === 'online'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-gray-200 text-gray-700'
                                        }`}
                                    >
                                      {booking.payment_method === 'online' ? '📱 線上付款' : '💵 現場付款'}
                                    </span>
                                  </div>
                                  {booking.need_paddle && (
                                    <span className="inline-block mt-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                      🏓 需租借球拍
                                    </span>
                                  )}
                                  {booking.notes && (
                                    <p className="text-xs text-gray-500 mt-1">💬 備註：{booking.notes}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                                  <button
                                    onClick={() => handleToggleClassPayment(booking.id, booking.payment_status)}
                                    className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 ${booking.payment_status === 'paid'
                                        ? 'bg-emerald-500 text-white border-emerald-600'
                                        : 'bg-amber-100 text-amber-800 border-amber-300'
                                      }`}
                                  >
                                    <DollarSign size={14} />
                                    {booking.payment_status === 'paid' ? '已收款' : '待收款'}
                                  </button>

                                  <button
                                    onClick={() => handleCancelClassBooking(booking.id)}
                                    className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 border border-red-200 rounded"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'open_plays' && (
              <div className="space-y-4">
                {showVisualSchedule ? (
                  <div className="bg-white p-4 rounded-xl border border-blue-300 shadow-lg animate-in fade-in zoom-in-95">
                    <div className="flex justify-between items-center mb-3 border-b pb-2">
                      <h4 className="font-bold text-blue-800 flex items-center gap-1.5">
                        <Eye size={18} /> 視覺化空檔快選
                      </h4>
                      <button onClick={() => { setShowVisualSchedule(false); setSelectedGrid([]); }} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="mb-4">
                      <label className="text-xs text-gray-500 font-bold block mb-1">目標日期</label>
                      <input
                        type="date"
                        value={visualDate}
                        onChange={(e) => { setVisualDate(e.target.value); setSelectedGrid([]); }}
                        className="w-full bg-gray-50 text-gray-900 border border-gray-300 p-2 rounded-lg text-sm focus:outline-none"
                      />
                    </div>

                    <p className="text-[11px] text-gray-500 mb-2 font-bold flex items-center gap-1">
                      <MousePointerClick size={12} /> 點擊綠色格子選擇空檔 (可跨時間與跨場地)
                    </p>

                    <div className="overflow-x-auto max-h-[400px] border border-gray-200 rounded-lg">
                      <table className="w-full text-xs text-center border-collapse">
                        <thead className="sticky top-0 z-20 shadow-sm">
                          <tr>
                            <th className="border-b p-2 bg-gray-100 text-gray-600 font-bold sticky left-0 z-30 w-16">時間</th>
                            {courtsList.map(c => (
                              <th key={c.id} className="border-b border-l p-2 bg-gray-100 text-gray-700 font-bold min-w-[80px]">
                                {c.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {timeSlots.map(time => (
                            <tr key={time}>
                              <td className="border-b p-1.5 bg-gray-50 sticky left-0 z-10 font-bold text-gray-500">{time}</td>
                              {courtsList.map(c => {
                                const status = checkIsOccupied(c.id, time);
                                const cellKey = `${c.id}_${time}`;
                                const isSelected = selectedGrid.includes(cellKey);

                                if (status.occupied) {
                                  return (
                                    <td key={c.id} className="border-b border-l p-1 bg-gray-200">
                                      <span className="text-[10px] text-gray-500 font-bold block">{status.label}</span>
                                    </td>
                                  );
                                }
                                return (
                                  <td
                                    key={c.id}
                                    onClick={() => toggleCellSelection(cellKey)}
                                    className={`border-b border-l p-1 cursor-pointer transition select-none ${isSelected
                                        ? 'bg-blue-500 text-white font-bold'
                                        : 'bg-green-50 text-green-700 hover:bg-green-200 font-medium'
                                      }`}
                                  >
                                    {isSelected ? '已選' : '空檔'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={handleQuickConvertOpenPlay}
                      className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition"
                    >
                      將選取的 {selectedGrid.length} 個時段轉為臨打
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsAddingOpenPlay(!isAddingOpenPlay)}
                      className="flex-1 py-3 bg-blue-100 text-blue-700 font-bold rounded-xl flex justify-center items-center gap-2 border border-blue-200 transition hover:bg-blue-200"
                    >
                      {isAddingOpenPlay ? <><X size={18} /> 取消新增</> : <><Plus size={18} /> 一般新增臨打</>}
                    </button>

                    <button
                      onClick={() => { setShowVisualSchedule(true); setIsAddingOpenPlay(false); }}
                      className="flex-1 py-3 bg-indigo-100 text-indigo-700 font-bold rounded-xl flex justify-center items-center gap-2 border border-indigo-200 transition hover:bg-indigo-200"
                    >
                      <Eye size={18} /> 空檔視覺化快選
                    </button>
                  </div>
                )}

                {isAddingOpenPlay && (
                  <form
                    onSubmit={submitNewOpenPlay}
                    className="bg-white p-4 rounded-xl border-2 border-blue-400 space-y-3 shadow-md animate-in fade-in"
                  >
                    <div className="flex justify-between items-center border-b pb-2">
                      <h4 className="font-bold text-blue-800 text-sm">新增臨打場次</h4>
                      <button
                        type="button"
                        onClick={() => setIsAddingOpenPlay(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="場次名稱"
                      required
                      className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                      style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                      value={newOpenPlay.title}
                      onChange={(e) => setNewOpenPlay({ ...newOpenPlay, title: e.target.value })}
                    />

                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">開放場地 (可多選)</label>
                      <div className="flex flex-wrap gap-2">
                        {courtsList.map(court => (
                          <label key={court.id} className="flex items-center gap-1.5 text-sm bg-gray-50 border px-3 py-1.5 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-blue-600"
                              checked={newOpenPlay.court_ids.includes(court.id)}
                              onChange={(e) => {
                                const newCourts = e.target.checked
                                  ? [...newOpenPlay.court_ids, court.id]
                                  : newOpenPlay.court_ids.filter((id: string) => id !== court.id);
                                setNewOpenPlay({ ...newOpenPlay, court_ids: newCourts });
                              }}
                            />
                            {court.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">DUPR 等級 (可多選)</label>
                      <div className="flex flex-wrap gap-2">
                        {['2.0', '2.5', '3.0', '3.5', '4.0'].map(lvl => (
                          <label key={lvl} className="flex items-center gap-1.5 text-sm bg-gray-50 border px-3 py-1.5 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-blue-600"
                              checked={newOpenPlay.level.includes(lvl)}
                              onChange={(e) => {
                                const newLevels = e.target.checked
                                  ? [...newOpenPlay.level, lvl]
                                  : newOpenPlay.level.filter(l => l !== lvl);
                                setNewOpenPlay({ ...newOpenPlay, level: newLevels });
                              }}
                            />
                            {lvl}
                          </label>
                        ))}
                      </div>
                    </div>

                    <input
                      type="date"
                      required
                      className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                      style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                      value={newOpenPlay.session_date}
                      onChange={(e) => setNewOpenPlay({ ...newOpenPlay, session_date: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <input
                        type="time"
                        required
                        className="flex-1 bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={newOpenPlay.start_time}
                        onChange={(e) => setNewOpenPlay({ ...newOpenPlay, start_time: e.target.value })}
                      />
                      <input
                        type="time"
                        required
                        className="flex-1 bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={newOpenPlay.end_time}
                        onChange={(e) => setNewOpenPlay({ ...newOpenPlay, end_time: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">正取人數</label>
                        <input
                          type="number"
                          required
                          className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={newOpenPlay.max_players}
                          onChange={(e) => setNewOpenPlay({ ...newOpenPlay, max_players: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">候補人數</label>
                        <input
                          type="number"
                          required
                          className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={newOpenPlay.max_waitlist}
                          onChange={(e) => setNewOpenPlay({ ...newOpenPlay, max_waitlist: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">價格 (元)</label>
                        <input
                          type="number"
                          required
                          className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={newOpenPlay.price}
                          onChange={(e) => setNewOpenPlay({ ...newOpenPlay, price: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="備註 (選填，例如：含教練指導)"
                      className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                      style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                      value={newOpenPlay.notes}
                      onChange={(e) => setNewOpenPlay({ ...newOpenPlay, notes: e.target.value })}
                    />

                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg shadow">
                      確認新增
                    </button>
                  </form>
                )}

                {openPlaySessions.length === 0 ? (
                  <p className="text-center text-gray-500 mt-10">無臨打場次</p>
                ) : (
                  openPlaySessions.map((session) => {
                    const activePlayers = session.open_play_players?.filter((p: any) => p.status !== 'cancelled') || [];

                    if (editingOpenPlayId === session.id) {
                      return (
                        <form
                          key={session.id}
                          onSubmit={submitEditOpenPlay}
                          className="bg-blue-50 p-4 rounded-xl border-2 border-blue-400 space-y-3 shadow-md animate-in fade-in"
                        >
                          <h4 className="font-bold text-blue-800 border-b border-blue-200 pb-2">✏️ 編輯臨打場次</h4>
                          <input
                            type="text"
                            placeholder="場次名稱"
                            required
                            className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                            style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                            value={editOpenPlay.title}
                            onChange={(e) => setEditOpenPlay({ ...editOpenPlay, title: e.target.value })}
                          />

                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">開放場地 (可多選)</label>
                            <div className="flex flex-wrap gap-2">
                              {courtsList.map(court => (
                                <label key={court.id} className="flex items-center gap-1.5 text-sm bg-gray-50 border px-3 py-1.5 rounded-lg cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="accent-blue-600"
                                    checked={editOpenPlay.court_ids.includes(court.id)}
                                    onChange={(e) => {
                                      const newCourts = e.target.checked
                                        ? [...editOpenPlay.court_ids, court.id]
                                        : editOpenPlay.court_ids.filter(id => id !== court.id);
                                      setEditOpenPlay({ ...editOpenPlay, court_ids: newCourts });
                                    }}
                                  />
                                  {court.name}
                                </label>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">DUPR 等級 (可多選)</label>
                            <div className="flex flex-wrap gap-2">
                              {['2.0', '2.5', '3.0', '3.5', '4.0'].map(lvl => (
                                <label key={lvl} className="flex items-center gap-1.5 text-sm bg-gray-50 border px-3 py-1.5 rounded-lg cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="accent-blue-600"
                                    checked={editOpenPlay.level.includes(lvl)}
                                    onChange={(e) => {
                                      const newLevels = e.target.checked
                                        ? [...editOpenPlay.level, lvl]
                                        : editOpenPlay.level.filter(l => l !== lvl);
                                      setEditOpenPlay({ ...editOpenPlay, level: newLevels });
                                    }}
                                  />
                                  {lvl}
                                </label>
                              ))}
                            </div>
                          </div>

                          <input
                            type="date"
                            required
                            className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                            style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                            value={editOpenPlay.session_date}
                            onChange={(e) => setEditOpenPlay({ ...editOpenPlay, session_date: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <input
                              type="time"
                              required
                              className="flex-1 bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                              style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                              value={editOpenPlay.start_time}
                              onChange={(e) => setEditOpenPlay({ ...editOpenPlay, start_time: e.target.value })}
                            />
                            <input
                              type="time"
                              required
                              className="flex-1 bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                              style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                              value={editOpenPlay.end_time}
                              onChange={(e) => setEditOpenPlay({ ...editOpenPlay, end_time: e.target.value })}
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">正取人數</label>
                              <input
                                type="number"
                                required
                                className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                                style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                                value={editOpenPlay.max_players}
                                onChange={(e) => setEditOpenPlay({ ...editOpenPlay, max_players: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">候補人數</label>
                              <input
                                type="number"
                                required
                                className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                                style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                                value={editOpenPlay.max_waitlist}
                                onChange={(e) => setEditOpenPlay({ ...editOpenPlay, max_waitlist: Number(e.target.value) })}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">價格 (元)</label>
                              <input
                                type="number"
                                required
                                className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                                style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                                value={editOpenPlay.price}
                                onChange={(e) => setEditOpenPlay({ ...editOpenPlay, price: Number(e.target.value) })}
                              />
                            </div>
                          </div>

                          <input
                            type="text"
                            placeholder="備註 (選填，例如：含教練指導)"
                            className="w-full bg-white text-gray-900 border border-gray-300 p-2 rounded-lg text-sm"
                            style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                            value={editOpenPlay.notes}
                            onChange={(e) => setEditOpenPlay({ ...editOpenPlay, notes: e.target.value })}
                          />

                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setEditingOpenPlayId(null)}
                              className="flex-1 bg-white border border-gray-300 text-gray-600 font-bold py-2 rounded-lg text-sm"
                            >
                              取消
                            </button>
                            <button
                              type="submit"
                              className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg text-sm shadow"
                            >
                              儲存修改
                            </button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div key={session.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded mb-1 inline-block">
                              DUPR {session.level}
                            </span>
                            <h3 className="font-bold text-gray-800 text-base">{session.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">
                              📅 {session.session_date} | {session.start_time?.slice(0, 5)}-{session.end_time?.slice(0, 5)}
                            </p>
                            <p className="text-xs text-blue-600 font-bold mt-1">
                              💰 ${session.price} / 人 (正取 {session.max_players} 人 / 候補 {session.max_waitlist} 人)
                            </p>
                            {session.notes && <p className="text-xs text-gray-500 mt-1">📝 館方備註：{session.notes}</p>}
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="text-xs font-bold text-blue-700 bg-blue-200 px-2 py-1 rounded">
                              {getCourtNames(session)}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={() => handleDuplicateOpenPlay(session)}
                                title="複製為新場次"
                                className="flex items-center gap-0.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-300 px-1.5 py-1 rounded"
                              >
                                <Copy size={12} /> 複製
                              </button>
                              <button
                                onClick={() => startEditingOpenPlay(session)}
                                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                              >
                                <Edit size={14} /> 編輯
                              </button>
                              <button
                                onClick={() => handleDeleteOpenPlaySession(session.id)}
                                className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={14} /> 刪除
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                            <span className="text-xs font-bold text-gray-500">
                              目前報名名冊 ({activePlayers.length} 人)
                            </span>
                            <button
                              onClick={() => setAgentBookingSession(session)}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg"
                            >
                              <UserPlus size={13} /> 代客登記球友
                            </button>
                          </div>

                          {activePlayers.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-2">目前無人報名</p>
                          ) : (
                            activePlayers.map((player: any) => (
                              <div
                                key={player.id}
                                className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm bg-gray-50 p-3 rounded-xl border border-gray-100 gap-2"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${player.status === 'registered'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-amber-100 text-amber-700'
                                        }`}
                                    >
                                      {player.status === 'registered' ? '正取' : '候補'}
                                    </span>
                                    <span className="font-semibold text-gray-800">{player.users?.name}</span>
                                    <span className="text-gray-500 text-xs">({player.users?.phone})</span>

                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${player.payment_method === 'online'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-gray-200 text-gray-700'
                                        }`}
                                    >
                                      {player.payment_method === 'online' ? '📱 線上付款' : '💵 現場付款'}
                                    </span>
                                  </div>

                                  {player.player_notes && (
                                    <p className="text-xs text-gray-500 mt-1">💬 備註：{player.player_notes}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                                  {player.status === 'registered' && (
                                    <button
                                      onClick={() => handleToggleOpenPlayPayment(player.id, player.payment_status)}
                                      className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 ${player.payment_status === 'paid'
                                          ? 'bg-emerald-500 text-white border-emerald-600'
                                          : 'bg-amber-100 text-amber-800 border-amber-300'
                                        }`}
                                    >
                                      <DollarSign size={14} />
                                      {player.payment_status === 'paid' ? '已收款' : '待收款'}
                                    </button>
                                  )}

                                  {player.status === 'waitlisted' && (
                                    <button
                                      onClick={() => handlePromotePlayer(player.id, session.id)}
                                      className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-bold px-2 py-1 bg-emerald-50 border border-emerald-200 rounded"
                                    >
                                      <CheckCircle size={12} /> 轉正取
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleCancelOpenPlayPlayer(player.id)}
                                    className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 border border-red-200 rounded"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 設定分頁 (包含動態費率與國定假日管理) */}
            {activeTab === 'settings' && (
              <div className="space-y-4 animate-in fade-in pb-10">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                  <h3 className="font-bold text-gray-800 text-base border-b pb-2 flex items-center gap-2">
                    <Settings size={18} className="text-purple-600" /> 場館與後台帳號設定
                  </h3>

                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">場館名稱</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={tempVenueName}
                        onChange={(e) => setTempVenueName(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">後台登入帳號</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={tempAdminUser}
                        onChange={(e) => setTempAdminUser(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">後台登入密碼</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={tempAdminPass}
                        onChange={(e) => setTempAdminPass(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">官方 LINE 連結 (球友付款回報用)</label>
                      <input
                        type="text"
                        required
                        placeholder="https://lin.ee/..."
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={tempLineUrl}
                        onChange={(e) => setTempLineUrl(e.target.value)}
                      />
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 mt-4">
                      <h4 className="font-bold text-amber-800 text-sm flex items-center gap-2">
                        <AlertCircle size={16} /> 首頁緊急公告設定
                      </h4>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="announceToggle"
                          className="w-4 h-4 accent-amber-600 rounded"
                          checked={tempAnnouncementActive}
                          onChange={(e) => setTempAnnouncementActive(e.target.checked)}
                        />
                        <label htmlFor="announceToggle" className="text-sm font-bold text-gray-700 cursor-pointer">
                          啟用首頁公告橫幅
                        </label>
                      </div>

                      {tempAnnouncementActive && (
                        <textarea
                          rows={2}
                          placeholder="請輸入公告內容，例如：今日因颱風休館一天。"
                          className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                          style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                          value={tempAnnouncementText}
                          onChange={(e) => setTempAnnouncementText(e.target.value)}
                        />
                      )}
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 mt-4">
                      <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        <Clock size={16} className="text-gray-600" /> 取消預約規則設定
                      </h4>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">開打前幾小時禁止取消預約？</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            className="w-24 bg-white text-gray-900 border border-gray-300 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                            value={tempCancelLimitHours}
                            onChange={(e) => setTempCancelLimitHours(e.target.value)}
                          />
                          <span className="text-sm text-gray-600 font-bold">小時</span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          設定為 0 表示不限制；設定為 3 表示開打前 3 小時內，球友前台將無法點擊取消按鈕。
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-purple-700 transition active:scale-95 text-sm mt-4"
                    >
                      儲存基本設定變更
                    </button>
                  </form>
                </div>

                {/* 🌟 國定假日 / 特殊日管理區塊 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                  <h3 className="font-bold text-gray-800 text-base border-b pb-2 flex items-center gap-2">
                    <CalendarPlus size={18} className="text-amber-600" /> 國定假日 / 特殊日管理
                  </h3>
                  <p className="text-xs text-gray-500">
                    設定在此清單中的日期，系統將自動強制以「假日費率」計算，解決平日遇到國定假日的計費問題。
                  </p>

                  <form onSubmit={handleAddSpecialDate} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-600 mb-1 block">選擇日期</label>
                      <input
                        type="date"
                        required
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl p-2.5 text-sm"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={newSpecialDate}
                        onChange={(e) => setNewSpecialDate(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-600 mb-1 block">說明 (選填)</label>
                      <input
                        type="text"
                        placeholder="例如: 國慶日"
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl p-2.5 text-sm"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={newSpecialDesc}
                        onChange={(e) => setNewSpecialDesc(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow transition shrink-0"
                    >
                      新增
                    </button>
                  </form>

                  <div className="space-y-2 pt-2 max-h-48 overflow-y-auto">
                    {specialDates.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">目前無特殊日設定</p>
                    ) : (
                      specialDates.map((spec) => (
                        <div key={spec.date} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border text-xs">
                          <div>
                            <span className="font-bold text-gray-800">{spec.date}</span>
                            <span className="text-gray-500 ml-2">({spec.description || '國定假日'})</span>
                          </div>
                          <button
                            onClick={() => handleDeleteSpecialDate(spec.date)}
                            className="text-red-500 hover:text-red-700 font-bold p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 🌟 尖峰/離峰費率規則管理區塊 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                  <h3 className="font-bold text-gray-800 text-base border-b pb-2 flex items-center gap-2">
                    <DollarSign size={18} className="text-emerald-600" /> 動態費率時段規則設定
                  </h3>
                  <p className="text-xs text-gray-500">
                    設定平日與假日不同時段的每半小時單價。
                  </p>

                  <form onSubmit={handleAddPricingRule} className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border">
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">適用日型</label>
                      <select
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-xs"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={newRuleDayType}
                        onChange={(e) => setNewRuleDayType(e.target.value)}
                      >
                        <option value="weekday">平日 (Weekday)</option>
                        <option value="weekend">假日 (Weekend)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">每半小時價格 (元)</label>
                      <input
                        type="number"
                        required
                        min="0"
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-xs"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={newRulePrice}
                        onChange={(e) => setNewRulePrice(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">起始時間</label>
                      <input
                        type="time"
                        required
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-xs"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={newRuleStart}
                        onChange={(e) => setNewRuleStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">結束時間</label>
                      <input
                        type="time"
                        required
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-xs"
                        style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                        value={newRuleEnd}
                        onChange={(e) => setNewRuleEnd(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      className="col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs shadow transition mt-1"
                    >
                      新增費率規則
                    </button>
                  </form>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pricingRules.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">目前無費率規則設定</p>
                    ) : (
                      pricingRules.map((rule) => (
                        <div key={rule.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border text-xs">
                          <div>
                            <span className={`px-1.5 py-0.5 rounded font-bold mr-2 text-[10px] ${rule.day_type === 'weekday' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {rule.day_type === 'weekday' ? '平日' : '假日'}
                            </span>
                            <span className="font-bold text-gray-800">{rule.start_time?.slice(0, 5)} - {rule.end_time?.slice(0, 5)}</span>
                            <span className="text-emerald-600 font-bold ml-3">${rule.price} / 半小時</span>
                          </div>
                          <button
                            onClick={() => handleDeletePricingRule(rule.id)}
                            className="text-red-500 hover:text-red-700 font-bold p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {agentBookingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-in fade-in overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 my-auto">
            <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <UserPlus size={18} /> 代客登記臨打
              </h3>
              <button onClick={() => setAgentBookingSession(null)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitAgentBooking} className="p-5 space-y-3">
              <p className="text-xs text-gray-500 font-bold">
                目標場次：{agentBookingSession.title} ({agentBookingSession.session_date})
              </p>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">球友姓名</label>
                <input
                  type="text"
                  required
                  placeholder="例如: 王大明"
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">手機號碼</label>
                <input
                  type="tel"
                  required
                  placeholder="例如: 0912345678"
                  pattern="[0-9]{10}"
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">排定狀態</label>
                  <select
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm"
                    style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                    value={agentStatus}
                    onChange={(e: any) => setAgentStatus(e.target.value)}
                  >
                    <option value="registered">正取</option>
                    <option value="waitlisted">候補</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">收款狀態</label>
                  <select
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm"
                    style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                    value={agentPaymentStatus}
                    onChange={(e: any) => setAgentPaymentStatus(e.target.value)}
                  >
                    <option value="unpaid">待收款</option>
                    <option value="paid">已收款</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">個人備註 (選填)</label>
                <input
                  type="text"
                  placeholder="例如: LINE 預先約定、現金已收"
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  style={{ backgroundColor: "white", color: "#111827", colorScheme: "light" }}
                  value={agentNotes}
                  onChange={(e) => setAgentNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAgentBookingSession(null)}
                  className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-lg text-sm"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isAgentSubmitting}
                  className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm shadow disabled:opacity-50"
                >
                  {isAgentSubmitting ? "登記中..." : "確認登記"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}