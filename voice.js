// 政变 — 轻量 WebRTC 语音（实验性）
// 独立模块：不参与游戏逻辑；任何失败都只 toast，不影响对局。

const MIC_ON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3Z"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M8.5 21h7"/></svg>`;
const MIC_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 9v2.5a3 3 0 0 0 4.6 2.5"/><path d="M15 9.5V6.5a3 3 0 0 0-5.6-1.5"/><path d="M5.5 11a6.5 6.5 0 0 0 10.1 5.5"/><path d="M18.5 11a6.5 6.5 0 0 1-.6 2.7"/><path d="M12 17.5V21"/><path d="M8.5 21h7"/><path d="M4 4l16 16"/></svg>`;
const CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
const USERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5"/><path d="M16 5.4a3 3 0 0 1 0 5.4"/><path d="M17.5 14.4c2 .5 3.2 2.2 3.5 4.6"/></svg>`;
const HANGUP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14.2c4.8-4.3 11.2-4.3 16 0l-2.1 2.5c-.5.6-1.3.7-2 .4l-2-1a1.8 1.8 0 0 1-1-1.7v-1a9.6 9.6 0 0 0-3.8 0v1c0 .7-.4 1.4-1 1.7l-2 1c-.7.3-1.5.2-2-.4Z"/></svg>`;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'disabled' || key === 'hidden' || key === 'checked') node[key] = Boolean(value);
    else if (key === 'value') node.value = value;
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

