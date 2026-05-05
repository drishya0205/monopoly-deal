import { io } from 'socket.io-client';
import { renderCard, renderCardBack } from './components/Card.js';
import { CARD_TYPES, ACTION_TYPES, PHASES, COLOR_NAMES, COLOR_HEX, SET_SIZES } from '../shared/constants.js';

const socket = io();
const app = document.getElementById('app');

let state = { screen: 'lobby', playerId: null, roomCode: null, room: null, gameState: null, selectedCard: null };

// Payment overlay state — persisted across renders
let paymentState = { active: false, selectedCardIds: new Set(), debtAmount: 0 };

// --- Socket Events ---
socket.on('room-updated', (room) => { state.room = room; render(); });
  socket.on('game-state', (gs) => {
    const prevPhase = state.gameState?.phase;
    state.gameState = gs;
    state.screen = gs.winner ? 'victory' : 'game';

  // If a payment overlay is active and we're still in payment phase, don't re-render the whole game
  // Just check if our debt was resolved (e.g. by Just Say No or we already paid)
  if (paymentState.active && gs.phase === PHASES.PAYMENT && gs.pendingAction) {
    const myDebt = gs.pendingAction.targets.find(t => t.playerId === state.playerId && !t.resolved);
    if (!myDebt) {
      // Our debt was resolved, close the overlay
      paymentState.active = false;
      paymentState.selectedCardIds.clear();
      render();
    }
    // Otherwise, don't re-render — keep the overlay stable
    return;
  }

    // If we left payment phase, clear payment state
  if (gs.phase !== PHASES.PAYMENT) {
    paymentState.active = false;
    paymentState.selectedCardIds.clear();
  }

  render();
  });

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
        <div style="font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center;gap:12px;">
          <span>Room: ${state.roomCode}</span>
          <button id="rulesBtn" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.75rem;">📜 Rules</button>
        </div>
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
  document.getElementById('rulesBtn')?.addEventListener('click', showRulesModal);
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

  const discDiv = document.createElement('div');
  discDiv.className = 'deck-pile';
  discDiv.innerHTML = '<span class="label">DISCARD/PLAY</span>';
  
  if (gs.discardPile?.length > 0) {
    const topCard = gs.discardPile[gs.discardPile.length - 1];
    discDiv.appendChild(renderCard(topCard, {}));
  } else {
    discDiv.innerHTML += '<div class="card empty-card" style="border:2px dashed rgba(255,255,255,0.2)"></div>';
  }

  // Action/Rent dropzone
  if (isMyTurn && gs.phase === PHASES.PLAY) {
    discDiv.ondragover = (e) => { e.preventDefault(); discDiv.classList.add('drag-over'); };
    discDiv.ondragleave = () => { discDiv.classList.remove('drag-over'); };
    discDiv.ondrop = async (e) => {
      e.preventDefault();
      discDiv.classList.remove('drag-over');
      const data = e.dataTransfer.getData('text/plain');
      if (data && data.startsWith('hand:')) {
        const cardId = data.split(':')[1];
        const card = me.hand?.find(c => c.id === cardId);
        if (card && (card.type === CARD_TYPES.ACTION || card.type === CARD_TYPES.RENT)) {
          await handleActionPlay(card, gs);
        } else {
          showToast('❌ Only Action and Rent cards can be played here!');
        }
      }
    };
  }
  center.appendChild(discDiv);

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

  // Payment overlay
  if (gs.phase === PHASES.PAYMENT && gs.pendingAction) {
    const myDebt = gs.pendingAction.targets.find(t => t.playerId === state.playerId && !t.resolved);
    if (myDebt) {
      paymentState.active = true;
      paymentState.debtAmount = myDebt.amount;
      renderPaymentOverlay(me, myDebt);
    }
  }

  if (gs.winner) {
    state.screen = 'victory';
    renderVictory();
  }
}

