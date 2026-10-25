// Icons drawn as inline SVG (no icon font, no network). Style is close to iOS symbols.

import type { ReactNode } from 'react';

const S = { stroke: 'currentColor', fill: 'none' } as const;

const icons: Record<string, ReactNode> = {
  home: <path d="M12 3.1L2.9 10.7c-.6.5-.3 1.5.5 1.5H5v7.2c0 .9.7 1.6 1.6 1.6h3v-5.4h4.8v5.4h3c.9 0 1.6-.7 1.6-1.6v-7.2h1.6c.8 0 1.1-1 .5-1.5z" fill="currentColor" stroke="none" />,
  star: <path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" {...S} strokeWidth="2" strokeLinejoin="round" />,
  'star-fill': <path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  play: <path d="M7 4.7v14.6c0 .8.9 1.3 1.6.9l12-7.3c.6-.4.6-1.3 0-1.7l-12-7.3C7.9 3.4 7 3.9 7 4.7z" fill="currentColor" stroke="none" />,
  pause: (
    <g fill="currentColor" stroke="none">
      <rect x="5.4" y="4" width="4.6" height="16" rx="1.4" />
      <rect x="14" y="4" width="4.6" height="16" rx="1.4" />
    </g>
  ),
  prev: (
    <g fill="currentColor" stroke="none">
      <path d="M21.4 6.6v10.8c0 .8-.9 1.3-1.6.8l-7.7-5.4c-.6-.4-.6-1.2 0-1.6l7.7-5.4c.7-.5 1.6 0 1.6.8z" />
      <path d="M11.4 6.6v10.8c0 .8-.9 1.3-1.6.8l-7.7-5.4c-.6-.4-.6-1.2 0-1.6l7.7-5.4c.7-.5 1.6 0 1.6.8z" />
    </g>
  ),
  next: (
    <g fill="currentColor" stroke="none">
      <path d="M2.6 6.6v10.8c0 .8.9 1.3 1.6.8l7.7-5.4c.6-.4.6-1.2 0-1.6L4.2 5.8c-.7-.5-1.6 0-1.6.8z" />
      <path d="M12.6 6.6v10.8c0 .8.9 1.3 1.6.8l7.7-5.4c.6-.4.6-1.2 0-1.6l-7.7-5.4c-.7-.5-1.6 0-1.6.8z" />
    </g>
  ),
  shuffle: (
    <g {...S} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h3.2c1.7 0 3.2.9 4.1 2.3l3.4 5.4c.9 1.4 2.4 2.3 4.1 2.3H21M3 17h3.2c1.7 0 3.2-.9 4.1-2.3M13.7 9.3c.9-1.4 2.4-2.3 4.1-2.3H21M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5" />
    </g>
  ),
  repeat: (
    <g {...S} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2.8l3.4 3.4L17 9.6M4 11v-1c0-2.2 1.8-4 4-4h12.4M7 21.2l-3.4-3.4L7 14.4M20 13v1c0 2.2-1.8 4-4 4H3.6" />
    </g>
  ),
  repeat1: (
    <g {...S} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2.8l3.4 3.4L17 9.6M4 11v-1c0-2.2 1.8-4 4-4h12.4M7 21.2l-3.4-3.4L7 14.4M20 13v1c0 2.2-1.8 4-4 4H3.6" />
      <path d="M11 10.6l1.5-1v5.6" strokeWidth="1.8" />
    </g>
  ),
  heart: <path d="M12 20.4s-7.8-4.7-7.8-10.6c0-2.7 2-4.5 4.3-4.5 1.5 0 2.8.7 3.5 2 .7-1.3 2-2 3.5-2 2.3 0 4.3 1.8 4.3 4.5 0 5.9-7.8 10.6-7.8 10.6z" {...S} strokeWidth="2" strokeLinejoin="round" />,
  'heart-fill': <path d="M12 20.4s-7.8-4.7-7.8-10.6c0-2.7 2-4.5 4.3-4.5 1.5 0 2.8.7 3.5 2 .7-1.3 2-2 3.5-2 2.3 0 4.3 1.8 4.3 4.5 0 5.9-7.8 10.6-7.8 10.6z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />,
  more: (
    <g fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </g>
  ),
  'chevron-down': <path d="M5 9l7 7 7-7" {...S} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  'chevron-right': <path d="M9 5l7 7-7 7" {...S} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  'chevron-left': <path d="M15 5l-7 7 7 7" {...S} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" {...S} strokeWidth="2.3" strokeLinecap="round" />,
  close: <path d="M6 6l12 12M18 6L6 18" {...S} strokeWidth="2.3" strokeLinecap="round" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" {...S} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  queue: (
    <g {...S} strokeWidth="2.1" strokeLinecap="round">
      <path d="M9 7h11M9 12h11M9 17h11" />
      <g fill="currentColor" stroke="none">
        <circle cx="4.6" cy="7" r="1.4" />
        <circle cx="4.6" cy="12" r="1.4" />
        <circle cx="4.6" cy="17" r="1.4" />
      </g>
    </g>
  ),
  lyrics: (
    <g {...S} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 4h13A2.5 2.5 0 0121 6.5v8a2.5 2.5 0 01-2.5 2.5h-5.7L9 20.4c-.5.4-1.2.1-1.2-.6V17H5.5A2.5 2.5 0 013 14.5v-8A2.5 2.5 0 015.5 4z" />
      <path d="M7.5 8.8h9M7.5 12.4h5.5" />
    </g>
  ),
  'lyrics-fill': (
    <g>
      <path d="M5.5 4h13A2.5 2.5 0 0121 6.5v8a2.5 2.5 0 01-2.5 2.5h-5.7L9 20.4c-.5.4-1.2.1-1.2-.6V17H5.5A2.5 2.5 0 013 14.5v-8A2.5 2.5 0 015.5 4z" fill="currentColor" stroke="none" />
      <path d="M7.5 8.8h9M7.5 12.4h5.5" stroke="var(--np-cut, #000)" strokeWidth="1.9" strokeLinecap="round" fill="none" />
    </g>
  ),
  airpods: (
    <g fill="currentColor" stroke="none">
      <path d="M8.2 3C5.9 3 4.2 4.8 4.2 7.1c0 1.9 1.1 3.3 2.6 3.8v8.1c0 .8.6 1.4 1.3 1.4s1.3-.6 1.3-1.4V7.2C9.4 6.1 9 5.2 8.2 5.2z" />
      <path d="M15.8 3c2.3 0 4 1.8 4 4.1 0 1.9-1.1 3.3-2.6 3.8v8.1c0 .8-.6 1.4-1.3 1.4s-1.3-.6-1.3-1.4V7.2c0-1.1.4-2 1.2-2z" />
    </g>
  ),
  airplay: (
    <g {...S} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.6 17H5.5A2.5 2.5 0 013 14.5v-9A2.5 2.5 0 015.5 3h13A2.5 2.5 0 0121 5.5v9a2.5 2.5 0 01-2.5 2.5h-1.1" />
      <path d="M12 14.2l5.1 6.3H6.9z" fill="currentColor" />
    </g>
  ),
  volume: (
    <g>
      <path d="M3 9.6v4.8h3.6l4.7 3.9V5.7L6.6 9.6z" fill="currentColor" stroke="none" />
      <path d="M14.6 9.3a3.9 3.9 0 010 5.4M17.2 6.7a7.5 7.5 0 010 10.6" {...S} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  'volume-low': (
    <g>
      <path d="M3 9.6v4.8h3.6l4.7 3.9V5.7L6.6 9.6z" fill="currentColor" stroke="none" />
      <path d="M14.6 9.3a3.9 3.9 0 010 5.4" {...S} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  note: (
    <g>
      <g {...S} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.4 17.6V6.4l9.4-1.9v10.7" />
        <path d="M9.4 9.8l9.4-1.9" />
      </g>
      <g fill="currentColor" stroke="none">
        <ellipse cx="7.1" cy="17.8" rx="2.9" ry="2.4" />
        <ellipse cx="16.5" cy="15.4" rx="2.9" ry="2.4" />
      </g>
    </g>
  ),
  listen: <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM10.1 8.1v7.8c0 .6.7 1 1.2.7l6-3.9c.5-.3.5-1 0-1.4l-6-3.9c-.5-.3-1.2.1-1.2.7z" fill="currentColor" stroke="none" fillRule="evenodd" />,
  browse: (
    <g fill="currentColor" stroke="none">
      <rect x="3" y="3" width="8.4" height="8.4" rx="2.4" />
      <rect x="12.6" y="3" width="8.4" height="8.4" rx="2.4" />
      <rect x="3" y="12.6" width="8.4" height="8.4" rx="2.4" />
      <rect x="12.6" y="12.6" width="8.4" height="8.4" rx="2.4" />
    </g>
  ),
  radio: (
    <g>
      <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
      <path d="M8 8.2a5.6 5.6 0 000 7.6M16 8.2a5.6 5.6 0 010 7.6M5 5.2a9.8 9.8 0 000 13.6M19 5.2a9.8 9.8 0 010 13.6" {...S} strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  library: (
    <g>
      <path d="M3 6h11M3 11h11M3 16h6" {...S} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20.2 17.4V7.2l-5 1.2" {...S} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="17.6" cy="17.6" rx="2.6" ry="2.2" fill="currentColor" stroke="none" />
    </g>
  ),
  search: (
    <g {...S} strokeWidth="2.3" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6.4" />
      <path d="M15.4 15.4L21 21" />
    </g>
  ),
  share: <path d="M12 3.5v11.5M8 7.4l4-4 4 4M7 10.5H6a2 2 0 00-2 2v6.5a2 2 0 002 2h12a2 2 0 002-2v-6.5a2 2 0 00-2-2h-1" {...S} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  info: (
    <g {...S} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.8" r="0.4" fill="currentColor" />
    </g>
  ),
  trash: <path d="M4 7h16M9 7V4.8c0-.4.4-.8.8-.8h4.4c.4 0 .8.4.8.8V7M6 7l.9 12.2c.1 1 .9 1.8 1.9 1.8h6.4c1 0 1.8-.8 1.9-1.8L18 7M10 11v6M14 11v6" {...S} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  settings: (
    <g {...S} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3.1" />
      <circle cx="12" cy="12" r="6.4" />
      <path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5" />
    </g>
  ),
  folder: <path d="M3 7.6A2.6 2.6 0 015.6 5H9l2 2.2h7.4A2.6 2.6 0 0121 9.8v7.6a2.6 2.6 0 01-2.6 2.6H5.6A2.6 2.6 0 013 17.4z" {...S} strokeWidth="2" strokeLinejoin="round" />,
  reorder: <path d="M4 8h16M4 12h16M4 16h16" {...S} strokeWidth="2.2" strokeLinecap="round" />,
  'minus-circle': (
    <g>
      <circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none" />
      <path d="M7.5 12h9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </g>
  ),
  'add-playlist': <path d="M3 6.5h12M3 11.5h8M3 16.5h6M17.5 13.5v8M13.5 17.5h8" {...S} strokeWidth="2.1" strokeLinecap="round" />,
  'play-next': (
    <g>
      <path d="M3 6.5h13M3 11.5h9M3 16.5h6" {...S} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M14.5 14.2v7.2c0 .6.6.9 1.1.6l5.3-3.6c.4-.3.4-.9 0-1.2l-5.3-3.6c-.5-.3-1.1 0-1.1.6z" fill="currentColor" stroke="none" />
    </g>
  ),
  'add-queue': <path d="M3 6.5h13M3 11.5h9M3 16.5h6M18 13v8M14 17h8" {...S} strokeWidth="2.1" strokeLinecap="round" />,
  person: (
    <g {...S} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c.6-3.8 3.7-6 7.5-6s6.9 2.2 7.5 6" />
    </g>
  ),
  album: (
    <g {...S} strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </g>
  ),
  edit: <path d="M4 20h4L19.4 8.6a2.1 2.1 0 000-3l-1-1a2.1 2.1 0 00-3 0L4 16zM13.6 6.4l4 4" {...S} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  warning: (
    <g {...S} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.6L2.9 19.4h18.2z" />
      <path d="M12 10v4.4" />
      <circle cx="12" cy="16.9" r="0.3" fill="currentColor" />
    </g>
  ),
  photo: (
    <g {...S} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="15" rx="2.6" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path d="M3.5 17l5-4.5 4 3.5 3-2.5 5 4" />
    </g>
  ),
  import: <path d="M12 3.5v12M7.5 11L12 15.5 16.5 11M4 17v1.5A2.5 2.5 0 006.5 21h11a2.5 2.5 0 002.5-2.5V17" {...S} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />,
  sparkle: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4zM19 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" stroke="none" />,
  clock: (
    <g {...S} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.4 2" />
    </g>
  ),
  mic: (
    <g {...S} strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" />
    </g>
  ),
  offline: (
    <g {...S} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18M8.6 8.9A8.5 8.5 0 004 12.5M13 6.3a8.6 8.6 0 018 6.2M10 15.6a5 5 0 014.2-1.1" />
      <circle cx="12" cy="19" r="0.4" fill="currentColor" />
    </g>
  ),
};

export type IconName = keyof typeof icons | string;

export function Icon({ name, size = 22, className = '', title }: { name: IconName; size?: number; className?: string; title?: string }) {
  const body = icons[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`icon ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {body}
    </svg>
  );
}
