// 政变 · 暗影宫廷 — 前端主程序（原生 ES module，无依赖）
import { ROLE_DEFS, ROLE_MAP, roleArt } from './roles.js';
import { createVoiceController } from './voice.js';

/* ============================================================
   图标（内部静态 SVG）
   ============================================================ */

const ICON_PATHS = {
  coin: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.1"/><path d="M12 8.6v6.8M9.7 10.3h3.1a1.8 1.8 0 0 1 0 3.6H9.7"/>`,
  deck: `<rect x="7" y="4" width="10" height="14" rx="1.6"/><path d="M5 7v12.4A1.6 1.6 0 0 0 6.6 21H16"/><path d="M17 7h1.4A1.6 1.6 0 0 1 20 8.6V19"/>`,
  book: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 5.5v15"/><path d="M8 7h8M8 11h6"/>`,
  soundOn: `<path d="M4 9.5h3L12 5v14L7 14.5H4Z"/><path d="M16 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8 8 0 0 1 0 12"/>`,
  soundOff: `<path d="M4 9.5h3L12 5v14L7 14.5H4Z"/><path d="M16 9l5 6M21 9l-5 6"/>`,
  log: `<path d="M5 6h14M5 12h14M5 18h8"/><circle cx="18.5" cy="18" r="1.4" fill="currentColor" stroke="none"/>`,
  chat: `<path d="M20 12a7.5 7.5 0 0 1-10.8 6.7L4 20l1.3-4.6A7.5 7.5 0 1 1 20 12Z"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18"/>`,
  copy: `<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5"/>`,
  exit: `<path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h9"/>`,
  crown: `<path d="M4 19 L6 7 L11 12 L12 5 L13 12 L18 7 L20 19 Z"/><path d="M6 21h12"/>`,
  mic: `<path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3Z"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M8.5 21h7"/>`,
  micOff: `<path d="M9 9v2.5a3 3 0 0 0 4.6 2.5"/><path d="M15 9.5V6.5a3 3 0 0 0-5.6-1.5"/><path d="M5.5 11a6.5 6.5 0 0 0 10.1 5.5"/><path d="M18.5 11a6.5 6.5 0 0 1-.6 2.7"/><path d="M12 17.5V21"/><path d="M8.5 21h7"/><path d="M4 4l16 16"/>`,
  users: `<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5"/><path d="M16 5.4a3 3 0 0 1 0 5.4"/><path d="M17.5 14.4c2 .5 3.2 2.2 3.5 4.6"/>`,
  shield: `<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6Z"/>`,
  scale: `<path d="M12 3v18M7 21h10"/><path d="M4 7h16"/><path d="M4 7l-2.2 6h4.4Z"/><path d="M20 7l-2.2 6h4.4Z"/>`,
  exchange: `<path d="M4 8h13l-3-3M20 16H7l3 3"/>`,
  heart: `<path d="M12 20s-7-4.3-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.7 12 20 12 20Z"/>`,
  target: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>`,
  bolt: `<path d="M13 2 4 14h6l-1 8 9-12h-6Z"/>`,
  refresh: `<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>`,
  check: `<path d="M4 12.5l5 5L20 6.5"/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>`
};

function icon(name) {
  return `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ''}</svg>`;
}

/* ============================================================
   DOM 工具
   ============================================================ */

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') node.value = value;
    else if (key === 'disabled' || key === 'hidden' || key === 'selected' || key === 'checked') node[key] = Boolean(value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

function iconSpan(name, cls = '') {
  return h('span', { class: `icon-holder${cls ? ' ' + cls : ''}`, html: icon(name), 'aria-hidden': 'true' });
}

/* ============================================================
   常量与状态
   ============================================================ */

const SESSION_KEY = 'coupSession';
const NAME_KEY = 'coupName';
const SOUND_KEY = 'coupSound';

const PHASE_LABELS = {
  action: '行动阶段',
  challenge: '质疑阶段',
  block: '阻止阶段',
  blockChallenge: '阻止质疑',
  exchange: '交换角色牌',
  loseLife: '失去生命',
  over: '对局结束'
};

const ACTION_CONFIG = [
  { type: 'income1', name: '收入', sub: '+1 金币 · 无风险', icon: 'coin', legalKey: 'income1' },
  { type: 'income2', name: '援助', sub: '+2 金币 · 可被公爵阻止', icon: 'coin', legalKey: 'income2' },
  { type: 'tax', name: '征税', sub: '宣称公爵 · +3 金币', role: 'duke', legalKey: 'tax' },
  { type: 'steal', name: '偷取', sub: '宣称队长 · 偷 2 金币', role: 'captain', legalKey: 'steal', target: true },
  { type: 'exchange', name: '交换', sub: '宣称大使 · 抽 2 换牌', role: 'ambassador', legalKey: 'exchange' },
  { type: 'assassinate', name: '刺杀', sub: '宣称刺客 · 花 3 金币', role: 'assassin', legalKey: 'assassinate', target: true },
  { type: 'bishop', name: '主教复制', sub: '宣称主教 · 复制阵亡者', role: 'bishop', legalKey: 'bishop' },
  { type: 'coup', name: '政变', sub: '花 7 金币 · 不可阻止', icon: 'crown', legalKey: 'coup', target: true }
];

const S = {
  session: null,
  state: null,
  receivedAt: 0,
  view: 'home',
  restoring: false,
  roomPrefill: '',
  sound: false,
  polling: false,
  pollTimer: null,
  connOk: true,
  ui: {
    homeName: '',
    lobbySig: '',
    gameVersion: -1,
    onlineSig: '',
    targeting: null,
    busyAction: false,
    chatBusy: false,
    exchangeKey: null,
    exchangeKeep: new Set(),
    loseKey: null,
    loseUid: null,
    drawer: 'closed',
    drawerTab: 'log',
    logMaxId: 0,
    logSeenId: 0,
    logRenderedId: 0,
    logUnread: 0,
    chatMaxId: 0,
    chatSeenId: 0,
    chatUnread: 0,
    phaseSeen: null,
    lastAttention: false,
    lastCoins: new Map(),
    lastLives: new Map(),
    startPlayerId: '',
    modalOpen: false,
    previousFocus: null
  }
};

let voice = null;

/* ============================================================
   基础工具
   ============================================================ */

function roleName(id) {
  return ROLE_MAP[id]?.name || id || '';
}

function roleInfo(id) {
  const local = ROLE_MAP[id] || { id, name: id, en: '', tagline: '', skill: '', desc: '' };
  const metaRoles = S.state?.meta?.roles;
  const fromMeta = Array.isArray(metaRoles) ? metaRoles.find((r) => r.id === id) : null;
  if (!fromMeta) return local;
  return { ...local, ...fromMeta, skill: local.skill };
}

function playerById(g, id) {
  return (g?.players || []).find((p) => p.id === id) || null;
}

function fmtClock(ts, withSeconds = false) {
  if (!ts) return '';
  try {
    const opts = { hour12: false, hour: '2-digit', minute: '2-digit' };
    if (withSeconds) opts.second = '2-digit';
    return new Date(ts).toLocaleTimeString('zh-CN', opts);
  } catch {
    return '';
  }
}

function nowServer() {
  if (!S.state) return Date.now();
  return S.state.serverNow + (Date.now() - S.receivedAt);
}

function lobbySignature(st) {
  const room = st?.room;
  if (!room) return '';
  const players = (room.players || [])
    .map((p) => `${p.id}:${p.name}:${p.online ? 1 : 0}:${p.isHost ? 1 : 0}`)
    .join(',');
  return `${room.code}|${room.hostId}|${room.canStart ? 1 : 0}|${players}`;
}

/* ============================================================
   Toast / 弹窗 / 请求按钮
   ============================================================ */

function toast(message, type = 'error', ms = 3400) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const node = h('div', { class: `toast toast-${type}`, role: 'status', text: String(message) });
  root.append(node);
  while (root.children.length > 4) root.firstElementChild?.remove();
  setTimeout(() => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 240);
  }, ms);
}

async function busyBtn(btn, label, fn) {
  if (!btn || btn.disabled || btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true;
  btn.classList.add('is-loading');
  btn.setAttribute('aria-busy', 'true');
  if (label) btn.setAttribute('aria-label', label);
  try {
    await fn();
  } catch (err) {
    if (!err?.silent) toast(err?.message || '操作失败，请重试');
  } finally {
    btn.dataset.busy = '';
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
  }
}

function openModal({ title, subtitle, body, actions = [], dismissible = true, wide = false }) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  S.ui.previousFocus = document.activeElement;
  const panel = h('div', {
    class: `modal${wide ? ' modal-wide' : ''}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title || '对话框'
  });
  const head = h('div', { class: 'modal-head' },
    h('div', {},
      h('h2', { class: 'modal-title', text: title || '' }),
      subtitle ? h('p', { class: 'modal-sub', text: subtitle }) : null
    ),
    h('button', {
      class: 'icon-btn',
      type: 'button',
      'aria-label': '关闭对话框',
      html: icon('close'),
      onclick: () => closeModal()
    })
  );
  const bodyEl = h('div', { class: 'modal-body' });
  if (body instanceof Node) bodyEl.append(body);
  else if (body != null) bodyEl.append(document.createTextNode(String(body)));
  panel.append(head, bodyEl);
  if (actions.length) {
    const actionsEl = h('div', { class: 'modal-actions' });
    for (const action of actions) {
      actionsEl.append(h('button', {
        class: `btn ${action.class || 'btn-ghost'}`,
        type: 'button',
        text: action.label,
        onclick: action.onClick
      }));
    }
    panel.append(actionsEl);
  }
  const backdrop = h('div', {
    class: 'modal-backdrop',
    onclick: () => { if (dismissible) closeModal(); }
  });
  root.replaceChildren(backdrop, panel);
  root.hidden = false;
  S.ui.modalOpen = true;
  document.addEventListener('keydown', modalEsc);
  requestAnimationFrame(() => {
    const focusable = panel.querySelector('button, input, select, textarea');
    focusable?.focus();
  });
}

function closeModal() {
  document.removeEventListener('keydown', modalEsc);
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.hidden = true;
  root.replaceChildren();
  S.ui.modalOpen = false;
  const prev = S.ui.previousFocus;
  if (prev && prev.isConnected && typeof prev.focus === 'function') {
    try { prev.focus(); } catch { /* ignore */ }
  }
}

function modalEsc(ev) {
  if (ev.key === 'Escape') closeModal();
}

function confirmModal({ title, message, confirmLabel = '确定', danger = false, onConfirm }) {
  const body = h('div', {},
    h('p', { text: message }),
    h('p', { class: 'fineprint', text: '此操作需要确认。' })
  );
  openModal({
    title,
    body,
    actions: [
      { label: '取消', class: 'btn btn-ghost', onClick: closeModal },
      {
        label: confirmLabel,
        class: `btn ${danger ? 'btn-danger' : 'btn-gold'}`,
        onClick: () => { closeModal(); onConfirm?.(); }
      }
    ]
  });
}

/* ============================================================
   API 与会话
   ============================================================ */

