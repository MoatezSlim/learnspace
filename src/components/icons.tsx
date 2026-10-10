import React from 'react';

// Stroke icons drawn on a 24px grid (1.8px stroke, round caps), in the spirit of the reference UI.
const P: Record<string, React.ReactNode> = {
  home: <><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5" /></>,
  courses: <><rect x="4" y="3.5" width="16" height="17" rx="2.5" /><path d="M8.5 3.5v17" /><path d="M11.5 8.5h5M11.5 12h5" /></>,
  library: <><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M8 8.5h8M8 12h8M8 15.5h5" /></>,
  progress: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /><path d="M12 3.5V2M20.5 12H22" /></>,
  badge: <><circle cx="12" cy="9" r="5.5" /><path d="m8.8 13.5-1.6 7 4.8-2.6 4.8 2.6-1.6-7" /></>,
  message: <><path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5v-3.5h-1A1.5 1.5 0 0 1 3 16V7a1.5 1.5 0 0 1 1.5-1.5Z" /><path d="M8 10h8M8 13.5h5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  arrowRight: <><path d="M4.5 12h15" /><path d="m13.5 6 6 6-6 6" /></>,
  arrowLeft: <><path d="M19.5 12h-15" /><path d="m10.5 6-6 6 6 6" /></>,
  play: <path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" stroke="none" />,
  pause: <><rect x="7" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" stroke="none" /><rect x="13.5" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" stroke="none" /></>,
  volume: <><path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  volumeOff: <><path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3Z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
  mic: <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></>,
  send: <><path d="M4 12 20 4.5 13.5 20l-2.3-6.2Z" /><path d="m11.2 13.8 4-4" /></>,
  smile: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" /><path d="M9 9.8h.01M15 9.8h.01" strokeWidth="2.6" /></>,
  clock: <><circle cx="12" cy="13" r="7.5" /><path d="M12 9.5V13l2.5 1.5M10 2.5h4M12 2.5v3" /></>,
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.3-5.1 3.6-7.8.4 1.9 1.6 3 2.7 3.5C11.9 7 13.4 4.6 15.7 3c-.4 2.6.8 4.6 1.9 6.1 1 1.4 1.9 2.9 1.9 5.2C19.5 18 16.3 21 12 21Z" />,
  shield: <><path d="M12 3.5 5 6.5v5c0 4.3 3 7.9 7 9 4-1.1 7-4.7 7-9v-5Z" /><path d="m8.8 12.2 2.3 2.3 4.3-4.6" /></>,
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8Z" />,
  bulb: <><path d="M9 17.5h6M10 21h4" /><path d="M8.2 14.5A6 6 0 1 1 15.8 14.5c-.7.6-.8 1.3-.8 2v1H9v-1c0-.7-.1-1.4-.8-2Z" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <><path d="M6 6l12 12M18 6 6 18" /></>,
  replay: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" /><path d="M4.5 4.5V9H9" /></>,
  lock: <><rect x="5.5" y="10.5" width="13" height="10" rx="2" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
  user: <><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5Z" /></>,
  briefcase: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V5.5h6v2M3.5 12.5h17" /></>,
  monitor: <><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M9 20.5h6M12 16.5v4" /></>,
  sprout: <><path d="M12 20.5V11" /><path d="M12 11c0-3.6-2.6-6-6.5-6 0 3.6 2.6 6 6.5 6ZM12 13.5c0-3 2.2-5 5.5-5 0 3-2.2 5-5.5 5Z" /></>,
  flask: <><path d="M9.5 3.5h5M10.5 3.5v6L5 18.5a1.5 1.5 0 0 0 1.3 2h11.4a1.5 1.5 0 0 0 1.3-2l-5.5-9v-6" /><path d="M7.5 14.5h9" /></>,
  palette: <><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.6 1.7-1.6h2.2a3.8 3.8 0 0 0 3.8-3.8c0-4.1-3.8-7.3-8.5-7.3Z" /><path d="M7.5 12h.01M9.5 8h.01M14 7.5h.01" strokeWidth="2.6" /></>,
  headphones: <><path d="M4 14.5v-2.5a8 8 0 0 1 16 0v2.5" /><rect x="3.5" y="14" width="4" height="6" rx="1.5" /><rect x="16.5" y="14" width="4" height="6" rx="1.5" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10.5 5-3v9l-5-3" /></>,
  text: <><path d="M6.5 3.5h8l3.5 3.5v13.5h-11.5Z" /><path d="M14.5 3.5V7H18M9.5 11.5h5M9.5 15h5" /></>,
  pencil: <><path d="M15 5.5 18.5 9 9 18.5H5.5V15Z" /><path d="m13 7.5 3.5 3.5" /></>,
  more: <><path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3" /></>,
  cloud: <path d="M7.5 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18.4 10a4.3 4.3 0 0 1-.9 8.5Z" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8h.01" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4Z" /><path d="M12 10v4.5M12 17.2h.01" /></>,
  sparkle: <path d="M12 3.5c.7 3.9 2.6 5.8 6.5 6.5-3.9.7-5.8 2.6-6.5 6.5-.7-3.9-2.6-5.8-6.5-6.5 3.9-.7 5.8-2.6 6.5-6.5ZM18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z" />,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  ear: <><path d="M7 9a5 5 0 0 1 10 0c0 3-2.6 3.8-2.6 6.2A3 3 0 0 1 11.5 18c-1.2 0-2-.5-2.5-1.3" /><path d="M10 9.5a2 2 0 0 1 4 0c0 1-.8 1.5-1.3 2" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  step: <><path d="M7.5 20.5c-2 0-3-1.5-3-3.3 0-2.3 1.3-3.4 1.3-6 0-2.2 1-4.7 3.2-4.7s2.7 2.6 2.2 5.6c-.5 3 .3 3.5.3 5 0 1.9-1.5 3.4-4 3.4Z" /><path d="M16.5 17.5c2 0 3-1.4 3-3 0-2-1.2-3-1.2-5.4 0-2-.9-4.1-2.8-4.1s-2.4 2.3-2 5c.5 2.7-.3 3.2-.3 4.6 0 1.6 1.2 2.9 3.3 2.9Z" /></>,
  medal: <><circle cx="12" cy="14.5" r="5.5" /><path d="M8.5 10 6 3.5h4l2 4 2-4h4L15.5 10" /><path d="m12 12 .9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3Z" /></>,
  flag: <><path d="M5.5 21V4" /><path d="M5.5 4.5h11l-2 3.5 2 3.5h-11" /></>,
  chat: <><path d="M5 18.5 3.5 21l3.8-1.3A8.5 8.5 0 1 0 5 18.5Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth="2.6" /></>,
  book: <><path d="M4 5.5A2 2 0 0 1 6 3.5h13.5v14H6a2 2 0 0 0-2 2Z" /><path d="M4 19.5a2 2 0 0 0 2 2h13.5v-4" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  logout: <><path d="M14.5 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4" /><path d="M10 8l-4 4 4 4M6 12h9.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  card: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 14.5h4" /></>,
  crown: <><path d="M4.5 16.5 3.5 8l5 3.8L12 5.5l3.5 6.3 5-3.8-1 8.5Z" /><path d="M5 19.5h14" /></>,
  receipt: <><path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 18.9Z" /><path d="M9 8.5h6M9 12h6M9 15.5h3.5" /></>,
  chevronsLeft: <path d="m11.5 6-6 6 6 6M18.5 6l-6 6 6 6" />,
  camera: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.6-2.5h5.2L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" /><circle cx="12" cy="12.8" r="3.6" /></>,
  upload: <><path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" /><path d="M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" /></>,
  download: <><path d="M12 4.5v11M7.5 11 12 15.5 16.5 11" /><path d="M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" /></>,
  rewind: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" /><path d="M4.5 4.5V9H9" /><path d="M10.6 10.2h2.9M10.8 10.2l-.4 2.4c.4-.3.9-.4 1.4-.4 1 0 1.6.7 1.6 1.6s-.7 1.7-1.7 1.7c-.6 0-1.1-.2-1.4-.6" strokeWidth="1.4" /></>,
  translate: <><path d="M4 5.5h9M8.5 3.5v2M6 5.5c.6 3 2.6 5.4 5.5 6.6M11 5.5c-.6 3-2.7 5.6-6.5 7" /><path d="m12.5 20.5 3.8-9 3.7 9M13.8 17.5h5" /></>,
  history: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" /><path d="M4.5 4.5V9H9M12 8v4.5l3 1.8" /></>,
  trend: <><path d="m3.5 16.5 5.5-5.5 4 4 7.5-7.5" /><path d="M15 7.5h5.5V13" /></>,
  bolt: <path d="M13 3 5.5 13.5H11l-1 7.5 7.5-10.5H12Z" />,
  pauseCircle: <><circle cx="12" cy="12" r="8.5" /><path d="M10 9v6M14 9v6" /></>,
  mortarboard: <><path d="M12 5 2.8 9.5 12 14l9.2-4.5Z" fill="currentColor" stroke="none" /><path d="M6.5 11.6v4c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4L12 14.3Z" fill="currentColor" stroke="none" opacity=".8" /><path d="M20.4 10v4.8" /></>,
  list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" strokeWidth="2.6" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  keyboard: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8" /></>,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-9.6A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.3c0 5.2-7.5 9.6-7.5 9.6Z" />,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>,
  wand: <><path d="m5 19 9.5-9.5M13 6l1 1M17.5 4.5v2M17.5 9.5v2M15 7h-2M22 7h-2" /><path d="m14.5 9.5 2-2" /></>,
  flameSolid: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.3-5.1 3.6-7.8.4 1.9 1.6 3 2.7 3.5C11.9 7 13.4 4.6 15.7 3c-.4 2.6.8 4.6 1.9 6.1 1 1.4 1.9 2.9 1.9 5.2C19.5 18 16.3 21 12 21Z" fill="currentColor" stroke="none" />,
  checkCircle: <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.3 2.4 2.4 4.6-4.9" /></>,
  minus: <path d="M5 12h14" />,
  sliders: <><path d="M4.5 7h9M17.5 7h2M4.5 17h3M11.5 17h8" /><circle cx="15.5" cy="7" r="2" /><circle cx="9.5" cy="17" r="2" /></>,
};

