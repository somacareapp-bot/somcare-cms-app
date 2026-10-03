// MedicineIcons.tsx
// Flat-illustration style medicine icons (glossy highlight + soft outline),
// matching the "real medicine packaging" reference look instead of flat emoji/line icons.
// Drop this file into: frontend/src/modules/pharmacy/MedicineIcons.tsx

import React from "react";

type IconProps = { size?: number; className?: string };

export const CapsuleIcon: React.FC<IconProps> = ({ size = 40, className }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
    <g transform="rotate(-35 32 32)">
      <path d="M20 14h24a10 10 0 0 1 10 10 10 10 0 0 1-10 10H20a10 10 0 0 1 0-20z" fill="#FF5C7A" stroke="#3D3348" strokeWidth="2"/>
      <path d="M32 14h12a10 10 0 0 1 10 10 10 10 0 0 1-10 10H32V14z" fill="#FFD34D" stroke="#3D3348" strokeWidth="2"/>
      <ellipse cx="25" cy="19" rx="3.2" ry="1.6" fill="#fff" opacity="0.85"/>
    </g>
    <g transform="translate(6 6) rotate(-35 32 32) scale(0.72)">
      <path d="M20 14h24a10 10 0 0 1 10 10 10 10 0 0 1-10 10H20a10 10 0 0 1 0-20z" fill="#17C3D6" stroke="#3D3348" strokeWidth="2.4"/>
      <path d="M32 14h12a10 10 0 0 1 10 10 10 10 0 0 1-10 10H32V14z" fill="#F4F1EC" stroke="#3D3348" strokeWidth="2.4"/>
      <ellipse cx="25" cy="19" rx="3" ry="1.4" fill="#fff" opacity="0.9"/>
    </g>
  </svg>
);

export const TabletIcon: React.FC<IconProps> = ({ size = 40, className }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
    <g transform="rotate(-18 32 34)">
      <ellipse cx="32" cy="38" rx="16" ry="9" fill="#F2A93B" stroke="#3D3348" strokeWidth="2"/>
      <path d="M16 38a16 9 0 0 0 32 0v-4a16 9 0 0 1-32 0z" fill="#D9861F"/>
      <line x1="18" y1="38" x2="46" y2="38" stroke="#B96F16" strokeWidth="1.4" opacity="0.6"/>
    </g>
    <ellipse cx="34" cy="20" rx="15" ry="8.5" fill="#FFD673" stroke="#3D3348" strokeWidth="2"/>
    <line x1="22" y1="19" x2="46" y2="21" stroke="#E8B34F" strokeWidth="1.6" opacity="0.8"/>
    <ellipse cx="28" cy="16" rx="4" ry="1.8" fill="#fff" opacity="0.8"/>
  </svg>
);

export const SyrupBottleIcon: React.FC<IconProps> = ({ size = 40, className }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
    <rect x="24" y="6" width="8" height="7" rx="1.5" fill="#8C6A4E" stroke="#3D3348" strokeWidth="1.6"/>
    <path d="M22 13h12l2 6v34a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V19z" fill="#5B3A29" stroke="#3D3348" strokeWidth="2"/>
    <rect x="19" y="30" width="18" height="17" rx="2" fill="#F7F4EE" stroke="#3D3348" strokeWidth="1.6"/>
    <circle cx="28" cy="36" r="4.2" fill="#E3453C"/>
    <path d="M28 33.2v5.6M25.4 36h5.2" stroke="#fff" strokeWidth="1.3"/>
    <line x1="21" y1="43" x2="35" y2="43" stroke="#C9C2B4" strokeWidth="1.4"/>
    <ellipse cx="21" cy="18" rx="1.6" ry="4" fill="#7A5236" opacity="0.7"/>
  </svg>
);

export const InjectionIcon: React.FC<IconProps> = ({ size = 40, className }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
    <g transform="rotate(45 32 32)">
      <rect x="14" y="27" width="26" height="10" rx="1.5" fill="#fff" stroke="#3D3348" strokeWidth="2"/>
      <rect x="14" y="27" width="12" height="10" fill="#F4863A"/>
      <line x1="18" y1="27" x2="18" y2="37" stroke="#3D3348" strokeWidth="1.2"/>
      <line x1="22" y1="27" x2="22" y2="37" stroke="#3D3348" strokeWidth="1.2"/>
      <rect x="40" y="30" width="10" height="4" fill="#3D3348"/>
      <polygon points="50,30 58,32 50,34" fill="#3D3348"/>
      <rect x="8" y="29" width="6" height="6" rx="1" fill="#F4863A" stroke="#3D3348" strokeWidth="1.6"/>
      <rect x="2" y="30.5" width="7" height="3" fill="#3D3348"/>
    </g>
    <g transform="translate(4 30)">
      <rect x="4" y="0" width="12" height="16" rx="2" fill="#F4863A" stroke="#3D3348" strokeWidth="2"/>
      <rect x="4" y="0" width="12" height="5" fill="#3D3348" opacity="0.85"/>
    </g>
  </svg>
);