function renderPropertySets(container, player) {
  const isMe = player.id === state.playerId;
  const isMyTurn = state.gameState?.currentPlayerId === state.playerId;
  const canMove = isMe && isMyTurn && state.gameState?.phase === PHASES.PLAY;

  const allColors = Object.keys(COLOR_NAMES);
  for (const color of allColors) {
    const cards = player.properties?.[color] || [];
    if (!isMe && cards.length === 0) continue;
    if (isMe && cards.length === 0 && !canMove) continue; // Only show empty dropzones when we can move
    
    const setDiv = document.createElement('div');
    setDiv.className = `property-set ${cards.length === 0 ? 'empty-set' : ''}`;
    setDiv.dataset.color = color;

    // Drop zone logic
    if (canMove) {
      setDiv.ondragover = (e) => { e.preventDefault(); setDiv.classList.add('drag-over'); };
      setDiv.ondragleave = () => { setDiv.classList.remove('drag-over'); };
      setDiv.ondrop = async (e) => {
        e.preventDefault();
        setDiv.classList.remove('drag-over');
        const data = e.dataTransfer.getData('text/plain');
        if (!data) return;
        
        if (data.startsWith('hand:')) {
          const cardId = data.split(':')[1];
          const me = state.gameState?.players.find(p => p.id === state.playerId);
          const card = me?.hand?.find(c => c.id === cardId);
          if (!card) return;

          let result;
          if (card.type === CARD_TYPES.ACTION && (card.action === ACTION_TYPES.HOUSE || card.action === ACTION_TYPES.HOTEL)) {
            result = await emit('play-card', { cardId, action: { type: 'action', targetColor: color } });
          } else {
            result = await emit('play-card', { cardId, action: { type: 'property', color } });
          }
          
          if (result?.error) showToast(`❌ ${result.error}`);
        } else {
          const result = await emit('move-wildcard', { cardId: data, color });
          if (result?.error) showToast(`❌ ${result.error}`);
        }
      };
    }
    
    if (cards.length === 0) {
      setDiv.innerHTML = `<div class="empty-set-label">${COLOR_NAMES[color]}</div>`;
    } else {
      cards.forEach((card) => {
        const isMovable = canMove && (card.type === CARD_TYPES.PROPERTY_WILDCARD || (card.type === CARD_TYPES.ACTION && (card.action === ACTION_TYPES.HOUSE || card.action === ACTION_TYPES.HOTEL)));
        const el = renderCard(card, {
          selected: state.selectedCard === card.id,
          onClick: isMovable ? () => {
            state.selectedCard = state.selectedCard === card.id ? null : card.id;
            render();
          } : undefined
        });
        
        // Drag logic for wildcards and houses/hotels
        if (isMovable) {
          el.draggable = true;
          el.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', card.id);
            document.body.classList.add('is-dragging');
          };
          el.ondragend = () => {
            document.body.classList.remove('is-dragging');
          };
        }
        setDiv.appendChild(el);
      });
    }
    
    container.appendChild(setDiv);
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
  
  // Bank dropzone
  if (isMyTurn && gs.phase === PHASES.PLAY) {
    bankDiv.ondragover = (e) => { e.preventDefault(); bankDiv.classList.add('drag-over'); };
    bankDiv.ondragleave = () => { bankDiv.classList.remove('drag-over'); };
    bankDiv.ondrop = async (e) => {
      e.preventDefault();
      bankDiv.classList.remove('drag-over');
      const data = e.dataTransfer.getData('text/plain');
      if (data && data.startsWith('hand:')) {
        const cardId = data.split(':')[1];
        const result = await emit('play-card', { cardId, action: 'bank' });
        if (result?.error) showToast(`❌ ${result.error}`);
      }
    };
  }
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
    
    // Make hand cards draggable
    if (canPlay) {
      el.draggable = true;
      el.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', `hand:${card.id}`);
        document.body.classList.add('is-dragging');
      };
      el.ondragend = () => {
        document.body.classList.remove('is-dragging');
      };
    }
    
    handDiv.appendChild(el);
  });
  area.appendChild(handDiv);

  // Action buttons
  if (isMyTurn && gs.phase === PHASES.PLAY) {
    const actDiv = document.createElement('div');
    actDiv.className = 'hand-actions';
    let sel = me.hand?.find(c => c.id === state.selectedCard);
    let isBoardCard = false;
    if (!sel) {
      sel = Object.values(me.properties || {}).flat().find(c => c.id === state.selectedCard);
      isBoardCard = !!sel;
    }
    
    const playsLeft = gs.playsRemaining ?? (3 - gs.playsThisTurn);

    // Plays remaining indicator
    const playsInfo = document.createElement('span');
    playsInfo.style.cssText = `font-size:0.8rem;color:${playsLeft === 0 ? 'var(--danger)' : 'var(--text-muted)'};margin-right:8px;font-weight:600;`;
    playsInfo.textContent = playsLeft === 0 ? '⚠️ No plays left!' : `${playsLeft} play${playsLeft !== 1 ? 's' : ''} left`;
    actDiv.appendChild(playsInfo);

    if (sel && !isBoardCard && playsLeft > 0) {
      // Property play
      if (sel.type === CARD_TYPES.PROPERTY || sel.type === CARD_TYPES.PROPERTY_WILDCARD) {
        const btn = makeBtn('🏠 Play Property', 'btn-success btn-sm', async () => {
          let color;
          if (sel.type === CARD_TYPES.PROPERTY_WILDCARD) {
            color = sel.colors === 'all' ? await promptColor() : await promptColorFromList(sel.colors);
            if (!color) return; // Cancelled
          }
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
        actDiv.appendChild(makeBtn('⚡ Play Action', 'btn-primary btn-sm', async () => {
          await handleActionPlay(sel, gs);
        }));
      }
    }
    
    if (sel && isBoardCard) {
      actDiv.appendChild(makeBtn('🔄 Move Property', 'btn-primary btn-sm', async () => {
        let colors = Object.keys(COLOR_NAMES);
        if (sel.type === CARD_TYPES.PROPERTY_WILDCARD && sel.colors !== 'all') {
          colors = sel.colors;
        }
        const color = await promptColorFromList(colors);
        if (color) {
          const result = await emit('move-wildcard', { cardId: sel.id, color });
          if (result?.error) showToast(`❌ ${result.error}`);
        }
        state.selectedCard = null;
        render();
      }));
    }

    if (sel && playsLeft === 0 && !isBoardCard) {
      showToast('⚠️ You\'ve used all 3 plays! End your turn.');
      state.selectedCard = null;
    }

    actDiv.appendChild(makeBtn('⏭ End Turn', 'btn-danger btn-sm', async () => {
      const result = await emit('end-turn');
      if (result?.needsDiscard) {
        showToast(`⚠️ You have ${me.hand?.length} cards — discard to 7 first!`);
      } else if (result?.error) {
        showToast(result.error);
      }
      state.selectedCard = null;
    }));
    area.appendChild(actDiv);
  }

  // Discard notice
  if (gs.phase === PHASES.DISCARD && isMyTurn) {
    const notice = document.createElement('div');
    notice.style.cssText = 'color:var(--warning);font-weight:700;font-size:0.85rem;padding:8px 12px;background:rgba(245,158,11,0.1);border-radius:8px;border:1px solid rgba(245,158,11,0.3);';
    notice.textContent = `⚠️ Too many cards! Discard to 7 (click cards to discard). You have: ${me.hand?.length || 0}`;
    area.appendChild(notice);
  }
}

async function handleActionPlay(card, gs) {
  const opponents = gs.players.filter(p => p.id !== state.playerId);

  if (card.type === CARD_TYPES.RENT) {
    const colors = card.colors === 'all' ? Object.keys(COLOR_NAMES) : card.colors;
    const color = colors.length === 1 ? colors[0] : await promptColorFromList(colors);
    if (!color) { state.selectedCard = null; render(); return; }
    const targetId = card.colors === 'all' ? await promptTarget(opponents) : undefined;
    if (card.colors === 'all' && !targetId) { state.selectedCard = null; render(); return; }

    // Check for Double the Rent in hand
    const me = gs.players.find(p => p.id === state.playerId);
    const dtr = me?.hand?.find(c => c.action === ACTION_TYPES.DOUBLE_RENT && c.id !== card.id);
    const doubled = dtr && confirm('Use Double the Rent? (uses 1 extra play)');

    return emitAction(card.id, { type: 'action', color, targetId, doubled });
  }

  switch (card.action) {
    case ACTION_TYPES.PASS_GO:
      return emitAction(card.id, 'action');
    case ACTION_TYPES.DEBT_COLLECTOR: {
      const tid = await promptTarget(opponents);
      if (tid) return emitAction(card.id, { type: 'action', targetId: tid });
      break;
    }
    case ACTION_TYPES.BIRTHDAY:
      return emitAction(card.id, 'action');
    case ACTION_TYPES.SLY_DEAL: {
      const tid = await promptTarget(opponents);
      if (!tid) break;
      const target = gs.players.find(p => p.id === tid);
      const tcid = await promptStealableProperty(target, 'Select a property to steal:');
      if (tcid) return emitAction(card.id, { type: 'action', targetId: tid, targetCardId: tcid });
      break;
    }
    case ACTION_TYPES.DEAL_BREAKER: {
      const tid = await promptTarget(opponents);
      if (!tid) break;
      const target = gs.players.find(p => p.id === tid);
      const colors = Object.entries(target.properties || {}).filter(([c, cards]) => cards.length >= (SET_SIZES[c] || 2)).map(([c]) => c);
      if (colors.length === 0) { alert('No complete sets to steal!'); break; }
      const color = colors.length === 1 ? colors[0] : await promptColorFromList(colors);
      if (color) return emitAction(card.id, { type: 'action', targetId: tid, targetColor: color });
      break;
    }
    case ACTION_TYPES.FORCED_DEAL: {
      const me = gs.players.find(p => p.id === state.playerId);
      const mycid = await promptStealableProperty(me, 'Select YOUR property to give:');
      if (!mycid) break;
      const tid = await promptTarget(opponents);
      if (!tid) break;
      const target = gs.players.find(p => p.id === tid);
      const tcid = await promptStealableProperty(target, 'Select THEIR property to take:');
      if (!tcid) break;
      return emitAction(card.id, { type: 'action', targetId: tid, targetCardId: tcid, myCardId: mycid });
    }
    case ACTION_TYPES.HOUSE:
    case ACTION_TYPES.HOTEL: {
      const me = gs.players.find(p => p.id === state.playerId);
      const complete = Object.entries(me.properties || {}).filter(([c, cards]) => cards.length >= (SET_SIZES[c] || 2) && c !== 'railroad' && c !== 'utility').map(([c]) => c);
      if (complete.length === 0) { alert('No eligible complete sets!'); break; }
      const color = complete.length === 1 ? complete[0] : await promptColorFromList(complete);
      if (color) return emitAction(card.id, { type: 'action', targetColor: color });
      break;
    }
    default:
      return emitAction(card.id, 'action');
  }
  state.selectedCard = null;
  render();
}

function showRulesModal() {
  let modal = document.getElementById('rulesModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'rulesModal';
    modal.className = 'rules-modal-overlay';
    modal.innerHTML = `
      <div class="rules-modal glass">
        <div class="rules-header">
          <h3 style="margin: 0; color: white;">📜 Quick Rules</h3>
          <button class="btn-close" id="closeRules" style="background:transparent;border:none;color:white;font-size:1.2rem;cursor:pointer;">✕</button>
        </div>
        <div class="rules-body">
          <ul style="padding-left: 20px; font-size: 0.9rem; line-height: 1.6; color: var(--text-light); margin-top: 15px;">
            <li><strong>Goal:</strong> Be the first player to collect 3 complete property sets of different colors.</li>
            <li><strong>Your Turn:</strong> Draw 2 cards at the start. You can play up to 3 cards per turn.</li>
            <li><strong>Playing Cards:</strong> You can put money/action cards in your bank, play properties face up, or play action cards into the center.</li>
            <li><strong>Paying Rent:</strong> If you are charged rent or fees, you must pay from your bank or properties on the table. Cards in your hand cannot be used to pay!</li>
            <li><strong>Change:</strong> If you overpay a debt (e.g., pay 3M for a 2M debt), you do NOT get change back!</li>
            <li><strong>End of Turn:</strong> You can only have 7 cards in your hand at the end of your turn. You must discard any extras.</li>
            <li><strong>Drag and Drop:</strong> You can drag properties, wildcards, and houses directly from your hand to the board.</li>
          </ul>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('closeRules').onclick = () => {
      modal.classList.remove('open');
    };
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('open');
    }
  }
  
  // A small timeout allows the CSS transition to trigger when adding the class
  setTimeout(() => modal.classList.add('open'), 10);
}

async function emitAction(cardId, action) {
  state.selectedCard = null;
  const result = await emit('play-card', { cardId, action });
  if (result?.error) {
    showToast(`❌ ${result.error}`);
    render();
  }
}

function renderPaymentOverlay(me, debt) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const allCards = [...(me.bank || []), ...Object.values(me.properties || {}).flat()];
  const totalAssets = allCards.reduce((s, c) => s + (c.value || 0), 0);

  // Check for Just Say No
  const jsn = me.hand?.find(c => c.action === ACTION_TYPES.JUST_SAY_NO);

  // Use the persisted payment state
  const selected = paymentState.selectedCardIds;

  // Remove any selected IDs that no longer exist (e.g. stale state)
  for (const id of selected) {
    if (!allCards.find(c => c.id === id)) selected.delete(id);
  }

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
      const jsnBtn = makeBtn('🚫 Just Say No!', 'btn-danger', async () => {
        const result = await emit('just-say-no', { cardId: jsn.id });
        if (result?.error) { showToast(`❌ ${result.error}`); return; }
        paymentState.active = false;
        paymentState.selectedCardIds.clear();
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

    if (allCards.length > 0) {
      const payBtn = makeBtn(`💰 Pay ${selectedTotal}M`, 'btn-primary btn-lg', async () => {
        const result = await emit('pay-debt', { cardIds: [...selected] });
        if (result?.error) { showToast(`❌ ${result.error}`); return; }
        paymentState.active = false;
        paymentState.selectedCardIds.clear();
        overlay.remove();
      });
      // Disable pay button if you haven't selected enough and you have enough assets
      payBtn.disabled = selectedTotal < debt.amount && totalAssets >= debt.amount;
      if (payBtn.disabled) {
        payBtn.style.opacity = '0.5';
        payBtn.style.cursor = 'not-allowed';
      }
      panel.appendChild(payBtn);

      // Allow underpay if total assets < debt (you give everything)
      if (totalAssets < debt.amount && totalAssets > 0) {
        const payAllBtn = makeBtn(`Pay everything I have (${totalAssets}M)`, 'btn-secondary', async () => {
          const allIds = allCards.map(c => c.id);
          const result = await emit('pay-debt', { cardIds: allIds });
          if (result?.error) { showToast(`❌ ${result.error}`); return; }
          paymentState.active = false;
          paymentState.selectedCardIds.clear();
          overlay.remove();
        });
        panel.appendChild(payAllBtn);
      }
    }

    if (totalAssets === 0) {
      const nothingBtn = makeBtn("I have nothing to pay!", 'btn-secondary', async () => {
        const result = await emit('pay-debt', { cardIds: [] });
        if (result?.error) { showToast(`❌ ${result.error}`); return; }
        paymentState.active = false;
        paymentState.selectedCardIds.clear();
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

  const insightsHtml = gs?.players.map(p => {
    const totalBank = p.bank.reduce((sum, c) => sum + (c.value || 0), 0);
    const totalProps = Object.values(p.properties || {}).flat().length;
    return `
      <div class="insight-row ${p.id === gs.winner ? 'winner-row' : ''}">
        <div class="insight-name">${p.name} ${p.id === gs.winner ? '🏆' : ''}</div>
        <div class="insight-stat"><span>Sets:</span> ${p.setsCompleted}</div>
        <div class="insight-stat"><span>Properties:</span> ${totalProps}</div>
        <div class="insight-stat"><span>Bank:</span> ${totalBank}M</div>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="victory-screen">
      <div class="confetti-container" id="confetti"></div>
      <h1 class="victory-title">${isMe ? '🎉 You Win!' : '🏆 Game Over!'}</h1>
      <p class="victory-winner">${winner?.name || 'Unknown'} wins with ${winner?.setsCompleted || 3} complete sets!</p>
      
      <div class="insights-board glass-strong">
        <h3>Game Insights</h3>
        <div class="insights-list">
          ${insightsHtml}
        </div>
      </div>

      <button class="btn btn-primary btn-lg" onclick="location.reload()" style="margin-top: 24px;">🔄 Play Again</button>
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

function createModal(title, subtitle, contentEl) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'overlay-panel glass-strong';
    panel.innerHTML = `<h2>${title}</h2>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}`;
    
    panel.appendChild(contentEl);
    
    const cancelBtn = makeBtn('Cancel', 'btn-secondary', () => {
      overlay.remove();
      resolve(null);
    });
    cancelBtn.style.marginTop = '15px';
    panel.appendChild(cancelBtn);
    
    overlay.appendChild(panel);
    document.getElementById('app').appendChild(overlay);

    // Helper to resolve and close
    overlay._resolve = (val) => {
      overlay.remove();
      resolve(val);
    };
  });
}