async function requestJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
    cache: 'no-store'
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const err = new Error(data?.error || `语音请求失败（${res.status}）`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function createVoiceController({ getSession, toast, onChange }) {
  const state = {
    joined: false,
    joining: false,
    muted: false,
    members: [],
    meMuted: false,
    stream: null,
    pcs: new Map(),
    pendingIce: new Map(),
    audioEls: new Map(),
    pollTimer: null,
    pollBusy: false,
    since: 0,
    panelOpen: false,
    memberSig: '',
    error: ''
  };

  let root = null;

  function notify() {
    try { onChange?.(); } catch { /* 不影响语音 */ }
  }

  function ensureRoot() {
    if (!root) {
      root = document.createElement('div');
      root.id = 'voice-root';
      document.body.append(root);
    }
    return root;
  }

  function session() {
    return getSession?.() || null;
  }

  // ---------- 信号与轮询 ----------

  function sendSignal(to, type, data) {
    const s = session();
    if (!s || !state.joined || !to) return;
    requestJson('/api/voice/signal', {
      code: s.code, playerId: s.playerId, token: s.token, to, type, data
    }).catch(() => {});
  }

  function startPoll(delay = 500) {
    stopPoll();
    state.pollTimer = setTimeout(pollOnce, delay);
  }

  function stopPoll() {
    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }
  }

  async function pollOnce() {
    state.pollTimer = null;
    const s = session();
    if (!state.joined || !s) return;
    if (state.pollBusy) { startPoll(500); return; }
    state.pollBusy = true;
    try {
      const q = new URLSearchParams({
        code: s.code, pid: s.playerId, token: s.token, since: String(state.since)
      });
      const res = await fetch(`/api/voice/poll?${q}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 409) { hardStop('语音连接已结束'); return; }
        if (res.status === 401 || res.status === 404) { hardStop('语音连接已结束'); return; }
        throw new Error(data?.error || '语音轮询失败');
      }
      for (const sig of data.signals || []) {
        if (typeof sig.id === 'number') state.since = Math.max(state.since, sig.id);
        try { await handleSignal(sig); } catch { /* 单条信令失败不影响其他 */ }
      }
      if (data.voice) setVoiceState(data.voice);
      state.pollBusy = false;
      startPoll(600);
    } catch {
      state.pollBusy = false;
      if (state.joined) startPoll(1600);
    }
  }

  async function handleSignal(sig) {
    const from = sig.from;
    if (!from || from === session()?.playerId) return;
    const data = sig.data;
    if (sig.type === 'bye') { closePeer(from, false); return; }
    if (sig.type === 'offer') {
      let pc = state.pcs.get(from);
      if (!pc) pc = createPeer(from, false);
      if (!pc) return;
      await pc.setRemoteDescription(data);
      await flushIce(from, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(from, 'answer', { type: answer.type, sdp: answer.sdp });
      return;
    }
    if (sig.type === 'answer') {
      const pc = state.pcs.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(data);
      await flushIce(from, pc);
      return;
    }
    if (sig.type === 'ice') {
      if (!data) return;
      const pc = state.pcs.get(from);
      if (!pc) return;
      if (pc.remoteDescription) {
        try { await pc.addIceCandidate(data); } catch { /* 忽略过期候选 */ }
      } else {
        const queue = state.pendingIce.get(from) || [];
        queue.push(data);
        state.pendingIce.set(from, queue);
      }
    }
  }

  async function flushIce(remoteId, pc) {
    const queue = state.pendingIce.get(remoteId) || [];
    state.pendingIce.set(remoteId, []);
    for (const candidate of queue) {
      try { await pc.addIceCandidate(candidate); } catch { /* 忽略 */ }
    }
  }

  // ---------- mesh ----------

  function syncMesh() {
    const me = session()?.playerId;
    if (!state.joined || !state.stream || !me) { closeAllPeers(); return; }
    const ids = new Set(
      state.members
        .filter((m) => m && m.id !== me && m.online !== false)
        .map((m) => m.id)
    );
    for (const id of ids) {
      if (!state.pcs.has(id)) createPeer(id, String(me) < String(id));
    }
    for (const id of [...state.pcs.keys()]) {
      if (!ids.has(id)) closePeer(id, false);
    }
  }

  function createPeer(remoteId, initiator) {
    if (state.pcs.has(remoteId)) return state.pcs.get(remoteId);
    let pc;
    try {
      // 不依赖公共 STUN；局域网/同一 NAT 下通常可用，公网复杂网络可能连不上。
      pc = new RTCPeerConnection({ iceServers: [] });
    } catch { return null; }
    state.pcs.set(remoteId, pc);
    state.pendingIce.set(remoteId, []);
    try {
      for (const track of state.stream.getTracks()) pc.addTrack(track, state.stream);
    } catch { /* ignore */ }
    pc.onicecandidate = (ev) => {
      if (ev.candidate) sendSignal(remoteId, 'ice', ev.candidate.toJSON());
    };
    pc.ontrack = (ev) => playRemote(remoteId, ev);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') closePeer(remoteId, false);
    };
    if (initiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => sendSignal(remoteId, 'offer', { type: pc.localDescription.type, sdp: pc.localDescription.sdp }))
        .catch(() => {});
    }
    return pc;
  }

  function playRemote(remoteId, ev) {
    let audio = state.audioEls.get(remoteId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', '');
      audio.dataset.voiceFor = remoteId;
      audio.style.display = 'none';
      state.audioEls.set(remoteId, audio);
      document.body.append(audio);
    }
    if (ev.streams && ev.streams[0]) audio.srcObject = ev.streams[0];
    else if (ev.track) audio.srcObject = new MediaStream([ev.track]);
    audio.play().catch(() => { /* 浏览器自动播放限制 */ });
  }

  function closePeer(remoteId, notify) {
    const pc = state.pcs.get(remoteId);
    if (notify) sendSignal(remoteId, 'bye', null);
    state.pcs.delete(remoteId);
    state.pendingIce.delete(remoteId);
    if (pc) { try { pc.close(); } catch { /* ignore */ } }
    const audio = state.audioEls.get(remoteId);
    if (audio) {
      try { audio.srcObject = null; } catch { /* ignore */ }
      audio.remove();
      state.audioEls.delete(remoteId);
    }
  }

  function closeAllPeers() {
    for (const id of [...state.pcs.keys()]) closePeer(id, false);
    for (const audio of state.audioEls.values()) {
      try { audio.srcObject = null; } catch { /* ignore */ }
      audio.remove();
    }
    state.audioEls.clear();
    state.pendingIce.clear();
  }

  function stopLocalMedia() {
    if (state.stream) {
      for (const track of state.stream.getTracks()) {
        try { track.stop(); } catch { /* ignore */ }
      }
    }
    state.stream = null;
  }

  // ---------- 服务端语音状态 ----------

  function setVoiceState(voice) {
    if (!voice) return;
    const members = Array.isArray(voice.members) ? voice.members : [];
    const sig = members.map((m) => `${m.id}:${m.muted ? 1 : 0}:${m.online ? 1 : 0}`).join(',');
    state.members = members;
    state.meMuted = Boolean(voice.meMuted);
    if (state.joined) state.muted = state.meMuted;
    if (sig !== state.memberSig) {
      state.memberSig = sig;
      syncMesh();
    }
    notify();
    if (state.panelOpen) renderPanel();
  }

  /** 主轮询每次拿到 state.voice 时调用 */
  function updateState(voice) {
    if (!voice) return;
    if (state.joined && voice.joined === false) {
      hardStop('');
      return;
    }
    setVoiceState(voice);
  }

  function hardStop(message) {
    stopPoll();
    closeAllPeers();
    stopLocalMedia();
    const wasJoined = state.joined;
    state.joined = false;
    state.joining = false;
    state.muted = false;
    state.memberSig = '';
    if (message && wasJoined) toast(message, 'error');
    notify();
    if (state.panelOpen) renderPanel();
  }

  // ---------- 对外操作 ----------

  async function join() {
    if (state.joined || state.joining) return;
    const s = session();
    if (!s) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('当前环境不支持麦克风采集：语音需要 localhost 或 HTTPS，游戏不受影响');
      return;
    }
    state.joining = true;
    state.error = '';
    notify();
    if (state.panelOpen) renderPanel();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      state.stream = stream;
      for (const track of stream.getAudioTracks()) track.enabled = !state.muted;
      const data = await requestJson('/api/voice/join', {
        code: s.code, playerId: s.playerId, token: s.token
      });
      state.joined = true;
      state.since = Number(data?.latestSignalId || 0);
      if (data?.voice) setVoiceState(data.voice);
      startPoll(300);
      toast('已加入语音。如果听不到声音，请确认浏览器允许播放。', 'ok');
    } catch (err) {
      stopLocalMedia();
      state.error = err?.message || '';
      let message = '加入语音失败，游戏不受影响';
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        message = '麦克风被拒绝或环境不安全：语音需要 localhost 或 HTTPS，游戏不受影响';
      } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        message = '没有检测到可用的麦克风';
      } else if (err?.status === 409) {
        message = err.message;
      }
      toast(message);
    } finally {
      state.joining = false;
      notify();
      if (state.panelOpen) renderPanel();
    }
  }

  async function leave(options = {}) {
    const silent = Boolean(options.silent);
    stopPoll();
    for (const id of [...state.pcs.keys()]) sendSignal(id, 'bye', null);
    closeAllPeers();
    stopLocalMedia();
    const s = session();
    state.joined = false;
    state.muted = false;
    state.memberSig = '';
    state.since = 0;
    if (s) {
      requestJson('/api/voice/leave', { code: s.code, playerId: s.playerId, token: s.token }).catch(() => {});
    }
    if (!silent) toast('已退出语音', 'info');
    notify();
    if (state.panelOpen) renderPanel();
  }

  async function toggleMute() {
    if (!state.joined) { openPanel(); return; }
    const next = !state.muted;
    state.muted = next;
    if (state.stream) {
      for (const track of state.stream.getAudioTracks()) track.enabled = !next;
    }
    notify();
    if (state.panelOpen) renderPanel();
    const s = session();
    if (!s) return;
    try {
      const data = await requestJson('/api/voice/mute', {
        code: s.code, playerId: s.playerId, token: s.token, muted: next
      });
      if (data?.voice) setVoiceState(data.voice);
    } catch (err) {
      toast(err.message || '静音状态同步失败');
    }
  }

  function openPanel() {
    state.panelOpen = true;
    renderPanel();
    notify();
    document.addEventListener('keydown', panelEsc);
  }

  function closePanel() {
    state.panelOpen = false;
    document.removeEventListener('keydown', panelEsc);
    if (root) root.replaceChildren();
    notify();
  }

  function panelEsc(ev) {
    if (ev.key === 'Escape') closePanel();
  }

  // ---------- 面板 UI ----------

  function renderPanel() {
    const host = ensureRoot();
    if (!state.panelOpen) { host.replaceChildren(); return; }
    const members = state.members;
    const joined = state.joined;
    const me = session()?.playerId;

    const list = el('div', { class: 'voice-list', role: 'list' });
    if (!members.length) {
      list.append(el('p', { class: 'voice-empty', text: joined ? '语音中暂时只有你，等待其他人加入…' : '还没有人加入语音。' }));
    }
    for (const m of members) {
      const row = el('div', { class: `voice-member${m.id === me ? ' is-me' : ''}`, role: 'listitem' });
      row.append(el('span', { class: `voice-dot${m.online === false ? ' offline' : ''}`, 'aria-hidden': 'true' }));
      row.append(el('span', { class: 'voice-name', text: m.name || '玩家' }));
      if (m.id === me) row.append(el('span', { class: 'tag tag-you', text: '你' }));
      if (m.online === false) row.append(el('span', { class: 'voice-state', text: '离线' }));
      row.append(el('span', {
        class: `voice-mic${m.muted ? ' is-muted' : ''}`,
        'aria-label': m.muted ? '已静音' : '麦克风开启',
        html: m.muted ? MIC_OFF : MIC_ON
      }));
      list.append(row);
    }

    const sheet = el('section', {
      class: 'sheet voice-panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': '语音通话'
    });
    const title = el('div', { class: 'sheet-head' },
      el('div', {},
        el('h2', { class: 'sheet-title', html: `${MIC_ON}<span>语音 · 实验性</span>` }),
        el('p', {
          class: 'sheet-sub',
          text: joined
            ? `已加入语音${state.muted ? ' · 已静音' : ''} · ${members.length} 人在线语音`
            : '轻量 WebRTC 语音，浏览器直连；连不上时游戏不受影响。'
        })
      ),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': '关闭语音面板', html: CLOSE, onclick: closePanel })
    );
    sheet.append(title);
    sheet.append(el('div', { class: 'voice-status' },
      el('span', { class: `voice-state-pill${joined ? ' is-on' : ''}`, text: joined ? '语音已开启' : '未加入语音' }),
      el('span', { class: 'voice-members-count', html: `${USERS}<span>${members.length} 人</span>` })
    ));
    sheet.append(list);

    const hint = el('p', {
      class: 'voice-hint',
      text: '麦克风需要 localhost 或 HTTPS；同一局域网内 WebRTC 通常可直连，公网 / 复杂 NAT 可能连不通。语音失败不会影响对局。'
    });
    sheet.append(hint);

    const actions = el('div', { class: 'sheet-actions' });
    if (!joined) {
      const joinBtn = el('button', {
        class: 'btn btn-gold btn-big',
        type: 'button',
        disabled: state.joining,
        onclick: () => join()
      }, el('span', { html: MIC_ON, class: 'icon-holder' }), state.joining ? '正在加入…' : '加入语音');
      actions.append(joinBtn);
    } else {
      actions.append(el('button', {
        class: 'btn btn-ghost btn-big',
        type: 'button',
        onclick: () => toggleMute()
      }, el('span', { html: state.muted ? MIC_OFF : MIC_ON, class: 'icon-holder' }), state.muted ? '取消静音' : '静音'));
      actions.append(el('button', {
        class: 'btn btn-danger btn-big',
        type: 'button',
        onclick: () => leave()
      }, el('span', { html: HANGUP, class: 'icon-holder' }), '退出语音'));
    }
    sheet.append(actions);

    const overlay = el('div', { class: 'overlay voice-overlay' });
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closePanel(); });
    overlay.append(sheet);
    host.replaceChildren(overlay);
    requestAnimationFrame(() => {
      const focusable = sheet.querySelector('button:not(:disabled)');
      focusable?.focus();
    });
  }

  function uiState() {
    return {
      joined: state.joined,
      joining: state.joining,
      muted: state.muted,
      memberCount: state.members.length,
      panelOpen: state.panelOpen,
      available: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    };
  }

  function leaveSilently() {
    closePanel();
    return leave({ silent: true });
  }

  function destroy() {
    stopPoll();
    closeAllPeers();
    stopLocalMedia();
    if (root) root.remove();
  }

  return {
    updateState,
    join,
    leave,
    leaveSilently,
    toggleMute,
    openPanel,
    closePanel,
    renderPanel,
    uiState,
    destroy
  };
}
