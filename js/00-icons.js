'use strict';
/* ============================ icon library ============================
   One source of truth for every UI icon: compact 16x16 SVGs in the
   VS Code Dark+ palette (blue #75beff, gold #e2c08d, green #89d185,
   red #f48771, brush wood #ce9178). Monochrome icons use currentColor
   so they follow button text color. Static markup carries data-ico
   attributes and is hydrated at load (see bottom of 12-account.js). */
const PLICON=(function(){
  const S='<svg class="ico" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" ';
  const K='fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">';
  const I={};
  I.menu=S+K+'<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/></svg>';
  I.person=S+K+'<circle cx="8" cy="5.2" r="2.7"/><path d="M2.6 13.6c.8-2.9 3-4.3 5.4-4.3s4.6 1.4 5.4 4.3"/></svg>';
  I.image=S+K+'<rect x="1.7" y="2.7" width="12.6" height="10.6" rx="1.2"/><circle cx="5.4" cy="6.2" r="1.1" fill="#e2c08d" stroke="none"/><path d="M3.2 12.2l3.4-3.9 2.8 2.8 1.9-2.2 2.7 3.2" stroke="#75beff"/></svg>';
  I.frame=S+'fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">'
    +'<rect x="2.2" y="1.7" width="11.6" height="12.6" rx="1" stroke="#e2c08d"/>'
    +'<rect x="4.7" y="4.4" width="6.6" height="7.2" stroke="currentColor"/>'
    +'<path d="M4.7 9.8l2-2.2 1.7 1.7 1.2-1.3 1.7 1.8" stroke="#75beff"/></svg>';
  I.folder=S+'fill="#e2c08d" stroke="none"><path d="M1.6 3.8c0-.6.4-1 1-1h3.3l1.5 1.7h6c.6 0 1 .4 1 1v7c0 .6-.4 1-1 1H2.6c-.6 0-1-.4-1-1z" opacity=".9"/><path d="M1.6 6h12.8v6.5c0 .6-.4 1-1 1H2.6c-.6 0-1-.4-1-1z" fill="#eed09f"/></svg>';
  I.globe=S+'fill="none" stroke="#75beff" stroke-width="1.3" stroke-linecap="round">'
    +'<circle cx="8" cy="8" r="6.1"/><ellipse cx="8" cy="8" rx="2.7" ry="6.1"/><path d="M2 8h12M2.9 4.9h10.2M2.9 11.1h10.2"/></svg>';
  I.play=S+'fill="#89d185" stroke="none"><path d="M4.8 3.1a.5.5 0 01.76-.43l7.6 4.9a.5.5 0 010 .85l-7.6 4.9a.5.5 0 01-.76-.43z"/></svg>';
  I.stop=S+'fill="#f48771" stroke="none"><rect x="3.8" y="3.8" width="8.4" height="8.4" rx="1"/></svg>';
  I.link=S+K+'<path d="M6.7 9.3l2.6-2.6"/><path d="M8.8 4.6l1.5-1.5a2.6 2.6 0 013.6 3.6l-1.5 1.5"/><path d="M7.2 11.4l-1.5 1.5a2.6 2.6 0 01-3.6-3.6l1.5-1.5"/></svg>';
  I.book=S+K+'<path d="M8 3.4C6.6 2.4 4 2.3 2.4 3v9.8c1.6-.7 4.2-.6 5.6.4 1.4-1 4-1.1 5.6-.4V3c-1.6-.7-4.2-.6-5.6.4z"/><path d="M8 3.4v9.8"/></svg>';
  I.brush=S+'stroke="none">'
    +'<path d="M13.1 1.7l1.2 1.2c.4.4.4 1 0 1.4L9.2 9.4 6.6 6.8l5.1-5.1c.4-.4 1-.4 1.4 0z" fill="#ce9178"/>'
    +'<path d="M6 7.4l2.6 2.6c-.3 1.3-1 2-2.2 2.4-1.1.4-1.8 1-2.3 2-.9-.1-1.7-.4-2.4-1 .8-.7 1.1-1.4 1.2-2.4.2-1.7 1.3-3 3.1-3.6z" fill="#75beff"/></svg>';
  I.gear=S+'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">'
    +'<circle cx="8" cy="8" r="2.1"/><path d="M8 1.6v2.1M8 12.3v2.1M1.6 8h2.1M12.3 8h2.1M3.5 3.5L5 5M11 11l1.5 1.5M12.5 3.5L11 5M5 11l-1.5 1.5"/></svg>';
  I.shapes=S+'fill="none" stroke-width="1.4" stroke-linejoin="round">'
    +'<rect x="1.9" y="6.4" width="7" height="7.2" rx=".8" stroke="currentColor"/>'
    +'<circle cx="10.6" cy="5.2" r="3.6" stroke="#75beff"/></svg>';
  I.cursor=S+'fill="currentColor" stroke="none"><path d="M4.6 1.6l8.3 6.9-3.9.5 2.1 4.2-1.7.9-2.1-4.2-2.7 2.8z"/></svg>';
  I.pipette=S+K+'<path d="M9.7 2.7l3.6 3.6-1.1 1.1-.5-.5-5 5c-.5.5-1.9.6-2.7 1.6l-1-1c1-.8 1.1-2.2 1.6-2.7l5-5-.5-.5z"/><path d="M9.2 3.2L12.8 6.8" stroke="#75beff"/></svg>';
  I.palette=S+'stroke="none">'
    +'<path d="M8 1.9a6.1 6.1 0 100 12.2c1 0 1.4-.6 1.2-1.3-.3-.9-.1-1.7.9-2h1.7c1.4 0 2.3-1 2.3-2.6C14.1 4.4 11.4 1.9 8 1.9z" fill="none" stroke="currentColor" stroke-width="1.3"/>'
    +'<circle cx="5.2" cy="6" r="1.05" fill="#f48771"/><circle cx="8.4" cy="4.7" r="1.05" fill="#e2c08d"/><circle cx="10.9" cy="6.9" r="1.05" fill="#75beff"/><circle cx="4.9" cy="9.4" r="1.05" fill="#89d185"/></svg>';
  I.undo=S+K+'<path d="M6.3 3.6L2.9 7l3.4 3.4"/><path d="M2.9 7h6.3a3.9 3.9 0 013.9 3.9v.6"/></svg>';
  I.redo=S+K+'<path d="M9.7 3.6L13.1 7l-3.4 3.4"/><path d="M13.1 7H6.8a3.9 3.9 0 00-3.9 3.9v.6"/></svg>';
  I.grip=S+'fill="currentColor" stroke="none"><circle cx="5.6" cy="4" r="1"/><circle cx="10.4" cy="4" r="1"/><circle cx="5.6" cy="8" r="1"/><circle cx="10.4" cy="8" r="1"/><circle cx="5.6" cy="12" r="1"/><circle cx="10.4" cy="12" r="1"/></svg>';
  I.chevdown=S+K+'<path d="M3.6 6.1L8 10.5l4.4-4.4"/></svg>';
  I.unpack=S+K+'<path d="M9.6 2.4h4v4M13.4 2.6L9 7M6.4 13.6h-4v-4M2.6 13.4L7 9"/></svg>';
  I.eye=S+'fill="none" stroke="currentColor" stroke-width="1.3">'
    +'<path d="M1.6 8S4.1 3.6 8 3.6 14.4 8 14.4 8 11.9 12.4 8 12.4 1.6 8 1.6 8z"/><circle cx="8" cy="8" r="2" fill="#75beff" stroke="none"/></svg>';
  I.eyeoff=S+'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">'
    +'<path d="M1.6 8S4.1 3.6 8 3.6 14.4 8 14.4 8 11.9 12.4 8 12.4 1.6 8 1.6 8z" opacity=".45"/><path d="M3 13L13 3"/></svg>';
  I.up=S+K+'<path d="M8 12.4V3.8M4.4 7.2L8 3.6l3.6 3.6"/></svg>';
  I.down=S+K+'<path d="M8 3.6v8.6M4.4 8.8L8 12.4l3.6-3.6"/></svg>';
  I.copy=S+'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">'
    +'<rect x="5.4" y="5.4" width="8" height="8" rx="1"/><path d="M3.4 10.6h-.8a1 1 0 01-1-1V3.6a1 1 0 011-1h6a1 1 0 011 1v.8"/></svg>';
  I.trash=S+'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">'
    +'<path d="M2.6 4.2h10.8M5.6 4V2.8a.6.6 0 01.6-.6h3.6a.6.6 0 01.6.6V4M4.2 4.2l.6 8.9a1 1 0 001 .9h4.4a1 1 0 001-.9l.6-8.9M6.6 6.8v4.6M9.4 6.8v4.6"/></svg>';
  I.cloud=S+'fill="none" stroke="#75beff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">'
    +'<path d="M4.6 12.6a3.1 3.1 0 01-.5-6.1 4.1 4.1 0 018-1.2 3.3 3.3 0 01-.5 7.3h-1.4"/><path d="M8 13.4V8.6M6 10.4L8 8.5l2 1.9" stroke="currentColor"/></svg>';
  I.history=S+'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">'
    +'<circle cx="8" cy="8" r="5.7"/><path d="M8 4.8V8l2.4 1.5" stroke="#75beff"/></svg>';
  I.pencil=S+'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">'
    +'<path d="M11.2 2.3l2.5 2.5-8.7 8.7-3.2.7.7-3.2z"/><path d="M9.7 3.8l2.5 2.5" stroke="#e2c08d"/></svg>';
  I.key=S+'fill="none" stroke="#e2c08d" stroke-width="1.4" stroke-linecap="round">'
    +'<circle cx="5" cy="11" r="3"/><path d="M7.3 8.7l6.2-6.2M10.9 5.1l2 2M8.9 7.1l1.5 1.5"/></svg>';
  I.github=S+'fill="currentColor" stroke="none"><path d="M8 .6a7.6 7.6 0 00-2.4 14.8c.38.07.52-.16.52-.36l-.01-1.4c-2.11.46-2.56-1.02-2.56-1.02-.35-.88-.85-1.11-.85-1.11-.69-.47.05-.46.05-.46.77.05 1.17.79 1.17.79.68 1.16 1.78.83 2.22.63.07-.49.27-.83.48-1.02-1.69-.19-3.46-.84-3.46-3.76 0-.83.3-1.51.78-2.04-.08-.19-.34-.97.08-2.02 0 0 .64-.2 2.09.78a7.27 7.27 0 013.8 0c1.45-.98 2.09-.78 2.09-.78.42 1.05.16 1.83.08 2.02.49.53.78 1.21.78 2.04 0 2.93-1.78 3.57-3.47 3.76.27.23.51.7.51 1.4l-.01 2.08c0 .2.14.44.52.36A7.6 7.6 0 008 .6z"/></svg>';
  I.google=S+'stroke="none">'
    +'<path d="M15.5 8.17c0-.55-.05-1.08-.14-1.59H8v3.01h4.2a3.6 3.6 0 01-1.56 2.36v1.96h2.53c1.48-1.36 2.33-3.37 2.33-5.74z" fill="#4285f4"/>'
    +'<path d="M8 15.6c2.11 0 3.89-.7 5.18-1.9l-2.53-1.95c-.7.47-1.6.75-2.65.75-2.04 0-3.76-1.37-4.38-3.22H1.01v2.02A7.6 7.6 0 008 15.6z" fill="#34a853"/>'
    +'<path d="M3.62 9.28a4.53 4.53 0 010-2.91V4.35H1.01a7.57 7.57 0 000 6.95l2.61-2.02z" fill="#fbbc05"/>'
    +'<path d="M8 3.08c1.15 0 2.18.4 2.99 1.17l2.24-2.24A7.58 7.58 0 001.01 4.35l2.61 2.02C4.24 4.52 5.96 3.08 8 3.08z" fill="#ea4335"/></svg>';
  I.check=S+K+'<path d="M2.8 8.6l3.2 3.2 7.2-7.6"/></svg>';
  I.film=S+'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">'
    +'<rect x="1.8" y="4" width="9.2" height="8" rx="1.2"/>'
    +'<path d="M11 7.6l3.2-2.4v5.6L11 8.4" fill="#75beff" stroke="#75beff"/></svg>';
  I.sun=S+'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">'
    +'<circle cx="8" cy="8" r="3.1"/><path d="M8 1.6v1.8M8 12.6v1.8M1.6 8h1.8M12.6 8h1.8M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3"/></svg>';
  I.moon=S+'fill="currentColor" stroke="none">'
    +'<path d="M13.4 9.8A5.8 5.8 0 016.2 2.6a5.8 5.8 0 107.2 7.2z"/></svg>';
  return I;
})();
function plIco(name){ return PLICON[name]||''; }
