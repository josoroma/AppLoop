import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/", label: "Home", className: "site-nav-home" },
  { href: "/features", label: "Features", className: "site-nav-features" },
  { href: "/pricing", label: "Pricing", className: "site-nav-pricing" },
  { href: "/contact", label: "Contact", className: "site-nav-contact" },
];

export function SiteHeader() {
  return (
    <header className="site-header page-header default-site-header" data-builder-component="SiteHeader" data-builder-id="site-header">
      <div className="site-header-inner default-site-header-inner" data-builder-id="site-header-inner">
        <Link className="site-logo default-site-logo" data-builder-id="site-logo" href="/">
          AppLoop
        </Link>
        <nav aria-label="Primary navigation" className="site-nav default-site-nav" data-builder-id="site-nav">
          {navItems.map((item) => (
            <Link className={`site-nav-link ${item.className}`} data-builder-id={item.className} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
