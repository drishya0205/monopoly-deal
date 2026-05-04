import { createDeck, shuffleDeck, getCardValue } from '../shared/cardData.js';
import {
  PHASES, CARD_TYPES, ACTION_TYPES, COLORS, COLOR_NAMES,
  INITIAL_HAND_SIZE, CARDS_TO_DRAW, CARDS_TO_DRAW_EMPTY_HAND,
  MAX_PLAYS_PER_TURN, MAX_HAND_SIZE, SETS_TO_WIN,
  SET_SIZES, RENT_VALUES, HOUSE_RENT_BONUS, HOTEL_RENT_BONUS,
  DEBT_COLLECTOR_AMOUNT, BIRTHDAY_AMOUNT,
} from '../shared/constants.js';

export class GameEngine {
  constructor(players) {
    this.players = players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot || false,
      hand: [],
      bank: [],
      properties: {},
      setsCompleted: 0,
      connected: true,
    }));
    this.drawPile = [];
    this.discardPile = [];
    this.currentPlayerIndex = 0;
    this.phase = PHASES.DRAW;
    this.playsThisTurn = 0;
    this.pendingAction = null;
    this.winner = null;
    this.log = [];
  }

  // Initialize and deal
  startGame() {
    this.drawPile = shuffleDeck(createDeck());
    for (const player of this.players) {
      player.hand = this.drawPile.splice(0, INITIAL_HAND_SIZE);
    }
    this.phase = PHASES.DRAW;
    this.addLog(`Game started!`);
    return this.getState();
  }

  // Draw cards at start of turn
  drawCards(playerId) {
    const player = this.getPlayer(playerId);
    if (!player || this.phase !== PHASES.DRAW) return { error: 'Cannot draw now' };
    if (this.players[this.currentPlayerIndex].id !== playerId) return { error: 'Not your turn' };

    const count = player.hand.length === 0 ? CARDS_TO_DRAW_EMPTY_HAND : CARDS_TO_DRAW;
    this._refillDeckIfNeeded();
    const drawn = this.drawPile.splice(0, Math.min(count, this.drawPile.length));
    player.hand.push(...drawn);
    this.phase = PHASES.PLAY;
    this.playsThisTurn = 0;
    this.addLog(`${player.name} drew ${drawn.length} cards`);
    return { success: true, drawn };
  }

  // Play a card from hand
  playCard(playerId, cardId, action) {
    const player = this.getPlayer(playerId);
    if (!player) return { error: 'Player not found' };
    if (this.phase !== PHASES.PLAY) return { error: 'Cannot play now' };
    if (this.players[this.currentPlayerIndex].id !== playerId) return { error: 'Not your turn' };
    if (this.playsThisTurn >= MAX_PLAYS_PER_TURN) return { error: 'Max 3 plays per turn' };

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { error: 'Card not in hand' };
    const card = player.hand[cardIndex];

    // Determine what to do with the card
    const actionType = typeof action === 'string' ? action : action.type;
    
    if (actionType === 'bank') {
      return this._bankCard(player, cardIndex, card);
    } else if (actionType === 'property') {
      return this._playProperty(player, cardIndex, card, action);
    } else if (actionType === 'action') {
      return this._playAction(player, cardIndex, card, action);
    }
    return { error: 'Invalid action type' };
  }

  moveWildcard(playerId, cardId, newColor) {
    const player = this.getPlayer(playerId);
    if (!player) return { error: 'Player not found' };
    if (this.phase !== PHASES.PLAY) return { error: 'Cannot move cards outside play phase' };
    if (this.players[this.currentPlayerIndex].id !== playerId) return { error: 'Not your turn' };
    
    // Find the wildcard in properties
    let card, oldColor, idx;
    for (const [color, cards] of Object.entries(player.properties)) {
      idx = cards.findIndex(c => c.id === cardId);
      if (idx !== -1) {
        card = cards[idx];
        oldColor = color;
        break;
      }
    }

    if (!card) return { error: 'Card not found in your properties' };
    if (card.type !== CARD_TYPES.PROPERTY_WILDCARD) return { error: 'Card is not a wildcard' };
    if (card.colors !== 'all' && !card.colors.includes(newColor)) return { error: 'Invalid color for this wildcard' };
    if (oldColor === newColor) return { error: 'Card is already in that color set' };

    // Move it
    player.properties[oldColor].splice(idx, 1);
    card.activeColor = newColor;
    if (!player.properties[newColor]) player.properties[newColor] = [];
    player.properties[newColor].push(card);

    this._updateCompletedSets(player);
    this.addLog(`${player.name} moved a wildcard to ${COLOR_NAMES[newColor] || newColor}`);
    
    if (this._checkWin(player)) return { success: true, type: 'move_wildcard', winner: player.id };
    return { success: true, type: 'move_wildcard' };
  }

  _bankCard(player, cardIndex, card) {
    if (card.type === CARD_TYPES.PROPERTY) return { error: 'Cannot bank property cards' };
    if (card.type === CARD_TYPES.PROPERTY_WILDCARD && card.colors === 'all') return { error: 'Rainbow wildcards have no value' };
    player.hand.splice(cardIndex, 1);
    player.bank.push(card);
    this.playsThisTurn++;
    this.addLog(`${player.name} banked a ${card.value}M card`);
    this._checkAutoEndTurn(player);
    return { success: true, type: 'bank' };
  }

  _playProperty(player, cardIndex, card, action) {
    if (card.type !== CARD_TYPES.PROPERTY && card.type !== CARD_TYPES.PROPERTY_WILDCARD) {
      return { error: 'Not a property card' };
    }
    const color = card.type === CARD_TYPES.PROPERTY ? card.color : (action.color || card.activeColor || card.colors[0]);

    if (card.type === CARD_TYPES.PROPERTY_WILDCARD && card.colors !== 'all' && !card.colors.includes(color)) {
      return { error: `Invalid color! This wildcard is for ${COLOR_NAMES[card.colors[0]] || card.colors[0]} or ${COLOR_NAMES[card.colors[1]] || card.colors[1]}.` };
    }

    player.hand.splice(cardIndex, 1);
    if (!player.properties[color]) player.properties[color] = [];
    if (card.type === CARD_TYPES.PROPERTY_WILDCARD) card.activeColor = color;
    player.properties[color].push(card);
    this.playsThisTurn++;
    this._updateCompletedSets(player);
    this.addLog(`${player.name} played ${card.name || 'wildcard'} to ${COLOR_NAMES[color] || color}`);
    if (this._checkWin(player)) return { success: true, type: 'property', winner: player.id };
    this._checkAutoEndTurn(player);
    return { success: true, type: 'property' };
  }

  _playAction(player, cardIndex, card, action) {
    if (card.type !== CARD_TYPES.ACTION && card.type !== CARD_TYPES.RENT) {
      return { error: 'Not an action/rent card' };
    }

    // Remove card from hand optimistically
    player.hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    this.playsThisTurn++;

    let result;
    if (card.type === CARD_TYPES.RENT) {
      result = this._handleRent(player, card, action);
    } else {
      switch (card.action) {
        case ACTION_TYPES.PASS_GO:
          result = this._handlePassGo(player); break;
        case ACTION_TYPES.DEBT_COLLECTOR:
          result = this._handleDebtCollector(player, action); break;
        case ACTION_TYPES.BIRTHDAY:
          result = this._handleBirthday(player); break;
        case ACTION_TYPES.SLY_DEAL:
          result = this._handleSlyDeal(player, action); break;
        case ACTION_TYPES.FORCED_DEAL:
          result = this._handleForcedDeal(player, action); break;
        case ACTION_TYPES.DEAL_BREAKER:
          result = this._handleDealBreaker(player, action); break;
        case ACTION_TYPES.HOUSE:
          result = this._handleHouse(player, action, card); break;
        case ACTION_TYPES.HOTEL:
          result = this._handleHotel(player, action, card); break;
        case ACTION_TYPES.JUST_SAY_NO:
          result = { error: 'Just Say No is played as a response' }; break;
        case ACTION_TYPES.DOUBLE_RENT:
          result = { error: 'Double the Rent must be played with a Rent card' }; break;
        default:
          result = { error: 'Unknown action' }; break;
      }
    }

    // Rollback if the action failed — restore card to hand
    if (result?.error) {
      this.discardPile.pop();
      player.hand.splice(cardIndex, 0, card);
      this.playsThisTurn--;
    }

    return result;
  }

  _handlePassGo(player) {
    this._refillDeckIfNeeded();
    const drawn = this.drawPile.splice(0, Math.min(2, this.drawPile.length));
    player.hand.push(...drawn);
    this.addLog(`${player.name} played Pass Go and drew 2 cards`);
    this._checkAutoEndTurn(player);
    return { success: true, type: 'pass_go', drawn };
  }

  _handleRent(player, card, action) {
    const color = action.color;
    if (!color) return { error: 'Must specify color for rent' };
    const propCount = this._getPropertyCount(player, color);
    if (propCount === 0) return { error: 'No properties of that color' };
    let amount = RENT_VALUES[color] ? (RENT_VALUES[color][propCount - 1] || 0) : 0;

    // Check for house/hotel
    const props = player.properties[color] || [];
    if (props.some(c => c.action === ACTION_TYPES.HOUSE)) amount += HOUSE_RENT_BONUS;
    if (props.some(c => c.action === ACTION_TYPES.HOTEL)) amount += HOTEL_RENT_BONUS;

    if (action.doubled) amount *= 2;

    // Determine targets
    const isWildRent = card.colors === 'all';
    let targets;
    if (isWildRent) {
      // Wild rent targets one player
      targets = action.targetId ? [action.targetId] : [];
      if (targets.length === 0) return { error: 'Must specify target for wild rent' };
    } else {
      // Standard rent targets all other players
      targets = this.players.filter(p => p.id !== player.id).map(p => p.id);
    }

    this.pendingAction = {
      type: 'rent',
      sourceId: player.id,
      amount,
      color,
      targets: targets.map(t => ({ playerId: t, resolved: false, amount })),
    };
    this.phase = PHASES.PAYMENT;
    this.addLog(`${player.name} charges ${amount}M rent for ${COLOR_NAMES[color] || color}`);
    return { success: true, type: 'rent', amount, targets };
  }

  _handleDebtCollector(player, action) {
    if (!action.targetId) return { error: 'Must specify target' };
    this.pendingAction = {
      type: 'debt',
      sourceId: player.id,
      targets: [{ playerId: action.targetId, resolved: false, amount: DEBT_COLLECTOR_AMOUNT }],
    };
    this.phase = PHASES.PAYMENT;
    this.addLog(`${player.name} plays Debt Collector on ${this.getPlayer(action.targetId)?.name}`);
    return { success: true, type: 'debt', amount: DEBT_COLLECTOR_AMOUNT };
  }

  _handleBirthday(player) {
    const targets = this.players.filter(p => p.id !== player.id).map(p => ({
      playerId: p.id, resolved: false, amount: BIRTHDAY_AMOUNT,
    }));
    this.pendingAction = { type: 'birthday', sourceId: player.id, targets };
    this.phase = PHASES.PAYMENT;
    this.addLog(`${player.name} says It's My Birthday! Everyone pays 2M`);
    return { success: true, type: 'birthday', amount: BIRTHDAY_AMOUNT };
  }

  _handleSlyDeal(player, action) {
    if (!action.targetId || !action.targetCardId) return { error: 'Must specify target and card' };
    const target = this.getPlayer(action.targetId);
    if (!target) return { error: 'Target not found' };

    // Find the card in target's properties
    for (const [color, cards] of Object.entries(target.properties)) {
      if (this._isSetComplete(target, color)) continue; // Can't steal from complete set
      const idx = cards.findIndex(c => c.id === action.targetCardId);
      if (idx !== -1) {
        const stolen = cards.splice(idx, 1)[0];
        const destColor = stolen.type === CARD_TYPES.PROPERTY ? stolen.color : (stolen.activeColor || color);
        if (!player.properties[destColor]) player.properties[destColor] = [];
        player.properties[destColor].push(stolen);
        this._updateCompletedSets(player);
        this._updateCompletedSets(target);
        this.addLog(`${player.name} stole ${stolen.name || 'wildcard'} from ${target.name}`);
        if (this._checkWin(player)) return { success: true, type: 'sly_deal', winner: player.id };
        this._checkAutoEndTurn(player);
        return { success: true, type: 'sly_deal' };
      }
    }
    return { error: 'Card not found or in complete set' };
  }

  _handleForcedDeal(player, action) {
    if (!action.targetId || !action.targetCardId || !action.myCardId) {
      return { error: 'Must specify target, their card, and your card' };
    }
    const target = this.getPlayer(action.targetId);
    if (!target) return { error: 'Target not found' };

    let myCard = null, myColor = null, myIdx = -1;
    for (const [color, cards] of Object.entries(player.properties)) {
      if (this._isSetComplete(player, color)) continue;
      const idx = cards.findIndex(c => c.id === action.myCardId);
      if (idx !== -1) { myCard = cards[idx]; myColor = color; myIdx = idx; break; }
    }
    if (!myCard) return { error: 'Your card not found or in complete set' };

    let theirCard = null, theirColor = null, theirIdx = -1;
    for (const [color, cards] of Object.entries(target.properties)) {
      if (this._isSetComplete(target, color)) continue;
      const idx = cards.findIndex(c => c.id === action.targetCardId);
      if (idx !== -1) { theirCard = cards[idx]; theirColor = color; theirIdx = idx; break; }
    }
    if (!theirCard) return { error: 'Target card not found or in complete set' };

    // Swap
    player.properties[myColor].splice(myIdx, 1);
    target.properties[theirColor].splice(theirIdx, 1);
    const destColor1 = theirCard.type === CARD_TYPES.PROPERTY ? theirCard.color : (theirCard.activeColor || theirColor);
    const destColor2 = myCard.type === CARD_TYPES.PROPERTY ? myCard.color : (myCard.activeColor || myColor);
    if (!player.properties[destColor1]) player.properties[destColor1] = [];
    if (!target.properties[destColor2]) target.properties[destColor2] = [];
    player.properties[destColor1].push(theirCard);
    target.properties[destColor2].push(myCard);
    this._updateCompletedSets(player);
    this._updateCompletedSets(target);
    this.addLog(`${player.name} forced a deal with ${target.name}`);
    if (this._checkWin(player)) return { success: true, type: 'forced_deal', winner: player.id };
    this._checkAutoEndTurn(player);
    return { success: true, type: 'forced_deal' };
  }

  _handleDealBreaker(player, action) {
    if (!action.targetId || !action.targetColor) return { error: 'Must specify target and color' };
    const target = this.getPlayer(action.targetId);
    if (!target) return { error: 'Target not found' };
    if (!this._isSetComplete(target, action.targetColor)) return { error: 'Target set is not complete' };

    const stolen = target.properties[action.targetColor].splice(0);
    if (!player.properties[action.targetColor]) player.properties[action.targetColor] = [];
    player.properties[action.targetColor].push(...stolen);
    this._updateCompletedSets(player);
    this._updateCompletedSets(target);
    this.addLog(`${player.name} used Deal Breaker to steal ${COLOR_NAMES[action.targetColor] || action.targetColor} set from ${target.name}!`);
    if (this._checkWin(player)) return { success: true, type: 'deal_breaker', winner: player.id };
    this._checkAutoEndTurn(player);
    return { success: true, type: 'deal_breaker' };
  }

  _handleHouse(player, action, card) {
    if (!action.targetColor) return { error: 'Must specify color' };
    if (action.targetColor === COLORS.RAILROAD || action.targetColor === COLORS.UTILITY) {
      return { error: 'Cannot add house to Black/Mint Green' };
    }
    if (!this._isSetComplete(player, action.targetColor)) return { error: 'Set must be complete' };
    const props = player.properties[action.targetColor];
    if (props.some(c => c.action === ACTION_TYPES.HOUSE)) return { error: 'Already has a house' };
    
    // Remove from discard pile (it was pushed optimistically)
    this.discardPile.pop();
    props.push(card);
    
    this.addLog(`${player.name} built a House on ${COLOR_NAMES[action.targetColor] || action.targetColor}`);
    this._checkAutoEndTurn(player);
    return { success: true, type: 'house' };
  }

  _handleHotel(player, action, card) {
    if (!action.targetColor) return { error: 'Must specify color' };
    if (!this._isSetComplete(player, action.targetColor)) return { error: 'Set must be complete' };
    const props = player.properties[action.targetColor];
    if (!props.some(c => c.action === ACTION_TYPES.HOUSE)) return { error: 'Must have a house first' };
    if (props.some(c => c.action === ACTION_TYPES.HOTEL)) return { error: 'Already has a hotel' };
    
    // Remove from discard pile
    this.discardPile.pop();
    props.push(card);

    this.addLog(`${player.name} built a Hotel on ${COLOR_NAMES[action.targetColor] || action.targetColor}`);
    this._checkAutoEndTurn(player);
    return { success: true, type: 'hotel' };
  }

  // Payment resolution
  payDebt(playerId, cardIds) {
    if (this.phase !== PHASES.PAYMENT || !this.pendingAction) return { error: 'No payment pending' };
    const target = this.pendingAction.targets.find(t => t.playerId === playerId && !t.resolved);
    if (!target) return { error: 'No debt for you' };

    const player = this.getPlayer(playerId);
    const source = this.getPlayer(this.pendingAction.sourceId);
    const cards = [];

    for (const cid of cardIds) {
      // Check bank first
      let idx = player.bank.findIndex(c => c.id === cid);
      if (idx !== -1) { cards.push(player.bank.splice(idx, 1)[0]); continue; }
      // Check properties
      for (const [color, propCards] of Object.entries(player.properties)) {
        idx = propCards.findIndex(c => c.id === cid);
        if (idx !== -1) { cards.push(propCards.splice(idx, 1)[0]); break; }
      }
    }

    // Transfer cards to source (properties go to properties, others to bank)
    for (const card of cards) {
      if (card.type === CARD_TYPES.PROPERTY || card.type === CARD_TYPES.PROPERTY_WILDCARD) {
        const color = card.type === CARD_TYPES.PROPERTY ? card.color : (card.activeColor || card.colors[0]);
        if (!source.properties[color]) source.properties[color] = [];
        if (card.type === CARD_TYPES.PROPERTY_WILDCARD) card.activeColor = color;
        source.properties[color].push(card);
      } else {
        source.bank.push(card);
      }
    }
    
    target.resolved = true;
    this._updateCompletedSets(player);
    this._updateCompletedSets(source);

    const totalPaid = cards.reduce((sum, c) => sum + getCardValue(c), 0);
    this.addLog(`${player.name} paid ${totalPaid}M to ${source.name}`);

    // Check if all payments resolved
    if (this.pendingAction.targets.every(t => t.resolved)) {
      this.pendingAction = null;
      this.phase = PHASES.PLAY;
      this._checkAutoEndTurn(this.players[this.currentPlayerIndex]);
    }
    return { success: true, paid: totalPaid };
  }

  // Can also pay with nothing if you have nothing
  payNothing(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) return { error: 'Player not found' };
    const totalAssets = player.bank.length + Object.values(player.properties).flat().length;
    if (totalAssets > 0) return { error: 'You have assets to pay with' };
    return this.payDebt(playerId, []);
  }

  // End turn
  endTurn(playerId) {
    if (this.players[this.currentPlayerIndex].id !== playerId) return { error: 'Not your turn' };
    if (this.phase !== PHASES.PLAY) return { error: 'Cannot end turn now' };

    const player = this.getPlayer(playerId);
    // Discard excess cards
    if (player.hand.length > MAX_HAND_SIZE) {
      return { error: 'Must discard to 7 cards first', needsDiscard: true, excess: player.hand.length - MAX_HAND_SIZE };
    }

    this._advanceTurn();
    return { success: true };
  }

  discardCards(playerId, cardIds) {
    const player = this.getPlayer(playerId);
    if (!player) return { error: 'Player not found' };
    if (this.players[this.currentPlayerIndex].id !== playerId) return { error: 'Not your turn' };

    for (const cid of cardIds) {
      const idx = player.hand.findIndex(c => c.id === cid);
      if (idx !== -1) {
        this.discardPile.push(player.hand.splice(idx, 1)[0]);
      }
    }

    if (player.hand.length <= MAX_HAND_SIZE) {
      this._advanceTurn();
      return { success: true };
    }
    return { success: true, stillNeedsDiscard: true, excess: player.hand.length - MAX_HAND_SIZE };
  }

  // Just Say No
  respondJustSayNo(playerId, cardId) {
    // For simplicity in v1, Just Say No cancels the pending action targeting this player
    const player = this.getPlayer(playerId);
    if (!player) return { error: 'Player not found' };
    const idx = player.hand.findIndex(c => c.id === cardId && c.action === ACTION_TYPES.JUST_SAY_NO);
    if (idx === -1) return { error: 'No Just Say No card' };

    player.hand.splice(idx, 1);
    if (this.pendingAction) {
      const target = this.pendingAction.targets.find(t => t.playerId === playerId && !t.resolved);
      if (target) {
        target.resolved = true;
        target.blocked = true;
        this.addLog(`${player.name} played Just Say No!`);
      }
      if (this.pendingAction.targets.every(t => t.resolved)) {
        this.pendingAction = null;
        this.phase = PHASES.PLAY;
      }
    }
    return { success: true };
  }

  // --- Helpers ---

  _advanceTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.playsThisTurn = 0;
    this.phase = PHASES.DRAW;
    this.addLog(`It's ${this.players[this.currentPlayerIndex].name}'s turn`);
  }

  _checkAutoEndTurn(player) {
    if (this.playsThisTurn >= MAX_PLAYS_PER_TURN && this.phase === PHASES.PLAY) {
      if (player.hand.length > MAX_HAND_SIZE) {
        this.phase = PHASES.DISCARD;
      } else {
        // All plays used and hand size is fine — auto-advance the turn
        this._advanceTurn();
      }
    }
  }

  _refillDeckIfNeeded() {
    if (this.drawPile.length === 0 && this.discardPile.length > 0) {
      this.drawPile = shuffleDeck(this.discardPile);
      this.discardPile = [];
    }
  }

  _getPropertyCount(player, color) {
    return (player.properties[color] || []).filter(c =>
      c.type === CARD_TYPES.PROPERTY || c.type === CARD_TYPES.PROPERTY_WILDCARD
    ).length;
  }

  _isSetComplete(player, color) {
    const needed = SET_SIZES[color];
    if (!needed) return false;
    return this._getPropertyCount(player, color) >= needed;
  }

  _updateCompletedSets(player) {
    let count = 0;
    for (const color of Object.values(COLORS)) {
      if (this._isSetComplete(player, color)) count++;
    }
    player.setsCompleted = count;
  }

  _checkWin(player) {
    if (player.setsCompleted >= SETS_TO_WIN) {
      this.phase = PHASES.GAME_OVER;
      this.winner = player.id;
      this.addLog(`🎉 ${player.name} wins with ${player.setsCompleted} complete sets!`);
      return true;
    }
    return false;
  }

  getPlayer(id) {
    return this.players.find(p => p.id === id);
  }

  addLog(msg) {
    this.log.push({ msg, time: Date.now() });
    if (this.log.length > 100) this.log.shift();
  }

  // Get state filtered for a specific player (hides other hands)
  getStateForPlayer(playerId) {
    return {
      phase: this.phase,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.players[this.currentPlayerIndex].id,
      playsThisTurn: this.playsThisTurn,
      playsRemaining: MAX_PLAYS_PER_TURN - this.playsThisTurn,
      drawPileCount: this.drawPile.length,
      discardPile: this.discardPile.slice(-3),
      pendingAction: this.pendingAction,
      winner: this.winner,
      log: this.log.slice(-20),
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        handCount: p.hand.length,
        hand: p.id === playerId ? p.hand : undefined,
        bank: p.bank,
        properties: p.properties,
        setsCompleted: p.setsCompleted,
        connected: p.connected,
      })),
    };
  }

  getState() {
    return this.getStateForPlayer(null);
  }
}
