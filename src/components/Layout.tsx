import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, RotateCcw, X } from 'lucide-react';
import { useStore } from '../state/store';
import { cx } from './ui';
import { LogoMark } from './Logo';
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

  return (
    <div className="min-h-screen overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>

      <header className="sticky top-0 z-[1000] bg-steel-200">
        <div className="container-wide flex h-20 items-center gap-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 text-night-900" aria-label="NourishNet home">
            <LogoMark />
            <span className="font-display text-[1.75rem] font-medium leading-none tracking-[-0.03em]">NourishNet</span>
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-10 md:flex lg:gap-14" aria-label="Main">
            {FEATURES.map((f) => (
              <NavLink
                key={f.to}
                to={f.to}
                className={({ isActive }) => cx('relative py-2 text-[17px] font-medium text-night-900 transition-opacity hover:opacity-70', isActive && 'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-[3px] after:bg-[var(--accent)]')}
                style={{ ['--accent' as string]: f.color }}
              >
                {f.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link to="/plan#create" className="btn-primary hidden px-7 py-3.5 text-[17px] font-medium sm:inline-flex">Plan a drive</Link>
            <button className="btn-ghost px-2 md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-black/10 bg-steel-200 px-4 pb-4 pt-2 md:hidden" aria-label="Mobile">
            {FEATURES.map((f) => (
              <NavLink key={f.to} to={f.to} className={({ isActive }) => cx('block px-3 py-2.5 text-lg font-medium text-night-900', isActive && 'bg-white/50')}>
                {f.label}
              </NavLink>
            ))}
            <Link to="/plan#create" className="btn-primary mt-2 w-full py-3">Plan a drive</Link>
          </nav>
        )}
      </header>

      <main id="main" className={landing ? '' : 'container-wide pb-10'}>
        <Outlet />
      </main>

      <footer className="mt-20 bg-night-900 text-white/60">
        <div className="container-wide grid gap-8 py-14 text-sm sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5 text-white">
              <LogoMark size={26} />
              <span className="font-display text-2xl font-medium tracking-[-0.03em]">NourishNet</span>
            </div>
            <p className="mt-3 max-w-xs">Predict needs. Connect communities. Fight hunger.</p>
          </div>
          <div>
            <div className="font-semibold text-white">How it works</div>
            <ul className="mt-3 space-y-1.5">
              <li><Link className="hover:text-lime-400" to="/plan#ai">How the AI works</Link></li>
              <li><Link className="hover:text-lime-400" to="/shelters#urgency">The urgency score</Link></li>
              <li><Link className="hover:text-lime-400" to="/match#how">The matching algorithm</Link></li>
              <li><Link className="hover:text-lime-400" to="/#sources">Data sources</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-white">About</div>
            <p className="mt-3">Built for the Congressional App Challenge. Map data © OpenStreetMap contributors.</p>
            <button
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-lime-400 underline underline-offset-2"
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
