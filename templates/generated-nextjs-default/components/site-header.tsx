import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="site-header page-header" data-builder-component="SiteHeader" data-builder-id="site-header">
      <div className="site-header-inner" data-builder-id="site-header-inner">
        <Link className="site-logo" data-builder-id="site-logo" href="/">
          AppLoop
        </Link>
        <nav aria-label="Primary navigation" className="site-nav" data-builder-id="site-nav">
          {navItems.map((item) => (
            <Link data-builder-id={`site-nav-${item.label.toLowerCase()}`} href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}