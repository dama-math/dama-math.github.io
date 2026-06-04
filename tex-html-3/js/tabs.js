/**
 * tabs.js — タブ UI 管理モジュール
 *
 * 各タブは { id, name, content } を保持する。
 * ID はセッション間の一意識別子として使用する。
 */

import { saveTabs, saveActiveTabId, loadActiveTabId } from './storage.js';

// ─── 定数 ────────────────────────────────────────────────────────
const DEFAULT_COUNT  = 10;
const DEFAULT_PREFIX = 'テキスト';

// ─── 内部状態 ────────────────────────────────────────────────────
let _tabs       = [];   // { id, name, content }[]
let _currentIdx = 0;

// コールバック
let _onSwitch   = null; // (index, content, tabId, prevTabId) => void
let _onRemove   = null; // (removedTabId) => void
let _getContent = null; // () => string

// Fix #8: 自動保存のデバウンスタイマー
let _saveTimer = null;

// ─── ユーティリティ ──────────────────────────────────────────────
function _genId() {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
function _makeTab(name, content = '', id = _genId()) {
  return { id, name, content };
}
function _el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

/**
 * Fix #8: キー入力のたびに発生する localStorage 書き込みを 400ms デバウンスする。
 * addTab / removeTab / renameTab など構造変化は即時保存のまま維持する。
 */
function _debouncedSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveTabs(_tabs), 400);
}

// ─── 公開 API ────────────────────────────────────────────────────

/**
 * タブシステムを初期化する
 * @param {object} opts
 * @param {Array|null} opts.savedTabs    保存済みタブデータ
 * @param {Function}   opts.onSwitch     切り替えコールバック (index, content, tabId, prevTabId) => void
 * @param {Function}   opts.getContent   現在のエディター内容を返す関数
 * @param {Function}   [opts.onRemove]   削除コールバック (removedTabId) => void
 */
export function initTabs({ savedTabs, onSwitch, getContent, onRemove }) {
  _onSwitch   = onSwitch;
  _getContent = getContent;
  _onRemove   = onRemove ?? null;

  if (savedTabs && savedTabs.length > 0) {
    // 後方互換性: id がないタブには付与する
    _tabs = savedTabs.map(t => _makeTab(t.name ?? DEFAULT_PREFIX, t.content ?? '', t.id));
  } else {
    _tabs = Array.from({ length: DEFAULT_COUNT }, (_, i) =>
      _makeTab(`${DEFAULT_PREFIX}${i + 1}`)
    );
  }

  let initialIdx = 0;
  const activeId = loadActiveTabId();
  if (activeId) {
    const idx = _tabs.findIndex(t => t.id === activeId);
    if (idx !== -1) initialIdx = idx;
  }

  _render();
  _doSwitch(initialIdx, false); // 初期タブ選択（現在の内容を保存しない）
}

/** 現在のタブインデックス */
export function getCurrentIndex() { return _currentIdx; }
/** 現在のタブデータ */
export function getCurrentTab()   { return _tabs[_currentIdx]; }
/** 全タブデータ */
export function getTabs()         { return _tabs; }

/**
 * エディター内容の変更を現在のタブに同期する（自動保存用）
 * Fix #8: localStorage 書き込みは 400ms デバウンスする。
 * @param {string} content
 */
export function syncCurrentContent(content) {
  _tabs[_currentIdx].content = content;
  _debouncedSave();
  _updateEmptyState(_currentIdx);
}

/**
 * タブを追加して選択する
 * Fix #9: 全 DOM を再構築せず、新しい要素のみ末尾に追加する。
 */
export function addTab() {
  const newTab = _makeTab(`${DEFAULT_PREFIX}${_tabs.length + 1}`);
  _tabs.push(newTab);
  saveTabs(_tabs);
  const list = document.getElementById('tab-list');
  list.appendChild(_createTabElement(newTab, false));
  _doSwitch(_tabs.length - 1);
}

/**
 * タブを削除する（最低 1 枚は維持）
 *
 * Fix #6: アクティブタブを削除した場合のみ _onSwitch を呼び出す。
 *         非アクティブタブ削除時はエディター内容が変わらないため不要。
 * Fix #9: 全 DOM を再構築せず、対象要素のみ除去する。
 *
 * @param {number} index
 */
