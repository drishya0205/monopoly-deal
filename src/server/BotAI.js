import { CARD_TYPES, ACTION_TYPES, PHASES, COLORS, SET_SIZES } from '../shared/constants.js';

/**
 * Simple Bot AI for Monopoly Deal.
 * Strategy: play properties first, bank money, use action cards opportunistically.
 */
export class BotAI {
  static takeTurn(game, botId) {
    const actions = [];
    const player = game.getPlayer(botId);
    if (!player) return actions;

    // Draw phase
    if (game.phase === PHASES.DRAW) {
      game.drawCards(botId);
      actions.push({ type: 'draw' });
    }

    // Play phase — play up to 3 cards
    let safety = 0;
    while (game.phase === PHASES.PLAY && game.playsThisTurn < 3 && player.hand.length > 0 && safety < 10) {
      safety++;
      const played = BotAI._playBestCard(game, player);
      if (played) {
        actions.push(played);
      } else {
        break;
      }
    }

    // End turn (discard if needed)
    if (game.phase === PHASES.PLAY || game.phase === PHASES.DISCARD) {
      const result = game.endTurn(botId);
      if (result.needsDiscard) {
        // Discard lowest value cards
        const sorted = [...player.hand].sort((a, b) => (a.value || 0) - (b.value || 0));
        const toDiscard = sorted.slice(0, result.excess).map(c => c.id);
        game.discardCards(botId, toDiscard);
      }
      actions.push({ type: 'end_turn' });
    }

    return actions;
  }

  static _playBestCard(game, player) {
    // Priority 1: Play property cards
    const props = player.hand.filter(c => c.type === CARD_TYPES.PROPERTY);
    if (props.length > 0) {
      const card = props[0];
      const result = game.playCard(player.id, card.id, 'property');
      if (result.success) return { type: 'property', cardId: card.id };
    }

    // Priority 2: Play property wildcards
    const wilds = player.hand.filter(c => c.type === CARD_TYPES.PROPERTY_WILDCARD);
    if (wilds.length > 0) {
      const card = wilds[0];
      const color = card.colors === 'all' ? BotAI._bestColorForWild(player) : card.colors[0];
      const result = game.playCard(player.id, card.id, { ...{ type: 'property' }, color });
      if (result.success) return { type: 'property', cardId: card.id };
      // Try as regular property action
      game.playCard(player.id, card.id, 'property');
    }

    // Priority 3: Play Pass Go
    const passGo = player.hand.find(c => c.action === ACTION_TYPES.PASS_GO);
    if (passGo) {
      const result = game.playCard(player.id, passGo.id, 'action');
      if (result.success) return { type: 'action', cardId: passGo.id, action: 'pass_go' };
    }

    // Priority 4: Play rent if we have properties
    const rentCards = player.hand.filter(c => c.type === CARD_TYPES.RENT);
    for (const rc of rentCards) {
      const colors = rc.colors === 'all' ? Object.values(COLORS) : rc.colors;
      for (const color of (Array.isArray(colors) ? colors : [colors])) {
        const count = (player.properties[color] || []).length;
        if (count > 0) {
          const others = game.players.filter(p => p.id !== player.id);
          const targetId = rc.colors === 'all' && others.length > 0 ? others[0].id : undefined;
          const result = game.playCard(player.id, rc.id, { type: 'action', color, targetId });
          if (result.success) return { type: 'action', cardId: rc.id, action: 'rent' };
        }
      }
    }

    // Priority 5: Bank money/action cards
    const bankable = player.hand.filter(c =>
      c.type === CARD_TYPES.MONEY ||
      (c.type === CARD_TYPES.ACTION && c.action !== ACTION_TYPES.JUST_SAY_NO)
    );
    if (bankable.length > 0) {
      const card = bankable[0];
      const result = game.playCard(player.id, card.id, 'bank');
      if (result.success) return { type: 'bank', cardId: card.id };
    }

    return null;
  }

  static _bestColorForWild(player) {
    // Pick color closest to completion
    let best = COLORS.BROWN;
    let bestScore = -1;
    for (const color of Object.values(COLORS)) {
      const have = (player.properties[color] || []).length;
      const need = SET_SIZES[color];
      const score = have / need;
      if (score > bestScore && score < 1) {
        bestScore = score;
        best = color;
      }
    }
    return best;
  }

  static handlePayment(game, botId) {
    const player = game.getPlayer(botId);
    if (!player) return;

    const pending = game.pendingAction?.targets?.find(t => t.playerId === botId && !t.resolved);
    if (!pending) return;

    // Check for Just Say No
    const jsn = player.hand.find(c => c.action === ACTION_TYPES.JUST_SAY_NO);
    if (jsn && pending.amount >= 5) {
      game.respondJustSayNo(botId, jsn.id);
      return;
    }

    // Pay with bank first, then cheapest properties
    const available = [
      ...player.bank.map(c => ({ ...c, source: 'bank' })),
      ...Object.values(player.properties).flat().map(c => ({ ...c, source: 'property' })),
    ].sort((a, b) => (a.value || 0) - (b.value || 0));

    let total = 0;
    const payWith = [];
    for (const card of available) {
      if (total >= pending.amount) break;
      payWith.push(card.id);
      total += card.value || 0;
    }

    if (payWith.length === 0) {
      game.payNothing(botId);
    } else {
      game.payDebt(botId, payWith);
    }
  }
}