async function api(path, options = {}) {
  // 支持两种调用：api(path, body) 与 api(path, {method, body})
  const isEnvelope = Object.prototype.hasOwnProperty.call(options, 'method') ||
    Object.prototype.hasOwnProperty.call(options, 'body');
  const method = isEnvelope ? (options.method || (options.body !== undefined ? 'POST' : 'GET')) : 'POST';
  const body = isEnvelope ? options.body : options;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store'
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const err = new Error(data?.error || `请求失败（${res.status}）`);
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') {
      const e = new Error('请求超时，请检查网络');
      e.status = 0;
      throw e;
    }
    if (!err?.status && err instanceof TypeError) {
      const e = new Error('网络连接失败，请检查网络');
      e.status = 0;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function sessionBody() {
  if (!S.session) return null;
  return { code: S.session.code, playerId: S.session.playerId, token: S.session.token };
}

function fetchState() {
  if (!S.session) return Promise.reject(new Error('没有会话'));
  const q = new URLSearchParams({
    code: S.session.code,
    pid: S.session.playerId,
    token: S.session.token
  });
  return api(`/api/state?${q}`, { method: 'GET' });
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.code || !data.playerId || !data.token) return null;
    return {
      code: String(data.code).toUpperCase(),
      playerId: String(data.playerId),
      token: String(data.token),
      name: String(data.name || '')
    };
  } catch {
    return null;
  }
}

function saveSession(session) {
  S.session = session;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (session.name) localStorage.setItem(NAME_KEY, session.name);
  } catch { /* 隐私模式忽略 */ }
}

function clearSession() {
  S.session = null;
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function urlSetRoom(code) {
  try {
    const url = new URL(location.href);
    url.searchParams.set('room', code);
    history.replaceState({}, '', url);
  } catch { /* ignore */ }
}

function urlClearRoom() {
  try {
    const url = new URL(location.href);
    url.searchParams.delete('room');
    history.replaceState({}, '', url);
  } catch { /* ignore */ }
}

/* ============================================================
   轮询与状态应用
   ============================================================ */

function stopPolling() {
  if (S.pollTimer) {
    clearTimeout(S.pollTimer);
    S.pollTimer = null;
  }
}

function startPolling(delay = 700) {
  stopPolling();
  S.pollTimer = setTimeout(pollOnce, Math.max(0, delay));
}

function pollSoon(delay = 0) {
  if (!S.session) return;
  startPolling(delay);
}

async function pollOnce() {
  S.pollTimer = null;
  if (!S.session || S.polling) return;
  S.polling = true;
  try {
    const st = await fetchState();
    S.polling = false;
    S.connOk = true;
    hideConnBanner();
    applyState(st);
    startPolling(S.state?.game ? 700 : 1100);
  } catch (err) {
    S.polling = false;
    if (err?.status === 401 || err?.status === 404) {
      handleSessionGone(err);
      return;
    }
    S.connOk = false;
    showConnBanner();
    startPolling(1600);
  }
}

function applyState(st, options = {}) {
  if (!st) return;
  const prevState = S.state;
  const prevGame = prevState?.game || null;

  // 再来一局时新对局的 version 会从头计数，不能用旧对局 version 把新状态当成迟到包
  const isRematch = Boolean(prevGame && prevGame.status === 'over' && st.game && st.game.status === 'playing');
  // 防止迟到的旧状态覆盖新状态
  if (!isRematch && prevGame && st.game && typeof st.game.version === 'number' && st.game.version < prevGame.version) {
    st = { ...st, game: prevGame };
  }
  if (isRematch) {
    resetTransientGameUi();
  }

  S.state = st;
  S.receivedAt = Date.now();
  const nextView = st.game ? 'game' : 'lobby';
  const viewChanged = S.view !== nextView;
  S.view = nextView;

  if (st.voice) voice?.updateState(st.voice);
  updateLogState(st);
  updateChatState(st);

  if (nextView === 'game') {
    const g = st.game;
    const onlineSig = `${st.room?.hostId || ''}:` + (g.players || []).map((p) => (p.online === false ? 0 : 1)).join('');
    const onlineChanged = onlineSig !== S.ui.onlineSig;
    S.ui.onlineSig = onlineSig;
    const changed = viewChanged || options.force || onlineChanged || g.version !== S.ui.gameVersion;
    if (changed) {
      S.ui.gameVersion = g.version;
      renderGameView();
      noteGameChanges(g, prevGame);
    } else {
      updateBadges();
    }
  } else {
    const sig = lobbySignature(st);
    if (viewChanged || options.force || sig !== S.ui.lobbySig) {
      S.ui.lobbySig = sig;
      renderLobbyView();
    } else {
      updateBadges();
    }
  }
}

function handleSessionGone(err) {
  stopPolling();
  S.polling = false;
  voice?.leaveSilently();
  voice?.closePanel();
  clearSession();
  urlClearRoom();
  S.state = null;
  S.view = 'home';
  S.ui.gameVersion = -1;
  S.ui.lobbySig = '';
  S.ui.logUnread = 0;
  S.ui.chatUnread = 0;
  closeDrawerDom();
  renderHomeView();
  updateVoiceButton();
  toast(err?.status === 404 ? '房间不存在或已过期，请重新加入' : '身份验证失败，请重新加入');
}

function resetTransientGameUi() {
  S.ui.targeting = null;
  S.ui.busyAction = false;
  S.ui.exchangeKey = null;
  S.ui.exchangeKeep = new Set();
  S.ui.loseKey = null;
  S.ui.loseUid = null;
  S.ui.lastCoins.clear();
  S.ui.lastLives.clear();
  S.ui.gameVersion = -1;
  S.ui.phaseSeen = null;
  S.ui.lastAttention = false;
  S.ui.onlineSig = '';
}

/* ============================================================
   语音
   ============================================================ */

function initVoiceController() {
  voice = createVoiceController({
    getSession: () => S.session,
    toast: (msg, type, ms) => toast(msg, type, ms),
    onChange: () => updateVoiceButton()
  });
}

function buildVoiceButton() {
  return h('button', {
    class: 'icon-btn voice-btn',
    id: 'voice-toggle',
    type: 'button',
    'aria-label': '加入语音（实验性）',
    'aria-pressed': 'false',
    title: '语音（实验性）',
    onclick: onVoiceToggle
  },
    h('span', { class: 'voice-ico', html: icon('mic'), 'aria-hidden': 'true' }),
    h('span', { class: 'voice-count', hidden: true })
  );
}

function onVoiceToggle() {
  if (!voice) return;
  const state = voice.uiState();
  if (state.joined) voice.openPanel();
  else voice.join();
}

function updateVoiceButton() {
  const btn = document.getElementById('voice-toggle');
  if (!btn || !voice) return;
  const state = voice.uiState();
  btn.classList.toggle('is-on', state.joined);
  btn.classList.toggle('is-muted', state.joined && state.muted);
  btn.setAttribute('aria-pressed', state.joined ? 'true' : 'false');
  btn.setAttribute(
    'aria-label',
    state.joined
      ? `语音已加入，${state.memberCount} 人在语音中，点击打开语音面板`
      : '加入语音（实验性）'
  );
  btn.title = state.joined ? '语音面板' : '加入语音（实验性）';
  const ico = btn.querySelector('.voice-ico');
  if (ico) ico.innerHTML = icon(state.joined && state.muted ? 'micOff' : 'mic');
  const count = btn.querySelector('.voice-count');
  if (count) {
    count.hidden = !state.joined;
    if (state.joined) count.textContent = String(state.memberCount);
  }
}

/* ============================================================
   音效
   ============================================================ */

let audioCtx = null;

function beep(kind = 'turn') {
  if (!S.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(kind === 'danger' ? 240 : 660, t);
    osc.frequency.exponentialRampToValueAtTime(kind === 'danger' ? 180 : 880, t + 0.12);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  } catch { /* 音频不可用时静默 */ }
}

function toggleSound() {
  S.sound = !S.sound;
  try { localStorage.setItem(SOUND_KEY, S.sound ? '1' : '0'); } catch { /* ignore */ }
  updateSoundButtons();
  if (S.sound) beep('turn');
}

function updateSoundButtons() {
  document.querySelectorAll('.sound-toggle').forEach((btn) => {
    btn.innerHTML = icon(S.sound ? 'soundOn' : 'soundOff');
    btn.setAttribute('aria-pressed', S.sound ? 'true' : 'false');
    btn.setAttribute('aria-label', S.sound ? '关闭音效' : '开启音效');
    btn.title = S.sound ? '关闭音效' : '开启音效';
  });
}

/* ============================================================
   阶段变化提示
   ============================================================ */

function needsAttention(g) {
  if (!g || g.status !== 'playing') return false;
  const me = g.you;
  const pending = g.pending;
  if (!me) return false;
  if (g.phase === 'action') return Boolean(me.isTurn);
  if (g.phase === 'challenge' || g.phase === 'blockChallenge') {
    return Boolean(pending && (pending.eligible || []).includes(me.id) && !(pending.passed || []).includes(me.id));
  }
  if (g.phase === 'block') return Boolean(pending?.canBlockIds?.includes(me.id));
  if (g.phase === 'exchange') return pending?.actorId === me.id;
  if (g.phase === 'loseLife') return pending?.playerId === me.id;
  return false;
}

function noteGameChanges(g, prevGame) {
  if (prevGame && prevGame.phase !== g.phase) {
    const label = PHASE_LABELS[g.phase] || '对局更新';
    showPhaseBanner(g.phase === 'over' ? '对局结束' : label);
  }
  const attention = needsAttention(g);
  if (prevGame && attention && !S.ui.lastAttention) beep('turn');
  S.ui.lastAttention = attention;
  S.ui.phaseSeen = g.phase;
  document.title = attention ? '【轮到你】政变 · 暗影宫廷' : '政变 · 暗影宫廷';
}

function showPhaseBanner(text) {
  document.querySelector('.phase-banner')?.remove();
  const node = h('div', { class: 'phase-banner', role: 'status', text });
  document.body.append(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 320);
  }, 1700);
}

/* ============================================================
   倒计时
   ============================================================ */

function countdownEl(deadline, prefix = '剩余') {
  if (!deadline) return null;
  return h('span', {
    class: 'countdown',
    dataset: { deadline: String(deadline), label: prefix },
    text: `${prefix} — 秒`
  });
}

function tickCountdowns() {
  const now = nowServer();
  document.querySelectorAll('[data-deadline]').forEach((node) => {
    const deadline = Number(node.dataset.deadline);
    if (!deadline) return;
    const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
    const label = node.dataset.label || '剩余';
    const text = seconds > 0 ? `${label} ${seconds} 秒` : '即将结束';
    if (node.textContent !== text) node.textContent = text;
    node.classList.toggle('urgent', seconds > 0 && seconds <= 5);
    node.classList.toggle('is-over', seconds <= 0);
  });
}

/* ============================================================
   角色牌 / 卡牌 UI
   ============================================================ */

function buildRoleCard(roleId, options = {}) {
  const {
    size = 'md', selected = false, dim = false, dead = false, faceDown = false, newTag = false
  } = options;
  const classes = ['role-card'];
  if (size && size !== 'md') classes.push(`size-${size}`);
  if (selected) classes.push('is-selected');
  if (dim) classes.push('dim');
  if (dead) classes.push('dead');
  if (faceDown) classes.push('back');
  const card = h('div', { class: classes.join(' ') });
  if (faceDown) {
    card.append(h('div', { class: 'seal', text: '政', 'aria-hidden': 'true' }));
  } else {
    const info = roleInfo(roleId);
    card.append(h('div', { class: 'emblem', html: roleArt(roleId), 'aria-hidden': 'true' }));
    card.append(h('div', { class: 'rname', text: info.name }));
    card.append(h('div', { class: 'ren', text: info.en || '' }));
    if (size === 'lg' && (info.tagline || info.desc)) {
      card.append(h('div', { class: 'rdesc', text: info.tagline || info.desc }));
    }
  }
  if (newTag) card.append(h('span', { class: 'new-tag', text: '新抽到' }));
  return card;
}

