"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, CalendarDays, User as UserIcon } from "lucide-react";

export default function BottomNav() {
    const pathname = usePathname();

    if (pathname?.startsWith("/admin")) return null;

    const tabs = [
        { name: "找球打", href: "/", icon: Search },
        { name: "我的臨打", href: "/my-sessions", icon: CalendarDays },
        { name: "我的", href: "/profile", icon: UserIcon },
    ];

    return (
        <nav
            className="shrink-0 w-full bg-white border-t border-gray-200 flex justify-around items-center pt-2.5 z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
        >
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = pathname === tab.href;
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className="flex flex-col items-center gap-1 py-1 px-4 transition-colors"
                    >
                        <Icon
                            size={22}
                            strokeWidth={isActive ? 2.5 : 2}
                            className={isActive ? "text-green-700" : "text-gray-400"}
                        />
                        <span
                            className={`text-[11px] ${isActive ? "font-bold text-green-700" : "font-medium text-gray-500"
                                }`}
                        >
                            {tab.name}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}