// Profile pictures: illustrated avatars (flat, drawn here in SVG), initials, or the learner's own photo
// (resized in the browser and kept with their progress).
import React, { useId } from 'react';
import type { ProfilePhoto } from '../types';

interface AvatarDef { id: string; label: string; bg: [string, string]; skin: string; hair: string; shirt: string; style: 'short' | 'long' | 'curly' | 'bun' | 'beard' | 'bob' }

export const AVATARS: AvatarDef[] = [
  { id: 'alex', label: 'Cheveux courts, pull bleu', bg: ['#E4EEFC', '#C9DBF7'], skin: '#F3CDB0', hair: '#4A3426', shirt: '#2C67D4', style: 'short' },
  { id: 'lina', label: 'Cheveux longs, haut vert', bg: ['#E3F4EC', '#C5E7D6'], skin: '#E6B48F', hair: '#2A211C', shirt: '#2F8F6E', style: 'long' },
  { id: 'sam', label: 'Cheveux bouclés, haut violet', bg: ['#EEEAFE', '#D9D0FB'], skin: '#9A6544', hair: '#1E1814', shirt: '#6D4CE0', style: 'curly' },
  { id: 'jade', label: 'Chignon, haut corail', bg: ['#FDEEE4', '#F8D6C0'], skin: '#F1C7A5', hair: '#B5652B', shirt: '#E07049', style: 'bun' },
  { id: 'noah', label: 'Barbe, pull bleu marine', bg: ['#E6EEF6', '#CFDCEA'], skin: '#C88D63', hair: '#3A2A20', shirt: '#123A66', style: 'beard' },
  { id: 'mia', label: 'Carré blond, haut rose', bg: ['#FCE8EF', '#F6CCDB'], skin: '#F6D6BF', hair: '#D9AE55', shirt: '#D24F7B', style: 'bob' },
];
export const INITIAL_COLORS: [string, string][] = [['#2C67D4', '#5B8FF0'], ['#0C2643', '#24507F'], ['#2F8F6E', '#4DB38F'], ['#6D4CE0', '#9478F2'], ['#E07049', '#F29A6E'], ['#D24F7B', '#EC7FA2']];
export const DEFAULT_PHOTO: ProfilePhoto = { kind: 'avatar', id: 'alex' };

export const initialsOf = (first: string, last: string) => `${(first.trim()[0] ?? '').toUpperCase()}${(last.trim()[0] ?? '').toUpperCase()}` || '?';

function Hair({ a, part }: { a: AvatarDef; part: 'back' | 'front' }) {
  const c = a.hair;
  switch (a.style) {
    case 'long':
      return part === 'back'
        ? <path d="M18.6 31c-.9-11 5-18.4 13.4-18.4S46.3 20 45.4 31l1.3 16.5c-4.4 2.3-24.9 2.3-29.4 0Z" fill={c} />
        : <path d="M20.6 28.6c.6-8.4 5.4-13 11.6-13 6.9 0 11.6 4.6 11.4 12.6-3.5-1.6-7.4-4.6-9.3-8.2-2.6 4.6-8 7.6-13.7 8.6Z" fill={c} />;
    case 'curly':
      return part === 'back' ? null : (
        <g fill={c}>
          {[[21.5, 24], [24, 19.5], [28.4, 16.6], [33.4, 15.8], [38.2, 17.4], [41.8, 21], [43, 25.6], [26, 22.8], [31, 20.6], [36.4, 21.2], [40, 24]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i > 6 ? 3.4 : 4.3} />)}
        </g>
      );
    case 'bun':
      return part === 'back'
        ? <circle cx="32" cy="12.6" r="5.6" fill={c} />
        : <path d="M20.6 28.4c-.2-8.6 4.7-13.4 11.4-13.4s11.6 4.8 11.4 13.4c-2.2-4.8-6.4-7.6-11.4-7.6s-9.2 2.8-11.4 7.6Z" fill={c} />;
    case 'beard':
      return part === 'back' ? null : (
        <g fill={c}>
          <path d="M20.8 27.6c-.4-8 4.4-12.6 11.2-12.6 6.9 0 11.6 4.6 11.2 12.6-1.6-3.6-4.4-5.8-11.2-5.8s-9.6 2.2-11.2 5.8Z" />
          <path d="M21.3 30.5c.3 7.6 4.6 11.6 10.7 11.6s10.4-4 10.7-11.6c-1.4 2.4-2.6 3.4-4.2 3.6-1.6-1.6-3.8-2.3-6.5-2.3s-4.9.7-6.5 2.3c-1.6-.2-2.8-1.2-4.2-3.6Z" />
        </g>
      );
    case 'bob':
      return part === 'back'
        ? <path d="M18.8 30.4c-.6-10.4 5-17 13.2-17s13.8 6.6 13.2 17l-.6 9.4c-2.1 1.2-4.3 1.4-6 .8V27.4H25.4v13.2c-1.7.6-3.9.4-6-.8Z" fill={c} />
        : <path d="M20.4 28.4c.4-8.2 5-13 11.6-13s11.2 4.8 11.6 13c-5.6.4-13.8-2.2-17.4-6.6-1.4 3-3.4 5.4-5.8 6.6Z" fill={c} />;
    default: // short
      return part === 'back' ? null : <path d="M20.7 28.4c-.7-8.6 4.3-13.6 11.6-13.6 7.6 0 12 5 11 13.2-1.9-4.2-5.4-6.4-10.2-6.3-5.3.1-9.6 2.5-12.4 6.7Z" fill={c} />;
  }
}

