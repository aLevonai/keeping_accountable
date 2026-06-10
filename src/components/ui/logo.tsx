export function AppLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: "22.5%", display: "block", flexShrink: 0 }}
    >
      <rect width="512" height="512" fill="#F8F4F0" />
      <rect x="232" y="243" width="90" height="26" rx="13" fill="#C4704F" opacity="0.13" />
      <circle cx="164" cy="256" r="88" fill="#C4704F" />
      <path d="M128 256 L156 288 L206 220" stroke="white" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="348" cy="256" r="88" fill="#C4704F" opacity="0.38" />
      <path d="M312 256 L340 288 L390 220" stroke="white" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
    </svg>
  );
}
