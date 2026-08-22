/** Minimal 1.5px-stroke icon set — consistent, quiet, no emoji. */

type P = { size?: number; className?: string };

function I({ size = 18, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => (
  <I {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></I>
);
export const IconSun = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></I>
);
export const IconTarget = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></I>
);
export const IconCalendar = (p: P) => (
  <I {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></I>
);
export const IconGrid = (p: P) => (
  <I {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></I>
);
export const IconTimer = (p: P) => (
  <I {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></I>
);
export const IconChart = (p: P) => (
  <I {...p}><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-5M12 16V8M16 16v-8" /></I>
);
export const IconUsers = (p: P) => (
  <I {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.5c2.5.3 4.3 1.8 5 4.5" /></I>
);
export const IconBook = (p: P) => (
  <I {...p}><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5v-2Z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19" /></I>
);
export const IconUser = (p: P) => (
  <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4.5 21c1-4 4-6 7.5-6s6.5 2 7.5 6" /></I>
);
export const IconVideo = (p: P) => (
  <I {...p}><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="m15.5 12 6-3.5v7l-6-3.5Z" /></I>
);
export const IconPlus = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconCheck = (p: P) => <I {...p}><path d="M4.5 12.5 10 18 19.5 6.5" /></I>;
export const IconX = (p: P) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>;
export const IconChevronL = (p: P) => <I {...p}><path d="M14.5 5.5 8 12l6.5 6.5" /></I>;
export const IconChevronR = (p: P) => <I {...p}><path d="M9.5 5.5 16 12l-6.5 6.5" /></I>;
export const IconClock = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></I>
);
export const IconFlame = (p: P) => (
  <I {...p}><path d="M12 21c-3.9 0-6.5-2.5-6.5-6 0-2.6 1.6-4.6 3-6.3.9-1.1 1.9-2.3 2.3-3.7.1-.5.7-.7 1-.3 1.2 1.3 1.7 3 1.4 4.6 1-.5 1.8-1.3 2.3-2.3.2-.4.8-.5 1-.1 1.3 1.9 2 4.1 2 6.1 0 4.5-2.6 8-6.5 8Z" /></I>
);
export const IconEdit = (p: P) => (
  <I {...p}><path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" /></I>
);
export const IconTrash = (p: P) => (
  <I {...p}><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" /></I>
);
export const IconArrowR = (p: P) => <I {...p}><path d="M4 12h16M13 5l7 7-7 7" /></I>;
export const IconUpload = (p: P) => (
  <I {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></I>
);
export const IconBell = (p: P) => (
  <I {...p}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></I>
);
export const IconMoon = (p: P) => (
  <I {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" /></I>
);
export const IconPause = (p: P) => <I {...p}><path d="M9 5v14M15 5v14" /></I>;
export const IconPlay = (p: P) => <I {...p}><path d="M7 4.5v15l12-7.5-12-7.5Z" /></I>;
export const IconTrendUp = (p: P) => (
  <I {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></I>
);
export const IconTrendDown = (p: P) => (
  <I {...p}><path d="M3 7l6 6 4-4 8 8" /><path d="M15 17h6v-6" /></I>
);
export const IconInfo = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></I>
);
export const IconLock = (p: P) => (
  <I {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></I>
);
export const IconEye = (p: P) => (
  <I {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></I>
);
export const IconLogout = (p: P) => (
  <I {...p}><path d="M15 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9" /><path d="M11 12h10M17.5 8.5 21 12l-3.5 3.5" /></I>
);
export const IconSettings = (p: P) => (
  <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.15-1.4l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.4-1.4L13.8 3h-3.6l-.35 2.3a7 7 0 0 0-2.4 1.4l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .5.05.9.15 1.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.4 1.4l.35 2.3h3.6l.35-2.3a7 7 0 0 0 2.4-1.4l2.3 1 2-3.4-2-1.5c.1-.5.15-.9.15-1.4Z" /></I>
);
