import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/analytics", label: "Analytics" },
  { href: "/customers", label: "Customers" },
  { href: "/settings", label: "Settings" },
];

export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="admin-shell dashboard-shell" data-builder-component="AdminShell" data-builder-id="admin-shell">
      <header className="admin-header dashboard-header" data-builder-id="admin-header">
        <div className="admin-header-inner" data-builder-id="admin-header-inner">
          <Link className="admin-brand" data-builder-id="admin-brand" href="/">
            Luma Admin
          </Link>
          <nav aria-label="Admin navigation" className="admin-nav" data-builder-id="admin-nav">
            {navItems.map((item) => (
              <Link className={`admin-nav-link admin-nav-${item.label.toLowerCase()}`} data-builder-id={`admin-nav-${item.label.toLowerCase()}`} href={item.href} key={item.href}>
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