/*
 * Inline hand-drawn SVG icons — capability: app-shell (left rail).
 * No icon font (design handoff); all stroke icons inherit currentColor.
 */
import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconSearch = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Svg>
);
export const IconComposite = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
  </Svg>
);
export const IconEconomy = () => (
  <Svg>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
);
export const IconMarkets = () => (
  <Svg>
    <path d="M3 16l5-6 4 3 6-8" />
    <path d="M18 5h3v3" />
  </Svg>
);
export const IconConflict = () => (
  <Svg>
    <path d="M12 3l9 16H3z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
);
export const IconRelations = () => (
  <Svg>
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="8" r="2" />
    <circle cx="12" cy="18" r="2" />
    <path d="M6.6 7.3l4 9M17.4 9l-4.8 7.4M7 6.4l10 1.2" />
  </Svg>
);
export const IconIndustry = () => (
  <Svg>
    <path d="M3 20V10l6 4V10l6 4V6l6 3v11z" />
  </Svg>
);
export const IconAir = () => (
  <Svg>
    <path d="M21 15l-9-3-3 6-2-1 1-4-4-1 1-2 6 1 3-6 2 1-1 6z" />
  </Svg>
);
export const IconSat = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M5 5l3 3M16 16l3 3M12 3v3M12 18v3M3 12h3M18 12h3" />
  </Svg>
);
export const IconWeather = () => (
  <Svg>
    <path d="M7 18h10a4 4 0 000-8 5 5 0 00-9.6 1.3A3.5 3.5 0 007 18z" />
  </Svg>
);
export const IconSun = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
  </Svg>
);
export const IconBook = () => (
  <Svg>
    <path d="M4 5a2 2 0 012-2h6v16H6a2 2 0 00-2 2z" />
    <path d="M12 3h6a2 2 0 012 2v14a2 2 0 00-2-2h-6" />
  </Svg>
);
export const IconSettings = () => (
  <Svg>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
);
