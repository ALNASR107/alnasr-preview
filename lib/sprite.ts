/** أيقونات SVG مضمّنة (sprite) — تُحقن مرة واحدة في layout */
export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></symbol>
    <symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2"/><circle cx="3.5" cy="12" r="1.2"/><circle cx="3.5" cy="18" r="1.2"/></symbol>
    <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 20h18"/><rect x="5" y="11" width="3.4" height="6" rx="1"/><rect x="10.3" y="7" width="3.4" height="10" rx="1"/><rect x="15.6" y="4" width="3.4" height="13" rx="1"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0"/><path d="M16.5 5.4a3.2 3.2 0 0 1 0 6"/><path d="M18.2 14.2A5.6 5.6 0 0 1 21.5 19"/></symbol>
    <symbol id="i-wallet" viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13.5" rx="3"/><path d="M2.5 10h19"/><circle cx="17" cy="14.5" r="1.3"/></symbol>
    <symbol id="i-cog" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></symbol>
    <symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.7 8.7 0 1 0 11.1 11.1"/></symbol>
    <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12M7.5 11 12 15.5 16.5 11"/><path d="M3.5 17.5v1A2.5 2.5 0 0 0 6 21h12a2.5 2.5 0 0 0 2.5-2.5v-1"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="i-filter" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></symbol>
    <symbol id="i-in" viewBox="0 0 24 24"><path d="M12 19V5"/><path d="m5.5 11.5 6.5-6.5 6.5 6.5"/></symbol>
    <symbol id="i-out" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="m5.5 12.5 6.5 6.5 6.5-6.5"/></symbol>
    <symbol id="i-more" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="m4.5 12.5 5 5 10-11"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
    <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></symbol>
    <symbol id="i-bank" viewBox="0 0 24 24"><path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.7 10v8M14.3 10v8M19 10v8"/><path d="M3 20.5h18"/></symbol>
    <symbol id="i-cash" viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/></symbol>
    <symbol id="i-card" viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 9.5h19"/></symbol>
    <symbol id="i-wallet2" viewBox="0 0 24 24"><path d="M20 8V6.5A2.5 2.5 0 0 0 17.5 4H6a2.5 2.5 0 0 0 0 5h13a2.5 2.5 0 0 1 0 5h-2"/><path d="M3 6.5V18a2.5 2.5 0 0 0 2.5 2.5H18a2 2 0 0 0 2-2v-11"/><circle cx="16" cy="13" r="1.2"/></symbol>
    <symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></symbol>
    <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 8v5"/><circle cx="12" cy="16.6" r="1"/><path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0"/></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.2 2"/></symbol>
    <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4.5V11h-6.5"/></symbol>
    <symbol id="i-chev-r" viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></symbol>
    <symbol id="i-chev-l" viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"/></symbol>
    <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
    <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.4-3 8.2-7.5 9.5-4.5-1.3-7.5-5.1-7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/></symbol>
    <symbol id="i-swap" viewBox="0 0 24 24"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/></symbol>
    <symbol id="i-print" viewBox="0 0 24 24"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7z"/></symbol>
    <symbol id="i-logout" viewBox="0 0 24 24"><path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"/><path d="M15.5 8.5 19 12l-3.5 3.5"/><path d="M9.5 12H19"/></symbol>
    <symbol id="i-logo" viewBox="0 0 32 32"><path d="M16 4 5 10v7.2C5 23.3 9.7 27.9 16 29c6.3-1.1 11-5.7 11-11.8V10z" fill="#fff" opacity=".16"/><path d="M16 7.4 8.2 11.6v5.4c0 4.3 3.3 7.6 7.8 8.5 4.5-.9 7.8-4.2 7.8-8.5v-5.4z" fill="none" stroke="#fff" stroke-width="1.7"/><path d="M12.2 16.2l2.6 2.7 5-5.2" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></symbol>
      <symbol id="i-mail" viewBox="0 0 24 24"><rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="m3.5 7.5 7.2 5.4a2.2 2.2 0 0 0 2.6 0l7.2-5.4"/></symbol>
    <symbol id="i-lock" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15.5" r="1.3"/></symbol>
    <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12"/><circle cx="12" cy="12" r="3.2"/></symbol>
    <symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M4 4l16 16"/><path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4"/><path d="M6.3 8A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 3.4-.6"/><path d="M9.7 10.3a3.2 3.2 0 0 0 4.3 4.3"/></symbol>
    <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2-2.4 3.7"/><circle cx="12" cy="17.2" r="1"/></symbol>
    <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z"/></symbol>
  </defs>
</svg>`;
