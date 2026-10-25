/**
 * Thin diagonal accent lines over a black background, with a slightly lighter
 * panel on the right, for the dark hero sections.
 */
export function HeroLines({ color = '#4CAF3F' }: { color?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-y-0 right-0 w-[42%] bg-gradient-to-b from-white/[0.035] to-white/[0.015]" />
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 500">
        <defs>
          <linearGradient id="hl-fade" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={color} stopOpacity="0" />
            <stop offset="0.35" stopColor={color} stopOpacity="0.75" />
            <stop offset="1" stopColor={color} stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <line x1="455" y1="0" x2="585" y2="200" stroke={color} strokeOpacity="0.55" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <line x1="585" y1="200" x2="1000" y2="78" stroke="url(#hl-fade)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="500" x2="1000" y2="170" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="585" y1="210" x2="585" y2="500" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="absolute -left-40 top-1/3 h-80 w-80 rounded-full blur-3xl" style={{ background: color, opacity: 0.08 }} />
    </div>
  );
}