export const OintmentIcon: React.FC<IconProps> = ({ size = 40, className }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
    <path d="M22 10h20l-2 8H24z" fill="#B9C3CC" stroke="#3D3348" strokeWidth="2"/>
    <path d="M23 18h18l3 5H20z" fill="#8FA0AC" stroke="#3D3348" strokeWidth="2"/>
    <rect x="17" y="23" width="30" height="30" rx="6" fill="#2FA8D6" stroke="#3D3348" strokeWidth="2"/>
    <rect x="21" y="30" width="22" height="14" rx="2.5" fill="#F7F4EE"/>
    <path d="M27 37h10M32 32v10" stroke="#2FA8D6" strokeWidth="2" strokeLinecap="round"/>
    <ellipse cx="23" cy="28" rx="2.4" ry="4.5" fill="#fff" opacity="0.35"/>
  </svg>
);

export const DropsIcon: React.FC<IconProps> = ({ size = 40, className }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
    <path d="M32 6c6 8 9 13.5 9 18a9 9 0 1 1-18 0c0-4.5 3-10 9-18z" fill="#FFC94A" stroke="#3D3348" strokeWidth="2"/>
    <ellipse cx="28.5" cy="22" rx="2" ry="4" fill="#fff" opacity="0.6"/>
    <rect x="14" y="38" width="30" height="20" rx="4" fill="#E3453C" stroke="#3D3348" strokeWidth="2"/>
    <rect x="18" y="42" width="22" height="12" rx="2" fill="#fff"/>
    <line x1="21" y1="47" x2="37" y2="47" stroke="#E3453C" strokeWidth="1.6"/>
    <line x1="21" y1="50.5" x2="33" y2="50.5" stroke="#E3453C" strokeWidth="1.6" opacity="0.6"/>
  </svg>
);

export const IVBagIcon: React.FC<IconProps> = ({ size = 40, className }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
    <circle cx="32" cy="8" r="2.4" fill="none" stroke="#3D3348" strokeWidth="2"/>
    <path d="M20 12h24l-3 26a9 9 0 0 1-9 8h0a9 9 0 0 1-9-8z" fill="#E3457B" stroke="#3D3348" strokeWidth="2"/>
    <rect x="24" y="20" width="16" height="10" rx="1.5" fill="#fff" opacity="0.9"/>
    <line x1="27" y1="24" x2="37" y2="24" stroke="#E3457B" strokeWidth="1.4"/>
    <line x1="27" y1="26.5" x2="34" y2="26.5" stroke="#E3457B" strokeWidth="1.4"/>
    <path d="M32 46v6l3 4-3 4-3-4 3-4v-6z" fill="#E3457B" stroke="#3D3348" strokeWidth="1.8"/>
  </svg>
);

export const OtherMedicineIcon: React.FC<IconProps> = ({ size = 40, className }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className}>
    <rect x="14" y="14" width="36" height="36" rx="6" fill="#8E7CC3" stroke="#3D3348" strokeWidth="2"/>
    <rect x="20" y="20" width="24" height="24" rx="3" fill="#F7F4EE"/>
    <path d="M32 26v12M26 32h12" stroke="#8E7CC3" strokeWidth="2.6" strokeLinecap="round"/>
    <ellipse cx="20" cy="18" rx="2.4" ry="4.5" fill="#fff" opacity="0.3"/>
  </svg>
);

// Background tile colors, rotated per item like the existing POS code does.
export const TILE_COLORS = ["#FFE9EE", "#FFF3D6", "#E6F7FB", "#EDE7FA", "#E9F7EC", "#FBEAE7"];

export type MedicineCategory =
  | "tablet"
  | "capsule"
  | "syrup"
  | "injection"
  | "ointment"
  | "drops"
  | "iv"
  | "other";

export function getMedicineIcon(category: string): React.FC<IconProps> {
  switch ((category || "").toLowerCase()) {
    case "tablet":
      return TabletIcon;
    case "capsule":
      return CapsuleIcon;
    case "syrup":
      return SyrupBottleIcon;
    case "injection":
      return InjectionIcon;
    case "ointment":
      return OintmentIcon;
    case "drops":
      return DropsIcon;
    case "iv":
      return IVBagIcon;
    default:
      return OtherMedicineIcon;
  }
}

// Usage inside a medicine card, replacing the emoji tile:
//
// const Icon = getMedicineIcon(medicine.category);
// const bg = TILE_COLORS[index % TILE_COLORS.length];
//
// <div style={{ background: bg }} className="w-12 h-12 rounded-xl flex items-center justify-center">
//   <Icon size={30} />
// </div>