/** One illustrated avatar (decorative: the surrounding control carries the name). */
export function AvatarSvg({ id, className }: { id: string; className?: string }) {
  const a = AVATARS.find((x) => x.id === id) ?? AVATARS[0];
  const g = `av${useId().replace(/[^a-zA-Z0-9]/g, '')}`; // unique per instance (the same avatar appears several times)
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a.bg[0]} /><stop offset="1" stopColor={a.bg[1]} /></linearGradient>
        <clipPath id={`${g}-c`}><circle cx="32" cy="32" r="32" /></clipPath>
      </defs>
      <g clipPath={`url(#${g}-c)`}>
        <rect width="64" height="64" fill={`url(#${g})`} />
        <g transform="translate(32 38) scale(1.2) translate(-32 -38)">
        <Hair a={a} part="back" />
        <path d="M9 66c1.5-12.6 10.6-19.6 23-19.6S53.5 53.4 55 66Z" fill={a.shirt} />
        <path d="M26.6 46.6c1.5 2.4 3.3 3.5 5.4 3.5s3.9-1.1 5.4-3.5" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.4" strokeLinecap="round" />
        <rect x="27.2" y="36.5" width="9.6" height="11" rx="4.2" fill={a.skin} />
        <rect x="27.2" y="36.5" width="9.6" height="5" rx="2.5" fill="#000" opacity=".07" />
        <circle cx="20.8" cy="30.6" r="2.6" fill={a.skin} />
        <circle cx="43.2" cy="30.6" r="2.6" fill={a.skin} />
        <ellipse cx="32" cy="29.4" rx="11.2" ry="12.6" fill={a.skin} />
        <ellipse cx="27.6" cy="30.4" rx="1.25" ry="1.55" fill="#2A2320" />
        <ellipse cx="36.4" cy="30.4" rx="1.25" ry="1.55" fill="#2A2320" />
        <circle cx="25.6" cy="34.2" r="2.1" fill="#F08A7E" opacity=".22" />
        <circle cx="38.4" cy="34.2" r="2.1" fill="#F08A7E" opacity=".22" />
        {a.style !== 'beard' && <path d="M29.2 35.6c1.8 1.6 3.8 1.6 5.6 0" fill="none" stroke="#9A5B4A" strokeWidth="1.3" strokeLinecap="round" />}
        <Hair a={a} part="front" />
        </g>
      </g>
    </svg>
  );
}

/** Initials on a coloured disc, as an SVG so it scales with its box. */
export function InitialsSvg({ text, color = 0, className }: { text: string; color?: number; className?: string }) {
  const [c1, c2] = INITIAL_COLORS[color % INITIAL_COLORS.length];
  const g = `ini${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs><linearGradient id={g} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${g})`} />
      <text x="32" y="33" textAnchor="middle" dominantBaseline="central" fill="#fff" fontFamily="'Nunito Sans', system-ui, sans-serif" fontWeight="800" fontSize={text.length > 1 ? 23 : 28} letterSpacing=".5">{text}</text>
    </svg>
  );
}

/** Any profile picture. */
export function PhotoView({ photo, first, last, className }: { photo: ProfilePhoto; first: string; last: string; className?: string }) {
  if (photo.kind === 'image') return <img className={className} src={photo.src} alt="" draggable={false} />;
  if (photo.kind === 'initials') return <InitialsSvg className={className} text={initialsOf(first, last)} color={photo.color} />;
  return <AvatarSvg className={className} id={photo.id} />;
}

/** Square, centred crop of an image file, resized for a profile picture (JPEG data URL). */
export function resizePhoto(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('type')); return; }
    if (file.size > 15 * 1024 * 1024) { reject(new Error('size')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
        const c = document.createElement('canvas'); c.width = size; c.height = size;
        const ctx = c.getContext('2d'); if (!ctx) throw new Error('canvas');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.86));
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}
