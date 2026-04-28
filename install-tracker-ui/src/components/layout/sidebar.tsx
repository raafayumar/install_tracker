"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart3, Settings, ChevronLeft, ChevronRight } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`
        fixed top-0 left-0 h-screen bg-navy-700 border-r border-border
        flex flex-col z-50 transition-all duration-250
        ${collapsed ? "w-16" : "w-60"}
      `}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        <Image
          src="/protex-logo.jpeg"
          alt="Protex AI"
          width={32}
          height={32}
          className="rounded-[6px] shrink-0"
        />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-extrabold text-text-primary tracking-tight">
              Protex<span className="font-light ml-0.5">AI</span>
            </span>
            <span className="text-[10px] text-text-tertiary font-medium">Install Tracker</span>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-sm font-semibold
                transition-all duration-150
                ${isActive
                  ? "bg-[rgba(0,160,242,0.12)] text-sky-500 border border-[rgba(0,160,242,0.28)]"
                  : "text-text-secondary hover:text-text-primary hover:bg-[rgba(255,255,255,0.04)] border border-transparent"
                }
              `}
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[8px] text-text-tertiary hover:text-text-primary hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span className="text-xs font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
