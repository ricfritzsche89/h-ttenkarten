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
const DATA_FILE = path.join(DATA_DIR, 'gut_tournament.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CARDS_DIR)) fs.mkdirSync(CARDS_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

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
  } else {
    tournamentData = getInitialTournamentData();
    if (!tournamentData.photos) tournamentData.photos = [];
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

function saveTournamentData() {
  try {
    tournamentData.meta.updatedAt = new Date().toISOString();
    fs.writeFileSync(DATA_FILE, JSON.stringify(tournamentData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

/* ============================================================ */
/* LEVEL & BADGES ENGINE                                        */
/* ============================================================ */
function ensurePlayerBadgeDefaults(p) {
  if (typeof p.xp !== 'number') p.xp = 100;
  if (!Array.isArray(p.badges)) p.badges = ['alpine_shield'];
  if (!p.badges.includes('alpine_shield')) p.badges.unshift('alpine_shield');
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

// Static file serving
app.use(express.static(__dirname));

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
  const playerPool = [...(playerIds && playerIds.length > 0 ? playerIds : tournamentData.players.map(p => p.id))];
  // Fisher-Yates shuffle
  for (let i = playerPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [playerPool[i], playerPool[j]] = [playerPool[j], playerPool[i]];
  }

  let teamAIds = [];
  let teamBIds = [];
  let note = '';

  if (playerPool.length === 3) {
    teamAIds = [playerPool[0], playerPool[1]];
    teamBIds = [playerPool[2]];
    const pAlone = tournamentData.players.find(p => p.id === playerPool[2]);
    const aloneName = pAlone ? pAlone.name : 'Einzelspieler';
    note = `2 gegen 1: ${aloneName} hat 2 Würfe pro Runde!`;
  } else if (playerPool.length === 2) {
    teamAIds = [playerPool[0]];
    teamBIds = [playerPool[1]];
  } else if (playerPool.length >= 4) {
    const half = Math.ceil(playerPool.length / 2);
    teamAIds = playerPool.slice(0, half);
    teamBIds = playerPool.slice(half);
    if (teamAIds.length !== teamBIds.length) {
      note = `Ungleiche Teams: Team mit weniger Spielern hat Ausgleichswürfe!`;
    }
  } else if (playerPool.length === 1) {
    teamAIds = [playerPool[0]];
    teamBIds = [];
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
  bets.forEach(b => {
    const amt = Number(b.amount) || 0;
    if (b.target === 'teamA' || b.target === 'rot' || b.target === 'A') potA += amt;
    else if (b.target === 'teamB' || b.target === 'blau' || b.target === 'B') potB += amt;
  });
  const totalPot = potA + potB;
  const quoteA = potA > 0 ? (totalPot / potA) : 2.0;
  const quoteB = potB > 0 ? (totalPot / potB) : 2.0;

  let payouts = [];
  if (betting.winner) {
    const isWinA = (betting.winner === 'A' || betting.winner === 'teamA' || betting.winner === 'rot');
    const winningPot = isWinA ? potA : potB;
    const winningBets = bets.filter(b => isWinA ? (b.target === 'teamA' || b.target === 'rot' || b.target === 'A') : (b.target === 'teamB' || b.target === 'blau' || b.target === 'B'));

    payouts = winningBets.map(b => {
      const share = winningPot > 0 ? (b.amount / winningPot) : 0;
      const rawPayout = share * totalPot;
      const payout = Math.round(rawPayout * 100) / 100;
      const profit = Math.round((payout - b.amount) * 100) / 100;
      return {
        id: b.id,
        bettorId: b.bettorId,
        bettorName: b.bettorName,
        amount: b.amount,
        target: b.target,
        payout,
        profit
      };
    });
  }

  return {
    status: betting.status || 'open',
    winner: betting.winner || null,
    bets,
    potA: Math.round(potA * 100) / 100,
    potB: Math.round(potB * 100) / 100,
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

async function downloadDriveImageLocally(imgFileId, name) {
  if (!imgFileId) return null;
  const cleanName = (name || 'card').replace(/[^\wÄÖÜäöüß\- ]/g, '').replace(/\s+/g, '_');
  const filename = `cards/${cleanName}_${imgFileId}.png`;
  const localPath = path.join(__dirname, filename);
  if (fs.existsSync(localPath)) return filename;

  try {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?downloadFileId=${imgFileId}`);
    const json = await res.json();
    if (json && json.ok && json.base64) {
      fs.writeFileSync(localPath, Buffer.from(json.base64, 'base64'));
      console.log(`💾 Karte lokal gespeichert: ${filename}`);
      return filename;
    }
  } catch (err) {
    console.error('Fehler beim Download des Kartenbildes:', err);
  }
  return null;
}

async function syncFromGoogleDrive() {
  try {
    const res = await fetch(GOOGLE_SCRIPT_URL);
    const data = await res.json();
    if (data.ok && Array.isArray(data.cards)) {
      let newCount = 0;
      if (!tournamentData.inbox) tournamentData.inbox = [];

      for (const c of data.cards) {
        const id = 'drive_' + (c.driveId || c.gesendet || c.name);
        const name = c.name || 'Gast';
        let localImg = null;

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
    console.error('Fehler beim Synchronisieren mit Google Drive:', err);
    return { ok: false, error: String(err) };
  }
}

// Auto-Sync mit Google Drive alle 20 Sekunden
setInterval(syncFromGoogleDrive, 20000);
setTimeout(syncFromGoogleDrive, 2000);

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
      const ext = parts[0].includes('jpeg') || parts[0].includes('jpg') ? 'jpg' : 'png';
      const cleanName = name.replace(/[^\wÄÖÜäöüß\- ]/g, '').replace(/\s+/g, '_');
      imageFilename = `cards/${Date.now()}_${cleanName}.${ext}`;
      const fullPath = path.join(__dirname, imageFilename);
      fs.writeFileSync(fullPath, Buffer.from(parts[1], 'base64'));
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

    console.log(`📥 Neue Karte in der Inbox: ${cardItem.name} (${cardItem.ovr} OVR)`);
    res.json({ ok: true, id, name: cardItem.name });
  } catch (err) {
    console.error('Error submitting card:', err);
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
    const ext = parts[0].includes('png') ? 'png' : 'jpg';
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

// REST Endpoints
app.get('/api/state', (req, res) => res.json(tournamentData));

app.get('/api/network', async (req, res) => {
  const localIp = getLocalIpAddress();
  const mobileAdminUrl = `http://${localIp}:${PORT}/admin.html`;
  const tvUrl = `http://localhost:${PORT}/tv.html`;
  const guestFotosUrl = `http://${localIp}:${PORT}/fotos.html`;
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
    res.json({
      localIp,
      port: PORT,
      mobileAdminUrl,
      tvUrl,
      qrDataUrl,
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
