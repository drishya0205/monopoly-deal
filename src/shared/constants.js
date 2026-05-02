// ============================================================
// Game Constants for Monopoly Deal
// ============================================================

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const INITIAL_HAND_SIZE = 5;
export const CARDS_TO_DRAW = 2;
export const CARDS_TO_DRAW_EMPTY_HAND = 5;
export const MAX_PLAYS_PER_TURN = 3;
export const MAX_HAND_SIZE = 7;
export const SETS_TO_WIN = 3;

// House and Hotel rent bonuses
export const HOUSE_RENT_BONUS = 3;
export const HOTEL_RENT_BONUS = 4;

// Action card charge amounts
export const DEBT_COLLECTOR_AMOUNT = 5;
export const BIRTHDAY_AMOUNT = 2;

// Reconnection timeout (ms)
export const RECONNECT_TIMEOUT = 60000;

// Turn phases
export const PHASES = {
  WAITING: 'waiting',
  DRAW: 'draw',
  PLAY: 'play',
  ACTION_RESOLUTION: 'action_resolution',
  PAYMENT: 'payment',
  DISCARD: 'discard',
  GAME_OVER: 'game_over',
};

// Card types
export const CARD_TYPES = {
  PROPERTY: 'property',
  PROPERTY_WILDCARD: 'property_wildcard',
  MONEY: 'money',
  ACTION: 'action',
  RENT: 'rent',
};

// Action card subtypes
export const ACTION_TYPES = {
  DEAL_BREAKER: 'deal_breaker',
  JUST_SAY_NO: 'just_say_no',
  SLY_DEAL: 'sly_deal',
  FORCED_DEAL: 'forced_deal',
  DEBT_COLLECTOR: 'debt_collector',
  BIRTHDAY: 'birthday',
  PASS_GO: 'pass_go',
  HOUSE: 'house',
  HOTEL: 'hotel',
  DOUBLE_RENT: 'double_rent',
};

// Property colors
export const COLORS = {
  BROWN: 'brown',
  LIGHT_BLUE: 'light_blue',
  PINK: 'pink',
  ORANGE: 'orange',
  RED: 'red',
  YELLOW: 'yellow',
  GREEN: 'green',
  DARK_BLUE: 'dark_blue',
  RAILROAD: 'railroad',
  UTILITY: 'utility',
};

// How many properties needed for a full set
export const SET_SIZES = {
  [COLORS.BROWN]: 2,
  [COLORS.LIGHT_BLUE]: 3,
  [COLORS.PINK]: 3,
  [COLORS.ORANGE]: 3,
  [COLORS.RED]: 3,
  [COLORS.YELLOW]: 3,
  [COLORS.GREEN]: 3,
  [COLORS.DARK_BLUE]: 2,
  [COLORS.RAILROAD]: 4,
  [COLORS.UTILITY]: 2,
};

// Rent values by color: index = number of properties owned - 1
export const RENT_VALUES = {
  [COLORS.BROWN]:      [1, 2],
  [COLORS.LIGHT_BLUE]: [1, 2, 3],
  [COLORS.PINK]:       [1, 2, 4],
  [COLORS.ORANGE]:     [1, 3, 5],
  [COLORS.RED]:        [2, 3, 6],
  [COLORS.YELLOW]:     [2, 4, 6],
  [COLORS.GREEN]:      [2, 4, 7],
  [COLORS.DARK_BLUE]:  [3, 8],
  [COLORS.RAILROAD]:   [1, 2, 3, 4],
  [COLORS.UTILITY]:    [1, 2],
};

// Display colors (CSS) for each property color
export const COLOR_HEX = {
  [COLORS.BROWN]:      '#8B4513',
  [COLORS.LIGHT_BLUE]: '#87CEEB',
  [COLORS.PINK]:       '#FF69B4',
  [COLORS.ORANGE]:     '#FF8C00',
  [COLORS.RED]:        '#DC143C',
  [COLORS.YELLOW]:     '#FFD700',
  [COLORS.GREEN]:      '#228B22',
  [COLORS.DARK_BLUE]:  '#00008B',
  [COLORS.RAILROAD]:   '#000000',
  [COLORS.UTILITY]:    '#98FF98',
};

// Display names for colors
export const COLOR_NAMES = {
  [COLORS.BROWN]:      'Brown',
  [COLORS.LIGHT_BLUE]: 'Light Blue',
  [COLORS.PINK]:       'Pink',
  [COLORS.ORANGE]:     'Orange',
  [COLORS.RED]:        'Red',
  [COLORS.YELLOW]:     'Yellow',
  [COLORS.GREEN]:      'Green',
  [COLORS.DARK_BLUE]:  'Dark Blue',
  [COLORS.RAILROAD]:   'Black',
  [COLORS.UTILITY]:    'Mint Green',
};

// Property names by color
export const PROPERTY_NAMES = {
  [COLORS.BROWN]:      ['Mediterranean Avenue', 'Baltic Avenue'],
  [COLORS.LIGHT_BLUE]: ['Oriental Avenue', 'Vermont Avenue', 'Connecticut Avenue'],
  [COLORS.PINK]:       ['St. Charles Place', 'States Avenue', 'Virginia Avenue'],
  [COLORS.ORANGE]:     ['St. James Place', 'Tennessee Avenue', 'New York Avenue'],
  [COLORS.RED]:        ['Kentucky Avenue', 'Indiana Avenue', 'Illinois Avenue'],
  [COLORS.YELLOW]:     ['Atlantic Avenue', 'Ventnor Avenue', 'Marvin Gardens'],
  [COLORS.GREEN]:      ['Pacific Avenue', 'North Carolina Avenue', 'Pennsylvania Avenue'],
  [COLORS.DARK_BLUE]:  ['Park Place', 'Boardwalk'],
  [COLORS.RAILROAD]:   ['Reading Railroad', 'Pennsylvania Railroad', 'B&O Railroad', 'Short Line'],
  [COLORS.UTILITY]:    ['Electric Company', 'Water Works'],
};
