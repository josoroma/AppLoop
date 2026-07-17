import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/", label: "Overview", className: "admin-nav-overview" },
  { href: "/analytics", label: "Analytics", className: "admin-nav-analytics" },
  { href: "/customers", label: "Customers", className: "admin-nav-customers" },
  { href: "/settings", label: "Settings", className: "admin-nav-settings" },
];

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="admin-shell dashboard-shell admin-app-shell" data-builder-component="AdminShell" data-builder-id="admin-shell">
      <header className="admin-header dashboard-header admin-dashboard-header" data-builder-id="admin-header">
        <div className="admin-header-inner admin-dashboard-header-inner" data-builder-id="admin-header-inner">
          <Link className="admin-brand admin-header-brand" data-builder-id="admin-brand" href="/">
            Luma Admin
          </Link>
          <nav aria-label="Admin navigation" className="admin-nav admin-header-nav" data-builder-id="admin-nav">
            {navItems.map((item) => (
              <Link className={`admin-nav-link ${item.className}`} data-builder-id={item.className} href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      {children}
    </div>
  );
}