function roleCardButton(roleId, options = {}) {
  const { selected = false, pressed, newTag = false, ariaLabel, onclick, size = 'md', dead = false } = options;
  const card = buildRoleCard(roleId, { size, selected, newTag, dead });
  if (selected) card.classList.add('is-picked');
  return h('button', {
    class: 'role-card-btn',
    type: 'button',
    'aria-label': ariaLabel || `角色牌：${roleName(roleId)}`,
    'aria-pressed': pressed === undefined ? null : (pressed ? 'true' : 'false'),
    onclick
  }, card);
}

function deadChip(roleId) {
  return h('span', {
    class: 'dead-chip',
    title: `阵亡：${roleName(roleId)}`,
    'aria-label': `阵亡：${roleName(roleId)}`
  },
    buildRoleCard(roleId, { size: 'xs', dead: true }),
    h('span', { text: roleName(roleId) })
  );
}

/* ============================================================
   首页
   ============================================================ */

function renderHomeView() {
  voice?.closePanel();
  const root = document.getElementById('view-root');
  if (!root) return;
  const nameInput = h('input', {
    class: 'input',
    id: 'name-input',
    name: 'name',
    maxlength: '12',
    autocomplete: 'off',
    placeholder: '例如：午夜旅人',
    value: S.ui.homeName || S.session?.name || '',
    'aria-label': '昵称'
  });
  nameInput.value = S.ui.homeName || S.session?.name || S.ui.homeName;
  nameInput.addEventListener('input', () => { S.ui.homeName = nameInput.value; });
  nameInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') document.getElementById('create-room-btn')?.click();
  });

  const codeInput = h('input', {
    class: 'input code-input',
    id: 'join-code',
    name: 'code',
    maxlength: '4',
    autocomplete: 'off',
    inputmode: 'text',
    placeholder: '4 位房号',
    value: S.roomPrefill || '',
    'aria-label': '4 位房间号'
  });
  codeInput.addEventListener('input', () => {
    const next = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (codeInput.value !== next) codeInput.value = next;
  });
  codeInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') document.getElementById('join-room-btn')?.click();
  });

  const createBtn = h('button', {
    class: 'btn btn-gold btn-big btn-block',
    id: 'create-room-btn',
    type: 'button',
    disabled: S.restoring,
    onclick: () => handleCreate(createBtn, nameInput)
  }, iconSpan('crown'), '创建房间');

  const joinBtn = h('button', {
    class: 'btn btn-ghost btn-big',
    id: 'join-room-btn',
    type: 'button',
    disabled: S.restoring,
    onclick: () => handleJoin(joinBtn, codeInput, nameInput)
  }, '加入房间');

  const panel = h('section', { class: 'panel auth-panel', 'aria-labelledby': 'auth-title' });

  if (S.session) {
    const continueBtn = h('button', {
      class: 'btn btn-gold btn-small',
      type: 'button',
      disabled: S.restoring,
      onclick: () => restoreSession()
    }, S.restoring ? '正在恢复…' : '继续对局');
    const banner = h('div', { class: 'session-banner' },
      h('p', {},
        document.createTextNode('检测到本机保存的对局：房间 '),
        h('strong', { text: S.session.code }),
        S.session.name ? document.createTextNode(` · ${S.session.name}`) : null
      ),
      h('div', { class: 'row' },
        continueBtn,
        h('button', {
          class: 'btn btn-ghost btn-small',
          type: 'button',
          onclick: () => confirmClearSession()
        }, '清除本机记录')
      )
    );
    panel.append(banner);
  }

  panel.append(
    h('h2', { class: 'auth-title', id: 'auth-title', text: S.roomPrefill ? '加入一场政变' : '进入暗影宫廷' }),
    h('p', { class: 'auth-hint', text: '给自己取一个代号，创建房间或输入房号加入。' }),
    h('div', { class: 'field' },
      h('label', { class: 'field-label', for: 'name-input', text: '你的代号' }),
      nameInput
    ),
    createBtn,
    h('div', { class: 'divider', text: '或加入已有房间' }),
    h('div', { class: 'join-row' },
      h('label', { class: 'sr-only', for: 'join-code', text: '4 位房号' }),
      codeInput,
      joinBtn
    ),
    h('div', { class: 'home-foot' },
      h('button', { class: 'link-btn', type: 'button', onclick: openRules }, '查看完整规则'),
      h('span', { text: '2–6 人 · 无需安装' })
    )
  );

  const hero = h('section', { class: 'hero', 'aria-labelledby': 'home-title' },
    h('div', { class: 'hero-mark', html: icon('crown'), 'aria-hidden': 'true' }),
    h('p', { class: 'eyebrow', text: '暗影宫廷 · 权谋卡牌' }),
    h('h1', { class: 'logo', id: 'home-title' },
      h('span', { text: '政' }),
      h('span', { text: '变' })
    ),
    h('p', { class: 'hero-sub', text: '六张面孔，一副面具。谁在说谎？' }),
    h('div', { class: 'hero-rule', 'aria-hidden': 'true' }),
    h('ul', { class: 'hero-points' },
      h('li', { text: '2–6 人在线' }),
      h('li', { text: '每人两条命' }),
      h('li', { text: '可以假装任何角色' }),
      h('li', { text: '质疑，或沉默' })
    )
  );

  root.replaceChildren(h('div', { class: 'home' }, hero, panel));
  updateBadges();
  updateSoundButtons();
}

async function handleCreate(btn, nameInput) {
  const name = (nameInput.value || '').trim();
  if (!name) {
    toast('请先输入昵称');
    nameInput.focus();
    return;
  }
  if (S.session && !S.restoring) {
    confirmModal({
      title: '创建新房间',
      message: `本机还保存着房间 ${S.session.code} 的记录，创建新房间会覆盖它。确定继续吗？`,
      confirmLabel: '创建新房间',
      onConfirm: () => doCreate(btn, nameInput)
    });
    return;
  }
  await doCreate(btn, nameInput);
}

async function doCreate(btn, nameInput) {
  const name = (nameInput.value || '').trim();
  if (!name) { toast('请先输入昵称'); nameInput.focus(); return; }
  await busyBtn(btn, '创建中…', async () => {
    const data = await api('/api/create', { name });
    enterSession(data, name);
    toast('房间已创建，把邀请链接发给朋友吧', 'ok');
  });
}

async function handleJoin(btn, codeInput, nameInput) {
  const name = (nameInput.value || '').trim();
  const code = (codeInput.value || '').trim().toUpperCase();
  if (!name) {
    toast('请先输入昵称');
    nameInput.focus();
    return;
  }
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    toast('请输入 4 位房号（字母或数字）');
    codeInput.focus();
    return;
  }
  if (S.session && !S.restoring) {
    confirmModal({
      title: '加入新房间',
      message: `本机还保存着房间 ${S.session.code} 的记录，加入新房间会覆盖它。确定继续吗？`,
      confirmLabel: '加入房间',
      onConfirm: () => doJoin(btn, codeInput, nameInput, code)
    });
    return;
  }
  await doJoin(btn, codeInput, nameInput, code);
}

async function doJoin(btn, codeInput, nameInput, code) {
  const name = (nameInput.value || '').trim();
  await busyBtn(btn, '加入中…', async () => {
    const data = await api('/api/join', { code, name });
    enterSession(data, name);
    toast('已加入房间', 'ok');
  });
}

function enterSession(data, name) {
  if (!data || !data.roomCode || !data.playerId || !data.token) throw new Error('创建/加入失败');
  const session = {
    code: String(data.roomCode).toUpperCase(),
    playerId: String(data.playerId),
    token: String(data.token),
    name: name || String(data.state?.me?.name || '')
  };
  saveSession(session);
  S.ui.homeName = session.name;
  S.roomPrefill = session.code;
  urlSetRoom(session.code);
  S.state = null;
  S.ui.gameVersion = -1;
  S.ui.lobbySig = '';
  S.ui.logUnread = 0;
  S.ui.chatUnread = 0;
  resetTransientGameUi();
  S.restoring = false;
  applyState(data.state, { force: true });
  startPolling(700);
}

async function restoreSession() {
  if (!S.session || S.restoring) return;
  S.restoring = true;
  renderHomeView();
  try {
    const st = await fetchState();
    S.restoring = false;
    applyState(st, { force: true });
    startPolling(700);
    toast('已恢复对局', 'ok');
  } catch (err) {
    S.restoring = false;
    if (err?.status === 401 || err?.status === 404) {
      clearSession();
      urlClearRoom();
      toast('房间不存在或已失效，请重新加入');
    } else {
      toast(err?.message || '连接失败，请检查网络后重试');
    }
    S.view = 'home';
    renderHomeView();
  }
}

function confirmClearSession() {
  confirmModal({
    title: '清除本机记录',
    message: '只会清除本机保存的房间号和身份令牌，不会影响服务器上的其他玩家。清除后无法再回到当前对局。',
    confirmLabel: '清除记录',
    danger: true,
    onConfirm: () => {
      clearSession();
      urlClearRoom();
      S.state = null;
      S.view = 'home';
      S.restoring = false;
      S.ui.gameVersion = -1;
      S.ui.lobbySig = '';
      renderHomeView();
      updateVoiceButton();
      toast('已清除本机记录', 'info');
    }
  });
}

/* ============================================================
   顶栏 / 通用小组件
   ============================================================ */

function buildTopbar(mode) {
  const st = S.state;
  const code = st?.room?.code || S.session?.code || '';
  const left = h('div', { class: 'topbar-left' });
  left.append(h('button', {
    class: 'room-chip',
    type: 'button',
    title: '复制邀请链接',
    'aria-label': `房间 ${code}，点击复制邀请链接`,
    onclick: copyInvite
  },
    h('span', { class: 'label', text: '房间' }),
    h('span', { class: 'code', text: code }),
    iconSpan('copy')
  ));

  if (mode === 'game' && st?.game) {
    left.append(h('span', {
      class: 'stat-chip',
      title: '牌堆剩余',
      'aria-label': `牌堆剩余 ${st.game.deckCount} 张`
    },
      iconSpan('deck'),
      h('span', { class: 'num', text: String(st.game.deckCount) }),
      h('span', { class: 'stat-unit', text: '张' })
    ));
  }

  const right = h('div', { class: 'topbar-right' },
    recordButton(),
    buildVoiceButton(),
    h('button', {
      class: 'icon-btn',
      type: 'button',
      'aria-label': '查看游戏规则',
      title: '游戏规则',
      html: icon('book'),
      onclick: openRules
    }),
    h('button', {
      class: 'icon-btn sound-toggle',
      type: 'button',
      'aria-label': S.sound ? '关闭音效' : '开启音效',
      'aria-pressed': S.sound ? 'true' : 'false',
      title: '音效开关',
      html: icon(S.sound ? 'soundOn' : 'soundOff'),
      onclick: toggleSound
    }),
    h('button', {
      class: 'icon-btn',
      type: 'button',
      'aria-label': mode === 'lobby' ? '退出房间' : '退出对局',
      title: mode === 'lobby' ? '离开房间' : '退出到首页',
      html: icon('exit'),
      onclick: mode === 'lobby' ? confirmLeaveLobby : confirmExitGame
    })
  );

  return h('header', { class: 'topbar' }, left, right);
}

