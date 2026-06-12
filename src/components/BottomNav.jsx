import React from 'react';
import { T } from '../utils/theme.js';

const NAV_ITEMS = [
  { page:'hq', label:'HQ', icon: (color) => (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill={color}/>
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill={color} opacity=".55"/>
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill={color} opacity=".55"/>
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill={color} opacity=".35"/>
    </svg>
  )},
  { page:'tracking', label:'Track', icon: () => (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d="M2 12 L5.5 7 L9 10 L14 4" fill="none" stroke={T.blue} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="14" cy="4" r="1.8" fill={T.blue}/>
    </svg>
  )},
  { page:'settings', label:'Settings', icon: () => (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="5.5" fill="none" stroke={T.purple} strokeWidth="1.6"/>
      <circle cx="8" cy="8" r="2" fill={T.purple}/>
      <path d="M8 2.5v1M8 12.5v1M2.5 8h1M12.5 8h1" stroke={T.purple} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )},
  { page:'mindcheck', label:'Mind', icon: () => (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path d="M8 13C8 13 2.5 9.2 2.5 5.8a3.5 3.5 0 016.5-1.8 3.5 3.5 0 016.5 1.8C15.5 9.2 8 13 8 13z" fill="none" stroke={T.green} strokeWidth="1.6"/>
      <path d="M5.5 6.5l1.8 1.8L10 5.5" fill="none" stroke={T.green} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
];

export default function BottomNav({ mainPage, setMainPage, closeWaypoint }) {
  return (
    <div className="sig-nav">
      {NAV_ITEMS.map(({ page, label, icon }) => (
        <button
          key={page}
          className={`nb${mainPage === page ? ' on' : ''}`}
          onClick={() => { setMainPage(page); closeWaypoint(); }}
        >
          <div className="ni">{icon(T.accent)}</div>
          <div className="nl">{label}</div>
        </button>
      ))}
    </div>
  );
}
