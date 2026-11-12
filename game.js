// 政变 — 游戏核心引擎（无第三方依赖）
// 规则以 README.md 为准；本文件同时被服务器与自动化测试使用。

export const MAX_COINS = 11;
export const COUP_COST = 7;
export const ASSASSIN_COST = 3;
export const ROLE_COPIES = 4;

export const ROLE_DEFS = [
  {
    id: 'duke', name: '公爵', en: 'Duke',
    active: 'tax', activeName: '征税', passive: 'blockAid',
    tagline: '征税 +3 · 阻止别人 +2',
    desc: '主动：行动时宣称公爵，获得 3 枚金币。被动：别人选择 +2 时，可宣称公爵阻止。'
  },
  {
    id: 'captain', name: '队长', en: 'Captain',
    active: 'steal', activeName: '偷取', passive: 'blockSteal',
    tagline: '偷 2 金币 · 阻止偷取',
    desc: '主动：宣称队长，从一名玩家处偷取 2 枚金币。被动：别人偷你时，可宣称队长阻止。'
  },
  {
    id: 'ambassador', name: '大使', en: 'Ambassador',
    active: 'exchange', activeName: '交换', passive: 'blockSteal',
    tagline: '抽 2 换牌 · 阻止偷取',
    desc: '主动：宣称大使，从牌堆抽 2 张牌，与自己的角色牌任意交换。被动：别人偷你时，可宣称大使阻止。'
  },
  {
    id: 'assassin', name: '刺客', en: 'Assassin',
    active: 'assassinate', activeName: '刺杀', passive: null,
    tagline: '花 3 金币刺杀 · 无被动',
    desc: '主动：花费 3 枚金币，宣称刺客，指定一名玩家失去一条命。无被动。'
  },
  {
    id: 'lord', name: '领主', en: 'Lord',
    active: null, activeName: null, passive: 'blockAssassinate',
    tagline: '无主动 · 阻止刺杀',
    desc: '没有主动技能。被动：被刺杀时，可宣称领主阻止。'
  },
  {
    id: 'bishop', name: '主教', en: 'Bishop',
    active: 'copy', activeName: '复制', passive: 'blockAssassinateIfNoDeath',
    tagline: '复制阵亡者主动 · 未死人时可挡刺杀',
    desc: '主动：宣称主教，获得场上最后一名阵亡角色的主动技能。无被动；但场上还没有任何人死亡时，可宣称主教阻止刺杀。最后一个阵亡的是领主时，没有主动技能。'
  }
];

export const ROLE_MAP = Object.fromEntries(ROLE_DEFS.map((r) => [r.id, r]));
const DIRECT_ACTIVE = { duke: 'tax', captain: 'steal', ambassador: 'exchange', assassin: 'assassinate' };
const ACTION_NEEDS_TARGET = { steal: true, assassinate: true, coup: true };

export class GameError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GameError';
  }
}

const DEFAULT_TIMEOUTS = {
  challenge: 15000,
  block: 15000,
  blockChallenge: 15000,
  exchange: 35000,
  life: 25000
};

