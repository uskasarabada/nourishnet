import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Beaker, Menu, Plus, RotateCcw, Siren, X } from 'lucide-react';
import { useStore } from '../state/store';
import { cx } from './ui';
import { Logo } from './Logo';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/map', label: 'Map' },
  { to: '/predict', label: 'Predict' },
  { to: '/shelters', label: 'Shelter Needs' },
  { to: '/match', label: 'Matching' },
  { to: '/impact', label: 'Impact' },
  { to: '/volunteer', label: 'Volunteer' },
];

const EmergencyCtx = createContext<{ on: boolean; set: (v: boolean) => void }>({ on: false, set: () => {} });
export const useEmergency = () => useContext(EmergencyCtx);

export function EmergencyProvider({ children }: { children: ReactNode }) {
  const [on, set] = useState(false);
  return <EmergencyCtx.Provider value={{ on, set }}>{children}</EmergencyCtx.Provider>;
}

export function Layout() {
  const { user, dispatch } = useStore();
  const emergency = useEmergency();
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
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>
      <div className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-forest-900 px-4 py-1.5 text-center text-xs text-forest-100">
        <span className="inline-flex items-center gap-1.5">
          <Beaker size={13} aria-hidden /> Demonstration mode — every organization, person, and number shown is <strong className="text-white">fictional sample data</strong>.
        </span>
        <button
          className="inline-flex items-center gap-1 underline decoration-forest-400 underline-offset-2 hover:text-white"
          onClick={() => {
            if (confirm('Reset the demo? Drives you created and donations you logged will be removed.')) dispatch({ type: 'reset' });
          }}
        >
          <RotateCcw size={12} aria-hidden /> Reset demo
        </button>
      </div>

      <header className={cx('no-print sticky top-0 z-[1000] border-b backdrop-blur-md', landing ? 'border-transparent bg-cream-100/80' : 'border-cream-300/70 bg-cream-100/90')}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label="NourishNet home">
            <Logo />
            <span className="font-display text-xl font-semibold text-forest-900">NourishNet</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cx('rounded-full px-3 py-1.5 text-sm font-semibold transition-colors', isActive ? 'bg-forest-700 text-white' : 'text-ink-700 hover:bg-cream-200')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => emergency.set(!emergency.on)}
              aria-pressed={emergency.on}
              title="Emergency Response Mode: show only verified urgent requests"
              className={cx(
                'btn hidden border sm:inline-flex',
                emergency.on ? 'border-coral-600 bg-coral-600 text-white hover:bg-coral-700' : 'border-coral-100 bg-white text-coral-700 hover:bg-coral-50',
              )}
            >
              <Siren size={15} aria-hidden /> {emergency.on ? 'Emergency on' : 'Emergency'}
            </button>
            <Link to="/create" className="btn-primary hidden sm:inline-flex">
              <Plus size={16} aria-hidden /> New drive
            </Link>
            <Link to="/profile" className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 ring-2 ring-white" aria-label="Your profile">
              {user.name.split(' ').map((p) => p[0]).join('')}
            </Link>
            <button className="btn-ghost px-2 lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-cream-300 bg-cream-50 px-4 pb-4 pt-2 lg:hidden" aria-label="Mobile">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('block rounded-xl px-3 py-2.5 font-semibold', isActive ? 'bg-forest-700 text-white' : 'text-ink-700')}>
                {n.label}
              </NavLink>
            ))}
            <div className="mt-3 flex gap-2">
              <Link to="/create" className="btn-primary flex-1">
                <Plus size={16} /> New drive
              </Link>
              <button onClick={() => emergency.set(!emergency.on)} className={cx('btn flex-1 border', emergency.on ? 'bg-coral-600 text-white' : 'border-coral-100 bg-white text-coral-700')}>
                <Siren size={15} /> Emergency
              </button>
            </div>
          </nav>
        )}
      </header>

      {emergency.on && (
        <div className="no-print border-b border-coral-100 bg-coral-50">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2.5 text-sm text-coral-700 sm:px-6">
            <Siren size={16} className="animate-pulse" aria-hidden />
            <strong>Emergency Response Mode.</strong> Showing only requests that are Critical or High urgency <em>and</em> verified in the last 72 hours.
            <Link to="/shelters" className="font-semibold underline underline-offset-2">
              View urgent requests →
            </Link>
          </div>
        </div>
      )}

      <main id="main" className={landing ? '' : 'mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10'}>
        <Outlet />
      </main>

      <footer className="no-print mt-16 border-t border-cream-300 bg-cream-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-ink-500 sm:grid-cols-3 sm:px-6">
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
              <li><Link className="hover:text-forest-700" to="/predict#how">Forecasting method</Link></li>
              <li><Link className="hover:text-forest-700" to="/shelters#urgency">Urgency scoring</Link></li>
              <li><Link className="hover:text-forest-700" to="/match#how">Matching algorithm</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-ink-700">About this prototype</div>
            <p className="mt-2">Built for the Congressional App Challenge. Map data © OpenStreetMap contributors. All demo organizations are fictional.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
