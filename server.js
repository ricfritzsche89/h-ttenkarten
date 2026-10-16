const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { WebSocketServer, WebSocket } = require('ws');
const QRCode = require('qrcode');
const { BADGES_CONFIG, getPlayerLevel } = require('./badges.js');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const CARDS_DIR = path.join(__dirname, 'cards');
const PHOTOS_DIR = path.join(__dirname, 'photos');
const PORTRAITS_DIR = path.join(__dirname, 'portraits');
const DATA_FILE = path.join(DATA_DIR, 'gut_tournament.json');
const HALL_OF_FAME_FILE = path.join(DATA_DIR, 'hall_of_fame.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CARDS_DIR)) fs.mkdirSync(CARDS_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });
if (!fs.existsSync(PORTRAITS_DIR)) fs.mkdirSync(PORTRAITS_DIR, { recursive: true });

// Robust IP detection: filter out Tailscale, virtual adapters, and 169.254.x.x link-local
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    const lowerName = name.toLowerCase();
    // Skip virtual, VPN, or loopback interfaces
    if (lowerName.includes('tailscale') || lowerName.includes('virtual') || lowerName.includes('pseudo') || lowerName.includes('vethernet') || lowerName.includes('loopback')) {
      continue;
    }

    for (const iface of interfaces[name]) {
      // Must be IPv4, non-internal, and NOT link-local (169.254.x.x)
      if (!iface.internal && iface.family === 'IPv4' && !iface.address.startsWith('169.254.')) {
        // Prioritize WLAN / Wi-Fi or Ethernet
        const isPriority = lowerName.includes('wlan') || lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('ethernet');
        candidates.push({ address: iface.address, priority: isPriority ? 1 : 2, name });
      }
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);

  if (candidates.length > 0) {
    return candidates[0].address;
  }
  return 'localhost';
}

function getInitialTournamentData() {
  return {
    meta: {
      title: 'Grillhütte Ultimate Team Tournament',
      updatedAt: new Date().toISOString()
    },
    inbox: [], // Stores freshly submitted cards from guests before or after adding
    players: [
      {
        id: 'p1',
        name: 'Elias',
        nickname: 'The Hammer',
        ovr: 98,
        pos: 'ST',
        edition: 'img_bier',
        editionName: 'Goldenes Bierfest',
        portrait: 'chef.jfif',
        stats: { PAC: 99, SHO: 98, PAS: 95, DRI: 97, DEF: 85, PHY: 99 }
      },
      {
        id: 'p2',
        name: 'Lena',
        nickname: 'Sniper Queen',
        ovr: 96,
        pos: 'CAM',
        edition: 'img_krone',
        editionName: 'Kaiserliche Prunkkrone',
        portrait: 'chef.jfif',
        stats: { PAC: 94, SHO: 97, PAS: 98, DRI: 96, DEF: 78, PHY: 89 }
      },
      {
        id: 'p3',
        name: 'Max',
        nickname: 'Bierkönig',
        ovr: 94,
        pos: 'CM',
        edition: 'img_holz',
        editionName: 'Eisenhütte',
        portrait: 'chef.jfif',
        stats: { PAC: 88, SHO: 93, PAS: 92, DRI: 90, DEF: 82, PHY: 95 }
      }
    ],
    games: [
      {
        id: 'g1',
        name: 'Bierpong',
        icon: '🍻',
        type: 'counter',
        unit: 'Treffer',
        step: 1,
        multiplier: 100,
        scores: { p1: 25, p2: 18, p3: 20 }
      },
      {
        id: 'g2',
        name: 'Schießen',
        icon: '🏹',
        type: 'counter',
        unit: 'Ringe',
        step: 5,
        multiplier: 10,
        scores: { p1: 250, p2: 215, p3: 170 }
      },
      {
        id: 'g3',
        name: 'Darts',
        icon: '🎯',
        type: 'counter',
        unit: 'Punkte',
        step: 10,
        multiplier: 1,
        scores: { p1: 400, p2: 350, p3: 250 }
      },
      {
        id: 'g4',
        name: 'Nageln',
        icon: '🔨',
        type: 'placement',
        unit: 'Punkte',
        pointsMap: [500, 350, 250, 150, 100],
        scores: { p1: 500, p2: 350, p3: 250 }
      }
    ]
  };
}

let tournamentData;
try {
  if (fs.existsSync(DATA_FILE)) {
    tournamentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!tournamentData.inbox) tournamentData.inbox = [];
    if (!tournamentData.photos) tournamentData.photos = [];
    if (!tournamentData.musicQueue) tournamentData.musicQueue = [];
    if (!tournamentData.guestbook) tournamentData.guestbook = [];
  } else {
    tournamentData = getInitialTournamentData();
    if (!tournamentData.photos) tournamentData.photos = [];
    if (!tournamentData.musicQueue) tournamentData.musicQueue = [];
    if (!tournamentData.guestbook) tournamentData.guestbook = [];
    saveTournamentData();
  }
  if (!tournamentData.activeEvent) {
    tournamentData.activeEvent = {
      status: 'idle',
      gameId: null,
      timerMinutes: 5,
      timerEndsAt: null,
      teamA: { name: 'Team Rot', playerIds: [] },
      teamB: { name: 'Team Blau', playerIds: [] },
      note: '',
      activePlayerId: null,
      round: 1,
      betting: {
        status: 'open',
        bets: [],
        winner: null,
        payouts: []
      }
    };
  }
} catch (e) {
  tournamentData = getInitialTournamentData();
  if (!tournamentData.photos) tournamentData.photos = [];
  if (!tournamentData.musicQueue) tournamentData.musicQueue = [];
  if (!tournamentData.guestbook) tournamentData.guestbook = [];
  if (!tournamentData.activeEvent) {
    tournamentData.activeEvent = {
      status: 'idle',
      gameId: null,
      timerMinutes: 5,
      timerEndsAt: null,
      teamA: { name: 'Team Rot', playerIds: [] },
      teamB: { name: 'Team Blau', playerIds: [] },
      note: '',
      activePlayerId: null,
      round: 1,
      betting: {
        status: 'open',
        bets: [],
        winner: null,
        payouts: []
      }
    };
  }
}
if (tournamentData.activeEvent && !tournamentData.activeEvent.betting) {
  tournamentData.activeEvent.betting = {
    status: 'open',
    bets: [],
    winner: null,
    payouts: []
  };
}

function ensureTournamentMetaDefaults() {
  if (!tournamentData.meta) tournamentData.meta = {};
  if (!tournamentData.meta.title) tournamentData.meta.title = 'Hüttencup 2026';
  if (!tournamentData.meta.eventTheme) tournamentData.meta.eventTheme = 'oktoberfest';
  if (!tournamentData.meta.eventName) tournamentData.meta.eventName = 'Oktoberfest-Edition';
  if (!tournamentData.meta.eventSubtitle) tournamentData.meta.eventSubtitle = '5 WETTKÄMPFE • LIVE WETTPOTT • FOTO-WALL • FINALE';
  if (!tournamentData.meta.icon) tournamentData.meta.icon = '🥨';
  if (!tournamentData.meta.hostName) tournamentData.meta.hostName = 'Ric (The Boss)';
  if (!tournamentData.meta.eventYear) tournamentData.meta.eventYear = 2026;
}
ensureTournamentMetaDefaults();

