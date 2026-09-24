// Original vector illustrations for the web edition, not extracted game assets.
export const gooseArt=color=>`<svg class="goose-art" viewBox="0 0 100 110" aria-hidden="true"><path fill="${color}" stroke="#242628" stroke-width="3" d="M30 105Q16 92 28 74L37 57Q25 34 39 18Q49 7 63 16Q86 14 85 39Q85 58 64 61L62 77Q80 88 78 105Z"/><path fill="#fff9dc" stroke="#242628" stroke-width="2" d="M55 23Q75 17 77 34Q78 48 68 49Q57 46 55 23Z"/><ellipse cx="68" cy="33" rx="3" ry="6" fill="#242628"/><path fill="#f4a132" stroke="#242628" stroke-width="3" d="M44 38Q49 34 54 40L59 48Q58 55 35 55Q23 53 30 48Z"/><path d="M43 78Q27 93 48 95" fill="none" stroke="#242628" stroke-width="3" stroke-linecap="round"/></svg>`;
const frame=body=>`<svg class="action-art" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="#26302b" stroke-width="3" stroke-linejoin="round">${body}</svg>`;
export const actionArt=[
 frame('<path fill="#c6cbd0" d="M8 34h48v19H8z"/><ellipse fill="#c94d47" cx="32" cy="32" rx="18" ry="10"/><path fill="#fff8df" d="M12 10l19 7 6 12-8 7-18-9z"/>'),
 gooseArt('#fff9dd'),
 frame('<path fill="#767d87" d="M7 17h34v30H7z"/><path fill="#c4c9c7" d="M41 25l16-8v31l-16-8z"/><path d="M21 48v9m-10 0h20"/><circle cx="23" cy="31" r="8" fill="#343b42"/>'),
 frame('<path fill="#d6bd80" d="M8 15h15l-3 9Q39 50 14 53Q-2 47 12 24zM42 15h15l-3 9Q69 50 44 53Q25 47 46 24z"/><path d="M23 8h22m-5-4 5 4-5 4M42 59H21m5-4-5 4 5 4"/>'),
 frame('<path fill="#8b9691" d="M10 7h43v49H10z"/><path fill="#56605b" d="M16 13h31v36H16z"/><circle fill="#b4bcad" cx="31" cy="30" r="10"/><path d="M31 20v20m-10-10h20M14 56v5m35-5v5"/>')
];
