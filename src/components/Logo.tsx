/** Full-color app icon (favicon style). */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill="#0A0C0B" />
      <path d="M16 6.5c-4.6 3.3-7 7-7 10.6a7 7 0 0 0 14 0c0-3.6-2.4-7.3-7-10.6z" fill="#6CCF4F" />
    </svg>
  );
}

/** Line-style mark for the header: a leaf over a base, drawn in currentColor. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" aria-hidden>
      <path d="M17 4c-5.5 4-8.4 8.3-8.4 12.6a8.4 8.4 0 0 0 16.8 0C25.4 12.3 22.5 8 17 4z" fill="currentColor" />
      <path d="M17 12v13" stroke="#CDD2D8" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="3" y="28" width="28" height="3" fill="currentColor" />
    </svg>
  );
}