function recordButton() {
  return h('button', {
    class: 'icon-btn record-toggle',
    type: 'button',
    'aria-label': '打开日志与聊天',
    title: '日志 / 聊天',
    onclick: () => openDrawer(S.ui.drawerTab || 'log')
  },
    iconSpan('log'),
    h('span', { class: 'badge', hidden: true })
  );
}


function sectionHead(title, note, iconName) {
  return h('div', { class: 'section-head' },
    h('h2', { class: 'section-title' }, iconName ? iconSpan(iconName) : null, title),
    note ? h('span', { class: 'section-note', text: note }) : null
  );
}

function waitingBox(text) {
  return h('div', { class: 'waiting-box' },
    h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    h('span', { text })
  );
}

/* ============================================================
   复制邀请链接
   ============================================================ */

async function inviteOrigin() {
  const host = location.hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') return location.origin;
  try {
    const data = await api('/api/network', { method: 'GET' });
    const lan = (data?.urls || []).find((x) => x.url)?.url;
    return lan || location.origin;
  } catch {
    return location.origin;
  }
}

async function copyInvite() {
  const code = S.session?.code;
  if (!code) return;
  const origin = await inviteOrigin();
  const url = `${origin}/?room=${encodeURIComponent(code)}`;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      toast(origin === location.origin ? '邀请链接已复制' : '已复制局域网邀请链接（朋友需与你在同一网络）', 'ok');
      return;
    }
    throw new Error('clipboard unavailable');
  } catch {
    try {
      fallbackCopy(url);
      toast(origin === location.origin ? '邀请链接已复制' : '已复制局域网邀请链接（朋友需与你在同一网络）', 'ok');
    } catch {
      toast(`复制失败，请手动分享：${url}`);
    }
  }
}

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, area.value.length);
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy failed');
}

/* ============================================================
   大厅
   ============================================================ */

function renderLobbyView() {
  const st = S.state;
  if (!st) { S.view = 'home'; renderHomeView(); return; }
  const root = document.getElementById('view-root');
  if (!root) return;
  const room = st.room;
  const me = st.me;

  const hero = h('section', { class: 'panel lobby-hero', 'aria-labelledby': 'lobby-title' },
    h('p', { class: 'eyebrow', text: '房间已开辟' }),
    h('h1', { class: 'room-code', id: 'lobby-title', text: room.code, 'aria-label': `房号 ${room.code}` }),
    h('p', { class: 'sub', text: `${room.players.length}/${room.maxPlayers} 人 · ${room.canStart ? '可以开始' : '等待更多玩家'}` }),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-gold', type: 'button', onclick: copyInvite },
        iconSpan('copy'), '复制邀请链接'),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: openRules },
        iconSpan('book'), '游戏规则')
    )
  );

  const playersPanel = h('section', { class: 'panel panel-pad', 'aria-labelledby': 'lobby-players-title' });
  playersPanel.append(sectionHead('玩家', `${room.players.length}/${room.maxPlayers}`, 'users'));
  const list = h('ul', { class: 'players-list', id: 'lobby-players-title' });
  room.players.forEach((p, index) => {
    const tags = h('span', { class: 'player-badges' });
    if (p.isHost) tags.append(h('span', { class: 'tag tag-host', text: '房主' }));
    if (p.id === me.id) tags.append(h('span', { class: 'tag tag-you', text: '你' }));
    list.append(h('li', { class: `player-row${p.id === me.id ? ' is-you' : ''}` },
      h('span', { class: 'seat-no', text: String(index + 1) }),
      h('span', { class: 'pname', text: p.name }),
      tags,
      h('span', { class: `online-dot${p.online ? '' : ' offline'}`, 'aria-hidden': 'true' }),
      h('span', { class: 'online-text', text: p.online ? '在线' : '离线' })
    ));
  });
  playersPanel.append(list);

  if (me.isHost) playersPanel.append(hostControls(room));
  else {
    const host = room.players.find((p) => p.isHost);
    playersPanel.append(h('div', { class: 'host-controls' },
      waitingBox(`等待房主 ${host?.name || ''} 开始游戏…`),
      h('p', { class: 'fineprint', text: '可以先看看完整规则，或把邀请链接发给朋友。' })
    ));
  }

  const chatPanel = h('section', { class: 'panel panel-pad chat-panel', 'aria-labelledby': 'lobby-chat-title' });
  chatPanel.append(sectionHead('房间聊天', '大厅与牌桌共用', 'chat'));
  chatPanel.append(buildChatList());
  const lobbyChatForm = h('form', {
    class: 'chat-form',
    onsubmit: (ev) => { ev.preventDefault(); submitChatForm(ev.currentTarget); }
  },
    h('label', { class: 'sr-only', for: 'lobby-chat-input', text: '发送聊天消息' }),
    h('input', {
      class: 'input',
      id: 'lobby-chat-input',
      maxlength: '100',
      placeholder: '说点什么…',
      autocomplete: 'off',
      enterkeyhint: 'send'
    }),
    h('button', { class: 'btn btn-gold btn-small', type: 'submit', text: '发送' })
  );
  chatPanel.append(lobbyChatForm);

  root.replaceChildren(h('div', { class: 'lobby' },
    buildTopbar('lobby'),
    hero,
    h('div', { class: 'lobby-grid' }, playersPanel, chatPanel)
  ));
  updateBadges();
  updateSoundButtons();
  updateVoiceButton();
}

function hostControls(room) {
  if (!room.players.length) return h('div', {});
  const selectedId = room.players.some((p) => p.id === S.ui.startPlayerId)
    ? S.ui.startPlayerId
    : room.players[0].id;
  S.ui.startPlayerId = selectedId;
  const select = h('select', {
    class: 'select',
    id: 'start-player',
    'aria-label': '选择起始行动玩家'
  });
  room.players.forEach((p) => {
    select.append(h('option', {
      value: p.id,
      text: `${p.name}${p.isHost ? '（房主）' : ''}`,
      selected: p.id === selectedId
    }));
  });
  select.value = selectedId;
  select.addEventListener('change', () => { S.ui.startPlayerId = select.value; });

  const canStart = room.players.length >= 2;
  const startBtn = h('button', {
    class: 'btn btn-gold btn-big btn-block',
    type: 'button',
    disabled: !canStart,
    onclick: () => startGame(startBtn)
  }, iconSpan('crown'), canStart ? '开始游戏' : '至少需要 2 名玩家');

  return h('div', { class: 'host-controls' },
    h('div', { class: 'start-row' },
      h('div', { class: 'field' },
        h('label', { class: 'field-label', for: 'start-player', text: '起始行动玩家' }),
        select
      ),
      h('p', { class: 'fineprint', text: '最后行动的那位玩家开局获得 3 金币，其他人 2 金币。' })
    ),
    startBtn,
    h('p', { class: 'fineprint', text: '你是房主。把邀请链接发给朋友，人齐后开始。' })
  );
}

async function startGame(btn) {
  if (!S.session) return;
  await busyBtn(btn, '正在开局…', async () => {
    const st = await api('/api/start', {
      ...sessionBody(),
      startPlayerId: S.ui.startPlayerId || undefined
    });
    resetTransientGameUi();
    applyState(st, { force: true });
    toast('对局开始', 'ok');
  });
}

function confirmLeaveLobby() {
  confirmModal({
    title: '离开房间',
    message: '确定离开这个房间吗？房主离开后，房主会转交给下一位玩家。',
    confirmLabel: '离开房间',
    danger: true,
    onConfirm: async () => {
      if (!S.session) return;
      try {
        await api('/api/leave', sessionBody());
      } catch (err) {
        toast(err.message || '离开失败');
        pollSoon(0);
        return;
      }
      cleanupSessionAndHome();
    }
  });
}

function confirmExitGame() {
  confirmModal({
    title: '退出到首页',
    message: '对局仍在进行中。退出到首页不会离开座位，凭本机记录可以稍后继续；清除记录后将无法回来。',
    confirmLabel: '退出到首页',
    onConfirm: () => {
      stopPolling();
      voice?.leaveSilently();
      voice?.closePanel();
      closeDrawerDom();
      S.ui.drawer = 'closed';
      S.state = null;
      S.view = 'home';
      S.ui.gameVersion = -1;
      renderHomeView();
      updateVoiceButton();
      toast('已退出到首页，可以随时继续对局', 'info');
    }
  });
}

function cleanupSessionAndHome() {
  stopPolling();
  voice?.leaveSilently();
  voice?.closePanel();
  closeDrawerDom();
  S.ui.drawer = 'closed';
  clearSession();
  urlClearRoom();
  S.state = null;
  S.view = 'home';
  S.restoring = false;
  S.ui.gameVersion = -1;
  S.ui.lobbySig = '';
  S.ui.logUnread = 0;
  S.ui.chatUnread = 0;
  resetTransientGameUi();
  renderHomeView();
  updateVoiceButton();
  toast('已返回首页', 'info');
}

async function leaveRoomAfterGame() {
  if (S.session) {
    try { await api('/api/leave', sessionBody()); } catch { /* 已结束，忽略 */ }
  }
  cleanupSessionAndHome();
}

/* ============================================================
   牌桌总渲染
   ============================================================ */

function renderGameView() {
  const st = S.state;
  const g = st?.game;
  if (!g) { S.view = 'lobby'; renderLobbyView(); return; }
  const root = document.getElementById('view-root');
  if (!root) return;

  if (S.ui.targeting && (g.phase !== 'action' || !g.you?.isTurn || !(g.you.legal?.targets || []).length)) {
    S.ui.targeting = null;
  }

  const scrollY = window.scrollY;
  const view = h('div', { class: 'game' },
    buildTopbar('game'),
    orderStrip(g),
    playersGrid(g),
    handPanel(g),
    actionArea(g)
  );

  if (g.phase === 'exchange' && g.pending?.actorId === g.you?.id) {
    const overlay = exchangeOverlay(g);
    if (overlay) view.append(overlay);
  } else if (g.phase === 'loseLife' && g.pending?.playerId === g.you?.id) {
    const overlay = loseLifeOverlay(g);
    if (overlay) view.append(overlay);
  }
  if (g.status === 'over') view.append(resultOverlay(g));

  root.replaceChildren(view);
  if (scrollY > 0) {
    requestAnimationFrame(() => { window.scrollTo(0, Math.min(scrollY, document.body.scrollHeight)); });
  }
  updateBadges();
  updateSoundButtons();
  updateVoiceButton();
}

