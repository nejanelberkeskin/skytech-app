/**
 * Skytech Green — merkezi SVG ikon kitaplığı.
 * Emoji yerine kullanılır; stroke/fill tek bir prop ile temada kalır.
 * Tüm ikonlar 24×24 viewBox, currentColor ile renkli.
 */

type IconProps = {
  className?: string;
  strokeWidth?: number;
};

const base = (sw: number = 1.8) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: sw,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function PackageIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

export function DroneIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <circle cx="4" cy="4" r="2" />
      <circle cx="20" cy="4" r="2" />
      <circle cx="4" cy="20" r="2" />
      <circle cx="20" cy="20" r="2" />
      <path d="M6 4h3" /><path d="M15 4h3" />
      <path d="M6 20h3" /><path d="M15 20h3" />
      <path d="M4 6v3" /><path d="M4 15v3" />
      <path d="M20 6v3" /><path d="M20 15v3" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

export function SproutIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
  );
}

export function GiftIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

export function MapPinIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function ClockIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function BarChartIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="M3 3v18h18" />
      <path d="M7 16V9" />
      <path d="M12 16v-5" />
      <path d="M17 16v-9" />
    </svg>
  );
}

export function CheckCircleIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11.5 14.5 16 9.5" />
    </svg>
  );
}

export function GlobeIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z" />
    </svg>
  );
}

export function MailIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  );
}

export function CertificateIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9" />
      <path d="M3 15h18" />
      <circle cx="12" cy="10" r="3" />
      <path d="m10 13-1.5 5 3.5-2 3.5 2L14 13" />
    </svg>
  );
}

export function PartyPopperIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="M5.8 11.3 2 22l10.7-3.79" />
      <path d="M4 3h.01" /><path d="M22 8h.01" /><path d="M15 2h.01" /><path d="M22 20h.01" />
      <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" />
      <path d="m22 13-1.99.94a2.9 2.9 0 0 0-1.49 2.4c0 .58-.25 1.13-.65 1.51l-.41.39c-.43.43-1.07.66-1.69.5L14 18" />
      <path d="M16.8 9.5c-.58-.58-1.42-.58-2 0L11 13.3" />
    </svg>
  );
}

export function TruckIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="M5 18H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12" />
      <path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

export function TreesIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0h0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" />
      <path d="M7 16v6" />
      <path d="M13 19h6" />
      <path d="M16 19v3" />
      <path d="M19 19a3 3 0 0 0 1-5.8V13a3 3 0 0 0-6 .2v.2A3 3 0 0 0 13 18.8" />
    </svg>
  );
}

export function ShoppingBagIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function HomeIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function UserIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
    </svg>
  );
}

export function SettingsIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function TrophyIcon({ className, strokeWidth }: IconProps) {
  return (
    <svg {...base(strokeWidth)} className={className}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
