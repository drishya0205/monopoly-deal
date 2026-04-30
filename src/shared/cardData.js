// ============================================================
// Complete Monopoly Deal Card Database — All 110 Cards
// ============================================================
// Each card has a unique `id`, a `type`, and type-specific fields.
// This file is shared between client and server.

import { CARD_TYPES, ACTION_TYPES, COLORS, PROPERTY_NAMES } from './constants.js';

// Helper to generate unique IDs
let _nextId = 1;
const uid = () => `card_${_nextId++}`;

// ------------------------------------------------------------------
// Property Cards (28 total)
// ------------------------------------------------------------------
function createPropertyCards() {
  const cards = [];
  for (const [color, names] of Object.entries(PROPERTY_NAMES)) {
    for (const name of names) {
      cards.push({
        id: uid(),
        type: CARD_TYPES.PROPERTY,
        color,
        name,
        value: getPropertyValue(color),
      });
    }
  }
  return cards;
}

// Property card monetary values (when used as payment)
function getPropertyValue(color) {
  const values = {
    [COLORS.BROWN]: 1,
    [COLORS.LIGHT_BLUE]: 1,
    [COLORS.PINK]: 2,
    [COLORS.ORANGE]: 2,
    [COLORS.RED]: 3,
    [COLORS.YELLOW]: 3,
    [COLORS.GREEN]: 4,
    [COLORS.DARK_BLUE]: 4,
    [COLORS.RAILROAD]: 2,
    [COLORS.UTILITY]: 2,
  };
  return values[color] || 1;
}

// ------------------------------------------------------------------
// Property Wildcard Cards (11 total)
// ------------------------------------------------------------------
function createWildcardCards() {
  const wildcards = [
    // Bi-color wildcards (9)
    { colors: [COLORS.LIGHT_BLUE, COLORS.BROWN], value: 1 },
    { colors: [COLORS.LIGHT_BLUE, COLORS.RAILROAD], value: 4 },
    { colors: [COLORS.PINK, COLORS.ORANGE], value: 2 },
    { colors: [COLORS.PINK, COLORS.ORANGE], value: 2 },
    { colors: [COLORS.RED, COLORS.YELLOW], value: 3 },
    { colors: [COLORS.RED, COLORS.YELLOW], value: 3 },
    { colors: [COLORS.DARK_BLUE, COLORS.GREEN], value: 4 },
    { colors: [COLORS.GREEN, COLORS.RAILROAD], value: 4 },
    { colors: [COLORS.RAILROAD, COLORS.UTILITY], value: 2 },
    // Rainbow wildcards (2) — no monetary value
    { colors: 'all', value: 0 },
    { colors: 'all', value: 0 },
  ];

  return wildcards.map((w) => ({
    id: uid(),
    type: CARD_TYPES.PROPERTY_WILDCARD,
    colors: w.colors,
    value: w.value,
    // activeColor is set when played (first of the pair by default)
    activeColor: w.colors === 'all' ? null : w.colors[0],
  }));
}

// ------------------------------------------------------------------
// Money Cards (20 total)
// ------------------------------------------------------------------
function createMoneyCards() {
  const denominations = [
    { value: 1, count: 6 },
    { value: 2, count: 5 },
    { value: 3, count: 3 },
    { value: 4, count: 3 },
    { value: 5, count: 2 },
    { value: 10, count: 1 },
  ];

  const cards = [];
  for (const { value, count } of denominations) {
    for (let i = 0; i < count; i++) {
      cards.push({
        id: uid(),
        type: CARD_TYPES.MONEY,
        value,
      });
    }
  }
  return cards;
}

// ------------------------------------------------------------------
// Action Cards (34 total)
// ------------------------------------------------------------------
function createActionCards() {
  const actions = [
    { action: ACTION_TYPES.DEAL_BREAKER, count: 2, value: 5, label: 'Deal Breaker', description: 'Steal a complete set from any player' },
    { action: ACTION_TYPES.JUST_SAY_NO, count: 3, value: 4, label: 'Just Say No', description: 'Cancel an action played against you' },
    { action: ACTION_TYPES.SLY_DEAL, count: 3, value: 3, label: 'Sly Deal', description: 'Steal a property from any player (not from a full set)' },
    { action: ACTION_TYPES.FORCED_DEAL, count: 4, value: 3, label: 'Forced Deal', description: 'Swap one of your properties with another player\'s (not from a full set)' },
    { action: ACTION_TYPES.DEBT_COLLECTOR, count: 3, value: 3, label: 'Debt Collector', description: 'Force one player to pay you 5M' },
    { action: ACTION_TYPES.BIRTHDAY, count: 3, value: 2, label: 'It\'s My Birthday', description: 'All players pay you 2M' },
    { action: ACTION_TYPES.PASS_GO, count: 10, value: 1, label: 'Pass Go', description: 'Draw 2 extra cards' },
    { action: ACTION_TYPES.HOUSE, count: 3, value: 3, label: 'House', description: 'Add to a full set to increase rent by 3M' },
    { action: ACTION_TYPES.HOTEL, count: 2, value: 4, label: 'Hotel', description: 'Add to a full set with a House to increase rent by 4M' },
    { action: ACTION_TYPES.DOUBLE_RENT, count: 2, value: 1, label: 'Double the Rent', description: 'Play with a Rent card to double the amount' },
  ];

  const cards = [];
  for (const a of actions) {
    for (let i = 0; i < a.count; i++) {
      cards.push({
        id: uid(),
        type: CARD_TYPES.ACTION,
        action: a.action,
        value: a.value,
        label: a.label,
        description: a.description,
      });
    }
  }
  return cards;
}

// ------------------------------------------------------------------
// Rent Cards (13 total)
// ------------------------------------------------------------------
function createRentCards() {
  const rents = [
    // Two-color rent cards (2 each = 10 total)
    { colors: [COLORS.DARK_BLUE, COLORS.GREEN], count: 2, value: 1 },
    { colors: [COLORS.RED, COLORS.YELLOW], count: 2, value: 1 },
    { colors: [COLORS.PINK, COLORS.ORANGE], count: 2, value: 1 },
    { colors: [COLORS.LIGHT_BLUE, COLORS.BROWN], count: 2, value: 1 },
    { colors: [COLORS.RAILROAD, COLORS.UTILITY], count: 2, value: 1 },
    // Wild rent cards (3 total)
    { colors: 'all', count: 3, value: 3 },
  ];

  const cards = [];
  for (const r of rents) {
    for (let i = 0; i < r.count; i++) {
      cards.push({
        id: uid(),
        type: CARD_TYPES.RENT,
        colors: r.colors,
        value: r.value,
      });
    }
  }
  return cards;
}

// ------------------------------------------------------------------
// Full Deck Generator
// ------------------------------------------------------------------
export function createDeck() {
  _nextId = 1; // Reset IDs for consistency
  const deck = [
    ...createPropertyCards(),
    ...createWildcardCards(),
    ...createMoneyCards(),
    ...createActionCards(),
    ...createRentCards(),
  ];
  return deck;
}

// Fisher-Yates shuffle (in-place)
export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Get a card's monetary value (for payment purposes)
export function getCardValue(card) {
  return card.value || 0;
}

// Check if a card can be banked (used as money)
export function canBankCard(card) {
  // Rainbow wildcards have 0 value and can't be banked
  if (card.type === CARD_TYPES.PROPERTY_WILDCARD && card.colors === 'all') {
    return false;
  }
  // Regular property cards can't be banked (but can be used as payment)
  if (card.type === CARD_TYPES.PROPERTY) {
    return false;
  }
  return card.value > 0;
}