async function promptTarget(opponents) {
  const div = document.createElement('div');
  div.style.display = 'flex'; div.style.flexDirection = 'column'; div.style.gap = '8px';
  opponents.forEach(p => {
    const b = makeBtn(p.name, 'btn-primary', function() { this.closest('.overlay')._resolve(p.id); });
    div.appendChild(b);
  });
  return createModal('Choose a Player', '', div);
}

async function promptColor() {
  return promptColorFromList(Object.keys(COLOR_NAMES));
}

async function promptColorFromList(colors) {
  const div = document.createElement('div');
  div.style.display = 'flex'; div.style.flexDirection = 'column'; div.style.gap = '8px';
  colors.forEach(c => {
    const b = makeBtn(COLOR_NAMES[c] || c, 'btn-primary', function() { this.closest('.overlay')._resolve(c); });
    b.style.backgroundColor = COLOR_HEX[c] || '#444';
    b.style.color = ['#fff', '#000'].includes(b.style.backgroundColor) ? (c==='railroad'?'#fff':'#000') : '#fff';
    div.appendChild(b);
  });
  return createModal('Choose a Color', '', div);
}

async function promptPropertyFromPlayer(player, msg = 'Select a property') {
  const allProps = Object.values(player.properties || {}).flat();
  if (allProps.length === 0) { showToast('No properties to select!'); return null; }
  
  const div = document.createElement('div');
  div.className = 'selectable-cards';
  allProps.forEach(c => {
    const el = renderCard(c, { onClick: () => {
      const ov = document.querySelector('.overlay');
      if (ov && ov._resolve) ov._resolve(c.id);
    }});
    div.appendChild(el);
  });
  return createModal(msg, `From ${player.name}'s properties`, div);
}

async function promptStealableProperty(player, msg) {
  const stealableProps = [];
  for (const [color, cards] of Object.entries(player.properties || {})) {
    const needed = SET_SIZES[color] || 2;
    if (cards.length < needed) stealableProps.push(...cards);
  }
  if (stealableProps.length === 0) { showToast('No eligible properties to select!'); return null; }
  
  const div = document.createElement('div');
  div.className = 'selectable-cards';
  stealableProps.forEach(c => {
    const el = renderCard(c, { onClick: () => {
      const ov = document.querySelector('.overlay');
      if (ov && ov._resolve) ov._resolve(c.id);
    }});
    div.appendChild(el);
  });
  return createModal(msg, `From ${player.name}'s properties`, div);
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
