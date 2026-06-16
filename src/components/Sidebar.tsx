"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Archive, Users, FileText, CreditCard, Settings, ShieldCheck, CalendarClock, CalendarDays, Home, Wallet, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { canSeeBillingSection, canSeeOrgTeamSection, isSuperAdmin } from "@/lib/permissions";
import { useUnreadSummary } from "@/hooks/useMenageViews";
import { useRescheduleRequests } from "@/hooks/useRescheduleRequests";

const NAV_ALL = [
  { href: "/dashboard", labelKey: "nav.overview", icon: LayoutDashboard, key: "overview" as const },
  { href: "/menages", labelKey: "nav.menages", icon: Building2, key: "menages" as const },
  { href: "/logements", labelKey: "nav.logements", icon: Home, key: "logements" as const },
  { href: "/calendar", labelKey: "nav.calendar", icon: CalendarDays, key: "calendar" as const },
  { href: "/reschedule-requests", labelKey: "nav.rescheduleRequests", icon: CalendarClock, key: "rescheduleRequests" as const },
  { href: "/archives", labelKey: "nav.archives", icon: Archive, key: "archives" as const },
  { href: "/team", labelKey: "nav.team", icon: Users, key: "team" as const },
  { href: "/earnings", labelKey: "nav.earnings", icon: Wallet, key: "earnings" as const },
  { href: "/invoices", labelKey: "nav.invoices", icon: Receipt, key: "invoices" as const },
  { href: "/billing", labelKey: "nav.billing", icon: CreditCard, key: "billing" as const },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, key: "settings" as const },
];

const SUPER_ADMIN_NAV = [
  { href: "/admin", labelKey: "admin.overview", icon: ShieldCheck, key: "admin-overview" as const },
  { href: "/admin/orgs", labelKey: "admin.orgs", icon: Building2, key: "admin-orgs" as const },
  { href: "/admin/users", labelKey: "admin.users", icon: Users, key: "admin-users" as const },
  { href: "/admin/audit", labelKey: "admin.audit", icon: FileText, key: "admin-audit" as const },
  { href: "/admin/errors", labelKey: "admin.errors", icon: ShieldCheck, key: "admin-errors" as const },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useI18n();
  const summary = useUnreadSummary(!!user);
  const totalUnread = Object.values(summary.data?.by_menage ?? {}).reduce(
    (s, n) => s + n,
    0,
  );
  const isAdmin = user?.role === "admin";
  const rescheduleList = useRescheduleRequests({ status: "pending" });
  const pendingReschedules = isAdmin
    ? (rescheduleList.data?.data ?? []).filter((r) => r.status === "pending").length
    : 0;

  const visible = NAV_ALL.filter((item) => {
    if (item.key === "team") return canSeeOrgTeamSection(user);
    if (item.key === "billing") return canSeeBillingSection(user);
    if (item.key === "rescheduleRequests" || item.key === "earnings" || item.key === "invoices") {
      return user?.role === "admin";
    }
    return true;
  });
  const showSuperAdmin = isSuperAdmin(user);

  return (
    <>
      {/* Overlay (mobile uniquement), visible quand le drawer est ouvert */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col gap-1 overflow-y-auto border-r border-zinc-200 bg-white px-3 py-4 transition-transform dark:border-zinc-800 dark:bg-zinc-900",
          "md:static md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
      <Link href="/dashboard" onClick={onClose} className="mb-4 flex items-center gap-2 px-3 py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-estia.svg"
          alt="Estia"
          className="h-20 w-auto dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-estia-blanc.svg"
          alt="Estia"
          className="hidden h-20 w-auto dark:block"
        />
      </Link>

      <nav className="flex flex-col gap-0.5">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const badge =
            item.key === "menages" && totalUnread > 0
              ? totalUnread
              : item.key === "rescheduleRequests" && pendingReschedules > 0
                ? pendingReschedules
                : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
              )}
            >
              <Icon size={18} />
              <span className="flex-1">{t(item.labelKey)}</span>
              {badge > 0 ? (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {showSuperAdmin ? (
        <>
          <div className="mt-6 px-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              {t("admin.section")}
            </p>
          </div>
          <nav className="mt-1 flex flex-col gap-0.5">
            {SUPER_ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                  )}
                >
                  <Icon size={18} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </>
      ) : null}
      </aside>
    </>
  );
}
