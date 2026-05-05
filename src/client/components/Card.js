import { CARD_TYPES, COLOR_HEX, COLOR_NAMES, RENT_VALUES, SET_SIZES, ACTION_TYPES } from '../../shared/constants.js';

const PROP_COLORS = {
  brown: '#8B4513', light_blue: '#87CEEB', pink: '#E91E90', orange: '#FF8C00',
  red: '#DC143C', yellow: '#FFD700', green: '#228B22', dark_blue: '#1a1acd',
  railroad: '#2d2d2d', utility: '#98FF98',
};

const PROP_ICONS = {
  brown: '🏚️', light_blue: '🏠', pink: '🏡', orange: '🏘️',
  red: '🏢', yellow: '🏬', green: '🏗️', dark_blue: '🏰',
  railroad: '🚂', utility: '💡',
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
  const icon = PROP_ICONS[card.color] || '🏠';

  return `
    <div class="card-inner">
      <div class="card-border" style="border-color: ${color}40"></div>
      <div class="card-glare"></div>
      <div class="card-header" style="background: ${color}">
        <span class="header-icon">${icon}</span>
        <span class="header-text">${name}</span>
      </div>
      <div class="card-body">
        <div class="card-name">${card.name}</div>
      </div>
      <div class="card-footer">
        <div class="value-badge">${card.value}M</div>
        <div class="rent-table">
          ${rents.map((r, i) => `
            <div class="rent-row ${i < setSize ? 'active' : ''}">
              <span class="rent-houses">${i === 0 ? 'Base' : i + '🏠'}</span>
              <span class="rent-val">${r}M</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function buildWildcardCard(card) {
  if (card.colors === 'all') {
    return `
      <div class="card-inner">
        <div class="card-glare"></div>
        <div class="card-header rainbow-header">
          <span class="header-icon">🌈</span>
          <span class="header-text">WILD</span>
        </div>
        <div class="card-body wildcard-body">
          <div class="wildcard-symbol">✨</div>
          <div class="card-name">Any Property</div>
        </div>
        <div class="card-footer">
          <div class="value-badge wildcard-value">—</div>
          <div class="wildcard-desc">Use as any color</div>
        </div>
      </div>
    `;
  }
  const c1 = COLOR_NAMES[card.colors[0]] || card.colors[0];
  const c2 = COLOR_NAMES[card.colors[1]] || card.colors[1];
  const icon1 = PROP_ICONS[card.colors[0]] || '🏠';
  const icon2 = PROP_ICONS[card.colors[1]] || '🏠';
  return `
    <div class="card-inner">
      <div class="card-glare"></div>
      <div class="card-header wildcard-header">
        <span class="header-icon">${icon1} ${icon2}</span>
        <span class="header-text">${c1} / ${c2}</span>
      </div>
      <div class="card-body wildcard-body">
        <div class="wildcard-symbol">🔀</div>
        <div class="card-name">Property Wild</div>
      </div>
      <div class="card-footer">
        <div class="value-badge">${card.value}M</div>
        <div class="wildcard-desc">Choose one color</div>
      </div>
    </div>
  `;
}

function buildMoneyCard(card) {
  const isHighValue = card.value >= 5;
  return `
    <div class="card-inner">
      <div class="card-glare"></div>
      <div class="card-header money-header">
        <span class="header-icon">${isHighValue ? '💎' : '💵'}</span>
        <span class="header-text">MONEY</span>
      </div>
      <div class="card-body money-body">
        <div class="money-amount">${card.value}M</div>
        <div class="money-subtitle">${isHighValue ? 'High Value' : 'Million'}</div>
      </div>
      <div class="card-footer money-footer">
        <div class="money-pattern"></div>
      </div>
    </div>
  `;
}

function buildActionCard(card) {
  const config = {
    [ACTION_TYPES.DEAL_BREAKER]: { icon: '💥', accent: '#ff3333', gradient: 'linear-gradient(135deg, #ff3333, #cc0000)' },
    [ACTION_TYPES.JUST_SAY_NO]: { icon: '🛡️', accent: '#4a90d9', gradient: 'linear-gradient(135deg, #4a90d9, #2c5f8a)' },
    [ACTION_TYPES.SLY_DEAL]: { icon: '🦊', accent: '#ff9800', gradient: 'linear-gradient(135deg, #ff9800, #e65100)' },
    [ACTION_TYPES.FORCED_DEAL]: { icon: '🔄', accent: '#9c27b0', gradient: 'linear-gradient(135deg, #9c27b0, #6a1b9a)' },
    [ACTION_TYPES.DEBT_COLLECTOR]: { icon: '💰', accent: '#4caf50', gradient: 'linear-gradient(135deg, #4caf50, #2e7d32)' },
    [ACTION_TYPES.BIRTHDAY]: { icon: '🎂', accent: '#e91e63', gradient: 'linear-gradient(135deg, #e91e63, #c2185b)' },
    [ACTION_TYPES.PASS_GO]: { icon: '⏩', accent: '#2196f3', gradient: 'linear-gradient(135deg, #2196f3, #1565c0)' },
    [ACTION_TYPES.HOUSE]: { icon: '🏠', accent: '#795548', gradient: 'linear-gradient(135deg, #795548, #4e342e)' },
    [ACTION_TYPES.HOTEL]: { icon: '🏨', accent: '#607d8b', gradient: 'linear-gradient(135deg, #607d8b, #37474f)' },
    [ACTION_TYPES.DOUBLE_RENT]: { icon: '✖️', accent: '#ff5722', gradient: 'linear-gradient(135deg, #ff5722, #d84315)' },
  };

  const cfg = config[card.action] || { icon: '⚡', accent: '#7c3aed', gradient: 'linear-gradient(135deg, #7c3aed, #5b21b6)' };

  return `
    <div class="card-inner">
      <div class="card-glare"></div>
      <div class="card-header action-header" style="background: ${cfg.gradient}">
        <span class="header-icon action-icon">${cfg.icon}</span>
        <span class="header-text">${card.label}</span>
      </div>
      <div class="card-body action-body">
        <div class="action-icon-large">${cfg.icon}</div>
        <div class="action-description">${card.description}</div>
      </div>
      <div class="card-footer action-footer">
        <div class="value-badge action-value">${card.value}M</div>
        <div class="action-type-badge">ACTION</div>
      </div>
    </div>
  `;
}

function buildRentCard(card) {
  if (card.colors === 'all') {
    return `
      <div class="card-inner">
        <div class="card-glare"></div>
        <div class="card-header rainbow-header">
          <span class="header-icon">🌈</span>
          <span class="header-text">WILD RENT</span>
        </div>
        <div class="card-body rent-body">
          <div class="rent-icon-large">💲</div>
          <div class="card-name">Collect Rent</div>
          <div class="card-description">Any color property</div>
        </div>
        <div class="card-footer rent-footer">
          <div class="value-badge">${card.value}M</div>
          <div class="rent-label">RENT</div>
        </div>
      </div>
    `;
  }
  const c1 = PROP_COLORS[card.colors[0]] || '#888';
  const c2 = PROP_COLORS[card.colors[1]] || '#aaa';
  const n1 = COLOR_NAMES[card.colors[0]] || '';
  const n2 = COLOR_NAMES[card.colors[1]] || '';
  const icon1 = PROP_ICONS[card.colors[0]] || '🏠';
  const icon2 = PROP_ICONS[card.colors[1]] || '🏠';

  return `
    <div class="card-inner">
      <div class="card-glare"></div>
      <div class="card-header rent-header" style="background: linear-gradient(90deg, ${c1}, ${c2})">
        <span class="header-icon">${icon1} ${icon2}</span>
        <span class="header-text">${n1} / ${n2}</span>
      </div>
      <div class="card-body rent-body">
        <div class="rent-icon-large">💲</div>
        <div class="card-name">Collect Rent</div>
        <div class="card-description">From all players</div>
      </div>
      <div class="card-footer rent-footer">
        <div class="value-badge">${card.value}M</div>
        <div class="rent-label">RENT</div>
      </div>
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
    label = PROP_ICONS[card.color] || '?';
  } else if (card.type === CARD_TYPES.PROPERTY_WILDCARD) {
    if (card.colors === 'all') {
      bg = 'linear-gradient(135deg, #DC143C, #228B22, #1a1acd)';
      label = '🌈';
    } else {
      bg = `linear-gradient(135deg, ${PROP_COLORS[card.colors[0]]}, ${PROP_COLORS[card.colors[1]]})`;
      label = '🔀';
    }
  } else if (card.type === CARD_TYPES.MONEY) {
    bg = 'linear-gradient(135deg, #c8a84e, #dab955)';
    label = '💵';
  } else if (card.type === CARD_TYPES.ACTION) {
    bg = 'linear-gradient(135deg, #7c3aed, #a855f7)';
    label = '⚡';
  } else if (card.type === CARD_TYPES.RENT) {
    if (card.colors === 'all') {
      bg = 'linear-gradient(135deg, #DC143C, #FFD700, #228B22)';
    } else {
      bg = `linear-gradient(135deg, ${PROP_COLORS[card.colors[0]]}, ${PROP_COLORS[card.colors[1]]})`;
    }
    label = '💲';
  }

  el.style.background = bg;
  el.textContent = label;
  el.dataset.cardId = card.id;
  return el;
}

export function renderCardBack(count) {
  const el = document.createElement('div');
  el.className = 'card-back';
  el.innerHTML = `
    <div class="card-back-inner">
      <div class="card-back-pattern"></div>
      <div class="card-back-logo">
        <span class="logo-m">M</span>
        <span class="logo-d">D</span>
      </div>
      ${count != null ? `<span class="count">${count}</span>` : ''}
    </div>
  `;
  return el;
}
