export function Logo({ size = 32 }: { size?: number }) {
  // A leaf whose vein is a rising forecast line: growth + prediction.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#145536" />
      <path d="M16 6.5c-4.6 3.3-7 7-7 10.6a7 7 0 0 0 14 0c0-3.6-2.4-7.3-7-10.6z" fill="#FBF8F1" />
      <path d="M12.2 20.4l2.6-2.6 2 1.6 3-3.6" fill="none" stroke="#1F8A52" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19.8" cy="15.8" r="1.4" fill="#E3A008" />
    </svg>
  );
}