function orderStrip(g) {
  const strip = h('div', { class: 'order-strip', 'aria-label': '行动顺序' });
  strip.append(h('span', { class: 'order-label', text: '行动顺序' }));
  const order = Array.isArray(g.turnOrder) ? g.turnOrder : [];
  order.forEach((id, index) => {
    const p = playerById(g, id);
    const classes = ['order-node'];
    if (id === g.turnPlayerId && g.status === 'playing') classes.push('is-current');
    if (p && !p.alive) classes.push('is-dead');
    const node = h('span', { class: classes.join(' '), title: id === g.startPlayerId ? '起始玩家' : '' },
      h('span', { class: 'seat-dot', 'aria-hidden': 'true' }),
      h('span', { text: p?.name || '?' })
    );
    strip.append(node);
    if (index < order.length - 1) strip.append(h('span', { class: 'order-arrow', text: '›', 'aria-hidden': 'true' }));
  });
  return strip;
}

function playersGrid(g) {
  const grid = h('div', { class: 'players-grid', 'aria-label': '玩家列表' });
  const me = g.you;
  const legal = g.you?.legal || {};
  const targetIds = new Set(Array.isArray(legal.targets) ? legal.targets : []);
  for (const p of g.players || []) {
    const targetable = Boolean(
      S.ui.targeting && p.alive && p.id !== me?.id && targetIds.has(p.id)
    );
    grid.append(playerCardEl(g, p, targetable));
  }
  return grid;
}

function playerCardEl(g, p, targetable) {
  const me = g.you;
  const isCurrent = g.turnPlayerId === p.id && g.status === 'playing';
  const isHost = S.state?.room?.hostId === p.id;
  const prevCoins = S.ui.lastCoins.get(p.id);
  const coinChanged = prevCoins !== undefined && prevCoins !== p.coins;
  const prevLives = S.ui.lastLives.get(p.id);
  const lifeLost = prevLives !== undefined && p.handCount < prevLives;
  S.ui.lastCoins.set(p.id, p.coins);
  S.ui.lastLives.set(p.id, p.handCount);

  const classes = ['player'];
  if (isCurrent) classes.push('is-current');
  if (p.isYou) classes.push('is-you');
  if (!p.alive) classes.push('is-dead');
  if (p.online === false) classes.push('is-offline');
  if (targetable) classes.push('is-targetable');

  const tags = h('span', { class: 'player-badges' });
  if (isHost) tags.append(h('span', { class: 'tag tag-host', text: '房主' }));
  if (p.isYou) tags.append(h('span', { class: 'tag tag-you', text: '你' }));
  if (!p.alive) tags.append(h('span', { class: 'tag tag-dead', text: '出局' }));
  else if (isCurrent) tags.append(h('span', { class: 'tag tag-turn', text: '行动中' }));

  const coinClasses = ['coins'];
  if (coinChanged) coinClasses.push(p.coins > prevCoins ? 'coin-up' : 'coin-down');
  if (p.coins >= 11) coinClasses.push('is-full');
  const coins = h('span', { class: coinClasses.join(' '), 'aria-label': `${p.coins} 金币` },
    iconSpan('coin'),
    h('b', { text: String(p.coins) })
  );

  const stats = h('div', { class: 'player-stats' },
    coins,
    p.online === false ? h('span', { class: 'player-offline', text: '离线' }) : null
  );

  const lives = h('div', {
    class: `lives${lifeLost ? ' life-lost-anim' : ''}`,
    'aria-label': `剩余生命 ${p.handCount}`
  });
  if (p.alive) {
    const revealHand = p.hand && (p.isYou || g.status === 'over');
    if (revealHand) {
      p.hand.forEach((card) => lives.append(buildRoleCard(card.role, { size: 'xs' })));
    } else {
      for (let i = 0; i < p.handCount; i++) {
        lives.append(buildRoleCard(null, { size: 'xs', faceDown: true }));
      }
    }
  }

  const card = h(targetable ? 'button' : 'div', {
    class: classes.join(' '),
    type: targetable ? 'button' : null,
    'aria-label': targetable ? `选择 ${p.name} 作为目标` : null,
    onclick: targetable
      ? () => {
        if (S.ui.busyAction || !S.ui.targeting) return;
        const action = { type: S.ui.targeting, targetId: p.id };
        S.ui.targeting = null;
        postAction(action);
      }
      : null
  },
    h('div', { class: 'player-head' },
      h('span', { class: 'player-name', text: p.name }),
      tags
    ),
    stats,
    lives,
    targetable ? h('span', { class: 'player-target-hint', text: '点击选为目标' }) : null,
    p.deadRoles?.length
      ? h('div', { class: 'dead-roles' },
        h('span', { class: 'dead-label', text: '阵亡' }),
        p.deadRoles.map((role) => deadChip(role))
      )
      : null
  );
  return card;
}

function handPanel(g) {
  const me = playerById(g, g.you?.id);
  const hand = g.you?.hand || [];
  const panel = h('section', { class: 'hand-panel', 'aria-label': '你的手牌' });
  panel.append(h('div', { class: 'hand-head' },
    h('span', { class: 'label', text: '手牌' }),
    h('span', { class: 'who', text: g.you?.name || '你' }),
    h('span', { class: 'meta', text: `${hand.length} 条命 · ${me?.coins ?? 0} 金币` })
  ));
  const row = h('div', { class: 'hand-row' });
  if (!me?.alive && g.status !== 'over') {
    row.append(h('p', { class: 'fineprint', text: '你已出局，正在观战。' }));
  } else if (!hand.length) {
    row.append(h('p', { class: 'fineprint', text: '你已没有角色牌。' }));
  } else {
    hand.forEach((card) => {
      row.append(roleCardButton(card.role, {
        ariaLabel: `查看手牌：${roleName(card.role)}`,
        onclick: () => openCardDetail(card.role)
      }));
    });
  }
  panel.append(row);
  return panel;
}

/* ============================================================
   行动区
   ============================================================ */

function actionArea(g) {
  if (g.status === 'over' || g.phase === 'over') {
    return h('section', { class: 'action-panel', 'aria-label': '对局状态' },
      h('div', { class: 'turn-waiting' }, h('span', { text: '对局已结束，正在展示结算。' }))
    );
  }
  const me = g.you;
  const alive = Boolean(playerById(g, me?.id)?.alive);
  if (g.phase !== 'action') return buildPendingPanel(g);
  if (!alive) {
    return h('section', { class: 'action-panel', 'aria-label': '观战' },
      h('div', { class: 'turn-waiting' }, iconSpan('eye'), h('span', { text: '你已出局，正在观战。' }))
    );
  }
  if (!me?.isTurn || !me?.legal?.canAct) return waitingTurnPanel(g);
  if (S.ui.targeting) return targetSelectPanel(g);
  return buildActionBar(g);
}

function waitingTurnPanel(g) {
  const current = playerById(g, g.turnPlayerId);
  return h('section', { class: 'action-panel', 'aria-label': '等待行动' },
    h('div', { class: 'turn-waiting' },
      h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      h('span', {}, document.createTextNode('等待 '), h('strong', { text: current?.name || '其他玩家' }), document.createTextNode(' 行动…')),
      h('span', { class: 'pieces', text: '观望' })
    )
  );
}

function buildActionBar(g) {
  const legal = g.you.legal || {};
  const me = playerById(g, g.you.id);
  const mustCoup = Boolean(legal.mustCoup);
  const panel = h('section', { class: 'action-panel', 'aria-labelledby': 'action-title' });
  panel.append(h('div', { class: 'action-head' },
    h('h2', { class: 'action-title', id: 'action-title' }, iconSpan('bolt'), '你的行动'),
    h('span', { class: 'action-sub', text: `金币 ${me?.coins ?? 0} / 11 · 选择一项行动` })
  ));

  if (legal.bishopInfo) {
    const info = legal.bishopInfo;
    panel.append(h('p', { class: 'fineprint' },
      document.createTextNode('主教可复制：'),
      h('strong', { text: roleName(info.role) }),
      document.createTextNode(` 的「${roleInfo(info.role).activeName || ''}」`),
      info.cost ? document.createTextNode(`（需 ${info.cost} 金币）`) : null
    ));
  } else if (legal.bishop === false && (g.deathLog || []).length > 0) {
    panel.append(h('p', { class: 'fineprint', text: '主教暂无可复制的主动技能（最后阵亡的是领主，或只阵亡过主教）。' }));
  }

  if (mustCoup) {
    panel.append(h('div', { class: 'must-coup-banner' },
      iconSpan('crown'),
      h('span', { text: '金币已达 11，必须发动政变。' })
    ));
  }

  const grid = h('div', { class: 'act-grid' });
  for (const cfg of ACTION_CONFIG) {
    grid.append(actionButtonEl(g, cfg, legal, mustCoup));
  }
  panel.append(grid);

  if (!mustCoup) {
    panel.append(h('p', {
      class: 'fineprint',
      text: '你可以伪装成任何角色发动技能；被质疑且手里没有该角色时，你会失去一条命。'
    }));
  }
  return panel;
}

function actionButtonEl(g, cfg, legal, mustCoup) {
  let name = cfg.name;
  let sub = cfg.sub;
  let needsTarget = Boolean(cfg.target);
  if (cfg.type === 'bishop') {
    const info = legal.bishopInfo;
    if (info) {
      name = `复制 · ${roleName(info.role)}`;
      sub = `${roleInfo(info.role).activeName || ''}${info.cost ? ` · ${info.cost} 金币` : ''}`;
      needsTarget = Boolean(info.needsTarget);
    } else {
      sub = '暂无可复制技能';
      needsTarget = false;
    }
  }
  const disabled = S.ui.busyAction || !legal[cfg.legalKey] || (mustCoup && cfg.type !== 'coup');
  const reason = S.ui.busyAction ? '请求处理中…' : (disabled ? disabledReason(g, cfg, legal) : '');
  const emblem = cfg.role ? roleArt(cfg.role) : icon(cfg.icon || 'coin');
  const btn = h('button', {
    class: `act-btn${mustCoup && cfg.type === 'coup' ? ' is-priority' : ''}`,
    type: 'button',
    disabled,
    title: reason || sub,
    'aria-label': `${name}：${sub}${reason ? `（不可用：${reason}）` : ''}`,
    onclick: () => handleActionClick(cfg, needsTarget)
  },
    h('span', { class: 'act-emblem', html: emblem, 'aria-hidden': 'true' }),
    h('span', { class: 'act-text' },
      h('span', { class: 'act-name', text: name }),
      h('span', { class: 'act-sub', text: reason || sub })
    )
  );
  return btn;
}

function disabledReason(g, cfg, legal) {
  const me = playerById(g, g.you.id);
  if (legal.mustCoup && cfg.type !== 'coup') return '金币已满，必须政变';
  if (cfg.type === 'assassinate' && (me?.coins ?? 0) < 3) return '需要 3 金币';
  if (cfg.type === 'coup' && (me?.coins ?? 0) < 7) return '需要 7 金币';
  if (cfg.type === 'bishop' && !legal.bishopInfo) return '暂无可复制的技能';
  if ((cfg.type === 'steal' || cfg.type === 'coup' || cfg.type === 'assassinate') &&
    !(legal.targets || []).length) return '没有可指定的目标';
  if (cfg.type === 'steal' && !legal.steal) return '当前不可用';
  return '当前不可用';
}

function handleActionClick(cfg, needsTarget) {
  if (S.ui.busyAction) return;
  const g = S.state?.game;
  const legal = g?.you?.legal || {};
  if (!legal[cfg.legalKey]) return;
  if (needsTarget) {
    S.ui.targeting = cfg.type;
    renderGameView();
    return;
  }
  postAction({ type: cfg.type });
}

