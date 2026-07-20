import Link from 'next/link'
import { ThemeToggle } from './theme-toggle'

const navItems = [
  { href: '/', label: 'Profile', className: 'cv-nav-profile' },
  { href: '/experience', label: 'Experience', className: 'cv-nav-experience' },
  { href: '/projects', label: 'Projects', className: 'cv-nav-projects' },
  { href: '/contact', label: 'Contact', className: 'cv-nav-contact' },
]

export function SiteHeader() {
  return (
    <header
      className="site-header cv-site-header"
      data-builder-component="SiteHeader"
      data-builder-id="site-header"
    >
      <div
        className="site-header-inner cv-site-header-inner"
        data-builder-id="site-header-inner"
      >
        <Link
          className="site-logo cv-site-logo"
          data-builder-id="site-logo"
          href="/"
        >
          LumaCV
        </Link>
        <nav
          aria-label="Primary navigation"
          className="site-nav cv-site-nav"
          data-builder-id="site-nav"
        >
          {navItems.map((item) => (
            <Link
              className={`site-nav-link cv-nav-link ${item.className}`}
              data-builder-id={item.className}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  )
}