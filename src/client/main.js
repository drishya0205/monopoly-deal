import { io } from 'socket.io-client';
import { renderCard, renderCardBack } from './components/Card.js';
import { CARD_TYPES, ACTION_TYPES, PHASES, COLOR_NAMES, COLOR_HEX, SET_SIZES } from '../shared/constants.js';

const socket = io();
const app = document.getElementById('app');

let state = { screen: 'lobby', playerId: null, roomCode: null, room: null, gameState: null, selectedCard: null };

// --- Socket Events ---
socket.on('room-updated', (room) => { state.room = room; render(); });
socket.on('game-state', (gs) => { state.gameState = gs; state.screen = gs.winner ? 'victory' : 'game'; render(); });

function emit(event, data = {}) {
  return new Promise((resolve) => socket.emit(event, data, resolve));
}

// --- Render Router ---
function render() {
  switch (state.screen) {
    case 'lobby': renderLobby(); break;
    case 'waiting': renderWaiting(); break;
    case 'game': renderGame(); break;
    case 'victory': renderVictory(); break;
  }
}

// --- LOBBY ---
function renderLobby() {
  app.innerHTML = `
    <div class="lobby">
      <h1 class="lobby-title">Monopoly Deal</h1>
      <p class="lobby-subtitle">The fast-dealing property trading card game</p>
      <div class="lobby-panel glass-strong">
        <h2>Enter your name</h2>
        <input class="input" id="nameInput" placeholder="Your name" maxlength="20" value="${localStorage.getItem('md_name') || ''}"/>
        <button class="btn btn-primary btn-lg" id="createBtn">Create Game</button>
        <div class="divider">or join a friend</div>
        <input class="input" id="codeInput" placeholder="Room code" maxlength="6" style="text-transform:uppercase;letter-spacing:0.2em;text-align:center"/>
        <button class="btn btn-secondary btn-lg" id="joinBtn">Join Game</button>
      </div>
    </div>`;

  document.getElementById('createBtn').onclick = async () => {
    const name = document.getElementById('nameInput').value.trim() || 'Player';
    localStorage.setItem('md_name', name);
    const res = await emit('create-room', { playerName: name });
    if (res.error) return alert(res.error);
    state.playerId = res.playerId; state.roomCode = res.roomCode; state.room = res.room;
    state.screen = 'waiting'; render();
  };

  document.getElementById('joinBtn').onclick = async () => {
    const name = document.getElementById('nameInput').value.trim() || 'Player';
    const code = document.getElementById('codeInput').value.trim().toUpperCase();
    if (!code) return alert('Enter a room code');
    localStorage.setItem('md_name', name);
    const res = await emit('join-room', { roomCode: code, playerName: name });
    if (res.error) return alert(res.error);
    state.playerId = res.playerId; state.roomCode = res.roomCode; state.room = res.room;
    state.screen = 'waiting'; render();
  };
}

// --- WAITING ROOM ---
function renderWaiting() {
  const r = state.room; if (!r) return;
  const isHost = r.hostId === state.playerId;
  const colors = ['#6366f1','#ec4899','#22c55e','#f59e0b'];

  app.innerHTML = `
    <div class="waiting-room">
      <h1 class="lobby-title">Monopoly Deal</h1>
      <p class="lobby-subtitle">Share this code with friends</p>
      <div class="room-code-display" id="roomCode">${r.code}</div>
      <div class="player-list">
        ${r.players.map((p, i) => `
          <div class="player-slot">
            <div class="avatar" style="background:${colors[i]}">${p.name[0]}</div>
            <span class="name">${p.name}</span>
            ${p.id === r.hostId ? '<span class="badge badge-host">HOST</span>' : ''}
            ${p.isBot ? `<span class="badge badge-bot">BOT</span>${isHost ? `<button class="btn btn-danger btn-sm" data-remove="${p.id}">✕</button>` : ''}` : ''}
          </div>`).join('')}
        ${Array(4 - r.players.length).fill('<div class="player-slot empty"><span class="name" style="color:var(--text-muted)">Waiting for player...</span></div>').join('')}
      </div>
      <div class="waiting-actions">
        ${isHost && r.players.length < 4 ? '<button class="btn btn-secondary" id="addBot">🤖 Add Bot</button>' : ''}
        ${isHost && r.players.length >= 2 ? '<button class="btn btn-primary btn-lg" id="startBtn">🎴 Start Game</button>' : ''}
      </div>
    </div>`;

  document.getElementById('roomCode')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(r.code);
    showToast('Room code copied!');
  });
  document.getElementById('addBot')?.addEventListener('click', () => emit('add-bot'));
  document.getElementById('startBtn')?.addEventListener('click', () => emit('start-game'));
  document.querySelectorAll('[data-remove]').forEach(b => {
    b.onclick = () => emit('remove-bot', { botId: b.dataset.remove });
  });
}