export type IconName = keyof typeof P;
export function Icon({ name, size = 20, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label} focusable="false">
      {P[name]}
    </svg>
  );
}

// Crisp flag badges (SVG) used on course cards and the current-path card
export function Flag({ code, size = 32 }: { code: 'gb' | 'es' | 'fr' | 'de' | 'it' | 'ru'; size?: number }) {
  const id = `flag-${code}`;
  const body: Record<string, React.ReactNode> = {
    gb: <g><rect width="60" height="60" fill="#012169" /><path d="M0 0 60 60M60 0 0 60" stroke="#fff" strokeWidth="12" /><path d="M0 0 60 60M60 0 0 60" stroke="#C8102E" strokeWidth="5" /><path d="M30 0v60M0 30h60" stroke="#fff" strokeWidth="18" /><path d="M30 0v60M0 30h60" stroke="#C8102E" strokeWidth="10" /></g>,
    es: <g><rect width="60" height="60" fill="#AA151B" /><rect y="15" width="60" height="30" fill="#F1BF00" /></g>,
    fr: <g><rect width="20" height="60" fill="#002654" /><rect x="20" width="20" height="60" fill="#fff" /><rect x="40" width="20" height="60" fill="#CE1126" /></g>,
    de: <g><rect width="60" height="20" fill="#000" /><rect y="20" width="60" height="20" fill="#DD0000" /><rect y="40" width="60" height="20" fill="#FFCE00" /></g>,
    it: <g><rect width="20" height="60" fill="#009246" /><rect x="20" width="20" height="60" fill="#fff" /><rect x="40" width="20" height="60" fill="#CE2B37" /></g>,
    ru: <g><rect width="60" height="20" fill="#fff" /><rect y="20" width="60" height="20" fill="#0039A6" /><rect y="40" width="60" height="20" fill="#D52B1E" /></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" className="flag" aria-hidden="true">
      <defs><clipPath id={id}><circle cx="30" cy="30" r="30" /></clipPath></defs>
      <g clipPath={`url(#${id})`}>{body[code]}</g>
      <circle cx="30" cy="30" r="29" fill="none" stroke="#fff" strokeWidth="2.5" />
    </svg>
  );
}