function targetSelectPanel(g) {
  const cfg = ACTION_CONFIG.find((item) => item.type === S.ui.targeting);
  const panel = h('section', { class: 'pending-panel', 'aria-labelledby': 'target-title' });
  panel.append(h('div', { class: 'pending-head' },
    h('h2', { class: 'phase-title', id: 'target-title' }, iconSpan('target'), '选择目标'),
    countdownEl(null)
  ));
  panel.append(h('p', { class: 'pending-desc', text: `请为「${cfg?.name || '行动'}」选择一名存活的其他玩家。` }));
  panel.append(h('p', { class: 'fineprint', text: '点击上方高亮的玩家卡牌即可确认，或取消本次行动。' }));
  panel.append(h('div', { class: 'choice-row' },
    h('button', {
      class: 'btn btn-ghost btn-big',
      type: 'button',
      onclick: () => { S.ui.targeting = null; renderGameView(); }
    }, '取消')
  ));
  return panel;
}

async function postAction(action) {
  if (!S.session || S.ui.busyAction) return;
  S.ui.busyAction = true;
  S.ui.targeting = null;
  renderGameView();
  try {
    const st = await api('/api/action', { ...sessionBody(), action });
    applyState(st, { force: false });
  } catch (err) {
    toast(err.message || '行动失败');
    if (err?.status === 409 || err?.status === 400) pollSoon(0);
  } finally {
    S.ui.busyAction = false;
    if (S.view === 'game') requestAnimationFrame(() => { if (S.view === 'game') renderGameView(); });
  }
}

async function postResponse(response) {
  if (!S.session || S.ui.busyAction) return;
  S.ui.busyAction = true;
  try {
    const st = await api('/api/respond', { ...sessionBody(), response });
    applyState(st, { force: false });
  } catch (err) {
    toast(err.message || '操作失败');
    if (err?.status === 409 || err?.status === 400) pollSoon(0);
  } finally {
    S.ui.busyAction = false;
    if (S.view === 'game') requestAnimationFrame(() => { if (S.view === 'game') renderGameView(); });
  }
}

/* ============================================================
   待响应阶段
   ============================================================ */

function buildPendingPanel(g) {
  const pending = g.pending;
  if (!pending) {
    return h('section', { class: 'action-panel' },
      h('div', { class: 'turn-waiting' },
        h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
        h('span', { text: '正在结算…' })
      )
    );
  }
  switch (g.phase) {
    case 'challenge':
      return challengePanel(g, pending, 'challenge');
    case 'blockChallenge':
      return challengePanel(g, pending, 'blockChallenge');
    case 'block':
      return blockPanel(g, pending);
    case 'exchange':
      return exchangeWaitingPanel(g, pending);
    case 'loseLife':
      return loseLifeWaitingPanel(g, pending);
    default:
      return h('section', { class: 'action-panel' },
        h('div', { class: 'turn-waiting' }, h('span', { text: '等待其他玩家操作…' }))
      );
  }
}

function pendingLabelText(label) {
  if (!label) return '';
  const parts = String(label).split(' · ');
  if (parts.length > 1 && ROLE_MAP[parts[0]] !== undefined) return parts.slice(1).join(' · ');
  return String(label);
}

function eligibilityEl(g, pending) {
  const eligible = pending.eligible || [];
  const passed = pending.passed || [];
  const row = h('div', { class: 'eligible-line' });
  row.append(h('span', { text: '可质疑者' }));
  eligible.forEach((id) => {
    const p = playerById(g, id);
    row.append(h('span', {
      class: `who-chip${passed.includes(id) ? ' is-passed' : ''}`,
      text: `${p?.name || '?'}${passed.includes(id) ? ' · 已放弃' : ''}`
    }));
  });
  row.append(h('span', { class: 'passed-count', text: `${passed.length}/${eligible.length} 已放弃` }));
  return row;
}

function challengePanel(g, pending, mode) {
  const isBlockChallenge = mode === 'blockChallenge';
  const me = g.you;
  const actor = playerById(g, pending.actorId);
  const blocker = pending.blockerId ? playerById(g, pending.blockerId) : null;
  const eligible = pending.eligible || [];
  const passed = pending.passed || [];
  const iCan = eligible.includes(me.id) && !passed.includes(me.id);
  const panel = h('section', {
    class: 'pending-panel',
    'aria-labelledby': 'pending-title'
  });
  panel.append(h('div', { class: 'pending-head' },
    h('h2', { class: 'phase-title', id: 'pending-title' },
      iconSpan('scale'),
      isBlockChallenge ? '阻止质疑' : '质疑阶段'
    ),
    countdownEl(pending.deadline)
  ));

  if (isBlockChallenge) {
    panel.append(h('p', { class: 'claim-line' },
      h('b', { class: 'who', text: actor?.name || '某人' }),
      document.createTextNode(' 的行动「'),
      h('span', { class: 'role-claim', text: pendingLabelText(pending.label) || '行动' }),
      document.createTextNode('」被 '),
      h('b', { class: 'who', text: blocker?.name || '有人' }),
      document.createTextNode(' 声称以「'),
      h('span', { class: 'role-claim', text: roleName(pending.blockRole) }),
      document.createTextNode('」阻止。')
    ));
  } else {
    panel.append(h('p', { class: 'claim-line' },
      h('b', { class: 'who', text: actor?.name || '某人' }),
      document.createTextNode(' 宣称「'),
      h('span', { class: 'role-claim', text: roleName(pending.claimedRole) }),
      document.createTextNode('」'),
      pending.label ? h('span', { class: 'claim-sub', text: ` · ${pendingLabelText(pending.label)}` }) : null
    ));
    if (pending.targetId) {
      const target = playerById(g, pending.targetId);
      if (target) panel.append(h('p', { class: 'claim-sub', text: `目标：${target.name}` }));
    }
  }

  panel.append(eligibilityEl(g, pending));

  if (iCan) {
    panel.append(h('div', { class: 'choice-row' },
      h('button', {
        class: 'btn btn-danger btn-big',
        type: 'button',
        onclick: () => postResponse({ type: 'challenge' })
      }, iconSpan('scale'), '质疑'),
      h('button', {
        class: 'btn btn-ghost btn-big',
        type: 'button',
        onclick: () => postResponse({ type: 'pass' })
      }, '不质疑')
    ));
    panel.append(h('p', {
      class: 'fineprint',
      text: isBlockChallenge
        ? '质疑失败：你失去 1 条命，阻止成立。质疑成功：阻止者失去 1 条命，原行动继续。'
        : '质疑失败：你失去 1 条命，行动继续。质疑成功：冒充者失去 1 条命，本次行动取消。'
    }));
  } else if ((isBlockChallenge ? pending.blockerId : pending.actorId) === me.id) {
    panel.append(waitingBox(isBlockChallenge
      ? '你是阻止者，等待其他人质疑你的声称…'
      : '你是此行动的宣称者，等待其他人质疑…'));
    if (isBlockChallenge && againstAssassinate(pending)) {
      panel.append(h('p', {
        class: 'fineprint is-danger',
        text: '风险：你谎称「领主 / 主教」阻止刺杀，一旦被质疑成功，会先失去 1 条命，随后刺杀仍然命中——2 条命会直接全部失去。'
      }));
    }
  } else if (passed.includes(me.id)) {
    panel.append(waitingBox('你已选择不质疑，等待其他玩家…'));
  } else {
    panel.append(waitingBox('等待其他玩家质疑…'));
  }
  return panel;
}

function blockPanel(g, pending) {
  const me = g.you;
  const actor = playerById(g, pending.actorId);
  const canBlock = pending.canBlockIds || [];
  const options = pending.options || [];
  const passed = pending.passed || [];
  const iCan = canBlock.includes(me.id) && !passed.includes(me.id);
  const isAid = pending.action === 'aid';
  const panel = h('section', { class: 'pending-panel', 'aria-labelledby': 'pending-title' });
  panel.append(h('div', { class: 'pending-head' },
    h('h2', { class: 'phase-title', id: 'pending-title' }, iconSpan('shield'), '阻止阶段'),
    countdownEl(pending.deadline)
  ));

  panel.append(h('p', { class: 'claim-line' },
    h('b', { class: 'who', text: actor?.name || '某人' }),
    document.createTextNode(' 的行动「'),
    h('span', { class: 'role-claim', text: pendingLabelText(pending.label) || '行动' }),
    document.createTextNode('」可以被阻止。')
  ));
  if (isAid) {
    panel.append(h('p', { class: 'fineprint', text: '任意其他存活玩家都可以宣称公爵，阻止这次援助 +2。' }));
  }

  if (iCan) {
    panel.append(h('p', { class: 'pending-desc', text: '你要阻止吗？' }));
    const grid = h('div', { class: 'role-choice-grid' });
    options.forEach((role) => {
      grid.append(h('button', {
        class: 'role-choice',
        type: 'button',
        onclick: () => postResponse({ type: 'block', role })
      },
        h('span', { class: 'rc-emblem', html: roleArt(role), 'aria-hidden': 'true' }),
        h('span', { class: 'rc-text' },
          h('span', { class: 'rc-name', text: `声称${roleName(role)}` }),
          h('span', { class: 'rc-sub', text: blockRoleHint(role) })
        )
      ));
    });
    panel.append(grid);
    panel.append(h('div', { class: 'choice-row' },
      h('button', {
        class: 'btn btn-ghost btn-big',
        type: 'button',
        onclick: () => postResponse({ type: 'noBlock' })
      }, isAid ? '不阻止' : '放弃阻止')
    ));
  } else if (passed.includes(me.id)) {
    panel.append(waitingBox('你已选择不阻止，等待其他玩家…'));
  } else {
    const names = canBlock
      .map((id) => playerById(g, id)?.name)
      .filter(Boolean)
      .join('、');
    panel.append(waitingBox(`等待 ${names || '可阻止者'} 决定是否阻止…`));
  }

  if (isAid && canBlock.length) {
    panel.append(h('div', { class: 'eligible-line' },
      h('span', { text: '已跳过阻止：' }),
      h('span', { class: 'passed-count', text: `${passed.length}/${canBlock.length}` })
    ));
  }
  panel.append(h('p', {
    class: 'fineprint',
    text: '阻止同样可以被质疑：阻止者若没有该角色，阻止失败且失去 1 条命。'
  }));
  if (iCan && againstAssassinate(pending)) {
    panel.append(h('p', {
      class: 'fineprint is-danger',
      text: '注意：被刺杀时谎称防刺角色且被质疑成功，你会先失去 1 条命，刺杀随后仍然命中；2 条命会直接全部失去。'
    }));
  }
  return panel;
}

function againstAssassinate(pending) {
  return pending?.action === 'assassinate' || (pending?.action === 'bishop' && pending?.copyRole === 'assassin');
}

function blockRoleHint(role) {
  switch (role) {
    case 'duke': return '阻止 · 援助 +2';
    case 'captain': return '阻止 · 偷取';
    case 'ambassador': return '阻止 · 偷取';
    case 'lord': return '阻止 · 刺杀';
    case 'bishop': return '阻止 · 刺杀（场上无人阵亡）';
    default: return '阻止';
  }
}

