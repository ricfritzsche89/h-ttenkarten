/* ============================================================ */
/* HÜTTENCUP 2026 - LEVEL & BADGES CONFIGURATION                */
/* ============================================================ */

const BADGES_CONFIG = {
  beer_pong_god: {
    id: 'beer_pong_god',
    name: 'Pong-Gott',
    desc: 'Mindestens 2 Siege beim Bierpong errungen',
    icon: 'assets/badges/beer_pong_god.png',
    xp: 250
  },
  sniper_bullseye: {
    id: 'sniper_bullseye',
    name: 'Scharfschütze',
    desc: '≥ 8 Treffer auf Sterne oder ≥ 40 Ringe auf der Zielscheibe',
    icon: 'assets/badges/sniper_bullseye.png',
    xp: 200
  },
  high_roller: {
    id: 'high_roller',
    name: 'High Roller',
    desc: 'Über 10 € Gewinn bei einer einzigen Wette abgestaubt',
    icon: 'assets/badges/high_roller.png',
    xp: 200
  },
  mvp_king: {
    id: 'mvp_king',
    name: 'MVP / OVR-König',
    desc: 'Führender auf dem Gesamt-Scoreboard (Platz 1)',
    icon: 'assets/badges/mvp_king.png',
    xp: 300
  },
  on_fire: {
    id: 'on_fire',
    name: 'On Fire',
    desc: '2 Turniersiege in direkter Folge errungen',
    icon: 'assets/badges/on_fire.png',
    xp: 200
  },
  first_blood: {
    id: 'first_blood',
    name: 'First Blood',
    desc: 'Erster Turniersieg des gesamten Abends',
    icon: 'assets/badges/first_blood.png',
    xp: 150
  },
  paparazzi: {
    id: 'paparazzi',
    name: 'Paparazzi',
    desc: 'Mindestens 3 Fotos für die TV-Slideshow hochgeladen',
    icon: 'assets/badges/paparazzi.png',
    xp: 150
  },
  alpine_shield: {
    id: 'alpine_shield',
    name: 'Hütten-Original',
    desc: 'Persönliche FUT-Karte erstellt & im Turnier registriert',
    icon: 'assets/badges/alpine_shield.png',
    xp: 100
  }
};

function getPlayerLevel(xp) {
  const points = Math.max(0, Number(xp) || 0);
  if (points >= 2200) {
    return {
      level: 5,
      title: 'Hütten-Legende',
      stars: '★★★★★',
      color: '#F59E0B',
      border: 'border-amber-400',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.6)]',
      bg: 'bg-gradient-to-r from-amber-600/40 via-amber-400/40 to-amber-600/40'
    };
  }
  if (points >= 1400) {
    return {
      level: 4,
      title: 'Turnier-Veteran',
      stars: '★★★★',
      color: '#60A5FA',
      border: 'border-blue-400',
      glow: 'shadow-[0_0_12px_rgba(96,165,250,0.5)]',
      bg: 'bg-blue-500/20'
    };
  }
  if (points >= 750) {
    return {
      level: 3,
      title: 'Party-Kämpfer',
      stars: '★★★',
      color: '#FBBF24',
      border: 'border-yellow-400',
      glow: 'shadow-[0_0_10px_rgba(251,191,36,0.4)]',
      bg: 'bg-yellow-500/20'
    };
  }
  if (points >= 300) {
    return {
      level: 2,
      title: 'Tresen-Talent',
      stars: '★★',
      color: '#CBD5E1',
      border: 'border-slate-300',
      glow: 'shadow-[0_0_8px_rgba(203,213,225,0.3)]',
      bg: 'bg-slate-500/20'
    };
  }
  return {
    level: 1,
    title: 'Hütten-Rookie',
    stars: '★',
    color: '#D97706',
    border: 'border-amber-700',
    glow: 'shadow-none',
    bg: 'bg-amber-900/30'
  };
}

/**
 * Option A: Render Card wrapped with Top-Right Level Pin and Bottom Medaillen-Gürtel
 */
function renderCardWithBadgesHtml(player, options = {}) {
  if (!player) return '';
  const cardImg = player.cardImage || player.portrait || 'chef.jfif';
  const imgClass = options.imgClass || 'h-[340px] w-auto max-w-full object-contain card-clean-shadow hover:scale-105 transition-transform duration-300';
  const lvl = getPlayerLevel(player.xp || 0);
  const badges = Array.isArray(player.badges) && player.badges.length > 0 ? player.badges : ['alpine_shield'];

  const beltSizeClass = options.beltSize === 'lg' ? 'w-10 h-10' : (options.beltSize === 'sm' ? 'w-6 h-6' : 'w-8 h-8 md:w-9 md:h-9');

  return `
    <div class="relative inline-block card-badges-container select-none group">
      <!-- The FUT Card Image -->
      <img src="${cardImg}" alt="${player.name}" class="${imgClass}">

      <!-- TOP-RIGHT: Level-Pin (Option A) -->
      <div class="absolute top-2.5 right-2.5 z-30 flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-black/90 border ${lvl.border} ${lvl.glow} backdrop-blur-md transition-transform group-hover:scale-110">
        <span class="text-[10px] font-fut font-black uppercase tracking-wider" style="color: ${lvl.color};">LVL ${lvl.level}</span>
        <span class="text-[8px] tracking-tighter" style="color: ${lvl.color};">${lvl.stars}</span>
      </div>

      <!-- BOTTOM: Medaillen-Gürtel (Option A) -->
      ${badges.length > 0 ? `
        <div class="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center space-x-1.5 px-3 py-1 rounded-2xl bg-black/90 border border-amber-400/60 shadow-[0_4px_25px_rgba(0,0,0,0.95),0_0_15px_rgba(245,158,11,0.4)] backdrop-blur-md transition-transform group-hover:scale-105">
          ${badges.slice(0, 4).map(bId => {
            const b = BADGES_CONFIG[bId];
            if (!b) return '';
            return `
              <div class="relative group/badge cursor-pointer" title="${b.name}: ${b.desc}">
                <img src="${b.icon}" alt="${b.name}" class="${beltSizeClass} object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] hover:scale-125 transition-transform duration-200">
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BADGES_CONFIG, getPlayerLevel, renderCardWithBadgesHtml };
}
