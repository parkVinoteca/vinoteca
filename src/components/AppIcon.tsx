import type { SVGProps } from 'react'
export type IconName = 'home' | 'tasting' | 'blind' | 'cellar' | 'recommend' | 'camera' | 'upload' | 'wine' | 'star' | 'globe'
export default function AppIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const shapes = {
    home: <><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
    tasting: <><path d="M5 3h12v18H5Z M8 7h6 M8 11h3 M14 17l5-5 2 2-5 5-3 1Z"/></>,
    blind: <><path d="M7 3h10l1 8c0 4-12 4-12 0Z M12 14v7 M8 21h8 M4 7h16 M4 10h16"/></>,
    cellar: <><path d="M4 3h16v18H4Z M4 12h16"/><circle cx="8" cy="7.5" r="2"/><circle cx="16" cy="7.5" r="2"/><circle cx="8" cy="16.5" r="2"/><circle cx="16" cy="16.5" r="2"/></>,
    recommend: <><path d="M3 4h18v13h-7l-4 4v-4H3Z M9 7h6l.5 3c0 3-7 3-7 0Z M12 12v3 M10 15h4"/></>,
    camera: <><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></>,
    upload: <><path d="M12 16V3 m-4 4 4-4 4 4 M4 15v6h16v-6"/></>,
    wine: <><path d="M7 3h10l1 8c0 5-12 5-12 0Z M12 15v6 M8 21h8 M7 9h10"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>,
    globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  }
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{shapes[name]}</svg>
}