function exchangeWaitingPanel(g, pending) {
  const actor = playerById(g, pending.actorId);
  const panel = h('section', { class: 'pending-panel', 'aria-labelledby': 'pending-title' });
  panel.append(h('div', { class: 'pending-head' },
    h('h2', { class: 'phase-title', id: 'pending-title' }, iconSpan('exchange'), '交换角色牌'),
    countdownEl(pending.deadline)
  ));
  panel.append(waitingBox(`${actor?.name || '玩家'} 正在查看抽到的角色牌并交换…`));
  panel.append(h('div', { class: 'deck-line' },
    h('span', { text: '牌堆剩余' }),
    h('span', { class: 'num', text: `${g.deckCount} 张` })
  ));
  panel.append(h('p', { class: 'fineprint', text: '交换不会公开亮牌，只有使用者知道自己最终保留了什么。' }));
  return panel;
}

function loseLifeWaitingPanel(g, pending) {
  const p = playerById(g, pending.playerId);
  const panel = h('section', { class: 'pending-panel', 'aria-labelledby': 'pending-title' });
  panel.append(h('div', { class: 'pending-head' },
    h('h2', { class: 'phase-title is-crimson', id: 'pending-title' }, iconSpan('heart'), '失去生命'),
    countdownEl(pending.deadline)
  ));
  panel.append(waitingBox(`${p?.name || '玩家'} 正在选择要失去的角色牌…`));
  if (pending.reason) {
    panel.append(h('p', { class: 'claim-sub', text: `原因：${pending.reason}` }));
  }
  panel.append(h('p', { class: 'fineprint', text: '失去的角色牌会公开置入阵亡区，并且不补抽新牌。' }));
  return panel;
}

/* ============================================================
   交换 / 失去生命 弹窗
   ============================================================ */

function toggleExchange(uid, handSize) {
  const keep = S.ui.exchangeKeep;
  const pool = new Set();
  const hand = S.state?.game?.you?.hand || [];
  const drawn = S.state?.game?.pending?.drawn || [];
  [...hand, ...drawn].forEach((card) => pool.add(card.uid));
  if (!pool.has(uid)) return;
  if (keep.has(uid)) keep.delete(uid);
  else {
    if (keep.size >= handSize) {
      const first = keep.values().next().value;
      if (first !== undefined) keep.delete(first);
    }
    keep.add(uid);
  }
  renderGameView();
}

function exchangeOverlay(g) {
  const pending = g.pending;
  const hand = g.you?.hand || [];
  const drawn = pending.drawn || [];
  const handSize = hand.length;
  if (!handSize) return null;
  const pool = [...hand, ...drawn];
  if (!pool.length) return null;
  const key = `${g.version}:${pending.actorId}:${pool.map((c) => c.uid).join('-')}`;
  if (S.ui.exchangeKey !== key) {
    S.ui.exchangeKey = key;
    S.ui.exchangeKeep = new Set(hand.map((c) => c.uid));
  }
  const poolUids = new Set(pool.map((c) => c.uid));
  const keep = new Set([...S.ui.exchangeKeep].filter((uid) => poolUids.has(uid)));
  S.ui.exchangeKeep = keep;
  const drawnUids = new Set(drawn.map((c) => c.uid));

  const sheet = h('section', {
    class: 'sheet',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': '交换角色牌'
  });
  sheet.append(h('div', { class: 'sheet-head' },
    h('div', {},
      h('h2', { class: 'sheet-title' }, iconSpan('exchange'), '交换角色牌'),
      h('p', { class: 'sheet-sub', text: `从 ${pool.length} 张中保留 ${handSize} 张，其余退回牌堆洗混。` })
    ),
    countdownEl(pending.deadline)
  ));

  const grid = h('div', { class: 'pool-grid' });
  pool.forEach((card) => {
    const selected = keep.has(card.uid);
    grid.append(roleCardButton(card.role, {
      selected,
      newTag: drawnUids.has(card.uid),
      pressed: selected,
      ariaLabel: `${roleName(card.role)}，${selected ? '已选择保留' : '未选择'}${drawnUids.has(card.uid) ? '，新抽到' : ''}`,
      onclick: () => toggleExchange(card.uid, handSize)
    }));
  });
  sheet.append(grid);
  sheet.append(h('div', { class: 'deck-line' },
    h('span', { text: `牌堆剩余 ${g.deckCount} 张` }),
    h('span', { class: 'num', text: `已选 ${keep.size} / ${handSize}` })
  ));

  const confirm = h('button', {
    class: 'btn btn-gold',
    type: 'button',
    disabled: keep.size !== handSize,
    onclick: () => {
      const uids = [...S.ui.exchangeKeep];
      S.ui.exchangeKey = null;
      S.ui.exchangeKeep = new Set();
      postResponse({ type: 'exchange', keepUids: uids });
    }
  }, keep.size === handSize ? `确认保留 ${handSize} 张` : `已选 ${keep.size}/${handSize} 张`);

  sheet.append(h('div', { class: 'sheet-actions' },
    h('button', {
      class: 'btn btn-ghost',
      type: 'button',
      onclick: () => {
        S.ui.exchangeKeep = new Set(hand.map((c) => c.uid));
        renderGameView();
      }
    }, '保留原手牌'),
    confirm
  ));
  sheet.append(h('p', { class: 'fineprint', text: '选择超时会自动保留原手牌，不会卡住对局。' }));

  return h('div', { class: 'overlay pending-overlay' }, sheet);
}

function loseLifeOverlay(g) {
  const pending = g.pending;
  const hand = g.you?.hand || [];
  if (!hand.length) return null;
  const key = `${g.version}:${pending.playerId}:${hand.map((c) => c.uid).join('-')}`;
  if (S.ui.loseKey !== key) {
    S.ui.loseKey = key;
    S.ui.loseUid = null;
  }
  const sheet = h('section', {
    class: 'sheet',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': '选择失去的角色牌'
  });
  sheet.append(h('div', { class: 'sheet-head' },
    h('div', {},
      h('h2', { class: 'sheet-title' }, iconSpan('heart'), '失去一条命'),
      h('p', { class: 'sheet-sub', text: `原因：${pending.reason || '失去生命'}。选择一张角色牌永久失去。` })
    ),
    countdownEl(pending.deadline)
  ));

  const grid = h('div', { class: 'pool-grid' });
  hand.forEach((card) => {
    const selected = S.ui.loseUid === card.uid;
    grid.append(roleCardButton(card.role, {
      selected,
      pressed: selected,
      ariaLabel: `${selected ? '已选择' : '选择'}失去 ${roleName(card.role)}`,
      onclick: () => {
        S.ui.loseUid = card.uid;
        renderGameView();
      }
    }));
  });
  sheet.append(grid);
  sheet.append(h('div', { class: 'sheet-note', text: '失去的牌会公开，并成为「最后阵亡角色」。两张都失去就出局。' }));

  const confirm = h('button', {
    class: 'btn btn-danger btn-big',
    type: 'button',
    disabled: !S.ui.loseUid,
    onclick: () => {
      const uid = S.ui.loseUid;
      S.ui.loseKey = null;
      S.ui.loseUid = null;
      postResponse({ type: 'loseCard', uid });
    }
  }, '确认失去这张牌');

  sheet.append(h('div', { class: 'sheet-actions' }, confirm));
  sheet.append(h('p', { class: 'fineprint', text: '超时未选择时，系统会随机失去一张角色牌。' }));

  return h('div', { class: 'overlay pending-overlay' }, sheet);
}

/* ============================================================
   结算
   ============================================================ */

function resultOverlay(g) {
  const winner = g.winnerId ? playerById(g, g.winnerId) : null;
  const iWon = Boolean(winner && winner.id === g.you?.id);
  const isHost = Boolean(S.state?.me?.isHost);

  const panel = h('div', { class: 'result-panel' });
  panel.append(
    h('div', { class: 'result-crown', html: icon('crown'), 'aria-hidden': 'true' }),
    h('p', { class: 'result-kicker', text: '对局结束' }),
    h('h2', { class: 'result-title', text: winner ? `${winner.name} 加冕` : '无人生还' }),
    h('p', { class: 'result-winner' },
      iWon
        ? document.createTextNode('你是最后的幸存者。')
        : winner
          ? h('span', {}, document.createTextNode('最后的幸存者：'), h('strong', { text: winner.name }))
          : document.createTextNode('这一局没有幸存者。')
    )
  );

  const grid = h('div', { class: 'reveal-grid' });
  for (const p of g.players || []) {
    const row = h('div', { class: `reveal-row${p.id === g.winnerId ? ' is-winner' : ''}` });
    row.append(h('div', { class: 'reveal-name' },
      p.name,
      p.id === g.winnerId ? h('span', { class: 'tag tag-host', text: '胜者' }) : null,
      p.isYou ? h('span', { class: 'tag tag-you', text: '你' }) : null,
      !p.alive ? h('span', { class: 'tag tag-dead', text: '出局' }) : null
    ));
    const cards = h('div', { class: 'reveal-cards' });
    cards.append(h('span', { class: 'dead-label', text: '手牌' }));
    (p.hand || []).forEach((card) => cards.append(buildRoleCard(card.role, { size: 'sm' })));
    if (p.deadRoles?.length) {
      cards.append(h('span', { class: 'dead-label', text: '阵亡' }));
      p.deadRoles.forEach((role) => cards.append(buildRoleCard(role, { size: 'sm', dead: true })));
    }
    row.append(cards);
    grid.append(row);
  }
  panel.append(grid);

  const log = h('div', { class: 'result-log', 'aria-label': '最后日志' });
  const logs = (g.log || []).slice(-8);
  if (!logs.length) log.append(h('p', { text: '暂无日志。' }));
  logs.forEach((item) => log.append(h('p', { text: item.text })));
  panel.append(log);

  const actions = h('div', { class: 'result-actions' });
  if (isHost) {
    actions.append(h('button', {
      class: 'btn btn-gold btn-big',
      type: 'button',
      onclick: (ev) => rematch(ev.currentTarget)
    }, iconSpan('refresh'), '再来一局'));
  } else {
    actions.append(h('p', { class: 'fineprint', text: '等待房主发起下一局…' }));
  }
  actions.append(h('button', {
    class: 'btn btn-ghost btn-big',
    type: 'button',
    onclick: confirmLeaveAfterGame
  }, '返回首页'));
  panel.append(actions);

  const overlay = h('div', {
    class: 'overlay result-overlay',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': '对局结算'
  }, panel);
  return overlay;
}

async function rematch(btn) {
  if (!S.session) return;
  await busyBtn(btn, '正在准备下一局…', async () => {
    const st = await api('/api/rematch', sessionBody());
    resetTransientGameUi();
    applyState(st, { force: true });
    toast('新对局开始', 'ok');
  });
}

function confirmLeaveAfterGame() {
  confirmModal({
    title: '返回首页',
    message: '本局已结束，返回首页会离开房间，之后无法再回到这一局。',
    confirmLabel: '返回首页',
    danger: true,
    onConfirm: leaveRoomAfterGame
  });
}

/* ============================================================
   日志 / 聊天 / 抽屉
   ============================================================ */