// --- GAME SCREEN ---
function renderGame() {
  const gs = state.gameState; if (!gs) return;
  const me = gs.players.find(p => p.id === state.playerId);
  const opponents = gs.players.filter(p => p.id !== state.playerId);
  const isMyTurn = gs.currentPlayerId === state.playerId;

  app.innerHTML = `
    <div class="game-screen">
      <div class="game-topbar">
        <div class="turn-info">${isMyTurn ? "🎴 Your Turn" : `${gs.players[gs.currentPlayerIndex]?.name}'s Turn`}</div>
        <div class="plays-counter">${[0,1,2].map(i => `<div class="dot ${i < gs.playsThisTurn ? 'used' : ''}"></div>`).join('')}</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">Room: ${state.roomCode}</div>
      </div>
      <div class="game-main">
        <div class="board-area">
          <div class="opponents-row" id="opponents"></div>
          <div class="center-area" id="center"></div>
        </div>
        <div class="game-sidebar glass" id="sidebar">
          <div style="padding:12px;font-weight:700;font-size:0.85rem;border-bottom:1px solid rgba(255,255,255,0.06)">Game Log</div>
          <div class="game-log" id="gameLog"></div>
        </div>
      </div>
      <div class="your-area" id="yourArea"></div>
    </div>`;

  // Render opponents
  const opRow = document.getElementById('opponents');
  opponents.forEach(p => {
    const isActive = gs.currentPlayerId === p.id;
    const div = document.createElement('div');
    div.className = `player-board glass ${isActive ? 'active' : ''}`;
    div.innerHTML = `
      <div class="player-board-header">
        <span class="name">${p.name} ${p.isBot ? '🤖' : ''}</span>
        <span class="info">🃏${p.handCount} | Sets: ${p.setsCompleted}</span>
      </div>
      <div class="property-sets" id="props_${p.id}"></div>
      <div class="bank-display">${p.bank.map(c => `<span class="bank-chip">${c.value}M</span>`).join('')}</div>`;
    opRow.appendChild(div);
    renderPropertySets(document.getElementById(`props_${p.id}`), p);
  });

  // Center
  const center = document.getElementById('center');
  const drawPile = renderCardBack(gs.drawPileCount);
  if (isMyTurn && gs.phase === PHASES.DRAW) {
    drawPile.style.cursor = 'pointer';
    drawPile.onclick = () => emit('draw-cards');
    drawPile.innerHTML += '<div style="position:absolute;bottom:4px;font-size:0.5rem;color:var(--accent)">Click to draw</div>';
  }
  const deckDiv = document.createElement('div');
  deckDiv.className = 'deck-pile';
  deckDiv.innerHTML = '<span class="label">DRAW PILE</span>';
  deckDiv.appendChild(drawPile);
  center.appendChild(deckDiv);

  if (gs.discardPile?.length > 0) {
    const discDiv = document.createElement('div');
    discDiv.className = 'deck-pile';
    discDiv.innerHTML = '<span class="label">DISCARD</span>';
    const topCard = gs.discardPile[gs.discardPile.length - 1];
    discDiv.appendChild(renderCard(topCard, {}));
    center.appendChild(discDiv);
  }

  // Game log
  const logEl = document.getElementById('gameLog');
  (gs.log || []).forEach(l => {
    const e = document.createElement('div');
    e.className = 'log-entry';
    e.textContent = l.msg;
    logEl.appendChild(e);
  });
  logEl.scrollTop = logEl.scrollHeight;

  // Your area
  renderYourArea(me, gs, isMyTurn);

  // Overlays
  if (gs.phase === PHASES.PAYMENT && gs.pendingAction) {
    const myDebt = gs.pendingAction.targets.find(t => t.playerId === state.playerId && !t.resolved);
    if (myDebt) renderPaymentOverlay(me, myDebt);
  }

  if (gs.winner) {
    state.screen = 'victory';
    renderVictory();
  }
}

function renderPropertySets(container, player) {
  for (const [color, cards] of Object.entries(player.properties || {})) {
    if (!cards || cards.length === 0) continue;
    const group = document.createElement('div');
    group.className = 'property-group';
    const needed = SET_SIZES[color] || 2;
    const complete = cards.length >= needed;
    cards.forEach(c => group.appendChild(renderCard(c, { mini: true, complete })));
    container.appendChild(group);
  }
}

function renderYourArea(me, gs, isMyTurn) {
  const area = document.getElementById('yourArea');
  if (!me) return;

  // Your properties
  const propsDiv = document.createElement('div');
  propsDiv.className = 'your-properties';
  renderPropertySets(propsDiv, me);
  area.appendChild(propsDiv);

  // Bank
  const bankTotal = (me.bank || []).reduce((s, c) => s + (c.value || 0), 0);
  const bankDiv = document.createElement('div');
  bankDiv.className = 'your-bank';
  bankDiv.innerHTML = `<span class="label">Bank</span><span class="total">${bankTotal}M</span>`;
  area.appendChild(bankDiv);

  // Hand
  const handDiv = document.createElement('div');
  handDiv.className = 'hand-container';
  (me.hand || []).forEach(card => {
    const canPlay = isMyTurn && gs.phase === PHASES.PLAY;
    const isSelected = state.selectedCard === card.id;
    const el = renderCard(card, {
      selected: isSelected,
      disabled: !canPlay && gs.phase !== PHASES.DISCARD,
      onClick: (c) => {
        if (gs.phase === PHASES.DISCARD) {
          emit('discard-cards', { cardIds: [c.id] });
          return;
        }
        state.selectedCard = isSelected ? null : c.id;
        render();
      }
    });
    handDiv.appendChild(el);
  });
  area.appendChild(handDiv);

  // Action buttons
  if (isMyTurn && gs.phase === PHASES.PLAY) {
    const actDiv = document.createElement('div');
    actDiv.className = 'hand-actions';
    const sel = me.hand?.find(c => c.id === state.selectedCard);

    if (sel) {
      // Property play
      if (sel.type === CARD_TYPES.PROPERTY || sel.type === CARD_TYPES.PROPERTY_WILDCARD) {
        const btn = makeBtn('🏠 Play Property', 'btn-success btn-sm', () => {
          const color = sel.type === CARD_TYPES.PROPERTY ? undefined : (sel.colors === 'all' ? promptColor() : sel.colors[0]);
          emit('play-card', { cardId: sel.id, action: { type: 'property', color } });
          state.selectedCard = null;
        });
        actDiv.appendChild(btn);
      }

      // Bank
      if (sel.type === CARD_TYPES.MONEY || (sel.value > 0 && sel.type !== CARD_TYPES.PROPERTY)) {
        actDiv.appendChild(makeBtn('💰 Bank It', 'btn-secondary btn-sm', () => {
          emit('play-card', { cardId: sel.id, action: 'bank' });
          state.selectedCard = null;
        }));
      }

      // Action play
      if (sel.type === CARD_TYPES.ACTION || sel.type === CARD_TYPES.RENT) {
        actDiv.appendChild(makeBtn('⚡ Play Action', 'btn-primary btn-sm', () => {
          handleActionPlay(sel, gs);
        }));
      }
    }

    actDiv.appendChild(makeBtn('⏭ End Turn', 'btn-danger btn-sm', () => {
      emit('end-turn');
      state.selectedCard = null;
    }));
    area.appendChild(actDiv);
  }

  // Discard notice
  if (gs.phase === PHASES.DISCARD && isMyTurn) {
    const notice = document.createElement('div');
    notice.style.cssText = 'color:var(--warning);font-weight:700;font-size:0.85rem;';
    notice.textContent = `⚠️ Discard to 7 cards (click cards to discard). Have: ${me.hand?.length || 0}`;
    area.appendChild(notice);
  }
}

function handleActionPlay(card, gs) {
  const opponents = gs.players.filter(p => p.id !== state.playerId);

  if (card.type === CARD_TYPES.RENT) {
    const colors = card.colors === 'all' ? Object.keys(COLOR_NAMES) : card.colors;
    const color = colors.length === 1 ? colors[0] : promptColorFromList(colors);
    if (!color) return;
    const targetId = card.colors === 'all' ? promptTarget(opponents) : undefined;
    if (card.colors === 'all' && !targetId) return;

    // Check for Double the Rent in hand
    const me = gs.players.find(p => p.id === state.playerId);
    const dtr = me?.hand?.find(c => c.action === ACTION_TYPES.DOUBLE_RENT && c.id !== card.id);
    const doubled = dtr && confirm('Use Double the Rent? (uses 1 extra play)');

    emit('play-card', { cardId: card.id, action: { type: 'action', color, targetId, doubled } });
    state.selectedCard = null;
    return;
  }

  switch (card.action) {
    case ACTION_TYPES.PASS_GO:
      emit('play-card', { cardId: card.id, action: 'action' });
      break;
    case ACTION_TYPES.DEBT_COLLECTOR: {
      const tid = promptTarget(opponents);
      if (tid) emit('play-card', { cardId: card.id, action: { type: 'action', targetId: tid } });
      break;
    }
    case ACTION_TYPES.BIRTHDAY:
      emit('play-card', { cardId: card.id, action: 'action' });
      break;
    case ACTION_TYPES.SLY_DEAL: {
      const tid = promptTarget(opponents);
      if (!tid) break;
      const target = gs.players.find(p => p.id === tid);
      const tcid = promptPropertyFromPlayer(target);
      if (tcid) emit('play-card', { cardId: card.id, action: { type: 'action', targetId: tid, targetCardId: tcid } });
      break;
    }
    case ACTION_TYPES.DEAL_BREAKER: {
      const tid = promptTarget(opponents);
      if (!tid) break;
      const target = gs.players.find(p => p.id === tid);
      const colors = Object.entries(target.properties || {}).filter(([c, cards]) => cards.length >= (SET_SIZES[c] || 2)).map(([c]) => c);
      if (colors.length === 0) { alert('No complete sets to steal!'); break; }
      const color = colors.length === 1 ? colors[0] : promptColorFromList(colors);
      if (color) emit('play-card', { cardId: card.id, action: { type: 'action', targetId: tid, targetColor: color } });
      break;
    }
    case ACTION_TYPES.FORCED_DEAL: {
      const tid = promptTarget(opponents);
      if (!tid) break;
      const target = gs.players.find(p => p.id === tid);
      const tcid = promptPropertyFromPlayer(target);
      if (!tcid) break;
      const me = gs.players.find(p => p.id === state.playerId);
      const mycid = promptPropertyFromPlayer(me, 'Select YOUR property to give:');
      if (mycid) emit('play-card', { cardId: card.id, action: { type: 'action', targetId: tid, targetCardId: tcid, myCardId: mycid } });
      break;
    }
    case ACTION_TYPES.HOUSE:
    case ACTION_TYPES.HOTEL: {
      const me = gs.players.find(p => p.id === state.playerId);
      const complete = Object.entries(me.properties || {}).filter(([c, cards]) => cards.length >= (SET_SIZES[c] || 2) && c !== 'railroad' && c !== 'utility').map(([c]) => c);
      if (complete.length === 0) { alert('No eligible complete sets!'); break; }
      const color = complete.length === 1 ? complete[0] : promptColorFromList(complete);
      if (color) emit('play-card', { cardId: card.id, action: { type: 'action', targetColor: color } });
      break;
    }
    default:
      emit('play-card', { cardId: card.id, action: 'action' });
  }
  state.selectedCard = null;
}

function renderPaymentOverlay(me, debt) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const allCards = [...(me.bank || []), ...Object.values(me.properties || {}).flat()];
  const totalAssets = allCards.reduce((s, c) => s + (c.value || 0), 0);

  // Check for Just Say No
  const jsn = me.hand?.find(c => c.action === ACTION_TYPES.JUST_SAY_NO);

  let selected = new Set();

  function renderInner() {
    const selectedTotal = allCards.filter(c => selected.has(c.id)).reduce((s, c) => s + (c.value || 0), 0);

    overlay.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'overlay-panel glass-strong';
    panel.innerHTML = `
      <h2>💸 Pay ${debt.amount}M</h2>
      <p class="subtitle">Select cards to pay with (no change given). Selected: ${selectedTotal}M / ${debt.amount}M</p>
    `;

    if (jsn) {
      const jsnBtn = makeBtn('🚫 Just Say No!', 'btn-danger', () => {
        emit('just-say-no', { cardId: jsn.id });
        overlay.remove();
      });
      panel.appendChild(jsnBtn);
    }

    const cardsDiv = document.createElement('div');
    cardsDiv.className = 'selectable-cards';
    allCards.forEach(card => {
      const el = renderCard(card, {
        selected: selected.has(card.id),
        onClick: (c) => {
          if (selected.has(c.id)) selected.delete(c.id); else selected.add(c.id);
          renderInner();
        }
      });
      cardsDiv.appendChild(el);
    });
    panel.appendChild(cardsDiv);

    const payBtn = makeBtn(`Pay ${selectedTotal}M`, 'btn-primary btn-lg', () => {
      emit('pay-debt', { cardIds: [...selected] });
      overlay.remove();
    });
    payBtn.disabled = selectedTotal < debt.amount && totalAssets >= debt.amount;
    panel.appendChild(payBtn);

    if (totalAssets === 0) {
      const nothingBtn = makeBtn("I have nothing to pay!", 'btn-secondary', () => {
        emit('pay-debt', { cardIds: [] });
        overlay.remove();
      });
      panel.appendChild(nothingBtn);
    }

    overlay.appendChild(panel);
  }

  renderInner();
  app.appendChild(overlay);
}

// --- VICTORY ---
function renderVictory() {
  const gs = state.gameState;
  const winner = gs?.players?.find(p => p.id === gs.winner);
  const isMe = gs?.winner === state.playerId;

  app.innerHTML = `
    <div class="victory-screen">
      <div class="confetti-container" id="confetti"></div>
      <h1 class="victory-title">${isMe ? '🎉 You Win!' : '🏆 Game Over!'}</h1>
      <p class="victory-winner">${winner?.name || 'Unknown'} wins with ${winner?.setsCompleted || 3} complete sets!</p>
      <button class="btn btn-primary btn-lg" onclick="location.reload()">🔄 Play Again</button>
    </div>`;

  // Confetti
  const container = document.getElementById('confetti');
  const colors = ['#6366f1','#ec4899','#22c55e','#f59e0b','#ef4444','#FFD700'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.cssText = `left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${2+Math.random()*3}s;animation-delay:${Math.random()*2}s;width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;border-radius:${Math.random()>0.5?'50%':'2px'};`;
    container.appendChild(c);
  }
}

// --- Helpers ---
function makeBtn(text, cls, onclick) {
  const b = document.createElement('button');
  b.className = `btn ${cls}`;
  b.textContent = text;
  b.onclick = onclick;
  return b;
}

function promptTarget(opponents) {
  if (opponents.length === 1) return opponents[0].id;
  const names = opponents.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
  const choice = prompt(`Choose a player:\n${names}`);
  const idx = parseInt(choice) - 1;
  return opponents[idx]?.id || null;
}

function promptColor() {
  const colors = Object.keys(COLOR_NAMES);
  const list = colors.map((c, i) => `${i + 1}. ${COLOR_NAMES[c]}`).join('\n');
  const choice = prompt(`Choose a color:\n${list}`);
  return colors[parseInt(choice) - 1] || colors[0];
}

function promptColorFromList(colors) {
  if (colors.length === 1) return colors[0];
  const list = colors.map((c, i) => `${i + 1}. ${COLOR_NAMES[c] || c}`).join('\n');
  const choice = prompt(`Choose a color:\n${list}`);
  return colors[parseInt(choice) - 1] || colors[0];
}

function promptPropertyFromPlayer(player, msg = 'Select a property (enter number):') {
  const allProps = Object.values(player.properties || {}).flat();
  if (allProps.length === 0) { alert('No properties to select!'); return null; }
  if (allProps.length === 1) return allProps[0].id;
  const list = allProps.map((c, i) => `${i + 1}. ${c.name || 'Wildcard'} (${c.color || c.activeColor || '?'})`).join('\n');
  const choice = prompt(`${msg}\n${list}`);
  return allProps[parseInt(choice) - 1]?.id || null;
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

// --- Init ---
render();
