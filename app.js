'use strict';

/**
 * Reversi Trainer PWA
 * - Loads JSON store
 * - Lists big/small folders and kifu entries
 * - Renders an 8x8 board and steps through moves
 */
const state = {
  store: null,
  big: null,
  small: null,
  kifu: null,
  moveIndex: 0,
  board: null,
  player: 'B', // B (先手/黒) → W → B ...
  autoTimer: null,
};

const els = {
  bigList: document.getElementById('bigList'),
  smallList: document.getElementById('smallList'),
  kifuList: document.getElementById('kifuList'),
  board: document.getElementById('board'),
  kifuTitle: document.getElementById('kifuTitle'),
  kifuMeta: document.getElementById('kifuMeta'),
  moveList: document.getElementById('moveList'),
  moveInfo: document.getElementById('moveInfo'),
  searchBox: document.getElementById('searchBox'),
  loadBundledBtn: document.getElementById('loadBundledBtn'),
  fileInput: document.getElementById('fileInput'),
  firstBtn: document.getElementById('firstBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  lastBtn: document.getElementById('lastBtn'),
  autoBtn: document.getElementById('autoBtn'),
};

const B = 'B', W = 'W', E = '.';
const DIRS = [
  [-1,-1], [0,-1], [1,-1],
  [-1, 0],         [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

function init() {
  buildEmptyBoard();
  wireEvents();
}

function wireEvents() {
  els.loadBundledBtn.addEventListener('click', async () => {
    const ok = await tryLoadBundled();
    if (!ok) alert('内蔵データの読み込みに失敗しました。先に「JSONファイルを選ぶ」をお試しください。');
  });
  els.fileInput.addEventListener('change', async (e) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const text = await file.text();
    const json = JSON.parse(text);
    loadStore(json);
  });

  els.searchBox.addEventListener('input', () => refreshKifuList());

  els.firstBtn.addEventListener('click', () => gotoMove(0));
  els.prevBtn.addEventListener('click', () => gotoMove(state.moveIndex - 1));
  els.nextBtn.addEventListener('click', () => gotoMove(state.moveIndex + 1));
  els.lastBtn.addEventListener('click', () => gotoMove(currentMoves().length));
  els.autoBtn.addEventListener('click', toggleAuto);
}

async function tryLoadBundled() {
  try {
    const res = await fetch('./data/reversi_trainer_store_v6_from_excel(1).json', {cache: 'no-store'});
    if (!res.ok) throw new Error('not ok');
    const store = await res.json();
    loadStore(store);
    return true;
  } catch (err) {
    console.warn('bundled load error', err);
    return false;
  }
}

function loadStore(store) {
  state.store = store;
  state.big = null; state.small = null; state.kifu = null;
  renderBigList();
  renderSmallList();
  renderKifuList();
  resetToNewKifu(null);
}

function buildEmptyBoard() {
  els.board.innerHTML = '';
  for (let r=0;r<8;r++) {
    for (let c=0;c<8;c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const coord = document.createElement('div');
      coord.className = 'coord';
      coord.textContent = String.fromCharCode(65+c) + (r+1);
      cell.appendChild(coord);
      els.board.appendChild(cell);
    }
  }
}

function startPosition() {
  const board = Array.from({length: 8}, () => Array(8).fill(E));
  board[3][3] = W; // D4
  board[4][4] = W; // E5
  board[3][4] = B; // D5
  board[4][3] = B; // E4
  return board;
}

function renderBoard() {
  const nodes = els.board.querySelectorAll('.cell');
  nodes.forEach(n => {
    const d = n.querySelector('.disc');
    if (d) d.remove();
  });
  for (let r=0;r<8;r++) {
    for (let c=0;c<8;c++) {
      const v = state.board[r][c];
      if (v === E) continue;
      const idx = r*8 + c;
      const cell = nodes[idx];
      const disc = document.createElement('div');
      disc.className = 'disc ' + (v===B ? 'black' : 'white');
      disc.setAttribute('aria-label', `${v===B?'黒':'白'}: ${String.fromCharCode(65+c)}${r+1}`);
      cell.appendChild(disc);
    }
  }
}

function parseMove(m) {
  // Expect like "F5"
  const col = m.charCodeAt(0) - 65; // A->0
  const row = parseInt(m.slice(1), 10) - 1; // "1"->0
  if (col<0 || col>7 || row<0 || row>7) throw new Error('invalid move: ' + m);
  return {c: col, r: row};
}

function inBoard(r,c){return r>=0&&r<8&&c>=0&&c<8;}

function applyMove(board, move, player) {
  const {r,c} = move;
  if (board[r][c] !== E) return false;
  const opponent = player===B?W:B;
  let flippedAny = false;

  for (const [dx,dy] of DIRS) {
    let rr = r+dy, cc = c+dx;
    let toFlip = [];
    while (inBoard(rr,cc) && board[rr][cc] === opponent) {
      toFlip.push([rr,cc]);
      rr += dy; cc += dx;
    }
    if (toFlip.length && inBoard(rr,cc) && board[rr][cc] === player) {
      flippedAny = true;
      for (const [fr,fc] of toFlip) board[fr][fc] = player;
    }
  }
  if (!flippedAny) {
    // Not a legal move in classic rules. For training data we assume legal.
    // Still place the disc so the user can step through sequences that include "edax" or odd lines.
    board[r][c] = player;
    return true;
  }
  board[r][c] = player;
  return true;
}

function currentMoves() {
  if (!state.kifu) return [];
  return state.kifu.moves || [];
}

function gotoMove(n) {
  const moves = currentMoves();
  const clamped = Math.min(Math.max(n, 0), moves.length);
  state.moveIndex = clamped;

  // rebuild from start
  state.board = startPosition();
  state.player = B;
  for (let i=0;i<clamped;i++) {
    const m = moves[i];
    try {
      applyMove(state.board, parseMove(m), state.player);
    } catch (e) {
      console.warn('move parse/apply error', m, e);
    }
    state.player = state.player===B?W:B;
  }
  renderBoard();
  updateMoveInfo();
  highlightMoveList();
  updateNavButtons();
}

function updateMoveInfo() {
  const total = currentMoves().length;
  els.moveInfo.textContent = `${state.moveIndex} / ${total}`;
}

function updateNavButtons() {
  const total = currentMoves().length;
  els.firstBtn.disabled = state.moveIndex <= 0;
  els.prevBtn.disabled = state.moveIndex <= 0;
  els.nextBtn.disabled = state.moveIndex >= total;
  els.lastBtn.disabled = state.moveIndex >= total;
}

function toggleAuto() {
  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
    els.autoBtn.textContent = '自動';
    return;
  }
  els.autoBtn.textContent = '停止';
  state.autoTimer = setInterval(() => {
    const total = currentMoves().length;
    if (state.moveIndex >= total) {
      clearInterval(state.autoTimer);
      state.autoTimer = null;
      els.autoBtn.textContent = '自動';
      return;
    }
    gotoMove(state.moveIndex + 1);
  }, 900);
}

function renderBigList() {
  const ul = els.bigList;
  ul.innerHTML = '';
  if (!state.store) return;
  for (const item of state.store.bigFolders || []) {
    const li = document.createElement('li');
    li.textContent = item.name + (item.defaultColor ? ` (${item.defaultColor})` : '');
    li.addEventListener('click', () => {
      state.big = item.name;
      state.small = null;
      state.kifu = null;
      setActive(ul, li);
      renderSmallList();
      renderKifuList();
      resetToNewKifu(null);
    });
    ul.appendChild(li);
  }
}

function renderSmallList() {
  const ul = els.smallList;
  ul.innerHTML = '';
  if (!state.store || !state.big) return;
  const list = state.store.smallByBig?.[state.big] || [];
  for (const name of list) {
    const li = document.createElement('li');
    li.textContent = name;
    li.addEventListener('click', () => {
      state.small = name;
      state.kifu = null;
      setActive(ul, li);
      renderKifuList();
      resetToNewKifu(null);
    });
    ul.appendChild(li);
  }
}

function renderKifuList() {
  const ul = els.kifuList;
  ul.innerHTML = '';
  if (!state.store || !state.big || !state.small) return;
  const key = `${state.big}/${state.small}`;
  const list = state.store.kifuByPath?.[key] || [];

  const q = els.searchBox.value?.trim().toLowerCase();
  const filtered = q
    ? list.filter(x => (x.name||'').toLowerCase().includes(q) || (x.comment||'').toLowerCase().includes(q))
    : list;

  filtered.forEach((k, idx) => {
    const li = document.createElement('li');
    const title = k.name || k.id || `#${idx+1}`;
    li.innerHTML = `<div>${escapeHtml(title)}</div>
      <div style="color:#bbb;font-size:12px">${(k.comment||'').slice(0,70)}</div>`;
    li.addEventListener('click', () => {
      setActive(ul, li);
      loadKifu(k);
    });
    ul.appendChild(li);
  });
}

function loadKifu(kifu) {
  state.kifu = kifu;
  state.moveIndex = 0;
  state.board = startPosition();
  state.player = B;
  renderBoard();
  updateMoveInfo();
  updateNavButtons();

  els.kifuTitle.textContent = kifu.name || kifu.id || '（無題）';

  const meta = [];
  if (kifu.id) meta.push(kv('ID', kifu.id));
  if (kifu.enabled !== undefined) meta.push(kv('有効', String(kifu.enabled)));
  if (kifu.comment) meta.push(kv('メモ', escapeHtml(kifu.comment)));
  if (kifu.moves) meta.push(kv('手数', String(kifu.moves.length)));
  if (kifu.sig) meta.push(kv('Sig', kifu.sig));

  els.kifuMeta.innerHTML = `<div class="kv">${meta.join('')}</div>`;

  // list of moves
  els.moveList.innerHTML = '';
  (kifu.moves||[]).forEach((m,i) => {
    const li = document.createElement('li');
    li.textContent = `${i+1}. ${m}`;
    li.addEventListener('click', () => gotoMove(i+1));
    els.moveList.appendChild(li);
  });
}

function kv(k, v) {
  return `<div class="k">${k}</div><div class="v">${v}</div>`;
}

function resetToNewKifu() {
  els.kifuTitle.textContent = state.kifu ? (state.kifu.name||state.kifu.id) : '定石を選んでください';
  els.kifuMeta.innerHTML = '';
  els.moveList.innerHTML = '';
  state.board = startPosition();
  state.player = B;
  state.moveIndex = 0;
  renderBoard();
  updateMoveInfo();
  updateNavButtons();
}

function setActive(ul, li) {
  ul.querySelectorAll('li').forEach(x=>x.classList.remove('active'));
  li.classList.add('active');
}

function highlightMoveList() {
  const items = els.moveList.querySelectorAll('li');
  items.forEach((li, i) => {
    li.style.background = (i+1 === state.moveIndex) ? '#1f2937' : '#141414';
  });
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

// Boot
document.addEventListener('DOMContentLoaded', init);