export function removeTab(index) {
  if (_tabs.length <= 1) return;
  const removedId = _tabs[index].id;
  const wasActive = (index === _currentIdx);

  // Fix #9: 対象要素のみ除去
  const removedEl = document.querySelector(`.tab-item[data-tab-id="${removedId}"]`);
  if (removedEl) removedEl.remove();

  _tabs.splice(index, 1);

  // 削除後のインデックス計算
  if (index < _currentIdx) {
    _currentIdx--;
  } else if (index === _currentIdx) {
    _currentIdx = Math.min(_currentIdx, _tabs.length - 1);
  }

  saveTabs(_tabs);
  if (_onRemove) _onRemove(removedId);

  // 残存要素の active クラスを更新
  document.querySelectorAll('#tab-list .tab-item').forEach((el, i) => {
    const isActive = i === _currentIdx;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-selected', String(isActive));
  });

  // アクティブタブをスクロール表示
  requestAnimationFrame(() => {
    const list   = document.getElementById('tab-list');
    const active = list?.querySelector('.tab-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  // Fix #6: アクティブタブを削除した場合のみエディターへ通知
  if (wasActive && _onSwitch) {
    const tab = _tabs[_currentIdx];
    saveActiveTabId(tab.id);
    // prevTabId = null: 削除済みのため保存不要
    _onSwitch(_currentIdx, tab.content, tab.id, null);
  }
}

/**
 * タブをリネームする
 * @param {number} index
 * @param {string} name
 */
export function renameTab(index, name) {
  _tabs[index].name = name.trim() || `${DEFAULT_PREFIX}${index + 1}`;
  saveTabs(_tabs);
}

// ─── 内部関数 ────────────────────────────────────────────────────

/**
 * Fix #9: タブ DOM 要素を生成するファクトリ関数。
 * ハンドラーはキャプチャしたインデックスではなく tab.id で都度検索するため、
 * 削除・追加後もインデックスがズレない。
 *
 * @param {{ id: string, name: string, content: string }} tab
 * @param {boolean} isActive
 * @returns {HTMLElement}
 */
function _createTabElement(tab, isActive) {
  const el = _el('div', [
    'tab-item',
    isActive            ? 'active' : '',
    !tab.content.trim() ? 'empty'  : '',
  ].filter(Boolean).join(' '));
  el.dataset.tabId = tab.id;
  el.setAttribute('role', 'tab');
  el.setAttribute('aria-selected', String(isActive));

  const dot     = _el('span', 'tab-dot');
  const nameEl  = _el('span', 'tab-name');
  nameEl.textContent = tab.name;
  const closeEl = _el('span', 'tab-close');
  closeEl.textContent = '×';
  closeEl.title = 'タブを閉じる';
  closeEl.setAttribute('role', 'button');
  closeEl.setAttribute('aria-label', `${tab.name} を閉じる`);

  el.append(dot, nameEl, closeEl);

  // クリックで切り替え（ダブルクリック時はスキップ）
  el.addEventListener('click', e => {
    if (e.target === closeEl) return;
    if (e.detail >= 2) return;
    const idx = _tabs.findIndex(t => t.id === tab.id);
    if (idx !== -1) _doSwitch(idx);
  });

  // ダブルクリックでリネーム
  el.addEventListener('dblclick', e => {
    if (e.target === closeEl) return;
    e.preventDefault();
    const idx = _tabs.findIndex(t => t.id === tab.id);
    if (idx === -1) return;
    if (idx !== _currentIdx) {
      _doSwitch(idx);
      requestAnimationFrame(() => _startRename(tab.id));
    } else {
      _startRename(tab.id);
    }
  });

  // 閉じるボタン
  closeEl.addEventListener('click', e => {
    e.stopPropagation();
    const idx = _tabs.findIndex(t => t.id === tab.id);
    if (idx !== -1) removeTab(idx);
  });

  return el;
}

/**
 * タブを切り替える
 * Fix #12: 切り替え前のタブ ID (oldTabId) を _onSwitch の第4引数として渡す。
 *          これにより main.js が currentTabId を独自管理する必要がなくなる。
 *
 * @param {number}  index     切り替え先インデックス
 * @param {boolean} saveFirst 切り替え前に現在の内容を保存するか
 */
function _doSwitch(index, saveFirst = true) {
  // saveFirst = false（初回）は oldTabId を null にして main.js の保存をスキップさせる
  const oldTabId = saveFirst ? (_tabs[_currentIdx]?.id ?? null) : null;

  if (saveFirst && _getContent) {
    _tabs[_currentIdx].content = _getContent();
    saveTabs(_tabs);
  }
  _currentIdx = index;

  // DOM を再生成せず、クラスと aria 属性のみ更新する
  document.querySelectorAll('#tab-list .tab-item').forEach((el, i) => {
    const isActive = i === _currentIdx;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-selected', String(isActive));
  });

  if (_onSwitch) {
    const tab = _tabs[_currentIdx];
    saveActiveTabId(tab.id);
    _onSwitch(_currentIdx, tab.content, tab.id, oldTabId);
  }
}

function _updateEmptyState(index) {
  const tab = _tabs[index];
  if (!tab) return;
  const el = document.querySelector(`.tab-item[data-tab-id="${tab.id}"]`);
  if (!el) return;
  el.classList.toggle('empty', !tab.content.trim());
}

/**
 * Fix #9: _createTabElement を使って全タブをレンダリングする。
 * 初期化・全体リロード時のみ呼ぶ。通常の追加・削除は直接 DOM 操作で行う。
 */
function _render() {
  const list = document.getElementById('tab-list');
  list.innerHTML = '';
  _tabs.forEach((tab, i) => {
    list.appendChild(_createTabElement(tab, i === _currentIdx));
  });
  requestAnimationFrame(() => {
    const active = list.querySelector('.tab-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}

/**
 * タブリネーム入力を開始する
 * @param {string} tabId リネーム対象タブの ID
 */
function _startRename(tabId) {
  // ID で DOM を新たに取得（古い参照を使わない）
  const el = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
  if (!el) return;
  // すでに入力中ならスキップ
  if (el.querySelector('.tab-rename-input')) return;
  const nameEl = el.querySelector('.tab-name');
  if (!nameEl) return;

  const index = _tabs.findIndex(t => t.id === tabId);
  if (index === -1) return;

  const input     = document.createElement('input');
  input.type      = 'text';
  input.className = 'tab-rename-input';
  input.value     = _tabs[index].name;
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    renameTab(index, input.value);
    const newNameEl = document.createElement('span');
    newNameEl.className = 'tab-name';
    newNameEl.textContent = _tabs[index].name;
    input.replaceWith(newNameEl);
  };
  const cancel = () => {
    if (done) return;
    done = true;
    const newNameEl = document.createElement('span');
    newNameEl.className = 'tab-name';
    newNameEl.textContent = _tabs[index].name;
    input.replaceWith(newNameEl);
  };

  input.addEventListener('blur', commit, { once: true });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { input.removeEventListener('blur', commit); commit(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); cancel(); }
  });
}
