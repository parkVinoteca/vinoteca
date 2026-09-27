import type { SVGProps } from 'react'
export type IconName = 'home' | 'tasting' | 'blind' | 'cellar' | 'recommend' | 'camera' | 'upload' | 'wine' | 'star' | 'globe'
export default function AppIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const shapes = {
    home: <><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
    tasting: <><path d="M5 3h12v18H5Z M8 7h6 M8 11h3 M14 17l5-5 2 2-5 5-3 1Z"/></>,
    blind: <g strokeWidth="1.4">
      <path d="M3 12C.5 11 .7 7.5 4 6.5L9 4.8C16 2.5 23 6.1 23 10c0 1.6-1 2.2-2 2.3"/>
      <path d="M3 12c0-4 3-5 9-5s9 1 9 5v1c0 4-3 6-6 4.5l-2-1a2 2 0 0 0-2 0l-2 1C6 19 3 17 3 13Z" fill="currentColor" fillOpacity=".08"/>
      <path d="M5.5 11.5q2 2.5 4 0 M14.5 11.5q2 2.5 4 0 M6 12.2l-.7 1 M7.5 12.8v1.1 M9 12.2l.7 1 M15 12.2l-.7 1 M16.5 12.8v1.1 M18 12.2l.7 1" strokeWidth="1.2"/>
    </g>,
    cellar: <g fill="currentColor" stroke="none" textAnchor="middle" fontFamily="Georgia, serif"><text x="12" y="10" fontSize="10" letterSpacing="1">MY</text><text x="12" y="21" fontSize="10">wine</text></g>,
    recommend: <><circle cx="8" cy="6" r="3"/><path d="M2 21v-5c0-5 12-5 12 0v5 M5 12l3 4 3-4 M6 17l2 1-2 1Z M10 17l-2 1 2 1Z M14 3h9v9h-4l-3 3v-3h-2Z"/><path d="M16.5 7.5h.1 M19 7.5h.1 M21.5 7.5h.1" strokeWidth="2"/></>,
    camera: <><path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/></>,
    upload: <><path d="M12 16V3 m-4 4 4-4 4 4 M4 15v6h16v-6"/></>,
    wine: <><path d="M7 3h10l1 8c0 5-12 5-12 0Z M12 15v6 M8 21h8 M7 9h10"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>,
    globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  }
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{shapes[name]}</svg>
}
