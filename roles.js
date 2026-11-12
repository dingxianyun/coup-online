// 政变 — 角色数据与徽记（纯静态常量，不含用户输入）

export const ROLE_DEFS = [
  {
    id: 'duke', name: '公爵', en: 'Duke',
    activeName: '征税', passiveName: '阻止援助',
    tagline: '征税 +3 · 可阻止 +2',
    skill: '主动：宣称公爵，获得 3 金币。被动：别人选择援助 +2 时，可宣称公爵阻止。',
    desc: '主动：行动时宣称公爵，获得 3 枚金币。被动：别人选择 +2 时，可宣称公爵阻止。'
  },
  {
    id: 'captain', name: '队长', en: 'Captain',
    activeName: '偷取', passiveName: '阻止偷取',
    tagline: '偷 2 金币 · 可阻止偷取',
    skill: '主动：宣称队长，从一名玩家处偷取 2 金币。被动：别人偷你时，可宣称队长阻止。',
    desc: '主动：宣称队长，从一名玩家处偷取 2 枚金币。被动：别人偷你时，可宣称队长阻止。'
  },
  {
    id: 'ambassador', name: '大使', en: 'Ambassador',
    activeName: '交换', passiveName: '阻止偷取',
    tagline: '抽 2 换牌 · 可阻止偷取',
    skill: '主动：宣称大使，抽 2 张牌，与自己的角色牌任意交换。被动：别人偷你时，可宣称大使阻止。',
    desc: '主动：宣称大使，从牌堆抽 2 张牌，与自己的角色牌任意交换。被动：别人偷你时，可宣称大使阻止。'
  },
  {
    id: 'assassin', name: '刺客', en: 'Assassin',
    activeName: '刺杀', passiveName: null,
    tagline: '花 3 金币刺杀 · 无被动',
    skill: '主动：花费 3 枚金币，宣称刺客，指定一名玩家失去一条命。无被动。',
    desc: '主动：花费 3 枚金币，宣称刺客，指定一名玩家失去一条命。无被动。'
  },
  {
    id: 'lord', name: '领主', en: 'Lord',
    activeName: null, passiveName: '阻止刺杀',
    tagline: '无主动 · 可阻止刺杀',
    skill: '没有主动技能。被动：被刺杀时，可宣称领主阻止。',
    desc: '没有主动技能。被动：被刺杀时，可宣称领主阻止。'
  },
  {
    id: 'bishop', name: '主教', en: 'Bishop',
    activeName: '复制', passiveName: '未死人时阻止刺杀',
    tagline: '复制阵亡者 · 无人阵亡时可挡刺杀',
    skill: '主动：宣称主教，获得最后一名阵亡角色的主动技能。被动：场上还没有任何人阵亡时，可宣称主教阻止刺杀。',
    desc: '主动：宣称主教，获得场上最后一名阵亡角色的主动技能。无被动；但场上还没有任何人死亡时，可宣称主教阻止刺杀。最后一个阵亡的是领主时，没有主动技能。'
  }
];

export const ROLE_MAP = Object.fromEntries(ROLE_DEFS.map((r) => [r.id, r]));
export const ROLE_ORDER = ROLE_DEFS.map((r) => r.id);

// 以下 SVG 均为内部静态图形；统一 64x64 viewBox。
const EMBLEMS = {
  duke: `
    <path d="M11 45 L15 22 L25 32 L32 15 L39 32 L49 22 L53 45 Z" />
    <path d="M13 51 H51" />
    <path d="M23 45 V39 H41 V45" />
    <circle cx="15" cy="21" r="2.3" fill="currentColor" stroke="none" />
    <circle cx="32" cy="14" r="2.3" fill="currentColor" stroke="none" />
    <circle cx="49" cy="21" r="2.3" fill="currentColor" stroke="none" />
  `,
  captain: `
    <path d="M12 14 C26 21 40 34 51 50" />
    <path d="M16 9 C30 17 44 30 53 44" />
    <path d="M9 19 L19 9" />
    <path d="M13 23 L23 13" />
    <path d="M52 14 C38 21 24 34 13 50" />
    <path d="M48 9 C34 17 20 30 11 44" />
    <path d="M55 19 L45 9" />
    <path d="M51 23 L41 13" />
  `,
  ambassador: `
    <rect x="18" y="16" width="28" height="32" rx="2" />
    <path d="M18 18 C11 18 11 46 18 46" />
    <path d="M46 18 C53 18 53 46 46 46" />
    <path d="M24 26 H40" />
    <path d="M24 33 H40" />
    <path d="M24 40 H34" />
    <circle cx="32" cy="22" r="1.8" fill="currentColor" stroke="none" />
  `,
  assassin: `
    <path d="M32 7 L38 29 L32 37 L26 29 Z" />
    <path d="M20 39 H44" />
    <path d="M32 37 V52" />
    <path d="M27 52 H37" />
    <path d="M32 43 V50" />
    <circle cx="32" cy="28" r="1.6" fill="currentColor" stroke="none" />
  `,
  lord: `
    <path d="M17 51 V25 H24 V18 H30 V25 H34 V18 H40 V25 H47 V51 Z" />
    <path d="M28 51 V41 Q32 34 36 41 V51" />
    <path d="M20 33 H44" />
    <path d="M17 51 H47" />
  `,
  bishop: `
    <path d="M32 55 V22" />
    <path d="M32 22 C32 12 42 8 48 14 C53 19 50 28 42 27 C35 26 34 18 39 16" />
    <path d="M24 55 H40" />
    <path d="M27 47 H37" />
    <circle cx="32" cy="21" r="1.7" fill="currentColor" stroke="none" />
  `
};

export function roleArt(roleId) {
  const inner = EMBLEMS[roleId];
  if (!inner) return '';
  return `<svg class="emblem-svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}

export function roleName(roleId) {
  return ROLE_MAP[roleId]?.name || roleId || '';
}

export function roleInfo(roleId) {
  return ROLE_MAP[roleId] || { id: roleId, name: roleId, en: '', tagline: '', skill: '', desc: '' };
}
