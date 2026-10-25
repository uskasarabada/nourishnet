import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, RotateCcw, X } from 'lucide-react';
import { useStore } from '../state/store';
import { cx } from './ui';
import { Logo } from './Logo';
import { FEATURES } from './features';

export function Layout() {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
    if (loc.hash) {
      const t = setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      return () => clearTimeout(t);
    }
    window.scrollTo({ top: 0 });
  }, [loc.pathname, loc.hash]);
  const landing = loc.pathname === '/';

  const navLink = (mobile: boolean) =>
    FEATURES.map((f) => (
      <NavLink
        key={f.to}
        to={f.to}
        className={({ isActive }) =>
          cx(mobile ? 'flex items-center gap-2 rounded-xl px-3 py-2.5 font-semibold' : 'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors', !isActive && 'text-ink-700 hover:bg-cream-200')
        }
        style={({ isActive }) => (isActive ? { background: f.color, color: '#fff' } : undefined)}
      >
        {({ isActive }) => (
          <>
            <span className="h-2 w-2 rounded-full" style={{ background: isActive ? '#fff' : f.color }} aria-hidden />
            {f.label}
          </>
        )}
      </NavLink>
    ));

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>
      <header className={cx('sticky top-0 z-[1000] border-b backdrop-blur-md', landing ? 'border-transparent bg-cream-100/80' : 'border-cream-300/70 bg-cream-100/90')}>
        <div className="container-wide flex h-16 items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="NourishNet home">
            <Logo />
            <span className="font-display text-xl font-semibold text-forest-900">NourishNet</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {navLink(false)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/plan#create" className="btn-primary hidden sm:inline-flex">Plan a drive</Link>
            <button className="btn-ghost px-2 md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-cream-300 bg-cream-50 px-4 pb-4 pt-2 md:hidden" aria-label="Mobile">
            {navLink(true)}
          </nav>
        )}
      </header>

      <main id="main" className={landing ? '' : 'container-wide py-8 sm:py-10'}>
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-cream-300 bg-cream-50">
        <div className="container-wide grid gap-6 py-10 text-sm text-ink-500 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <Logo size={26} />
              <span className="font-display text-lg font-semibold text-forest-900">NourishNet</span>
            </div>
            <p className="mt-2 max-w-xs">Predict needs. Connect communities. Fight hunger.</p>
          </div>
          <div>
            <div className="font-semibold text-ink-700">How it works</div>
            <ul className="mt-2 space-y-1">
              <li><Link className="hover:text-forest-700" to="/plan#ai">How the AI works</Link></li>
              <li><Link className="hover:text-forest-700" to="/shelters#urgency">The urgency score</Link></li>
              <li><Link className="hover:text-forest-700" to="/match#how">The matching algorithm</Link></li>
              <li><Link className="hover:text-forest-700" to="/#sources">Data sources</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-ink-700">About this prototype</div>
            <p className="mt-2">Built for the Congressional App Challenge. Map data © OpenStreetMap contributors. Demo organizations and numbers are fictional.</p>
            <button
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-forest-700 underline underline-offset-2"
              onClick={() => {
                if (confirm('Reset the demo? Drives you created and donations you logged will be removed.')) dispatch({ type: 'reset' });
              }}
            >
              <RotateCcw size={12} aria-hidden /> Reset demo
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