function saveTournamentData() {
  try {
    tournamentData.meta.updatedAt = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(tournamentData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

/* ============================================================ */
/* HALL OF FAME & PERMANENT CHAMPION ENGINE                     */
/* ============================================================ */
let hallOfFame = { champions: [] };
try {
  if (fs.existsSync(HALL_OF_FAME_FILE)) {
    hallOfFame = JSON.parse(fs.readFileSync(HALL_OF_FAME_FILE, 'utf8'));
    if (!Array.isArray(hallOfFame.champions)) hallOfFame.champions = [];
  } else {
    fs.writeFileSync(HALL_OF_FAME_FILE, JSON.stringify(hallOfFame, null, 2), 'utf8');
  }
} catch (e) {
  console.error('Error loading Hall of Fame:', e);
}

function saveHallOfFame() {
  try {
    fs.writeFileSync(HALL_OF_FAME_FILE, JSON.stringify(hallOfFame, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving Hall of Fame:', err);
  }
}

function checkChampionStatus(player) {
  if (!player || !player.name) return false;
  const isChamp = (hallOfFame.champions || []).some(c => 
    c.winnerName && c.winnerName.toLowerCase().trim() === player.name.toLowerCase().trim()
  );
  if (isChamp) {
    if (!Array.isArray(player.badges)) player.badges = ['alpine_shield'];
    if (!player.badges.includes('champion_cup')) {
      player.badges.unshift('champion_cup');
      if (typeof player.xp === 'number') player.xp += 500;
    }
    player.isChampion = true;
    return true;
  }
  return false;
}

/* ============================================================ */
/* LEVEL & BADGES ENGINE                                        */
/* ============================================================ */
function ensurePlayerBadgeDefaults(p) {
  if (typeof p.xp !== 'number') p.xp = 100;
  if (!Array.isArray(p.badges)) p.badges = ['alpine_shield'];
  if (!p.badges.includes('alpine_shield')) p.badges.unshift('alpine_shield');
  checkChampionStatus(p);
  p.level = getPlayerLevel(p.xp).level;
}

// Initialize all existing players
(tournamentData.players || []).forEach(ensurePlayerBadgeDefaults);

function addPlayerXp(playerId, amount, reason = '') {
  const p = (tournamentData.players || []).find(x => x.id === playerId);
  if (!p) return;
  ensurePlayerBadgeDefaults(p);
  const oldLvl = p.level;
  p.xp += Math.max(0, Number(amount) || 0);
  const lvlInfo = getPlayerLevel(p.xp);
  p.level = lvlInfo.level;

  if (p.level > oldLvl) {
    broadcast({
      type: 'LEVEL_UP',
      payload: {
        playerId: p.id,
        playerName: p.name,
        oldLevel: oldLvl,
        newLevel: p.level,
        title: lvlInfo.title,
        color: lvlInfo.color
      }
    });
  }
}

function awardPlayerBadge(playerId, badgeId) {
  const p = (tournamentData.players || []).find(x => x.id === playerId);
  const badge = BADGES_CONFIG[badgeId];
  if (!p || !badge) return;
  ensurePlayerBadgeDefaults(p);

  if (!p.badges.includes(badgeId)) {
    p.badges.push(badgeId);
    addPlayerXp(playerId, badge.xp || 100, `Badge: ${badge.name}`);
    saveTournamentData();

    broadcast({
      type: 'BADGE_UNLOCKED',
      payload: {
        playerId: p.id,
        playerName: p.name,
        badgeId,
        badgeName: badge.name,
        badgeDesc: badge.desc,
        badgeIcon: badge.icon
      }
    });
  }
}

function togglePlayerBadge(playerId, badgeId) {
  const p = (tournamentData.players || []).find(x => x.id === playerId);
  if (!p) return;
  ensurePlayerBadgeDefaults(p);
  if (p.badges.includes(badgeId)) {
    p.badges = p.badges.filter(b => b !== badgeId);
    saveTournamentData();
  } else {
    awardPlayerBadge(playerId, badgeId);
  }
}

function checkMvpKingBadge() {
  const players = tournamentData.players || [];
  if (!players.length) return;
  const scores = {};
  (tournamentData.games || []).forEach(g => {
    if (g.scores) {
      Object.entries(g.scores).forEach(([pId, score]) => {
        scores[pId] = (scores[pId] || 0) + (Number(score) || 0);
      });
    }
  });

  let topPlayerId = null;
  let topScore = 0;
  Object.entries(scores).forEach(([pId, s]) => {
    if (s > topScore) {
      topScore = s;
      topPlayerId = pId;
    }
  });

  if (topPlayerId && topScore > 0) {
    awardPlayerBadge(topPlayerId, 'mvp_king');
  }
}

// Express App Setup
const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Enable CORS so phones or guests can post easily
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Static file serving with high-performance caching for assets/images
app.use(express.static(__dirname, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    // HTML pages, JS scripts and Service Worker must revalidate so updates are immediately visible
    if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache');
      if (filePath.endsWith('sw.js')) {
        res.setHeader('Service-Worker-Allowed', '/');
      }
    } else if (filePath.endsWith('manifest.json')) {
      res.setHeader('Content-Type', 'application/manifest+json');
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.includes(path.sep + 'cards' + path.sep) || filePath.includes('/cards/')) {
      // Dynamic player cards should revalidate immediately!
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (filePath.match(/\.(png|jpg|jpeg|webp|gif|svg|woff2?|ttf|mp3|wav|ogg)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// Direct PDF Download Endpoint
app.get('/download-pdf', (req, res) => {
  const pdfPath = path.join(__dirname, 'Huettencup_2026_Kompakt_Broschuere.pdf');
  if (fs.existsSync(pdfPath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.download(pdfPath, 'Huettencup_2026_Kompakt_Broschuere.pdf');
  } else {
    res.status(404).send('PDF nicht gefunden.');
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(msgObj) {
  const data = JSON.stringify(msgObj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'STATE_INIT', data: tournamentData }));

  ws.on('message', (messageRaw) => {
    try {
      const msg = JSON.parse(messageRaw);
      handleClientMessage(msg);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });
});

function generateTeamsInternal(gameId, playerIds = null) {
  const isRic = (p) => p && /^(ric|riccardo|richard)\b/i.test((p.name || '').trim());
  const isMandy = (p) => p && /^(mandy|mandi)\b/i.test((p.name || '').trim());

  const allPlayers = tournamentData.players || [];
  const poolIds = (playerIds && playerIds.length > 0) ? playerIds : allPlayers.map(p => p.id);
  const selectedPlayers = poolIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean);

  if (selectedPlayers.length < 2) {
    return;
  }

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let teamAIds = [];
  let teamBIds = [];
  let note = '';

  if (selectedPlayers.length === 2) {
    // 1vs1
    const p1 = selectedPlayers[0];
    const p2 = selectedPlayers[1];
    if (isRic(p1) && isMandy(p2)) {
      teamAIds = [p1.id];
      teamBIds = [p2.id];
    } else if (isMandy(p1) && isRic(p2)) {
      teamAIds = [p2.id];
      teamBIds = [p1.id];
    } else {
      const shuffled = shuffle(selectedPlayers);
      teamAIds = [shuffled[0].id];
      teamBIds = [shuffled[1].id];
    }
    note = '1 gegen 1: Direktes Duell am Tisch!';
  } else if (selectedPlayers.length === 3) {
    // 2vs1
    const ric = selectedPlayers.find(isRic);
    const mandy = selectedPlayers.find(isMandy);

    if (ric && mandy) {
      // Niemals Ric und Mandy im selben Team:
      const other = selectedPlayers.find(p => p.id !== ric.id && p.id !== mandy.id);
      const ricAlone = Math.random() < 0.5;
      const soloPlayer = ricAlone ? ric : mandy;
      const duoOther = ricAlone ? mandy : ric;

      if (Math.random() < 0.5) {
        teamAIds = [duoOther.id, other.id];
        teamBIds = [soloPlayer.id];
      } else {
        teamAIds = [soloPlayer.id];
        teamBIds = [duoOther.id, other.id];
      }
      note = `2 gegen 1: ${soloPlayer.name} hat 2 Ausgleichswürfe!`;
    } else {
      const shuffled = shuffle(selectedPlayers);
      if (Math.random() < 0.5) {
        teamAIds = [shuffled[0].id, shuffled[1].id];
        teamBIds = [shuffled[2].id];
        note = `2 gegen 1: ${shuffled[2].name} hat 2 Ausgleichswürfe!`;
      } else {
        teamAIds = [shuffled[0].id];
        teamBIds = [shuffled[1].id, shuffled[2].id];
        note = `2 gegen 1: ${shuffled[0].name} hat 2 Ausgleichswürfe!`;
      }
    }
  } else {
    // 4 oder mehr Spieler angewählt -> STRIKT 2vs2 (maximal 4 Spieler am Tisch)
    let active4;
    const ric = selectedPlayers.find(isRic);
    const mandy = selectedPlayers.find(isMandy);

    if (selectedPlayers.length === 4) {
      active4 = [...selectedPlayers];
    } else {
      // Wenn Ric und Mandy unter den ausgewählten Spielern sind, beide bevorzugt ins Match nehmen
      if (ric && mandy) {
        const others = shuffle(selectedPlayers.filter(p => p.id !== ric.id && p.id !== mandy.id)).slice(0, 2);
        active4 = [ric, mandy, ...others];
      } else {
        active4 = shuffle(selectedPlayers).slice(0, 4);
      }
    }

    const activeRic = active4.find(isRic);
    const activeMandy = active4.find(isMandy);

    if (activeRic && activeMandy) {
      // NIEMALS Ric und Mandy in einem Team:
      const others = shuffle(active4.filter(p => p.id !== activeRic.id && p.id !== activeMandy.id));
      if (Math.random() < 0.5) {
        teamAIds = [activeRic.id, others[0].id];
        teamBIds = [activeMandy.id, others[1].id];
      } else {
        teamAIds = [activeMandy.id, others[0].id];
        teamBIds = [activeRic.id, others[1].id];
      }
    } else {
      const shuffled = shuffle(active4);
      teamAIds = [shuffled[0].id, shuffled[1].id];
      teamBIds = [shuffled[2].id, shuffled[3].id];
    }
    note = '2 gegen 2: Klassisches Bierpong-Teamduell!';
  }

  if (!tournamentData.activeEvent) tournamentData.activeEvent = {};
  if (gameId) tournamentData.activeEvent.gameId = gameId;
  tournamentData.activeEvent.teamA = { name: 'Team Rot', playerIds: teamAIds };
  tournamentData.activeEvent.teamB = { name: 'Team Blau', playerIds: teamBIds };
  tournamentData.activeEvent.note = note;
}

function calculateBettingSummary(betting) {
  if (!betting) return null;
  const bets = betting.bets || [];
  let potA = 0;
  let potB = 0;
  let countA = 0;
  let countB = 0;
  bets.forEach(b => {
    const amt = Number(b.amount) || 0;
    if (b.target === 'teamA' || b.target === 'rot' || b.target === 'A') {
      potA += amt;
      countA++;
    } else if (b.target === 'teamB' || b.target === 'blau' || b.target === 'B') {
      potB += amt;
      countB++;
    }
  });
  const totalPot = potA + potB;

  // STRICT PARI-MUTUEL POOL (Totalisator - Bank zahlt niemals aus eigener Tasche):
  // 1. Wenn noch keine Wetten da sind: Quote ist 1.00
  // 2. Wenn nur auf EIN Team gewettet wurde (z.B. nur 1 € auf Rot, 0 € auf Blau):
  //    - Die Quote auf Rot ist 1.00x (Einsatz zurück, 0 € Gewinn).
  //    - Die Bank zahlt niemals extra drauf!
  // 3. Nur wenn auf BEIDE Teams Einsätze vorliegen, verteilt sich der gegnerische Pott:
  //    - quoteA = totalPot / potA
  //    - quoteB = totalPot / potB
  let quoteA = 1.0;
  let quoteB = 1.0;

  if (potA > 0 && potB > 0) {
    quoteA = totalPot / potA;
    quoteB = totalPot / potB;
  } else if (potA > 0 && potB === 0) {
    quoteA = 1.0;
    quoteB = 1.0;
  } else if (potB > 0 && potA === 0) {
    quoteA = 1.0;
    quoteB = 1.0;
  }

  let payouts = [];
  if (betting.winner) {
    const isWinA = (betting.winner === 'A' || betting.winner === 'teamA' || betting.winner === 'rot');
    const winningPot = isWinA ? potA : potB;
    const opponentPot = isWinA ? potB : potA;
    const winningBets = bets.filter(b => isWinA 
      ? (b.target === 'teamA' || b.target === 'rot' || b.target === 'A') 
      : (b.target === 'teamB' || b.target === 'blau' || b.target === 'B'));

    if (winningPot > 0) {
      if (opponentPot > 0) {
        // Normalfall: Gewinner teilen sich den GESAMTEN Pott (inkl. Verlierer-Einsätze) proportional
        payouts = winningBets.map(b => {
          const share = b.amount / winningPot;
          const rawPayout = share * totalPot;
          const payout = Math.round(rawPayout * 100) / 100;
          const profit = Math.max(0, Math.round((payout - b.amount) * 100) / 100);
          return {
            id: b.id,
            bettorId: b.bettorId,
            bettorName: b.bettorName,
            name: b.bettorName,
            amount: b.amount,
            target: b.target,
            payout,
            profit,
            note: `Gewonnen (+${profit.toFixed(2)} € aus gegnerischem Pott)`
          };
        });
      } else {
        // Sonderfall: Nur 1 Team hatte Einsätze, keine Gegenwetten.
        // Gewinner bekommt maximal seinen Einsatz zurück, Bank zahlt 0 € aus.
        payouts = winningBets.map(b => ({
          id: b.id,
          bettorId: b.bettorId,
          bettorName: b.bettorName,
          name: b.bettorName,
          amount: b.amount,
          target: b.target,
          payout: b.amount,
          profit: 0,
          note: 'Einsatz zurück (Kein Gegeneinsatz vorhanden, Bank zahlt nix drauf)'
        }));
      }
    } else {
      // Niemand hat auf das Gewinner-Team gewettet -> Alle Einsätze zurück an die Tipper
      payouts = bets.map(b => ({
        id: b.id,
        bettorId: b.bettorId,
        bettorName: b.bettorName,
        name: b.bettorName,
        amount: b.amount,
        target: b.target,
        payout: b.amount,
        profit: 0,
        note: 'Rückerstattung (Niemand hatte auf den Sieger gewettet)'
      }));
    }
  }

  return {
    status: betting.status || 'open',
    winner: betting.winner || null,
    bets,
    potA: Math.round(potA * 100) / 100,
    potB: Math.round(potB * 100) / 100,
    countA,
    countB,
    totalPot: Math.round(totalPot * 100) / 100,
    quoteA: Number(quoteA.toFixed(2)),
    quoteB: Number(quoteB.toFixed(2)),
    payouts
  };
}

function handleClientMessage(msg) {
  const { type, payload } = msg;

  switch (type) {
    case 'UPDATE_SCORE': {
      const game = tournamentData.games.find(g => g.id === payload.gameId);
      if (game) {
        if (!game.scores) game.scores = {};
        if (typeof payload.score === 'number') {
          game.scores[payload.playerId] = Math.max(0, payload.score);
        } else if (typeof payload.delta === 'number') {
          const current = Number(game.scores[payload.playerId] || 0);
          game.scores[payload.playerId] = Math.max(0, current + payload.delta);
        }
        saveTournamentData();
        broadcast({
          type: 'SCORE_CHANGED',
          payload: {
            gameId: payload.gameId,
            playerId: payload.playerId,
            newScore: game.scores[payload.playerId],
            tournamentData
          }
        });
      }
      break;
    }

    case 'ADD_GAME': {
      const newGame = {
        id: 'g_' + Date.now(),
        name: payload.name || 'Neues Spiel',
        icon: payload.icon || '🏆',
        type: payload.type || 'counter',
        unit: payload.unit || 'Punkte',
        step: Number(payload.step) || 1,
        multiplier: Number(payload.multiplier) || 1,
        scores: {}
      };
      tournamentData.players.forEach(p => {
        newGame.scores[p.id] = 0;
      });
      tournamentData.games.push(newGame);
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      break;
    }

    case 'DELETE_GAME': {
      tournamentData.games = tournamentData.games.filter(g => g.id !== payload.gameId);
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      break;
    }

    case 'ADD_PLAYER': {
      const newPlayer = {
        id: payload.id || ('p_' + Date.now()),
        name: payload.name || 'Neuer Spieler',
        nickname: payload.nickname || '',
        ovr: Number(payload.ovr) || 85,
        pos: payload.pos || 'ST',
        edition: payload.edition || 'img_bier',
        editionName: payload.editionName || 'Goldenes Bierfest',
        portrait: payload.portrait || 'chef.jfif',
        stats: payload.stats || { PAC: 85, SHO: 85, PAS: 85, DRI: 85, DEF: 85, PHY: 85 }
      };
      
      // Prevent duplicates if already exists
      const existing = tournamentData.players.find(p => p.id === newPlayer.id || p.name.toLowerCase() === newPlayer.name.toLowerCase());
      if (!existing) {
        tournamentData.players.push(newPlayer);
        tournamentData.games.forEach(g => {
          if (!g.scores) g.scores = {};
          if (g.scores[newPlayer.id] === undefined) g.scores[newPlayer.id] = 0;
        });
      }
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      break;
    }

    case 'IMPORT_FROM_INBOX': {
      // Moves single card from inbox directly into tournament players
      const inboxCard = tournamentData.inbox.find(c => c.id === payload.cardId);
      if (inboxCard) {
        addCardToPlayers_(inboxCard);
        tournamentData.inbox = tournamentData.inbox.filter(c => c.id !== payload.cardId);
        saveTournamentData();
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      }
      break;
    }

    case 'IMPORT_ALL_INBOX': {
      // Moves ALL cards from inbox into tournament players
      if (tournamentData.inbox && tournamentData.inbox.length > 0) {
        tournamentData.inbox.forEach(card => {
          addCardToPlayers_(card);
        });
        tournamentData.inbox = [];
        saveTournamentData();
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      }
      break;
    }

    case 'DISMISS_INBOX_CARD': {
      tournamentData.inbox = (tournamentData.inbox || []).filter(c => c.id !== payload.cardId);
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      break;
    }

    case 'DELETE_PLAYER': {
      tournamentData.players = tournamentData.players.filter(p => p.id !== payload.playerId);
      tournamentData.games.forEach(g => {
        if (g.scores && g.scores[payload.playerId] !== undefined) {
          delete g.scores[payload.playerId];
        }
      });
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      break;
    }

    case 'TRIGGER_EFFECT': {
      broadcast({ type: 'EFFECT_TRIGGERED', payload });
      break;
    }

    case 'SYNC_DRIVE': {
      syncFromGoogleDrive().then(res => {
        broadcast({ type: 'DRIVE_SYNC_DONE', payload: res });
      });
      break;
    }

    case 'RESET_ALL': {
      tournamentData.games.forEach(g => {
        g.scores = {};
        tournamentData.players.forEach(p => {
          g.scores[p.id] = 0;
        });
      });
      if (tournamentData.activeEvent) {
        tournamentData.activeEvent.status = 'idle';
        tournamentData.activeEvent.timerEndsAt = null;
      }
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      break;
    }

    case 'TRIGGER_TEKKEN_CLASH': {
      broadcast({ type: 'TEKKEN_CLASH', payload });
      break;
    }

    case 'CROWN_CHAMPION': {
      const p = (tournamentData.players || []).find(x => x.id === payload.playerId);
      if (p) {
        awardPlayerBadge(p.id, 'champion_cup');
        p.isChampion = true;
        const year = payload.year || new Date().getFullYear();
        const eventName = payload.tournamentName || tournamentData.meta?.eventName || 'Hüttencup';
        const champEntry = {
          id: `champ_${year}_${p.id}`,
          year: year,
          tournament: `${eventName} ${year}`,
          winnerId: p.id,
          winnerName: p.name,
          title: `Champion – ${eventName} ${year}`,
          points: payload.points || 0,
          cardImage: p.cardImage || p.portrait,
          crownedAt: new Date().toISOString()
        };
        hallOfFame.champions = (hallOfFame.champions || []).filter(c => !(c.year === year && c.tournament === champEntry.tournament));
        hallOfFame.champions.unshift(champEntry);
        saveHallOfFame();
        saveTournamentData();
        broadcast({
          type: 'CHAMPION_CROWNED',
          payload: {
            player: p,
            entry: champEntry
          }
        });
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      }
      break;
    }

    case 'UPDATE_EVENT_CONFIG': {
      if (!tournamentData.meta) tournamentData.meta = {};
      tournamentData.meta = {
        ...tournamentData.meta,
        title: payload.title || tournamentData.meta.title || 'Hüttencup 2026',
        eventTheme: payload.eventTheme || tournamentData.meta.eventTheme || 'oktoberfest',
        eventName: payload.eventName || tournamentData.meta.eventName || 'Oktoberfest-Edition',
        eventSubtitle: payload.eventSubtitle !== undefined ? payload.eventSubtitle : tournamentData.meta.eventSubtitle,
        icon: payload.icon || tournamentData.meta.icon || '🏆',
        hostName: payload.hostName || tournamentData.meta.hostName || 'Ric (The Boss)',
        eventYear: payload.eventYear || tournamentData.meta.eventYear || 2026
      };
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      console.log(`🎉 Event-Konfiguration aktualisiert: ${tournamentData.meta.eventName} (${tournamentData.meta.icon})`);
      break;
    }

    case 'SET_ACTIVE_EVENT': {
      if (!tournamentData.activeEvent) tournamentData.activeEvent = {};
      tournamentData.activeEvent = {
        ...tournamentData.activeEvent,
        ...payload
      };
      const curGameId = payload.gameId || tournamentData.activeEvent.gameId;
      const gameObj = tournamentData.games.find(g => g.id === curGameId);

      if (payload.status === 'announced') {
        if (payload.timerMinutes) {
          tournamentData.activeEvent.timerEndsAt = Date.now() + (payload.timerMinutes * 60 * 1000);
        }
        if (!payload.tvView) tournamentData.activeEvent.tvView = 'announced';
        if (gameObj && gameObj.type === 'team_match') {
          if (!tournamentData.activeEvent.teamA || !tournamentData.activeEvent.teamA.playerIds || tournamentData.activeEvent.teamA.playerIds.length === 0) {
            generateTeamsInternal(curGameId);
          }
        }
      } else if (payload.status === 'live') {
        if (!payload.tvView) tournamentData.activeEvent.tvView = 'live';
        if (gameObj && gameObj.type === 'team_match') {
          if (!tournamentData.activeEvent.teamA || !tournamentData.activeEvent.teamA.playerIds || tournamentData.activeEvent.teamA.playerIds.length === 0) {
            generateTeamsInternal(curGameId);
          }
        }
      } else if (payload.status === 'idle') {
        tournamentData.activeEvent.timerEndsAt = null;
        if (!payload.tvView) tournamentData.activeEvent.tvView = 'scoreboard';
      }
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      if (payload.status === 'live' || payload.tvView === 'live') {
        broadcast({ type: 'TEKKEN_CLASH', payload: { gameId: curGameId } });
      }
      break;
    }

    case 'GENERATE_TEAMS': {
      generateTeamsInternal(payload.gameId, payload.playerIds);
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      broadcast({ type: 'TEKKEN_CLASH', payload: { gameId: payload.gameId } });
      break;
    }

    case 'AWARD_TEAM_WIN': {
      const game = tournamentData.games.find(g => g.id === payload.gameId);
      if (game && tournamentData.activeEvent) {
        const winningPlayerIds = payload.winningTeam === 'A'
          ? (tournamentData.activeEvent.teamA?.playerIds || [])
          : (tournamentData.activeEvent.teamB?.playerIds || []);

        const pts = Number(payload.winPoints) || (game.winPoints ? Number(game.winPoints) : 1);
        if (!game.scores) game.scores = {};
        winningPlayerIds.forEach(pId => {
          game.scores[pId] = (game.scores[pId] || 0) + pts;
          addPlayerXp(pId, 250, 'Match-Sieg');

          const p = (tournamentData.players || []).find(x => x.id === pId);
          if (p) {
            p.pongWins = (p.pongWins || 0) + 1;
            if (p.pongWins >= 2) awardPlayerBadge(pId, 'beer_pong_god');
            p.winStreak = (p.winStreak || 0) + 1;
            if (p.winStreak >= 2) awardPlayerBadge(pId, 'on_fire');
          }
        });

        if (!tournamentData.firstBloodAwarded) {
          tournamentData.firstBloodAwarded = true;
          winningPlayerIds.forEach(pId => awardPlayerBadge(pId, 'first_blood'));
        }

        checkMvpKingBadge();
        tournamentData.activeEvent.round = (tournamentData.activeEvent.round || 1) + 1;

        // Auto-resolve bets if betting is active
        if (tournamentData.activeEvent.betting && (tournamentData.activeEvent.betting.bets || []).length > 0 && !tournamentData.activeEvent.betting.winner) {
          const winnerChoice = (payload.winningTeam === 'A' || payload.winningTeam === 'teamA') ? 'teamA' : 'teamB';
          tournamentData.activeEvent.betting.winner = winnerChoice;
          tournamentData.activeEvent.betting.status = 'resolved';
          const bettingSummary = calculateBettingSummary(tournamentData.activeEvent.betting);
          tournamentData.activeEvent.betting.payouts = bettingSummary.payouts;
          broadcast({ type: 'BETS_RESOLVED', payload: bettingSummary });
        }

        saveTournamentData();
        broadcast({
          type: 'MATCH_WIN_AWARDED',
          payload: {
            gameId: payload.gameId,
            winningTeam: payload.winningTeam,
            winningPlayerIds,
            pts,
            tournamentData
          }
        });
      }
      break;
    }

    /* ======================================================== */
    /* BUCHMACHER / WETTBÜRO HANDLERS                           */
    /* ======================================================== */
    case 'PLACE_BET': {
      if (!tournamentData.activeEvent) tournamentData.activeEvent = {};
      if (!tournamentData.activeEvent.betting) {
        tournamentData.activeEvent.betting = { status: 'open', bets: [], winner: null, payouts: [] };
      }
      const amt = Math.max(0.5, Number(payload.amount) || 1);
      const bet = {
        id: 'bet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        bettorId: payload.bettorId || null,
        bettorName: (payload.bettorName || 'Gast').trim(),
        target: (payload.target === 'B' || payload.target === 'teamB' || payload.target === 'blau') ? 'blau' : 'rot',
        amount: amt,
        time: Date.now()
      };
      tournamentData.activeEvent.betting.bets.push(bet);
      saveTournamentData();
      const summary = calculateBettingSummary(tournamentData.activeEvent.betting);
      broadcast({ type: 'BET_PLACED', payload: { bet, summary } });
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      break;
    }

    case 'DELETE_BET': {
      if (tournamentData.activeEvent && tournamentData.activeEvent.betting) {
        const betId = payload.betId;
        tournamentData.activeEvent.betting.bets = (tournamentData.activeEvent.betting.bets || []).filter(b => b.id !== betId);
        saveTournamentData();
        const summary = calculateBettingSummary(tournamentData.activeEvent.betting);
        broadcast({ type: 'BET_DELETED', payload: { betId, summary } });
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      }
      break;
    }

    case 'SET_BETTING_STATUS': {
      if (tournamentData.activeEvent) {
        if (!tournamentData.activeEvent.betting) {
          tournamentData.activeEvent.betting = { status: 'open', bets: [], winner: null, payouts: [] };
        }
        tournamentData.activeEvent.betting.status = payload.status || 'open';
        saveTournamentData();
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      }
      break;
    }

    case 'RESOLVE_BETS': {
      if (tournamentData.activeEvent) {
        if (!tournamentData.activeEvent.betting) {
          tournamentData.activeEvent.betting = { status: 'open', bets: [], winner: null, payouts: [] };
        }
        const win = (payload.winner === 'B' || payload.winner === 'teamB' || payload.winner === 'blau') ? 'blau' : 'rot';
        tournamentData.activeEvent.betting.winner = win;
        tournamentData.activeEvent.betting.status = 'resolved';
        const summary = calculateBettingSummary(tournamentData.activeEvent.betting);
        tournamentData.activeEvent.betting.payouts = summary.payouts;
        saveTournamentData();
        if (summary.payouts && summary.payouts.length > 0) {
          summary.payouts.forEach(po => {
            if (po.profit >= 10 && po.bettorId) {
              awardPlayerBadge(po.bettorId, 'high_roller');
            }
          });
        }
        broadcast({ type: 'BETS_RESOLVED', payload: summary });
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      }
      break;
    }

    case 'RESET_BETS': {
      if (tournamentData.activeEvent) {
        tournamentData.activeEvent.betting = {
          status: 'open',
          bets: [],
          winner: null,
          payouts: []
        };
        saveTournamentData();
        broadcast({ type: 'BETS_RESET', payload: calculateBettingSummary(tournamentData.activeEvent.betting) });
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      }
      break;
    }

    case 'UPDATE_TURN_SHOTS': {
      if (!tournamentData.activeEvent) tournamentData.activeEvent = {};
      tournamentData.activeEvent.turnShots = payload.turnShots || [];
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      break;
    }

    case 'UPDATE_TARGET_SHOTS': {
      if (!tournamentData.activeEvent) tournamentData.activeEvent = {};
      tournamentData.activeEvent.targetShots = payload.targetShots || [];
      tournamentData.activeEvent.activeShotIdx = payload.activeShotIdx !== undefined ? payload.activeShotIdx : 0;
      saveTournamentData();
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      break;
    }

    case 'RECORD_PLAYER_TURN': {
      const game = tournamentData.games.find(g => g.id === payload.gameId);
      if (game) {
        if (!game.scores) game.scores = {};
        const pts = Number(payload.scoreDelta) || 0;
        game.scores[payload.playerId] = (game.scores[payload.playerId] || 0) + pts;
        
        if (payload.playerId) {
          addPlayerXp(payload.playerId, 100, 'Durchgang gespielt');
          if (pts >= 8) {
            awardPlayerBadge(payload.playerId, 'sniper_bullseye');
          }
          checkMvpKingBadge();
        }

        if (payload.nextPlayerId !== undefined) {
          if (!tournamentData.activeEvent) tournamentData.activeEvent = {};
          tournamentData.activeEvent.activePlayerId = payload.nextPlayerId;
          tournamentData.activeEvent.turnShots = [];
          tournamentData.activeEvent.targetShots = [];
          tournamentData.activeEvent.activeShotIdx = 0;
        }
        saveTournamentData();
        broadcast({
          type: 'SCORE_CHANGED',
          payload: {
            gameId: payload.gameId,
            playerId: payload.playerId,
            newScore: game.scores[payload.playerId],
            tournamentData
          }
        });
      }
      break;
    }

    case 'ADD_PLAYER_XP': {
      if (payload.playerId && payload.amount) {
        addPlayerXp(payload.playerId, payload.amount, payload.reason);
        saveTournamentData();
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      }
      break;
    }

    case 'TOGGLE_PLAYER_BADGE': {
      if (payload.playerId && payload.badgeId) {
        togglePlayerBadge(payload.playerId, payload.badgeId);
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      }
      break;
    }
  }
}

// Google Drive Sync Engine
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzjjuwFg5ZQe_JBDfCTlNrg0pBa35ffkEGE0r2-vyQnzCS8MWzGfBZJykQb1LnFyydI/exec';

async function downloadDriveImageLocally(imgFileId, name, isPhoto = false) {
  if (!imgFileId) return null;
  const cleanName = (name || (isPhoto ? 'photo' : 'card')).replace(/[^\wÄÖÜäöüß\- ]/g, '').replace(/\s+/g, '_');
  const dir = isPhoto ? 'photos' : 'cards';
  const ext = isPhoto ? 'jpg' : 'png';
  const filename = `${dir}/${cleanName}_${imgFileId}.${ext}`;
  const localPath = path.join(__dirname, filename);
  if (fs.existsSync(localPath)) return filename;

  try {
    // 1. Direkt Google Drive CDN (blitzschnell)
    try {
      const cdnRes = await fetch(`https://lh3.googleusercontent.com/d/${imgFileId}`);
      if (cdnRes.ok) {
        const buf = Buffer.from(await cdnRes.arrayBuffer());
        if (buf.length > 500) {
          fs.writeFileSync(localPath, buf);
          console.log(`💾 ${isPhoto ? 'Foto' : 'Karte'} per Google CDN geladen: ${filename}`);
          return filename;
        }
      }
    } catch (e) {}

    // 2. Fallback via Apps Script downloadFileId
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?downloadFileId=${imgFileId}`);
    const json = await res.json();
    if (json && json.ok && json.base64) {
      fs.writeFileSync(localPath, Buffer.from(json.base64, 'base64'));
      console.log(`💾 ${isPhoto ? 'Foto' : 'Karte'} lokal gespeichert: ${filename}`);
      return filename;
    }
  } catch (err) {
    console.error('Fehler beim Download des Bildes:', err);
  }
  return null;
}

let isSyncingDrive = false;

async function syncFromGoogleDrive() {
  if (isSyncingDrive) return { ok: false, busy: true };
  isSyncingDrive = true;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 95000);

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data.ok && Array.isArray(data.cards)) {
      let newCount = 0;
      if (!tournamentData.inbox) tournamentData.inbox = [];
      if (!tournamentData.photos) tournamentData.photos = [];

      for (const c of data.cards) {
        const id = 'drive_' + (c.driveId || c.gesendet || c.name);
        const name = c.name || 'Gast';
        let localImg = null;

        // 0A. Song-Wunsch via Google Drive (Gäste im mobilen Handynetz LTE / 5G / außerhalb des WLANs)
        let isSongReq = (c.type === 'song_request');
        let songMeta = null;
        if (c.caption && (c.caption.includes('"type":"song_request"') || c.caption.startsWith('SONG:'))) {
          isSongReq = true;
          try { songMeta = JSON.parse(c.caption); } catch (e) {}
        }
        if (isSongReq) {
          const songTitle = (songMeta && songMeta.title) || c.title || (c.caption && c.caption.replace(/^Song:\s*/i, '').split('von')[0].trim()) || '';
          const songArtist = (songMeta && songMeta.artist) || c.artist || (c.caption && c.caption.includes('von') ? c.caption.split('von')[1].trim() : 'Unbekannt');
          
          if (songTitle) {
            if (!tournamentData.musicQueue) tournamentData.musicQueue = [];
            const songExists = tournamentData.musicQueue.some(s => 
              s.title.toLowerCase().trim() === songTitle.toLowerCase().trim() &&
              s.requestedBy.toLowerCase().trim() === name.toLowerCase().trim()
            );
            if (!songExists) {
              const song = {
                id: 'drive_song_' + (c.driveId || c.gesendet || Date.now()),
                title: songTitle,
                artist: songArtist || 'Unbekannt',
                requestedBy: name,
                votes: [name],
                status: 'pending',
                requestedAt: c.gesendet || new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                timestamp: Date.now()
              };
              tournamentData.musicQueue.unshift(song);
              saveTournamentData();
              broadcast({ type: 'NEW_SONG_REQUEST', payload: song });
              broadcast({ type: 'MUSIC_QUEUE_UPDATED', payload: tournamentData.musicQueue });
              broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
              console.log(`🎵 Neuer Musikwunsch via Google Drive (LTE/5G) von: ${name} ("${song.title} - ${song.artist}")`);
            }
          }
          continue; // Weder als Foto noch als Karte behandeln!
        }

        // 0B. Gästebuch-Eintrag via Google Drive (Gäste im mobilen Handynetz LTE / 5G / außerhalb des WLANs)
        let isGb = (c.type === 'guestbook');
        let gbMeta = null;
        if (c.caption && (c.caption.includes('"type":"guestbook"') || c.caption.startsWith('GUESTBOOK:'))) {
          isGb = true;
          try { gbMeta = JSON.parse(c.caption); } catch (e) {}
        }
        if (isGb) {
          const gbMsg = (gbMeta && gbMeta.message) || c.message || (c.caption && c.caption.replace(/^GUESTBOOK:\s*/i, '')) || '';
          if (gbMsg || (gbMeta && gbMeta.hasRealPhoto)) {
            if (!tournamentData.guestbook) tournamentData.guestbook = [];
            const gbExists = tournamentData.guestbook.some(g => 
              g.name.toLowerCase().trim() === name.toLowerCase().trim() &&
              g.message.trim() === gbMsg.trim()
            );
            if (!gbExists) {
              let photoUrl = null;
              if (gbMeta && gbMeta.hasRealPhoto && c.imgFileId) {
                photoUrl = await downloadDriveImageLocally(c.imgFileId, name, true);
                if (photoUrl) {
                  const photoItem = {
                    id: 'gb_photo_' + (c.driveId || Date.now()),
                    url: photoUrl,
                    sender: name,
                    caption: `📖 Gästebuch: ${gbMsg.substring(0, 80)}`,
                    uploadedAt: c.gesendet || new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                  };
                  if (!tournamentData.photos) tournamentData.photos = [];
                  tournamentData.photos.unshift(photoItem);
                  broadcast({ type: 'NEW_PHOTO', payload: photoItem });
                }
              }

              const entry = {
                id: 'drive_gb_' + (c.driveId || c.gesendet || Date.now()),
                name: name,
                message: gbMsg,
                photoUrl: photoUrl,
                createdAt: c.gesendet || new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
                date: new Date().toLocaleDateString('de-DE'),
                timestamp: Date.now()
              };
              tournamentData.guestbook.unshift(entry);
              saveTournamentData();
              broadcast({ type: 'NEW_GUESTBOOK_ENTRY', payload: entry });
              broadcast({ type: 'GUESTBOOK_UPDATED', payload: tournamentData.guestbook });
              broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
              console.log(`📖 Neuer Gästebuch-Eintrag via Google Drive (LTE/5G) von: ${name}`);
            }
          }
          continue; // Weder als normales Foto noch als Karte behandeln!
        }

        // 1. Unterscheidung: Ist es ein Party-Foto oder eine Spielerkarte?
        const isPhoto = (c.type === 'photo') || 
                        (c.caption !== undefined && c.caption !== null && c.caption !== '') ||
                        (c.datei && /\.(jpe?g|webp)$/i.test(c.datei)) ||
                        (!c.ovr && !c.pos && (!c.stats || Object.keys(c.stats).length === 0));
        if (isPhoto) {
          const photoId = 'drive_photo_' + (c.driveId || c.gesendet || c.datei || Date.now());
          const alreadyExists = tournamentData.photos.some(p => p.id === photoId || (p.sender === name && p.uploadedAt === c.gesendet));

          if (!alreadyExists) {
            let photoUrl = '';
            if (c.imageBase64) {
              const cleanName = (name || 'photo').replace(/[^\wÄÖÜäöüß\- ]/g, '').replace(/\s+/g, '_');
              const filename = `photos/${cleanName}_${c.driveId || c.imgFileId || Date.now()}.jpg`;
              const fullPath = path.join(__dirname, filename);
              if (!fs.existsSync(fullPath)) {
                fs.writeFileSync(fullPath, Buffer.from(c.imageBase64, 'base64'));
              }
              photoUrl = filename;
            } else if (c.imgFileId) {
              photoUrl = await downloadDriveImageLocally(c.imgFileId, name, true);
            }

            if (photoUrl) {
              const photoItem = {
                id: photoId,
                url: photoUrl,
                sender: name,
                caption: c.caption || '',
                uploadedAt: c.gesendet || new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
              };
              tournamentData.photos.unshift(photoItem);

              // XP & Paparazzi Badge check
              const matchingPlayer = (tournamentData.players || []).find(p => 
                p.name.toLowerCase().trim() === name.toLowerCase().trim()
              );
              if (matchingPlayer) {
                addPlayerXp(matchingPlayer.id, 50, 'Foto hochgeladen');
                matchingPlayer.photoCount = (matchingPlayer.photoCount || 0) + 1;
                if (matchingPlayer.photoCount >= 3) {
                  awardPlayerBadge(matchingPlayer.id, 'paparazzi');
                }
              }

              saveTournamentData();
              broadcast({ type: 'NEW_PHOTO', payload: photoItem });
              broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
              console.log(`📸 Neues Party-Foto via Google Drive von: ${photoItem.sender} ("${photoItem.caption}")`);
            }
          }
          continue; // Nicht als Spielerkarte behandeln!
        }

        // 2. Spielerkarte verarbeiten
        if (c.imageBase64) {
          const cleanName = (name || 'card').replace(/[^\wÄÖÜäöüß\- ]/g, '').replace(/\s+/g, '_');
          const filename = `cards/${cleanName}_${c.driveId || c.imgFileId}.png`;
          const localPath = path.join(__dirname, filename);
          if (!fs.existsSync(localPath)) {
            fs.writeFileSync(localPath, Buffer.from(c.imageBase64, 'base64'));
            console.log(`💾 Fertige Gast-Karte lokal gespeichert: ${filename}`);
          }
          localImg = filename;
        } else if (c.imgFileId) {
          localImg = await downloadDriveImageLocally(c.imgFileId, name);
        }

        // Auch bei bereits existierenden Spielern das Bild auf die echte Gast-Karte aktualisieren
        const existingPlayer = tournamentData.players.find(p => p.id === id || p.name.toLowerCase() === name.toLowerCase());
        if (existingPlayer) {
          if (localImg && existingPlayer.cardImage !== localImg) {
            existingPlayer.cardImage = localImg;
            existingPlayer.portrait = localImg;
            saveTournamentData();
            broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
          }
          continue;
        }

        const alreadyInInbox = tournamentData.inbox.some(i => i.id === id || (i.name.toLowerCase() === name.toLowerCase() && i.receivedAt === c.gesendet));

        if (!alreadyInInbox) {
          const cardItem = {
            id,
            name,
            nickname: c.nickname || '',
            ovr: Number(c.ovr) || 88,
            pos: c.pos || 'ST',
            edition: c.edition || 'img_bier',
            portrait: localImg || c.cardImageUrl || 'chef.jfif',
            cardImage: localImg || c.cardImageUrl,
            stats: c.stats || { PAC: 85, SHO: 85, PAS: 85, DRI: 85, DEF: 85, PHY: 85 },
            receivedAt: c.gesendet || new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          };
          tournamentData.inbox.unshift(cardItem);
          newCount++;
        }
      }

      if (newCount > 0) {
        saveTournamentData();
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
        broadcast({ type: 'CARD_RECEIVED', payload: tournamentData.inbox[0] });
        console.log(`☁️ ${newCount} neue Karte(n) aus Google Drive synchronisiert!`);
      }
      return { ok: true, newCards: newCount };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name !== 'AbortError') {
      console.error('Fehler beim Synchronisieren mit Google Drive:', err.message || err);
    }
    return { ok: false, error: String(err) };
  } finally {
    isSyncingDrive = false;
  }
}

// Auto-Sync mit Google Drive alle 6 Sekunden (für blitzschnelle Live-Übertragung im Handynetz/LTE/5G)
const DRIVE_SYNC_INTERVAL = 6000;
setInterval(syncFromGoogleDrive, DRIVE_SYNC_INTERVAL);
setTimeout(syncFromGoogleDrive, 1500);

let fastSyncTimer = null;
function triggerFastDriveSync() {
  if (fastSyncTimer) clearTimeout(fastSyncTimer);
  fastSyncTimer = setTimeout(() => {
    syncFromGoogleDrive();
  }, 200);
}

// Helper: adds an inbox card object into active players
function addCardToPlayers_(card) {
  const player = {
    id: card.id,
    name: card.name,
    nickname: card.nickname || '',
    ovr: Number(card.ovr) || 85,
    pos: card.pos || 'ST',
    edition: card.edition || 'img_bier',
    portrait: card.portrait || card.cardImage || 'chef.jfif',
    cardImage: card.cardImage,
    stats: card.stats || { PAC: 85, SHO: 85, PAS: 85, DRI: 85, DEF: 85, PHY: 85 }
  };
  const existingIdx = tournamentData.players.findIndex(p => p.id === player.id || p.name.toLowerCase() === player.name.toLowerCase());
  if (existingIdx !== -1) {
    tournamentData.players[existingIdx] = player;
  } else {
    tournamentData.players.push(player);
  }
  tournamentData.games.forEach(g => {
    if (!g.scores) g.scores = {};
    if (g.scores[player.id] === undefined) g.scores[player.id] = 0;
  });
}

// ================================================================
// CARD INBOX & RECEIVER ENDPOINTS (WEG C)
// ================================================================
app.post('/api/submit_card', (req, res) => {
  try {
    const payload = req.body;
    const name = String(payload.name || 'Gast').trim();
    const id = 'p_' + Date.now();
    let imageFilename = '';

    // If base64 file is attached, save to /cards/
    if (payload.file && typeof payload.file === 'string' && payload.file.includes('base64,')) {
      const parts = payload.file.split(';base64,');
      const ext = parts[0].includes('jpeg') || parts[0].includes('jpg') ? 'jpg' : (parts[0].includes('webp') ? 'webp' : 'png');
      const cleanName = name.replace(/[^\wÄÖÜäöüß\- ]/g, '').replace(/\s+/g, '_');
      imageFilename = `cards/${Date.now()}_${cleanName}.${ext}`;
      const fullPath = path.join(__dirname, imageFilename);
      fs.writeFileSync(fullPath, Buffer.from(parts[1], 'base64'));
    }

    // If base64 portrait cutout is attached, save to /portraits/
    if (payload.portraitBase64 && typeof payload.portraitBase64 === 'string' && payload.portraitBase64.includes('base64,')) {
      const pParts = payload.portraitBase64.split(';base64,');
      const cleanName = name.replace(/[^\wÄÖÜäöüß\- ]/g, '').replace(/\s+/g, '_');
      const pPath = path.join(__dirname, 'portraits', `${cleanName}.png`);
      fs.writeFileSync(pPath, Buffer.from(pParts[1], 'base64'));
      console.log(`👤 Freigestelltes Porträt gespeichert: portraits/${cleanName}.png`);
    }

    const cardItem = {
      id,
      name,
      nickname: payload.nickname || '',
      ovr: Number(payload.ovr) || 88,
      pos: payload.pos || 'ST',
      edition: payload.edition || 'img_bier',
      portrait: imageFilename || payload.portrait || 'chef.jfif',
      cardImage: imageFilename,
      stats: payload.stats || { PAC: 85, SHO: 85, PAS: 85, DRI: 85, DEF: 85, PHY: 85 },
      receivedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    };

    // Weg C: Karte landet in der Inbox des Admins
    if (!tournamentData.inbox) tournamentData.inbox = [];
    tournamentData.inbox.unshift(cardItem);
    saveTournamentData();

    // Broadcast live to Admin and TV
    broadcast({ type: 'CARD_RECEIVED', payload: cardItem });
    broadcast({ type: 'STATE_UPDATE', payload: tournamentData });

    // Triggere auch sofortigen schnellen Drive-Sync im Hintergrund
    triggerFastDriveSync();

    console.log(`📥 Neue Karte in der Inbox: ${cardItem.name} (${cardItem.ovr} OVR)`);
    res.json({ ok: true, id, name: cardItem.name });
  } catch (err) {
    console.error('Error submitting card:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ================================================================
// PORTRAITS (CUTOUTS) ENDPOINT FOR GROUP PICTURES
// ================================================================
app.get('/api/portraits', (req, res) => {
  try {
    const pDir = path.join(__dirname, 'portraits');
    if (!fs.existsSync(pDir)) fs.mkdirSync(pDir, { recursive: true });
    const files = fs.readdirSync(pDir).filter(f => f.match(/\.(png|jpe?g|webp)$/i));
    const list = files.map(f => ({
      name: path.basename(f, path.extname(f)),
      file: f,
      url: `/portraits/${f}`
    }));
    res.json({ ok: true, count: list.length, portraits: list });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ================================================================
// GUEST CHECK-IN & REAL-TIME PORTRAIT REPO FOR CHATGPT
// ================================================================
const CHECKIN_DIR = path.join(__dirname, 'portraits', 'checkin');
if (!fs.existsSync(CHECKIN_DIR)) fs.mkdirSync(CHECKIN_DIR, { recursive: true });

app.get('/api/checkin/guests', (req, res) => {
  if (!tournamentData.checkinGuests) tournamentData.checkinGuests = [];
  res.json({ ok: true, guests: tournamentData.checkinGuests });
});

app.post('/api/checkin/guests/add', (req, res) => {
  try {
    const { name, gender = 'M', portraitBase64 } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ ok: false, error: 'Bitte einen Namen eingeben' });
    }
    if (!portraitBase64 || !portraitBase64.includes('base64,')) {
      return res.status(400).json({ ok: false, error: 'Kein Foto übergeben' });
    }

    const cleanName = name.trim().replace(/[^\wÄÖÜäöüß\- ]/g, '').replace(/\s+/g, '_');
    const ts = Date.now();
    const filename = `${cleanName}_${ts}.png`;
    const fullPath = path.join(CHECKIN_DIR, filename);

    const parts = portraitBase64.split(';base64,');
    fs.writeFileSync(fullPath, Buffer.from(parts[1], 'base64'));

    const guestItem = {
      id: 'guest_' + ts,
      name: name.trim(),
      gender: gender.toUpperCase() === 'F' ? 'F' : 'M',
      file: filename,
      filePath: fullPath,
      url: `/portraits/checkin/${filename}`,
      createdAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    };

    if (!tournamentData.checkinGuests) tournamentData.checkinGuests = [];
    tournamentData.checkinGuests.unshift(guestItem);
    saveTournamentData();

    console.log(`👤 Neuer Gast eingecheckt: ${guestItem.name} (${guestItem.gender === 'F' ? 'Weiblich' : 'Männlich'})`);
    res.json({ ok: true, guest: guestItem, total: tournamentData.checkinGuests.length });
  } catch (err) {
    console.error('Fehler bei checkin/guests/add:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/api/checkin/guests/delete', (req, res) => {
  try {
    const { guestId } = req.body || {};
    if (!tournamentData.checkinGuests) tournamentData.checkinGuests = [];
    const item = tournamentData.checkinGuests.find(g => g.id === guestId);
    if (item && item.filePath && fs.existsSync(item.filePath)) {
      try { fs.unlinkSync(item.filePath); } catch (e) {}
    }
    tournamentData.checkinGuests = tournamentData.checkinGuests.filter(g => g.id !== guestId);
    saveTournamentData();
    res.json({ ok: true, remaining: tournamentData.checkinGuests.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/api/checkin/generate_bundle', (req, res) => {
  try {
    const { execFile } = require('child_process');
    const { theme = 'hangover', customSetting = '', guestIds = [] } = req.body || {};

    let list = tournamentData.checkinGuests || [];
    if (guestIds && Array.isArray(guestIds) && guestIds.length > 0) {
      list = list.filter(g => guestIds.includes(g.id));
    }

    if (list.length === 0) {
      return res.status(400).json({ ok: false, error: 'Keine Gäste zum Erstellen des Referenzblattes ausgewählt' });
    }

    const scriptPath = path.join(__dirname, 'scripts', 'generate_chatgpt_bundle.py');
    const args = ['--theme', String(theme).toLowerCase()];
    if (customSetting && customSetting.trim()) {
      args.push('--custom_setting', customSetting.trim());
    }

    const payloadPlayers = list.map(g => ({
      name: g.name,
      gender: g.gender,
      filePath: g.filePath || path.join(CHECKIN_DIR, g.file),
      file: g.file
    }));
    args.push('--payload', JSON.stringify(payloadPlayers));

    console.log(`📦 Erstelle ChatGPT-Referenzblatt für ${list.length} Gäste (Thema: ${theme})...`);

    execFile('python', [scriptPath, ...args], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Fehler bei Python Bundle Generator:', err, stderr);
        return res.status(500).json({ ok: false, error: 'Fehler beim Erstellen: ' + (stderr || err.message) });
      }

      try {
        const outData = JSON.parse(stdout.trim());
        res.json(outData);
      } catch (parseErr) {
        console.error('Fehler beim Parsen der Bundle-Ausgabe:', parseErr, stdout);
        res.status(500).json({ ok: false, error: 'Ungültige Rückgabe vom Generator' });
      }
    });
  } catch (err) {
    console.error('Fehler bei checkin/generate_bundle:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ================================================================
// 1-CLICK AI GROUP PHOTO GENERATION & TV REVEAL ENDPOINT
// ================================================================
app.post('/api/group_photo/generate', (req, res) => {
  try {
    const { execFile } = require('child_process');
    const { theme = 'hangover', players = 'all', title = '', revealOnTv = true } = req.body || {};

    const scriptPath = path.join(__dirname, 'scripts', 'generate_group_photo.py');
    const args = ['--theme', String(theme).toLowerCase()];

    if (players && Array.isArray(players) && players.length > 0) {
      args.push('--players', players.join(','));
    } else if (typeof players === 'string' && players.trim()) {
      args.push('--players', players.trim());
    } else {
      args.push('--players', 'all');
    }

    if (title && String(title).trim()) {
      args.push('--title', String(title).trim());
    }

    console.log(`📸 Starte 1-Klick KI-Gruppenbild Generierung: Thema="${theme}", Spieler="${players}"...`);

    execFile('python', [scriptPath, ...args], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Fehler bei Python Group Photo Generator:', err, stderr);
        return res.status(500).json({ ok: false, error: 'Generierung fehlgeschlagen: ' + (stderr || err.message) });
      }

      try {
        const outData = JSON.parse(stdout.trim());
        if (!outData.ok) {
          return res.status(500).json({ ok: false, error: outData.error || 'Generierung fehlgeschlagen' });
        }

        const photoItem = {
          id: 'photo_group_' + Date.now(),
          url: outData.path,
          sender: '🤖 KI-Studio',
          caption: `${outData.title} (${outData.player_count} Legenden)`,
          isGroupPhoto: true,
          theme: outData.theme,
          uploadedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        };

        if (!tournamentData.photos) tournamentData.photos = [];
        tournamentData.photos.unshift(photoItem);
        saveTournamentData();

        // Broadcast to TV and all guests
        if (revealOnTv) {
          broadcast({ type: 'GROUP_PHOTO_REVEAL', payload: photoItem });
        }
        broadcast({ type: 'NEW_PHOTO', payload: photoItem });
        broadcast({ type: 'STATE_UPDATE', payload: tournamentData });

        console.log(`✨ KI-Gruppenbild erfolgreich erstellt & auf TV übertragen: ${photoItem.url}`);
        res.json({ ok: true, photo: photoItem });
      } catch (parseErr) {
        console.error('Fehler beim Parsen der Generator-Ausgabe:', parseErr, stdout);
        res.status(500).json({ ok: false, error: 'Ungültige Rückgabe vom Generator' });
      }
    });
  } catch (err) {
    console.error('Fehler im group_photo endpoint:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ================================================================
// OPTION B: CHATGPT BUNDLE GENERATOR & DRIVE PUBLISHER
// ================================================================
app.post('/api/chatgpt_bundle/create', (req, res) => {
  try {
    const { execFile } = require('child_process');
    const { theme = 'hangover', players = [] } = req.body || {};

    const scriptPath = path.join(__dirname, 'scripts', 'generate_chatgpt_bundle.py');
    const args = ['--theme', String(theme).toLowerCase()];

    if (players && Array.isArray(players) && players.length > 0) {
      args.push('--payload', JSON.stringify(players));
    }

    console.log(`📦 Erstelle ChatGPT-Paket: Thema="${theme}", Spieler=${players.length}...`);

    execFile('python', [scriptPath, ...args], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        console.error('Fehler bei Python ChatGPT Bundle Generator:', err, stderr);
        return res.status(500).json({ ok: false, error: 'Bundle-Erstellung fehlgeschlagen: ' + (stderr || err.message) });
      }

      try {
        const outData = JSON.parse(stdout.trim());
        res.json(outData);
      } catch (parseErr) {
        console.error('Fehler beim Parsen der Bundle-Ausgabe:', parseErr, stdout);
        res.status(500).json({ ok: false, error: 'Ungültige Rückgabe' });
      }
    });
  } catch (err) {
    console.error('Fehler im chatgpt_bundle/create endpoint:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/api/chatgpt_bundle/publish', async (req, res) => {
  try {
    const { file, caption = 'The Hangover • KI Meisterwerk', theme = 'hangover' } = req.body || {};

    if (!file || typeof file !== 'string' || !file.includes('base64,')) {
      return res.status(400).json({ ok: false, error: 'Kein gültiges Bild empfangen' });
    }

    const parts = file.split(';base64,');
    const ext = parts[0].includes('png') ? 'png' : 'jpg';
    const ts = Date.now();
    const filename = `photos/Gruppenbild_${theme.toUpperCase()}_KI_${ts}.${ext}`;
    const fullPath = path.join(__dirname, filename);

    // 1. Lokal in photos/ speichern
    fs.writeFileSync(fullPath, Buffer.from(parts[1], 'base64'));

    const photoItem = {
      id: 'photo_ai_group_' + ts,
      url: filename,
      sender: '🤖 CHATGPT KI-STUDIO',
      caption: caption,
      isGroupPhoto: true,
      theme: theme,
      uploadedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    };

    if (!tournamentData.photos) tournamentData.photos = [];
    tournamentData.photos.unshift(photoItem);
    saveTournamentData();

    // 2. Sofortiger Broadcast an TV & Slideshow
    broadcast({ type: 'GROUP_PHOTO_REVEAL', payload: photoItem });
    broadcast({ type: 'NEW_PHOTO', payload: photoItem });
    broadcast({ type: 'STATE_UPDATE', payload: tournamentData });

    // 3. Im Hintergrund automatisch auf Google Drive hochladen via Google Apps Script
    fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: file,
        name: 'KI-Studio',
        caption: caption,
        type: 'photo'
      })
    }).then(async r => {
      const respJson = await r.json().catch(() => null);
      console.log('☁️ KI-Gruppenbild erfolgreich auf Google Drive hochgeladen!', respJson);
      triggerFastDriveSync();
    }).catch(e => {
      console.warn('Hinweis: Google Drive Upload im Hintergrund verzögert:', e.message);
    });

    console.log(`🎉 Fertiges KI-Gruppenbild veröffentlicht & auf TV enthüllt: ${filename}`);
    res.json({ ok: true, photo: photoItem });
  } catch (err) {
    console.error('Fehler bei chatgpt_bundle/publish:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ================================================================
// LIVE PARTY PHOTO UPLOAD & SLIDESHOW ENDPOINTS
// ================================================================
app.get('/api/photos', (req, res) => {
  res.json({ ok: true, photos: tournamentData.photos || [] });
});

app.post('/api/upload_photo', (req, res) => {
  try {
    const payload = req.body;
    const name = String(payload.name || 'Gast').trim();
    const caption = String(payload.caption || '').trim();
    const id = 'photo_' + Date.now();
    let filename = '';

    if (!payload.file || typeof payload.file !== 'string' || !payload.file.includes('base64,')) {
      return res.status(400).json({ ok: false, error: 'Kein gültiges Bild empfangen' });
    }

    const parts = payload.file.split(';base64,');
    const ext = parts[0].includes('png') ? 'png' : (parts[0].includes('webp') ? 'webp' : 'jpg');
    const cleanName = name.replace(/[^\wÄÖÜäöüß\- ]/g, '').replace(/\s+/g, '_');
    filename = `photos/${Date.now()}_${cleanName}.${ext}`;
    const fullPath = path.join(__dirname, filename);
    fs.writeFileSync(fullPath, Buffer.from(parts[1], 'base64'));

    const photoItem = {
      id,
      url: filename,
      sender: name,
      caption: caption,
      uploadedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    };

    if (!tournamentData.photos) tournamentData.photos = [];
    tournamentData.photos.unshift(photoItem);

    // XP & Paparazzi Badge check
    const matchingPlayer = (tournamentData.players || []).find(p => 
      p.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (matchingPlayer) {
      addPlayerXp(matchingPlayer.id, 50, 'Foto hochgeladen');
      matchingPlayer.photoCount = (matchingPlayer.photoCount || 0) + 1;
      if (matchingPlayer.photoCount >= 3) {
        awardPlayerBadge(matchingPlayer.id, 'paparazzi');
      }
    }

    saveTournamentData();

    broadcast({ type: 'NEW_PHOTO', payload: photoItem });
    broadcast({ type: 'STATE_UPDATE', payload: tournamentData });

    // Triggere auch sofortigen schnellen Drive-Sync im Hintergrund
    triggerFastDriveSync();

    console.log(`📸 Neues Party-Foto hochgeladen von: ${photoItem.sender} ("${photoItem.caption}")`);
    res.json({ ok: true, photo: photoItem });
  } catch (err) {
    console.error('Error uploading photo:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/api/delete_photo', (req, res) => {
  try {
    const { photoId } = req.body;
    if (!tournamentData.photos) tournamentData.photos = [];
    const photo = tournamentData.photos.find(p => p.id === photoId);
    if (photo && photo.url) {
      const fullPath = path.join(__dirname, photo.url);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }
    tournamentData.photos = tournamentData.photos.filter(p => p.id !== photoId);
    saveTournamentData();
    broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// 1-KLICK PARTY-FOTOALBUM (ZIP-DOWNLOAD)
app.get('/api/download_photos_zip', (req, res) => {
  const scriptPath = path.join(__dirname, 'scripts', 'create_party_zip.py');
  const zipPath = path.join(__dirname, 'photos', 'Huettencup_Party_Album.zip');

  const { execFile } = require('child_process');
  execFile('python', [scriptPath], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error('Fehler bei create_party_zip:', err, stderr);
      return res.status(500).json({ ok: false, error: String(err) });
    }
    if (fs.existsSync(zipPath)) {
      res.download(zipPath, 'Huettencup_Party_Album.zip');
    } else {
      res.status(500).json({ ok: false, error: 'Fehler beim Erstellen des ZIP-Archivs' });
    }
  });
});

// SAUBERER NEUSTART VOR DEM EVENT (MIT AUTOMATISCHEM BACKUP)
app.post('/api/tournament/reset', (req, res) => {
  try {
    const { mode = 'scores_only' } = req.body || {};
    const archiveDir = path.join(__dirname, 'archive');
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const tsStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const backupFolder = path.join(archiveDir, `Backup_${tsStr}`);
    fs.mkdirSync(backupFolder, { recursive: true });

    // 1. Automatische Sicherung von tournament.json
    if (fs.existsSync(DATA_FILE)) {
      fs.copyFileSync(DATA_FILE, path.join(backupFolder, 'tournament.json'));
    }

    // 2. Modus ausführen
    if (mode === 'full') {
      // Komplett leerer Kader & Fotos
      tournamentData.players = [];
      tournamentData.photos = [];
    } else {
      // Nur Punkte & Duelle zurücksetzen, Spieler behalten
      (tournamentData.players || []).forEach(p => {
        p.scores = {};
        p.xp = 0;
      });
    }

    // Wetten & aktives Match immer zurücksetzen
    if (!tournamentData.betting) tournamentData.betting = {};
    tournamentData.betting.bets = [];
    tournamentData.betting.status = 'open';
    tournamentData.activeEvent = {
      status: 'idle',
      gameId: (tournamentData.games && tournamentData.games[0]?.id) || 'bierpong',
      tvView: 'welcome'
    };

    saveTournamentData();
    broadcast({ type: 'STATE_UPDATE', payload: tournamentData });

    console.log(`🔄 Turnier erfolgreich zurückgesetzt (Modus: ${mode}). Backup liegt in: ${backupFolder}`);
    res.json({ ok: true, backupFolder, mode });
  } catch (err) {
    console.error('Fehler bei tournament/reset:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ================================================================
// LIVE PARTY JUKEBOX & GUESTBOOK ENDPOINTS
// ================================================================
app.get('/api/music/queue', (req, res) => {
  if (!tournamentData.musicQueue) tournamentData.musicQueue = [];
  // Sort queue: 'playing' first, then votes.length desc, then timestamp asc
  const sorted = [...tournamentData.musicQueue].sort((a, b) => {
    if (a.status === 'playing' && b.status !== 'playing') return -1;
    if (b.status === 'playing' && a.status !== 'playing') return 1;
    const votesA = (a.votes || []).length;
    const votesB = (b.votes || []).length;
    if (votesB !== votesA) return votesB - votesA;
    return a.timestamp - b.timestamp;
  });
  res.json({ ok: true, queue: sorted });
});

app.post('/api/music/request', (req, res) => {
  try {
    const { title, artist, requestedBy } = req.body || {};
    const cleanTitle = String(title || '').trim();
    const cleanArtist = String(artist || '').trim();
    const cleanName = String(requestedBy || 'Gast').trim();

    if (!cleanTitle) {
      return res.status(400).json({ ok: false, error: 'Bitte gib einen Songtitel ein!' });
    }

    if (!tournamentData.musicQueue) tournamentData.musicQueue = [];

    // Duplicate check
    const existing = tournamentData.musicQueue.find(s => 
      s.title.toLowerCase().trim() === cleanTitle.toLowerCase() &&
      (!cleanArtist || s.artist.toLowerCase().trim() === cleanArtist.toLowerCase())
    );

    if (existing) {
      if (!existing.votes) existing.votes = [];
      if (!existing.votes.includes(cleanName)) {
        existing.votes.push(cleanName);
      }
      saveTournamentData();
      broadcast({ type: 'MUSIC_QUEUE_UPDATED', payload: tournamentData.musicQueue });
      broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
      return res.json({ 
        ok: true, 
        song: existing, 
        alreadyExisted: true, 
        message: 'Song stand schon auf der Liste – deine Stimme (+1 Banger) wurde gezählt! 🔥' 
      });
    }

    const song = {
      id: 'song_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      title: cleanTitle,
      artist: cleanArtist || 'Unbekannt',
      requestedBy: cleanName,
      votes: [cleanName],
      status: 'pending', // 'pending' | 'playing' | 'played'
      requestedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    tournamentData.musicQueue.unshift(song);
    saveTournamentData();

    broadcast({ type: 'NEW_SONG_REQUEST', payload: song });
    broadcast({ type: 'MUSIC_QUEUE_UPDATED', payload: tournamentData.musicQueue });
    broadcast({ type: 'STATE_UPDATE', payload: tournamentData });

    console.log(`🎵 Neuer Musikwunsch von ${cleanName}: "${song.title} - ${song.artist}"`);
    res.json({ ok: true, song, message: 'Song erfolgreich zur Playlist hinzugefügt! 🔥' });
  } catch (err) {
    console.error('Error adding song request:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/api/music/vote', (req, res) => {
  try {
    const { songId, voterName } = req.body || {};
    const cleanName = String(voterName || 'Gast').trim();

    if (!tournamentData.musicQueue) tournamentData.musicQueue = [];
    const song = tournamentData.musicQueue.find(s => s.id === songId);

    if (!song) {
      return res.status(404).json({ ok: false, error: 'Song nicht gefunden' });
    }

    if (!song.votes) song.votes = [];
    const idx = song.votes.indexOf(cleanName);
    let voted = false;
    if (idx !== -1) {
      song.votes.splice(idx, 1);
      voted = false;
    } else {
      song.votes.push(cleanName);
      voted = true;
    }

    saveTournamentData();
    broadcast({ type: 'MUSIC_QUEUE_UPDATED', payload: tournamentData.musicQueue });
    broadcast({ type: 'STATE_UPDATE', payload: tournamentData });

    res.json({ ok: true, song, voted, votesCount: song.votes.length });
  } catch (err) {
    console.error('Error voting song:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/api/music/status', (req, res) => {
  try {
    const { songId, status } = req.body || {};
    if (!tournamentData.musicQueue) tournamentData.musicQueue = [];

    if (status === 'delete') {
      tournamentData.musicQueue = tournamentData.musicQueue.filter(s => s.id !== songId);
    } else {
      const song = tournamentData.musicQueue.find(s => s.id === songId);
      if (song) {
        song.status = status; // 'pending' | 'playing' | 'played'
      }
    }

    saveTournamentData();
    broadcast({ type: 'MUSIC_QUEUE_UPDATED', payload: tournamentData.musicQueue });
    broadcast({ type: 'STATE_UPDATE', payload: tournamentData });

    res.json({ ok: true });
  } catch (err) {
    console.error('Error updating song status:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// GUESTBOOK ENDPOINTS
app.get('/api/guestbook', (req, res) => {
  res.json({ ok: true, entries: tournamentData.guestbook || [] });
});

app.post('/api/guestbook', (req, res) => {
  try {
    const { name, message, photo } = req.body || {};
    const cleanName = String(name || 'Gast').trim();
    const cleanMessage = String(message || '').trim();

    if (!cleanMessage && !photo) {
      return res.status(400).json({ ok: false, error: 'Bitte gib eine Nachricht oder ein Foto ein!' });
    }

    let photoFilename = null;
    if (photo && typeof photo === 'string' && photo.includes('base64,')) {
      const parts = photo.split(';base64,');
      const ext = parts[0].includes('png') ? 'png' : (parts[0].includes('webp') ? 'webp' : 'jpg');
      const cleanSafeName = cleanName.replace(/[^\wÄÖÜäöüß\- ]/g, '').replace(/\s+/g, '_');
      photoFilename = `photos/${Date.now()}_gb_${cleanSafeName}.${ext}`;
      fs.writeFileSync(path.join(__dirname, photoFilename), Buffer.from(parts[1], 'base64'));

      // Also add to slideshow photos so it displays live on the TV!
      const photoItem = {
        id: 'photo_gb_' + Date.now(),
        url: photoFilename,
        sender: cleanName,
        caption: `📖 Gästebuch: ${cleanMessage.substring(0, 80)}`,
        uploadedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      };
      if (!tournamentData.photos) tournamentData.photos = [];
      tournamentData.photos.unshift(photoItem);
      broadcast({ type: 'NEW_PHOTO', payload: photoItem });
    }

    if (!tournamentData.guestbook) tournamentData.guestbook = [];
    const entry = {
      id: 'gb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      message: cleanMessage,
      photoUrl: photoFilename,
      createdAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('de-DE'),
      timestamp: Date.now()
    };

    tournamentData.guestbook.unshift(entry);
    saveTournamentData();

    broadcast({ type: 'NEW_GUESTBOOK_ENTRY', payload: entry });
    broadcast({ type: 'GUESTBOOK_UPDATED', payload: tournamentData.guestbook });
    broadcast({ type: 'STATE_UPDATE', payload: tournamentData });

    console.log(`📖 Neuer Gästebuch-Eintrag von ${cleanName}: "${cleanMessage.substring(0, 50)}..."`);
    res.json({ ok: true, entry });
  } catch (err) {
    console.error('Error posting guestbook entry:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/api/guestbook/delete', (req, res) => {
  try {
    const { entryId } = req.body || {};
    if (!tournamentData.guestbook) tournamentData.guestbook = [];
    tournamentData.guestbook = tournamentData.guestbook.filter(e => e.id !== entryId);
    saveTournamentData();
    broadcast({ type: 'GUESTBOOK_UPDATED', payload: tournamentData.guestbook });
    broadcast({ type: 'STATE_UPDATE', payload: tournamentData });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// REST Endpoints
app.get('/api/state', (req, res) => res.json(tournamentData));
app.get('/api/hall_of_fame', (req, res) => res.json(hallOfFame));

app.get('/api/network', async (req, res) => {
  const localIp = getLocalIpAddress();
  const mobileAdminUrl = `http://${localIp}:${PORT}/admin.html`;
  const tvUrl = `http://localhost:${PORT}/tv.html`;
  const partyHubUrl = `http://${localIp}:${PORT}/party.html`;
  // Online weltweit erreichbar für alle Gäste per Handynetz / LTE / 5G (ohne im WLAN sein zu müssen!):
  const partyOnlineUrl = `https://ricfritzsche89.github.io/h-ttenkarten/party.html?host=${localIp}:${PORT}`;
  const guestFotosUrl = `https://ricfritzsche89.github.io/h-ttenkarten/fotos.html?host=${localIp}:${PORT}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(mobileAdminUrl, {
      margin: 2,
      scale: 8,
      color: { dark: '#000000', light: '#ffffff' }
    });
    const qrFotosUrl = await QRCode.toDataURL(guestFotosUrl, {
      margin: 2,
      scale: 8,
      color: { dark: '#000000', light: '#ffffff' }
    });
    const qrPartyUrl = await QRCode.toDataURL(partyOnlineUrl, {
      margin: 2,
      scale: 10,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.json({
      localIp,
      port: PORT,
      mobileAdminUrl,
      tvUrl,
      partyHubUrl,
      partyOnlineUrl,
      qrDataUrl,
      qrPartyUrl,
      guestFotosUrl,
      qrFotosUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Start Server
const localIp = getLocalIpAddress();
server.listen(PORT, async () => {
  console.log('\n======================================================');
  console.log('   🔥 GRILLHÜTTE ULTIMATE TEAM (GUT) GAME STUDIO 🔥   ');
  console.log('======================================================');
  console.log(` TV Scoreboard (Laptop / HDMI TV):`);
  console.log(`    👉 http://localhost:${PORT}/tv.html`);
  console.log(`\n Mobile Admin (Smartphone im selben WLAN / Hotspot):`);
  console.log(`    👉 http://${localIp}:${PORT}/admin.html`);
  console.log('======================================================');

  try {
    const terminalQr = await QRCode.toString(`http://${localIp}:${PORT}/admin.html`, { type: 'terminal', small: true });
    console.log(terminalQr);
    console.log(` Scanne diesen QR-Code mit der Smartphone-Kamera!`);
  } catch (e) {}
  console.log('======================================================\n');
});