function buildLogList() {
  const logs = S.state?.game?.log || [];
  const list = h('div', { class: 'log-list', 'aria-label': '游戏日志' });
  if (!logs.length) {
    list.append(h('p', {
      class: 'chat-empty',
      text: S.state?.game ? '暂无日志。' : '对局开始后，这里会记录公开信息。'
    }));
    return list;
  }
  const prevRendered = S.ui.logRenderedId;
  logs.forEach((item) => {
    list.append(h('div', {
      class: `log-item tone-${item.tone || 'info'}${item.id > prevRendered ? ' is-new' : ''}`
    },
      h('span', { class: 'log-time', text: fmtClock(item.ts, true) }),
      h('span', { class: 'log-text', text: item.text })
    ));
  });
  S.ui.logRenderedId = logs[logs.length - 1].id;
  return list;
}

function buildChatList() {
  const chat = S.state?.chat || [];
  const list = h('div', { class: 'chat-list', 'data-chat-list': '' });
  if (!chat.length) {
    list.append(h('p', { class: 'chat-empty', text: '还没有人说话。' }));
    return list;
  }
  for (const msg of chat) {
    if (msg.system) {
      list.append(h('div', { class: 'chat-msg is-system' },
        h('div', { class: 'chat-bubble', text: msg.text })
      ));
      continue;
    }
    const mine = Boolean(msg.from && S.session?.playerId === msg.from);
    list.append(h('div', { class: `chat-msg${mine ? ' is-me' : ''}` },
      h('div', { class: 'chat-meta' },
        h('span', { class: 'who', text: msg.name || '玩家' }),
        h('span', { class: 'time', text: fmtClock(msg.ts) })
      ),
      h('div', { class: 'chat-bubble', text: msg.text })
    ));
  }
  return list;
}

function refreshChatLists() {
  document.querySelectorAll('[data-chat-list]').forEach((old) => {
    const nearBottom = old.scrollHeight - old.scrollTop - old.clientHeight < 48;
    const fresh = buildChatList();
    fresh.scrollTop = nearBottom ? fresh.scrollHeight : old.scrollTop;
    old.replaceWith(fresh);
  });
}

async function submitChatForm(form) {
  const input = form?.querySelector('input');
  const submit = form?.querySelector('button[type="submit"]');
  const text = (input?.value || '').trim();
  if (!text || !S.session || S.ui.chatBusy) return;
  S.ui.chatBusy = true;
  if (submit) submit.disabled = true;
  try {
    const st = await api('/api/chat', { ...sessionBody(), text });
    if (input && input.isConnected) input.value = '';
    applyState(st);
  } catch (err) {
    toast(err.message || '发送失败');
  } finally {
    S.ui.chatBusy = false;
    if (submit && submit.isConnected) submit.disabled = false;
  }
}

function updateLogState(st) {
  const logs = st?.game?.log || [];
  const maxId = logs.length ? logs[logs.length - 1].id : 0;
  const prevMax = S.ui.logMaxId;
  S.ui.logMaxId = maxId;
  const visible = S.ui.drawer === 'open' && S.ui.drawerTab === 'log';
  if (visible) S.ui.logSeenId = maxId;
  S.ui.logUnread = logs.filter((item) => item.id > S.ui.logSeenId).length;
  if (visible && maxId !== prevMax) renderDrawerBody({ scrollBottom: true });
  updateBadges();
}

function updateChatState(st) {
  const chat = st?.chat || [];
  const maxId = chat.length ? chat[chat.length - 1].id : 0;
  const prevMax = S.ui.chatMaxId;
  S.ui.chatMaxId = maxId;
  const visible =
    (S.ui.drawer === 'open' && S.ui.drawerTab === 'chat') ||
    (S.view === 'lobby' && S.ui.drawer !== 'open');
  if (visible) S.ui.chatSeenId = maxId;
  S.ui.chatUnread = chat.filter((item) => item.id > S.ui.chatSeenId).length;
  if (maxId !== prevMax) refreshChatLists();
  updateBadges();
}

function updateBadges() {
  const unread = (S.ui.logUnread || 0) + (S.ui.chatUnread || 0);
  document.querySelectorAll('.record-toggle').forEach((btn) => {
    const badge = btn.querySelector('.badge');
    if (badge) {
      badge.hidden = unread <= 0;
      badge.textContent = unread > 9 ? '9+' : String(unread);
    }
    btn.setAttribute('aria-label', unread > 0
      ? `打开日志与聊天（${unread} 条未读）`
      : '打开日志与聊天');
  });
  const logBadge = document.getElementById('badge-log');
  if (logBadge) {
    logBadge.hidden = (S.ui.logUnread || 0) <= 0;
    logBadge.textContent = S.ui.logUnread > 9 ? '9+' : String(S.ui.logUnread || 0);
  }
  const chatBadge = document.getElementById('badge-chat');
  if (chatBadge) {
    chatBadge.hidden = (S.ui.chatUnread || 0) <= 0;
    chatBadge.textContent = S.ui.chatUnread > 9 ? '9+' : String(S.ui.chatUnread || 0);
  }
}

function setupDrawer() {
  const drawer = document.getElementById('drawer');
  if (!drawer) return;
  document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);
  drawer.querySelector('[data-drawer-close]')?.addEventListener('click', closeDrawer);
  document.getElementById('tab-log')?.addEventListener('click', () => setDrawerTab('log'));
  document.getElementById('tab-chat')?.addEventListener('click', () => setDrawerTab('chat'));
  const closeBtn = document.getElementById('drawer-close');
  if (closeBtn) closeBtn.innerHTML = icon('close');
  document.getElementById('chat-form')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    submitChatForm(ev.currentTarget);
  });
  document.getElementById('drawer-sound')?.addEventListener('click', toggleSound);
}

function openDrawer(tab = 'log') {
  if (!S.state) {
    toast('还没有可查看的记录');
    return;
  }
  S.ui.drawer = 'open';
  S.ui.drawerTab = tab === 'chat' ? 'chat' : 'log';
  const drawer = document.getElementById('drawer');
  if (!drawer) return;
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  syncDrawerChrome();
  renderDrawerBody({ scrollBottom: true });
  markDrawerSeen();
  updateBadges();
}

function closeDrawer() {
  S.ui.drawer = 'closed';
  closeDrawerDom();
  updateBadges();
}

function closeDrawerDom() {
  const drawer = document.getElementById('drawer');
  if (!drawer) return;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
}

function setDrawerTab(tab) {
  S.ui.drawerTab = tab === 'chat' ? 'chat' : 'log';
  syncDrawerChrome();
  renderDrawerBody({ scrollBottom: true });
  markDrawerSeen();
  updateBadges();
}

function syncDrawerChrome() {
  const logTab = document.getElementById('tab-log');
  const chatTab = document.getElementById('tab-chat');
  const form = document.getElementById('chat-form');
  const isChat = S.ui.drawerTab === 'chat';
  if (logTab) {
    logTab.classList.toggle('is-active', !isChat);
    logTab.setAttribute('aria-selected', String(!isChat));
  }
  if (chatTab) {
    chatTab.classList.toggle('is-active', isChat);
    chatTab.setAttribute('aria-selected', String(isChat));
  }
  if (form) form.hidden = !isChat;
}

function renderDrawerBody({ scrollBottom = false } = {}) {
  const body = document.getElementById('drawer-body');
  if (!body) return;
  const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 48;
  if (S.ui.drawerTab === 'chat') {
    body.replaceChildren(buildChatList());
    const form = document.getElementById('chat-form');
    if (form) form.hidden = false;
  } else {
    body.replaceChildren(buildLogList());
    const form = document.getElementById('chat-form');
    if (form) form.hidden = true;
  }
  if (scrollBottom || nearBottom) {
    body.scrollTop = body.scrollHeight;
  }
}

function markDrawerSeen() {
  if (S.ui.drawer !== 'open') return;
  if (S.ui.drawerTab === 'chat') {
    S.ui.chatSeenId = S.ui.chatMaxId;
    S.ui.chatUnread = 0;
  } else {
    S.ui.logSeenId = S.ui.logMaxId;
    S.ui.logUnread = 0;
  }
  updateBadges();
}

/* ============================================================
   规则 / 卡牌详情
   ============================================================ */

function openRules() {
  const template = document.getElementById('tpl-rules');
  if (!template) {
    toast('规则内容加载失败');
    return;
  }
  const content = template.content.cloneNode(true);
  const rolesBox = content.querySelector('#rules-roles');
  if (rolesBox) {
    ROLE_DEFS.forEach((role) => {
      rolesBox.append(h('div', { class: 'rules-role' },
        buildRoleCard(role.id, { size: 'sm' }),
        h('div', { class: 'rr-body' },
          h('span', { class: 'rr-name', text: role.name }),
          h('span', { class: 'rr-skill', text: role.tagline })
        )
      ));
    });
  }
  openModal({
    title: '政变 · 完整规则',
    subtitle: '自定义 Coup 变体 · 2–6 人',
    body: content,
    wide: true,
    actions: [{ label: '明白了', class: 'btn btn-gold', onClick: closeModal }]
  });
}

function openCardDetail(roleId) {
  const info = roleInfo(roleId);
  const body = h('div', { class: 'card-detail' },
    buildRoleCard(roleId, { size: 'lg' }),
    h('div', { class: 'card-detail-body' },
      h('h3', { text: info.name }),
      h('div', { class: 'en', text: info.en || '' }),
      h('span', { class: 'detail-tag', text: info.tagline || '' }),
      h('p', { text: info.skill || info.desc || '' }),
      h('p', { class: 'fineprint', text: '这是你的手牌，只有你能看到。你可以伪装成任何角色，但被质疑且手里没有该角色时会失去一条命。' })
    )
  );
  openModal({
    title: '角色牌详情',
    subtitle: '仅你可见',
    body,
    actions: [{ label: '关闭', class: 'btn btn-ghost', onClick: closeModal }]
  });
}

/* ============================================================
   全局事件与启动
   ============================================================ */

function showConnBanner() {
  const banner = document.getElementById('conn-banner');
  if (banner) banner.hidden = false;
}

function hideConnBanner() {
  const banner = document.getElementById('conn-banner');
  if (banner) banner.hidden = true;
}

function bindGlobalEvents() {
  window.addEventListener('online', () => {
    if (S.session) {
      hideConnBanner();
      pollSoon(0);
    }
  });
  window.addEventListener('offline', () => showConnBanner());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && S.session) pollSoon(0);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (S.ui.modalOpen) {
      closeModal();
      return;
    }
    if (S.ui.drawer === 'open') {
      closeDrawer();
    }
  });
  window.addEventListener('pagehide', () => {
    try { voice?.leave({ silent: true }); } catch { /* ignore */ }
  });
}

function boot() {
  try { S.ui.homeName = localStorage.getItem(NAME_KEY) || ''; } catch { /* ignore */ }
  try { S.sound = localStorage.getItem(SOUND_KEY) === '1'; } catch { S.sound = false; }
  const params = new URLSearchParams(location.search);
  const roomParam = (params.get('room') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (roomParam) S.roomPrefill = roomParam;

  bindGlobalEvents();
  setupDrawer();
  initVoiceController();

  const session = loadSession();
  if (session) {
    S.session = session;
    if (!S.ui.homeName) S.ui.homeName = session.name;
    S.view = 'home';
    renderHomeView();
    restoreSession();
  } else {
    S.view = 'home';
    renderHomeView();
  }

  setInterval(tickCountdowns, 250);
  updateSoundButtons();
  updateVoiceButton();
}

boot();
