/**
 * tabs.js — タブ UI 管理モジュール
 *
 * 各タブは { id, name, content } を保持する。
 * ID はセッション間の一意識別子として使用する。
 */

import { saveTabs } from './storage.js';

// ─── 定数 ────────────────────────────────────────────────────────
const DEFAULT_COUNT  = 10;
const DEFAULT_PREFIX = 'テキスト';

// ─── 内部状態 ────────────────────────────────────────────────────
let _tabs       = [];   // { id, name, content }[]
let _currentIdx = 0;

// コールバック
let _onSwitch   = null; // (index, content, tabId) => void
let _onRemove   = null; // (removedTabId) => void
let _getContent = null; // () => string

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

// ─── 公開 API ────────────────────────────────────────────────────

/**
 * タブシステムを初期化する
 * @param {object} opts
 * @param {Array|null} opts.savedTabs    保存済みタブデータ
 * @param {Function}   opts.onSwitch     切り替えコールバック (index, content, tabId) => void
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

  _render();
  _doSwitch(0, false); // 初期タブ選択（現在の内容を保存しない）
}

/** 現在のタブインデックス */
export function getCurrentIndex() { return _currentIdx; }
/** 現在のタブデータ */
export function getCurrentTab()   { return _tabs[_currentIdx]; }
/** 全タブデータ */
export function getTabs()         { return _tabs; }

/**
 * エディター内容の変更を現在のタブに同期する（自動保存用）
 * @param {string} content
 */
export function syncCurrentContent(content) {
  _tabs[_currentIdx].content = content;
  saveTabs(_tabs);
  _updateEmptyState(_currentIdx);
}

/** タブを追加して選択する */
export function addTab() {
  _tabs.push(_makeTab(`${DEFAULT_PREFIX}${_tabs.length + 1}`));
  saveTabs(_tabs);
  _render();
  _doSwitch(_tabs.length - 1);
}

/**
 * タブを削除する（最低 1 枚は維持）
 * @param {number} index
 */
export function removeTab(index) {
  if (_tabs.length <= 1) return;
  const removedId = _tabs[index].id;
  _tabs.splice(index, 1);
  // 削除後のインデックス計算
  const newIdx = Math.min(_currentIdx, _tabs.length - 1);
  _currentIdx = newIdx;
  saveTabs(_tabs);
  if (_onRemove) _onRemove(removedId);
  _render();
  if (_onSwitch) {
    const tab = _tabs[_currentIdx];
    _onSwitch(_currentIdx, tab.content, tab.id);
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
  _render();
}

// ─── 内部関数 ────────────────────────────────────────────────────

/**
 * タブを切り替える
 * @param {number}  index     切り替え先インデックス
 * @param {boolean} saveFirst 切り替え前に現在の内容を保存するか
 */
function _doSwitch(index, saveFirst = true) {
  if (saveFirst && _getContent) {
    _tabs[_currentIdx].content = _getContent();
    saveTabs(_tabs);
  }
  _currentIdx = index;
  _render();
  if (_onSwitch) {
    const tab = _tabs[_currentIdx];
    _onSwitch(_currentIdx, tab.content, tab.id);
  }
}

function _updateEmptyState(index) {
  const tab = _tabs[index];
  if (!tab) return;
  const el = document.querySelector(`.tab-item[data-tab-id="${tab.id}"]`);
  if (!el) return;
  el.classList.toggle('empty', !tab.content.trim());
}

function _render() {
  const list = document.getElementById('tab-list');
  list.innerHTML = '';

  _tabs.forEach((tab, i) => {
    const el = _el('div', [
      'tab-item',
      i === _currentIdx   ? 'active' : '',
      !tab.content.trim() ? 'empty'  : '',
    ].filter(Boolean).join(' '));
    el.dataset.tabId = tab.id;
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', String(i === _currentIdx));

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
      if (e.detail >= 2) return;  // dblclick 時は click を無視
      _doSwitch(i);
    });
    // ダブルクリックでリネーム（ID を渡して DOM を再取得）
    el.addEventListener('dblclick', e => {
      if (e.target === closeEl) return;
      e.preventDefault();
      const tabId = tab.id;
      // 未アクティブなタブなら先に切り替える（_renderが走るので rAFで待つ）
      if (i !== _currentIdx) {
        _doSwitch(i);
        requestAnimationFrame(() => _startRename(tabId));
      } else {
        _startRename(tabId);
      }
    });
    // 閉じるボタン
    closeEl.addEventListener('click', e => {
      e.stopPropagation();
      removeTab(i);
    });

    list.appendChild(el);
  });

  // アクティブタブを表示
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
  };
  const cancel = () => {
    if (done) return;
    done = true;
    _render();
  };

  input.addEventListener('blur', commit, { once: true });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { input.removeEventListener('blur', commit); commit(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); cancel(); }
  });
}