function shuffle(array, rng = Math.random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function roleName(role) {
  return ROLE_MAP[role]?.name || role;
}

export class Game {
  constructor({ players, startPlayerId, rng = Math.random, timeouts = {} }) {
    if (!Array.isArray(players) || players.length < 2) throw new GameError('至少需要 2 名玩家');
    if (players.length > 6) throw new GameError('最多 6 名玩家');
    this.rng = rng;
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...timeouts };
    this.players = players.map((p, seat) => ({
      id: p.id,
      name: p.name,
      seat,
      coins: 0,
      hand: [],
      deadRoles: [],
      alive: true,
      connected: true
    }));
    this.byId = new Map(this.players.map((p) => [p.id, p]));
    this.startPlayerId = startPlayerId && this.byId.has(startPlayerId) ? startPlayerId : this.players[0].id;
    this.version = 0;
    this.logSeq = 0;
    this.logs = [];
    this.status = 'playing';
    this.phase = 'action'; // action | challenge | block | blockChallenge | exchange | loseLife | over
    this.turnPlayerId = this.startPlayerId;
    this.pending = null;
    this.lifeLoss = null;
    this.deathLog = [];
    this.winnerId = null;
    this.deck = [];
    this._start();
  }

  // ---------- 初始化 ----------

  _start() {
    this.deck = [];
    let n = 0;
    for (const role of ROLE_DEFS) {
      for (let i = 0; i < ROLE_COPIES; i++) {
        this.deck.push({ uid: `c${++n}`, role: role.id });
      }
    }
    shuffle(this.deck, this.rng);

    const startIndex = this.players.findIndex((p) => p.id === this.startPlayerId);
    this.turnOrder = [
      ...this.players.slice(startIndex),
      ...this.players.slice(0, startIndex)
    ].map((p) => p.id);

    // 行动顺序的最后一位开局 3 金币，其余 2 金币
    const lastId = this.turnOrder[this.turnOrder.length - 1];
    for (const p of this.players) p.coins = p.id === lastId ? 3 : 2;

    // 每人 2 张不同角色牌
    for (const p of this.players) {
      while (p.hand.length < 2) {
        let idx = this.deck.findIndex((c) => !p.hand.some((h) => h.role === c.role));
        if (idx < 0) idx = 0;
        const [card] = this.deck.splice(idx, 1);
        if (!card) break;
        p.hand.push(card);
      }
    }

    const start = this.byId.get(this.turnPlayerId);
    this._log(`游戏开始。行动顺序：${this.turnOrder.map((id) => this.byId.get(id).name).join(' → ')}。`, 'system');
    this._log(`最后行动的是 ${this.byId.get(lastId).name}，开局获得 3 金币；其他人 2 金币。`, 'system');
    this._log(`现在轮到 ${start.name}。`, 'turn');
    this._touch();
  }

  // ---------- 通用 ----------

  _touch() {
    this.version += 1;
  }

  _log(text, tone = 'info', privateTo = null) {
    this.logs.push({ id: ++this.logSeq, text, tone, privateTo, ts: Date.now() });
    if (this.logs.length > 160) this.logs.splice(0, this.logs.length - 160);
  }

  _player(id) {
    const p = this.byId.get(id);
    if (!p) throw new GameError('玩家不存在');
    return p;
  }

  _alive() {
    return this.players.filter((p) => p.alive);
  }

  _aliveOthers(id) {
    return this.players.filter((p) => p.alive && p.id !== id);
  }

  _current() {
    return this.byId.get(this.turnPlayerId);
  }

  _assertTurn(playerId) {
    if (this.status !== 'playing') throw new GameError('游戏已经结束');
    if (this.phase !== 'action') throw new GameError('当前正在结算上一步行动');
    if (this.turnPlayerId !== playerId) throw new GameError('还没轮到你行动');
    const p = this._player(playerId);
    if (!p.alive) throw new GameError('你已经出局了');
    return p;
  }

  _mustCoup(player) {
    return player.coins >= MAX_COINS;
  }

  isMustCoup() {
    const p = this._current();
    return Boolean(p && p.alive && p.coins >= MAX_COINS && this.status === 'playing');
  }

  _target(playerId, targetId) {
    if (!targetId) throw new GameError('请选择目标');
    if (targetId === playerId) throw new GameError('不能选择自己');
    const t = this.byId.get(targetId);
    if (!t || !t.alive) throw new GameError('目标已经出局');
    return t;
  }

  _lastDeadRole() {
    return this.deathLog.length ? this.deathLog[this.deathLog.length - 1].role : null;
  }

  // 主教复制的主动技能：从最后一次阵亡往前找；跳过主教自己（避免无限递归）。
  getBishopCopyRole() {
    for (let i = this.deathLog.length - 1; i >= 0; i--) {
      const role = this.deathLog[i].role;
      if (role === 'bishop') continue;
      return role;
    }
    return null;
  }

  getBishopAction() {
    const role = this.getBishopCopyRole();
    if (!role) return null;
    if (role === 'lord') return null; // 最后阵亡的是领主：主教没有主动
    const active = DIRECT_ACTIVE[role];
    if (!active) return null;
    return {
      role,
      active,
      needsTarget: Boolean(ACTION_NEEDS_TARGET[active]),
      cost: active === 'assassinate' ? ASSASSIN_COST : 0
    };
  }

  // ---------- 行动 ----------

  act(playerId, action = {}) {
    const p = this._assertTurn(playerId);
    const type = action.type;
    if (!type) throw new GameError('缺少行动类型');

    if (this._mustCoup(p) && type !== 'coup') {
      throw new GameError('金币已达 11，必须发动政变');
    }

    switch (type) {
      case 'income1':
        return this._income(p, 1);
      case 'income2':
        return this._income(p, 2);
      case 'coup':
        return this._coup(p, action.targetId);
      case 'tax':
        return this._tax(p);
      case 'steal':
        return this._steal(p, action.targetId);
      case 'assassinate':
        return this._assassinate(p, action.targetId);
      case 'exchange':
        return this._exchange(p);
      case 'bishop':
        return this._bishop(p, action.targetId);
      default:
        throw new GameError('未知行动');
    }
  }

  _addCoins(p, amount, reason) {
    const before = p.coins;
    p.coins = Math.min(MAX_COINS, p.coins + amount);
    const gained = p.coins - before;
    if (gained > 0) this._log(`${p.name} 获得 ${gained} 枚金币（${reason}），现有 ${p.coins} 枚。`, 'gain');
    else this._log(`${p.name} 的金币已满，无法再获得金币。`, 'warn');
    return gained;
  }

  _income(p, amount) {
    if (amount === 1) {
      this._log(`${p.name} 选择收入 +1。`, 'action');
      this._addCoins(p, 1, '收入');
      return this._endTurn();
    }
    // +2 可被任意其他存活玩家用公爵阻止
    this._log(`${p.name} 选择援助 +2，等待公爵阻止。`, 'action');
    const eligible = this._aliveOthers(p.id).map((x) => x.id);
    if (!eligible.length) {
      this._addCoins(p, 2, '援助');
      return this._endTurn();
    }
    this.pending = {
      kind: 'action',
      action: 'aid',
      actorId: p.id,
      targetId: null,
      claimedRole: null,
      label: '援助 +2',
      eligible,
      passed: [],
      canBlockIds: eligible,
      options: ['duke'],
      deadline: Date.now() + this.timeouts.block
    };
    this.phase = 'block';
    this._touch();
  }

  _coup(p, targetId) {
    const target = this._target(p.id, targetId);
    if (p.coins < COUP_COST) throw new GameError('政变需要 7 枚金币');
    p.coins -= COUP_COST;
    this._log(`${p.name} 花费 7 枚金币，对 ${target.name} 发动政变！`, 'danger');
    this.pending = {
      kind: 'effect',
      action: 'coup',
      actorId: p.id,
      targetId: target.id,
      claimedRole: null,
      label: `政变 → ${target.name}`
    };
    this._queueLoss(target.id, '政变', 'effect');
  }

  _tax(p) {
    this._log(`${p.name} 宣称「公爵」，征税 +3。`, 'claim');
    this.pending = {
      kind: 'action',
      action: 'tax',
      actorId: p.id,
      targetId: null,
      claimedRole: 'duke',
      label: '公爵 · 征税 +3'
    };
    this._startChallenge();
  }

  _steal(p, targetId) {
    const target = this._target(p.id, targetId);
    this._log(`${p.name} 宣称「队长」，要偷取 ${target.name} 的 2 枚金币。`, 'claim');
    this.pending = {
      kind: 'action',
      action: 'steal',
      actorId: p.id,
      targetId: target.id,
      claimedRole: 'captain',
      label: `队长 · 偷取 ${target.name} 2 金币`
    };
    this._startChallenge();
  }

  _assassinate(p, targetId) {
    const target = this._target(p.id, targetId);
    if (p.coins < ASSASSIN_COST) throw new GameError('刺杀需要 3 枚金币');
    p.coins -= ASSASSIN_COST;
    this._log(`${p.name} 花费 3 枚金币，宣称「刺客」，刺杀 ${target.name}！`, 'danger');
    this.pending = {
      kind: 'action',
      action: 'assassinate',
      actorId: p.id,
      targetId: target.id,
      claimedRole: 'assassin',
      label: `刺客 · 刺杀 ${target.name}`,
      costPaid: ASSASSIN_COST
    };
    this._startChallenge();
  }

  _exchange(p) {
    this._log(`${p.name} 宣称「大使」，抽取并交换角色牌。`, 'claim');
    this.pending = {
      kind: 'action',
      action: 'exchange',
      actorId: p.id,
      targetId: null,
      claimedRole: 'ambassador',
      label: '大使 · 交换角色牌'
    };
    this._startChallenge();
  }

  _bishop(p, targetId) {
    const info = this.getBishopAction();
    if (!info) throw new GameError('当前没有可复制的主动技能');
    if (info.cost && p.coins < info.cost) throw new GameError(`需要 ${info.cost} 枚金币`);
    let target = null;
    if (info.needsTarget) target = this._target(p.id, targetId);
    if (info.cost) p.coins -= info.cost;

    const activeName = ROLE_MAP[info.role].activeName;
    this._log(
      `${p.name} 宣称「主教」，复制${ROLE_MAP[info.role].name}的主动技能（${activeName}）` +
      (target ? `，目标 ${target.name}。` : '。'),
      'claim'
    );
    this.pending = {
      kind: 'action',
      action: 'bishop',
      copyRole: info.role,
      copyActive: info.active,
      actorId: p.id,
      targetId: target ? target.id : null,
      claimedRole: 'bishop',
      label: `主教 · 复制${ROLE_MAP[info.role].name}（${activeName}）`,
      costPaid: info.cost
    };
    this._startChallenge();
  }

  _effectiveAction() {
    if (!this.pending) return null;
    return this.pending.action === 'bishop' ? this.pending.copyActive : this.pending.action;
  }

  _startChallenge() {
    const p = this.pending;
    p.eligible = this._aliveOthers(p.actorId).map((x) => x.id);
    p.passed = [];
    p.deadline = Date.now() + this.timeouts.challenge;
    this.phase = 'challenge';
    this._touch();
  }

  // ---------- 响应 ----------

  respond(playerId, response = {}) {
    if (this.status !== 'playing') throw new GameError('游戏已经结束');
    const type = response.type;
    if (!type) throw new GameError('缺少响应类型');

    if (this.phase === 'challenge') return this._respondChallenge(playerId, type);
    if (this.phase === 'block') return this._respondBlock(playerId, type, response);
    if (this.phase === 'blockChallenge') return this._respondBlockChallenge(playerId, type);
    if (this.phase === 'exchange') return this._respondExchange(playerId, response);
    if (this.phase === 'loseLife') return this._respondLoseLife(playerId, response);
    throw new GameError('现在没有需要响应的阶段');
  }

  _respondChallenge(playerId, type) {
    const p = this.pending;
    if (!p.eligible.includes(playerId)) throw new GameError('你没有资格质疑');
    if (p.passed.includes(playerId)) throw new GameError('你已经选择不质疑');
    if (type === 'challenge') {
      p.deadline = null;
      return this._resolveActionChallenge(playerId);
    }
    if (type === 'pass') {
      p.passed.push(playerId);
      if (p.passed.length >= p.eligible.length) {
        p.deadline = null;
        return this._continueAction();
      }
      this._touch();
      return;
    }
    throw new GameError('未知响应');
  }

  _resolveActionChallenge(challengerId) {
    const p = this.pending;
    const actor = this._player(p.actorId);
    const challenger = this._player(challengerId);
    const claimed = p.claimedRole;
    const has = actor.hand.some((c) => c.role === claimed);
    if (has) {
      this._log(
        `${challenger.name} 质疑 ${actor.name} 的「${roleName(claimed)}」失败，${challenger.name} 失去一条命。`,
        'danger'
      );
      this._log(`你质疑失败：${actor.name} 确实持有「${roleName(claimed)}」。`, 'system', challengerId);
      this._queueLoss(challengerId, '质疑失败', 'challengeChallenger');
    } else {
      this._log(
        `${challenger.name} 质疑成功！${actor.name} 并不是「${roleName(claimed)}」，${actor.name} 失去一条命。`,
        'good'
      );
      this._queueLoss(actor.id, '冒充被识破', 'challengeActor');
    }
  }

  _respondBlock(playerId, type, response) {
    const p = this.pending;
    if (p.passed?.includes(playerId)) throw new GameError('你已经选择不阻止，不能改口');
    if (type === 'noBlock') {
      this._noBlock(playerId);
      return;
    }
    if (type !== 'block') throw new GameError('未知响应');
    if (!p.canBlockIds || !p.canBlockIds.includes(playerId)) throw new GameError('你不能阻止这个行动');
    const role = response.role;
    if (!p.options.includes(role)) throw new GameError('这个角色不能阻止该行动');
    const player = this._player(playerId);
    if (!player.alive) throw new GameError('你已经出局');

    // 额外规则校验
    const effective = this._effectiveAction();
    if (effective === 'aid' && role !== 'duke') throw new GameError('只有公爵能阻止援助');
    if (effective === 'assassinate' && role === 'bishop' && this.deathLog.length > 0) {
      throw new GameError('场上已经有人死亡，主教的防刺杀被动已经失效');
    }

    p.blockerId = playerId;
    p.blockRole = role;
    this._log(`${player.name} 声称「${roleName(role)}」阻止${p.label || '行动'}。`, 'block');
    p.eligible = this._aliveOthers(playerId).map((x) => x.id);
    p.passed = [];
    p.deadline = Date.now() + this.timeouts.blockChallenge;
    this.phase = 'blockChallenge';
    this._touch();
  }

  _respondBlockChallenge(playerId, type) {
    const p = this.pending;
    if (!p.eligible.includes(playerId)) throw new GameError('你没有资格质疑');
    if (p.passed.includes(playerId)) throw new GameError('你已经选择不质疑');
    if (type === 'challenge') {
      p.deadline = null;
      return this._resolveBlockChallenge(playerId);
    }
    if (type === 'pass') {
      p.passed.push(playerId);
      if (p.passed.length >= p.eligible.length) {
        p.deadline = null;
        return this._blockStands();
      }
      this._touch();
      return;
    }
    throw new GameError('未知响应');
  }

  _resolveBlockChallenge(challengerId) {
    const p = this.pending;
    const blocker = this._player(p.blockerId);
    const challenger = this._player(challengerId);
    const has = blocker.hand.some((c) => c.role === p.blockRole);
    if (has) {
      this._log(
        `${challenger.name} 质疑 ${blocker.name} 的「${roleName(p.blockRole)}」失败，${challenger.name} 失去一条命，阻止成立。`,
        'danger'
      );
      this._log(`你质疑失败：${blocker.name} 确实持有「${roleName(p.blockRole)}」。`, 'system', challengerId);
      this._queueLoss(challengerId, '质疑失败', 'blockChallenger');
    } else {
      this._log(
        `${challenger.name} 质疑成功！${blocker.name} 并不是「${roleName(p.blockRole)}」，阻止失败，${blocker.name} 失去一条命。`,
        'good'
      );
      this._queueLoss(blocker.id, '冒充被识破', 'blockBlocker');
    }
  }

  _noBlock(playerId) {
    const p = this.pending;
    if (!p.canBlockIds || !p.canBlockIds.includes(playerId)) throw new GameError('你不能跳过这个阻止');
    if (this._effectiveAction() === 'aid') {
      if (!p.passed.includes(playerId)) p.passed.push(playerId);
      if (p.passed.length >= p.canBlockIds.length) {
        p.deadline = null;
        this._log('无人阻止援助。', 'info');
        this._addCoins(this._player(p.actorId), 2, '援助');
        return this._endTurn();
      }
      this._touch();
      return;
    }
    p.deadline = null;
    return this._resolveUnblockedAction();
  }

  _startExchange() {
    const p = this.pending;
    const actor = this._player(p.actorId);
    const drawn = this.deck.splice(0, Math.min(2, this.deck.length));
    p.drawn = drawn;
    p.deadline = Date.now() + this.timeouts.exchange;
    this.phase = 'exchange';
    this._log(`${actor.name} 正在查看抽到的角色牌。`, 'info');
    this._touch();
    if (!drawn.length) {
      this._log('牌堆已空，交换无效。', 'warn');
      this._endTurn();
    }
  }

  _respondExchange(playerId, response) {
    const p = this.pending;
    if (p.actorId !== playerId) throw new GameError('只有使用者能交换角色牌');
    if (response.type !== 'exchange') throw new GameError('未知响应');
    const actor = this._player(playerId);
    const keepUids = Array.isArray(response.keepUids) ? response.keepUids : [];
    const handSize = actor.hand.length;
    if (keepUids.length !== handSize) throw new GameError(`需要选择 ${handSize} 张角色牌保留`);
    if (new Set(keepUids).size !== keepUids.length) throw new GameError('不能重复选择同一张牌');
    const pool = [...actor.hand, ...p.drawn];
    const chosen = [];
    for (const uid of keepUids) {
      const card = pool.find((c) => c.uid === uid);
      if (!card) throw new GameError('选择的牌不在可交换范围内');
      chosen.push(card);
    }
    const returned = pool.filter((c) => !keepUids.includes(c.uid));
    actor.hand = chosen;
    this.deck.push(...returned);
    shuffle(this.deck, this.rng);
    p.deadline = null;
    this._log(`${actor.name} 完成了角色牌交换。`, 'info');
    this._endTurn();
  }

  // ---------- 失去生命 ----------

  _queueLoss(playerId, reason, after) {
    const p = this._player(playerId);
    if (!p.alive) {
      this._resume(after);
      return;
    }
    this.lifeLoss = {
      playerId,
      reason,
      after,
      deadline: Date.now() + this.timeouts.life
    };
    this.phase = 'loseLife';
    if (this.pending) this.pending.deadline = null;
    this._log(`${p.name} 需要失去一条命（${reason}）。`, 'warn');
    this._touch();
    // 只剩一张牌时不用等待，直接结算
    if (p.hand.length <= 1) {
      if (p.hand.length === 0) {
        this.lifeLoss = null;
        this._resume(after);
      } else {
        this._chooseLoss(p.hand[0].uid);
      }
    }
  }

  _respondLoseLife(playerId, response) {
    if (this.phase !== 'loseLife' || !this.lifeLoss) throw new GameError('现在不需要选择');
    if (this.lifeLoss.playerId !== playerId) throw new GameError('现在不是你失去生命');
    const uid = response.uid;
    if (!uid) throw new GameError('请选择要失去的角色牌');
    this._chooseLoss(uid);
  }

  _chooseLoss(uid) {
    const loss = this.lifeLoss;
    if (!loss) return;
    const p = this._player(loss.playerId);
    const idx = p.hand.findIndex((c) => c.uid === uid);
    if (idx < 0) throw new GameError('你没有这张角色牌');
    const [card] = p.hand.splice(idx, 1);
    p.deadRoles.push(card.role);
    this.deathLog.push({
      role: card.role,
      playerId: p.id,
      playerName: p.name,
      ts: Date.now()
    });
    this._log(`${p.name} 失去一条命，亮出「${roleName(card.role)}」。`, 'danger');
    if (p.hand.length === 0) {
      p.alive = false;
      p.coins = 0;
      this._log(`${p.name} 的两条命都已失去，出局！`, 'danger');
    }
    this.lifeLoss = null;
    this._touch();

    if (this._checkGameOver()) return;
    this._resume(loss.after);
  }

  _resume(after) {
    if (this.status !== 'playing') return;
    switch (after) {
      case 'challengeChallenger':
        return this._continueAction();
      case 'challengeActor':
        this._log('冒充被识破，行动取消。', 'warn');
        return this._endTurn();
      case 'blockChallenger':
        return this._blockStands();
      case 'blockBlocker':
        this._log('阻止者冒充被识破，阻止失败，行动继续。', 'warn');
        return this._resolveUnblockedAction();
      case 'effect':
        return this._endTurn();
      default:
        throw new GameError('内部结算错误');
    }
  }

  // ---------- 行动结算 ----------

  _continueAction() {
    const p = this.pending;
    if (!p) return this._endTurn();
    if (p.action === 'tax') {
      this._addCoins(this._player(p.actorId), 3, '征税');
      return this._endTurn();
    }
    if (p.action === 'steal') return this._beginStealBlock();
    if (p.action === 'assassinate') return this._beginAssassinateBlock();
    if (p.action === 'exchange') return this._startExchange();
    if (p.action === 'bishop') return this._resolveBishopCopy();
    if (p.action === 'aid') return this._endTurn();
    return this._endTurn();
  }

  _resolveBishopCopy() {
    const p = this.pending;
    const actor = this._player(p.actorId);
    switch (p.copyActive) {
      case 'tax':
        this._addCoins(actor, 3, '主教复制·征税');
        return this._endTurn();
      case 'steal':
        return this._beginStealBlock();
      case 'assassinate':
        return this._beginAssassinateBlock();
      case 'exchange':
        return this._startExchange();
      default:
        this._log('没有可执行的复制技能。', 'warn');
        return this._endTurn();
    }
  }

  _beginStealBlock() {
    const p = this.pending;
    const actor = this._player(p.actorId);
    const target = this._player(p.targetId);
    if (!target.alive) return this._endTurn();
    if (target.coins <= 0 || actor.coins >= MAX_COINS) {
      this._log(`${target.name} 没有可偷取的金币（或你的金币已满）。`, 'warn');
      return this._endTurn();
    }
    this.pending.canBlockIds = [target.id];
    this.pending.options = ['captain', 'ambassador'];
    this.pending.passed = [];
    this.pending.deadline = Date.now() + this.timeouts.block;
    this.phase = 'block';
    this._log(`等待 ${target.name} 决定是否阻止偷取。`, 'info');
    this._touch();
  }

  _beginAssassinateBlock() {
    const p = this.pending;
    const target = this._player(p.targetId);
    if (!target.alive) return this._endTurn();
    const options = ['lord'];
    if (this.deathLog.length === 0) options.push('bishop');
    this.pending.canBlockIds = [target.id];
    this.pending.options = options;
    this.pending.passed = [];
    this.pending.deadline = Date.now() + this.timeouts.block;
    this.phase = 'block';
    this._log(`等待 ${target.name} 决定是否阻止刺杀。`, 'info');
    this._touch();
  }

  _resolveUnblockedAction() {
    const p = this.pending;
    if (!p) return this._endTurn();
    const effective = this._effectiveAction();
    if (effective === 'aid') {
      this._addCoins(this._player(p.actorId), 2, '援助');
      return this._endTurn();
    }
    if (effective === 'steal') {
      const actor = this._player(p.actorId);
      const target = this._player(p.targetId);
      const amount = Math.min(2, target.coins, MAX_COINS - actor.coins);
      if (amount > 0) {
        target.coins -= amount;
        actor.coins += amount;
        this._log(`${actor.name} 从 ${target.name} 偷走 ${amount} 枚金币。`, 'gain');
      } else {
        this._log('没有金币被偷走。', 'warn');
      }
      return this._endTurn();
    }
    if (effective === 'assassinate') {
      const target = this._player(p.targetId);
      this._log(`刺杀命中 ${target.name}！`, 'danger');
      return this._queueLoss(target.id, '被刺杀', 'effect');
    }
    return this._endTurn();
  }

  _blockStands() {
    this._log(`阻止成立，${this.pending?.label || '行动'}无效。`, 'block');
    this.pending = null;
    this._endTurn();
  }

  // ---------- 回合 ----------

  _endTurn() {
    if (this._checkGameOver()) return;
    this.pending = null;
    this.lifeLoss = null;
    const idx = this.turnOrder.indexOf(this.turnPlayerId);
    let nextId = null;
    for (let step = 1; step <= this.turnOrder.length; step++) {
      const candidate = this.turnOrder[(idx + step) % this.turnOrder.length];
      if (this.byId.get(candidate).alive) {
        nextId = candidate;
        break;
      }
    }
    if (!nextId) {
      this._checkGameOver();
      return;
    }
    this.turnPlayerId = nextId;
    this.phase = 'action';
    const next = this._player(nextId);
    this._log(`轮到 ${next.name} 行动。`, 'turn');
    if (next.coins >= MAX_COINS) {
      this._log(`${next.name} 的金币达到上限 11，必须发动政变！`, 'warn');
    }
    this._touch();
  }

  _checkGameOver() {
    if (this.status !== 'playing') return true;
    const alive = this._alive();
    if (alive.length <= 1) {
      this.status = 'over';
      this.phase = 'over';
      this.winnerId = alive[0]?.id || null;
      this.pending = null;
      this.lifeLoss = null;
      if (this.winnerId) {
        this._log(`游戏结束！最后的幸存者：${alive[0].name} 获胜！`, 'win');
      } else {
        this._log('游戏结束，没有幸存者。', 'system');
      }
      this._touch();
      return true;
    }
    return false;
  }

  // ---------- 超时处理 ----------

  tick(now = Date.now()) {
    if (this.status !== 'playing') return false;
    const before = this.version;
    if (this.phase === 'challenge' && this.pending?.deadline && now >= this.pending.deadline) {
      this.pending.deadline = null;
      this._log('质疑时间结束，无人质疑。', 'info');
      this._continueAction();
    } else if (this.phase === 'block' && this.pending?.deadline && now >= this.pending.deadline) {
      this.pending.deadline = null;
      if (this._effectiveAction() === 'aid') {
        this._log('无人阻止援助。', 'info');
        this._addCoins(this._player(this.pending.actorId), 2, '援助');
        this._endTurn();
      } else {
        this._log('目标没有阻止。', 'info');
        this._resolveUnblockedAction();
      }
    } else if (this.phase === 'blockChallenge' && this.pending?.deadline && now >= this.pending.deadline) {
      this.pending.deadline = null;
      this._log('质疑时间结束，阻止成立。', 'info');
      this._blockStands();
    } else if (this.phase === 'exchange' && this.pending?.deadline && now >= this.pending.deadline) {
      const actor = this._player(this.pending.actorId);
      const drawn = this.pending.drawn || [];
      this.deck.push(...drawn);
      shuffle(this.deck, this.rng);
      this._log(`${actor.name} 交换超时，保留原来的角色牌。`, 'warn');
      this.pending.deadline = null;
      this._endTurn();
    } else if (this.phase === 'loseLife' && this.lifeLoss?.deadline && now >= this.lifeLoss.deadline) {
      const p = this._player(this.lifeLoss.playerId);
      if (p.hand.length) {
        this._log(`${p.name} 选择超时，系统随机失去一张角色牌。`, 'warn');
        const card = p.hand[Math.floor(this.rng() * p.hand.length)];
        this._chooseLoss(card.uid);
      }
    }
    return this.version !== before;
  }

  // ---------- 视图 ----------

  legalActions(playerId) {
    const p = this.byId.get(playerId);
    const no = { canAct: false };
    if (!p || !p.alive || this.status !== 'playing' || this.phase !== 'action' || this.turnPlayerId !== playerId) {
      return no;
    }
    const others = this._aliveOthers(playerId);
    const mustCoup = this.isMustCoup();
    const bishop = this.getBishopAction();
    const canBishop = Boolean(
      bishop &&
      (!bishop.cost || p.coins >= bishop.cost) &&
      (!bishop.needsTarget || others.length > 0) &&
      !mustCoup
    );
    return {
      canAct: true,
      mustCoup,
      income1: !mustCoup,
      income2: !mustCoup,
      tax: !mustCoup,
      steal: !mustCoup && others.length > 0,
      exchange: !mustCoup,
      assassinate: !mustCoup && p.coins >= ASSASSIN_COST && others.length > 0,
      bishop: canBishop,
      bishopInfo: bishop,
      coup: p.coins >= COUP_COST && others.length > 0,
      targets: others.map((x) => x.id)
    };
  }

  _pendingView(viewerId) {
    const p = this.pending;
    if (!p) return null;
    // 只暴露当前阶段需要的信息
    if (this.phase === 'challenge' || this.phase === 'blockChallenge') {
      return {
        kind: p.kind,
        action: p.action,
        actorId: p.actorId,
        targetId: p.targetId,
        claimedRole: p.claimedRole,
        blockRole: p.blockRole || null,
        blockerId: p.blockerId || null,
        copyRole: p.copyRole || null,
        label: p.label,
        eligible: p.eligible || [],
        passed: p.passed || [],
        deadline: p.deadline
      };
    }
    if (this.phase === 'block') {
      return {
        kind: p.kind,
        action: p.action,
        actorId: p.actorId,
        targetId: p.targetId,
        claimedRole: p.claimedRole,
        copyRole: p.copyRole || null,
        label: p.label,
        canBlockIds: p.canBlockIds || [],
        options: p.options || [],
        passed: p.passed || [],
        deadline: p.deadline
      };
    }
    if (this.phase === 'exchange') {
      const base = {
        kind: 'exchange',
        action: 'exchange',
        actorId: p.actorId,
        label: p.label,
        deadline: p.deadline
      };
      if (p.actorId === viewerId) base.drawn = p.drawn || [];
      return base;
    }
    if (this.phase === 'loseLife') {
      return {
        kind: 'loseLife',
        playerId: this.lifeLoss?.playerId,
        reason: this.lifeLoss?.reason,
        label: p.label || null,
        deadline: this.lifeLoss?.deadline
      };
    }
    return { kind: p.kind, action: p.action, actorId: p.actorId, targetId: p.targetId, label: p.label };
  }

  getState(viewerId) {
    const viewer = this.byId.get(viewerId);
    if (!viewer) throw new GameError('玩家不存在');
    const reveal = this.status === 'over';
    const players = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      coins: p.coins,
      alive: p.alive,
      connected: p.connected,
      handCount: p.hand.length,
      deadRoles: [...p.deadRoles],
      isYou: p.id === viewerId,
      ...(reveal || p.id === viewerId ? { hand: p.hand.map((c) => ({ ...c })) } : {})
    }));
    const logs = this.logs
      .filter((l) => !l.privateTo || l.privateTo === viewerId)
      .slice(-80)
      .map((l) => ({ id: l.id, text: l.text, tone: l.tone, ts: l.ts }));
    const lastDead = this.deathLog.length ? this.deathLog[this.deathLog.length - 1] : null;
    return {
      version: this.version,
      status: this.status,
      phase: this.phase,
      turnPlayerId: this.turnPlayerId,
      turnOrder: [...this.turnOrder],
      startPlayerId: this.startPlayerId,
      players,
      you: {
        id: viewer.id,
        name: viewer.name,
        isTurn: this.turnPlayerId === viewer.id && this.status === 'playing',
        mustCoup: this.isMustCoup() && this.turnPlayerId === viewer.id,
        hand: viewer.hand.map((c) => ({ ...c })),
        legal: this.legalActions(viewerId)
      },
      deckCount: this.deck.length,
      deathLog: this.deathLog.map((d) => ({ ...d })),
      lastDead,
      bishopCopyRole: this.getBishopCopyRole(),
      winnerId: this.winnerId,
      pending: this._pendingView(viewerId),
      log: logs,
      settings: {
        maxCoins: MAX_COINS,
        coupCost: COUP_COST,
        assassinCost: ASSASSIN_COST,
        roleCopies: ROLE_COPIES
      }
    };
  }

  setConnected(playerId, connected) {
    const p = this.byId.get(playerId);
    if (!p) return;
    const next = Boolean(connected);
    if (p.connected !== next) {
      p.connected = next;
      this._touch();
    }
  }
}

export function publicMeta() {
  return {
    roles: ROLE_DEFS,
    constants: {
      maxCoins: MAX_COINS,
      coupCost: COUP_COST,
      assassinCost: ASSASSIN_COST,
      roleCopies: ROLE_COPIES,
      maxPlayers: 6,
      minPlayers: 2
    },
    timeouts: DEFAULT_TIMEOUTS
  };
}
