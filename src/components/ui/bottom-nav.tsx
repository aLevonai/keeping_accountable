"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, Star, BookOpen, User } from "lucide-react";
import { cn } from "@/utils/cn";

const navItems = [
  { href: "/home",    icon: Home,     label: "Home" },
  { href: "/goals",   icon: Target,   label: "Goals" },
  { href: "/dreams",  icon: Star,     label: "Dreams" },
  { href: "/journal", icon: BookOpen, label: "Journal" },
  { href: "/profile", icon: User,     label: "Profile" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[--border]"
      style={{
        background: "var(--nav-bg)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors",
                active ? "text-[--primary]" : "text-[--muted]"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className={cn("text-[10px] font-semibold", active ? "text-[--primary]" : "text-[--muted]")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
