import { CARD_TYPES, COLOR_HEX, COLOR_NAMES, RENT_VALUES, SET_SIZES } from '../../shared/constants.js';

const PROP_COLORS = {
  brown: '#8B4513', light_blue: '#87CEEB', pink: '#E91E90', orange: '#FF8C00',
  red: '#DC143C', yellow: '#FFD700', green: '#228B22', dark_blue: '#1a1acd',
  railroad: '#000000', utility: '#98FF98',
};

export function renderCard(card, opts = {}) {
  const { selected, onClick, mini, disabled } = opts;
  if (mini) return renderMiniCard(card, opts);

  const el = document.createElement('div');
  el.className = `card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} animate-in`;
  el.dataset.cardId = card.id;
  if (onClick) el.addEventListener('click', () => onClick(card));

  switch (card.type) {
    case CARD_TYPES.PROPERTY:
      el.classList.add('card-property');
      el.innerHTML = buildPropertyCard(card);
      break;
    case CARD_TYPES.PROPERTY_WILDCARD:
      el.classList.add('card-wildcard');
      if (card.colors === 'all') el.classList.add('rainbow');
      el.innerHTML = buildWildcardCard(card);
      if (card.colors !== 'all') {
        el.style.setProperty('--wc-color1', PROP_COLORS[card.colors[0]] || '#888');
        el.style.setProperty('--wc-color2', PROP_COLORS[card.colors[1]] || '#aaa');
      }
      break;
    case CARD_TYPES.MONEY:
      el.classList.add('card-money');
      el.innerHTML = buildMoneyCard(card);
      break;
    case CARD_TYPES.ACTION:
      el.classList.add('card-action');
      el.innerHTML = buildActionCard(card);
      break;
    case CARD_TYPES.RENT:
      el.classList.add('card-rent');
      el.innerHTML = buildRentCard(card);
      break;
  }

  return el;
}

function buildPropertyCard(card) {
  const color = PROP_COLORS[card.color] || '#888';
  const name = COLOR_NAMES[card.color] || card.color;
  const rents = RENT_VALUES[card.color] || [];
  const setSize = SET_SIZES[card.color] || 2;

  return `
    <div class="card-value">${card.value}M</div>
    <div class="card-header" style="background: ${color}">${name}</div>
    <div class="card-body">
      <div class="card-name">${card.name}</div>
      <div class="card-footer" style="margin-top: auto;">
        ${rents.map((r, i) => `<span class="rent-dot" style="opacity:${i < setSize ? 1 : 0.3}">${i + 1}→${r}M</span>`).join(' ')}
      </div>
    </div>
  `;
}

function buildWildcardCard(card) {
  if (card.colors === 'all') {
    return `
      <div class="card-header">🌈 WILD</div>
      <div class="card-body">
        <div class="card-name">Property<br>Wildcard</div>
        <div class="card-description">Use as any color</div>
      </div>
    `;
  }
  const c1 = COLOR_NAMES[card.colors[0]] || card.colors[0];
  const c2 = COLOR_NAMES[card.colors[1]] || card.colors[1];
  return `
    <div class="card-value">${card.value}M</div>
    <div class="card-header">${c1} / ${c2}</div>
    <div class="card-body">
      <div class="card-name">Property<br>Wildcard</div>
      <div class="card-description">${c1} or ${c2}</div>
    </div>
  `;
}

function buildMoneyCard(card) {
  return `
    <div class="card-header">MONEY</div>
    <div class="card-body">
      <div class="money-amount">${card.value}M</div>
      <div class="money-label">Million</div>
    </div>
  `;
}

function buildActionCard(card) {
  const icons = {
    deal_breaker: '💥', just_say_no: '🚫', sly_deal: '🦊', forced_deal: '🔄',
    debt_collector: '💰', birthday: '🎂', pass_go: '▶️', house: '🏠', hotel: '🏨',
    double_rent: '✖️2',
  };
  return `
    <div class="card-value">${card.value}M</div>
    <div class="card-header">${icons[card.action] || '⚡'} ACTION</div>
    <div class="card-body">
      <div class="card-name">${card.label}</div>
      <div class="card-description">${card.description}</div>
    </div>
  `;
}

function buildRentCard(card) {
  if (card.colors === 'all') {
    return `
      <div class="card-value">${card.value}M</div>
      <div class="card-header" style="background: linear-gradient(90deg, #DC143C, #FF8C00, #FFD700, #228B22, #1a1acd)">WILD RENT</div>
      <div class="card-body">
        <div class="card-name">Rent</div>
        <div class="card-description">Charge one player rent for any color</div>
      </div>
    `;
  }
  const c1 = PROP_COLORS[card.colors[0]] || '#888';
  const c2 = PROP_COLORS[card.colors[1]] || '#aaa';
  const n1 = COLOR_NAMES[card.colors[0]] || '';
  const n2 = COLOR_NAMES[card.colors[1]] || '';
  return `
    <div class="card-value">${card.value}M</div>
    <div class="card-header" style="background: linear-gradient(90deg, ${c1}, ${c2})">${n1} / ${n2}</div>
    <div class="card-body">
      <div class="card-name">Rent</div>
      <div class="card-description">Charge all players rent</div>
    </div>
  `;
}

function renderMiniCard(card, opts = {}) {
  const el = document.createElement('div');
  el.className = 'mini-card';
  if (opts.complete) el.classList.add('complete');
  if (opts.onClick) el.addEventListener('click', () => opts.onClick(card));

  let bg = '#888';
  let label = '';

  if (card.type === CARD_TYPES.PROPERTY) {
    bg = PROP_COLORS[card.color] || '#888';
    label = card.name?.split(' ').map(w => w[0]).join('') || '?';
  } else if (card.type === CARD_TYPES.PROPERTY_WILDCARD) {
    if (card.colors === 'all') {
      bg = 'linear-gradient(135deg, #DC143C, #228B22, #1a1acd)';
      label = '🌈';
    } else {
      bg = `linear-gradient(135deg, ${PROP_COLORS[card.colors[0]]}, ${PROP_COLORS[card.colors[1]]})`;
      label = 'W';
    }
  }

  el.style.background = bg;
  el.textContent = label;
  el.dataset.cardId = card.id;
  return el;
}

export function renderCardBack(count) {
  const el = document.createElement('div');
  el.className = 'card-back';
  el.innerHTML = `M.D.${count != null ? `<span class="count">${count}</span>` : ''}`;
  return el;
}
