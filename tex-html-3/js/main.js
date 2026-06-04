/**
 * main.js — アプリのエントリーポイント
 *
 * CodeMirror 6 の初期化、タブシステムとの統合、
 * イベントハンドリング、ペインリサイズなどを担当する。
 */

// CodeMirror 6 — 個別パッケージから直接インポート（メタパッケージ非使用）
import {
  EditorView, keymap,
  lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  highlightSpecialChars, drawSelection, rectangularSelection,
  dropCursor, crosshairCursor,
} from '@codemirror/view';
import { EditorState, EditorSelection } from '@codemirror/state';
import {
  history, historyKeymap, defaultKeymap,
} from '@codemirror/commands';
import {
  searchKeymap, highlightSelectionMatches,
} from '@codemirror/search';
import {
  foldGutter, foldKeymap,
  syntaxHighlighting, defaultHighlightStyle, bracketMatching,
  indentOnInput, StreamLanguage,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap,
         autocompletion, completionKeymap,
         acceptCompletion, startCompletion } from '@codemirror/autocomplete';
import { oneDark }     from '@codemirror/theme-one-dark';
import { stex }        from '@codemirror/legacy-modes/mode/stex';

import { loadTabs }                                       from './storage.js';
import { initTabs, addTab, syncCurrentContent,
         getCurrentTab }                                  from './tabs.js';
import { renderPreview }                                  from './preview.js';
import { latexCompletionSource }                          from './snippets.js';
import { initToolbar }                                    from './toolbar.js';
import { exportAsTxt }                                    from './export.js';

// ─── グローバル状態 ────────────────────────────────────────────

/** @type {EditorView | null} */
let editorView = null;

/**
 * タブ ID → EditorState のキャッシュ
 * タブごとの Undo/Redo 履歴を保持するために使用する
 * @type {Map<string, EditorState>}
 */
const tabStateCache = new Map();

/**
 * 現在表示しているタブの ID
 * null は初期化前を示す（最初のタブ切り替え時に保存スキップ）
 * @type {string | null}
 */
let currentTabId = null;

// ─── スクロール同期状態 ────────────────────────────────────────

let isSyncingLeft = false;
let isSyncingRight = false;

function syncScrollToPreview(cmScroller) {
  if (isSyncingRight) {
    isSyncingRight = false;
    return;
  }
  const previewPane = document.getElementById('preview-pane');
  if (!previewPane) return;
  
  const maxCmScroll = cmScroller.scrollHeight - cmScroller.clientHeight;
  if (maxCmScroll <= 0) return;

  const percentage = cmScroller.scrollTop / maxCmScroll;
  const maxPreviewScroll = previewPane.scrollHeight - previewPane.clientHeight;
  
  isSyncingLeft = true;
  previewPane.scrollTop = maxPreviewScroll * percentage;
}

function syncScrollToEditor(previewPane) {
  if (isSyncingLeft) {
    isSyncingLeft = false;
    return;
  }
  if (!editorView) return;
  const cmScroller = editorView.scrollDOM;
  if (!cmScroller) return;

  const maxPreviewScroll = previewPane.scrollHeight - previewPane.clientHeight;
  if (maxPreviewScroll <= 0) return;

  const percentage = previewPane.scrollTop / maxPreviewScroll;
  const maxCmScroll = cmScroller.scrollHeight - cmScroller.clientHeight;
  
  isSyncingRight = true;
  cmScroller.scrollTop = maxCmScroll * percentage;
}

// ─── カスタムテーマ ────────────────────────────────────────────

const customTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#0d1117',
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    fontSize:   '15px',
    lineHeight: '1.75',
    overflow:   'auto',
  },
  '.cm-content': {
    padding:    '16px 0',
    caretColor: '#7c6af7',
  },
  '.cm-line': { padding: '0 20px' },
  '.cm-gutters': {
    backgroundColor: '#0d1117',
    borderRight:     '1px solid #21262d',
    color:           '#484f58',
    minWidth:        '50px',
  },
  '.cm-activeLineGutter': { backgroundColor: '#161b22' },
  '.cm-activeLine':       { backgroundColor: 'rgba(255,255,255,0.025)' },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#7c6af7',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(124,106,247,0.28)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(210,153,34,0.3)',
    outline:         '1px solid rgba(210,153,34,0.5)',
    borderRadius:    '2px',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(210,153,34,0.5)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    color: '#c9d1d9',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '4px 8px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: '#1f6feb',
    color: '#ffffff',
  },
  '.cm-completionLabel': {
    color: '#c9d1d9',
  },
  '.cm-completionDetail': {
    color: '#8b949e',
    fontStyle: 'italic',
    marginLeft: '8px',
  },
  '.cm-completionMatchedText': {
    textDecoration: 'none',
    fontWeight: 'bold',
    color: '#58a6ff',
  },
}, { dark: true });

// ─── エクステンション生成 ─────────────────────────────────────

function buildExtensions() {
  return [
    // ─ カスタムキーマップ（最優先） ─
    keymap.of([
      {
        // Tab: 補完メニューが開いていれば確定、そうでなければ 2 スペース
        key: 'Tab',
        run(view) {
          if (acceptCompletion(view)) return true;
          const { state, dispatch } = view;
          const changes = state.changeByRange(range => ({
            changes: { from: range.from, to: range.to, insert: '  ' },
            range:   EditorSelection.cursor(range.from + 2),
          }));
          dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input' }));
          return true;
        },
      },
      {
        // Ctrl+S / Mod-S
        key: 'Mod-s',
        run(view) {
          const autoExport = document.getElementById('chk-auto-export')?.checked;
          if (autoExport) {
            const content  = view.state.doc.toString();
            const tab      = getCurrentTab();
            const filename = `${tab.name.replace(/[\\/:*?"<>|]/g, '_')}.txt`;
            exportAsTxt(content, filename);
            showToast(`ダウンロードしました: ${filename}`);
          } else {
            showToast('保存しました (Auto-save)');
          }
          return true;
        },
        preventDefault: true,
      },
    ]),
    // LaTeX用カッコ補完・キーマップ
    keymap.of([
      {
        key: "$",
        run(view) {
          const { state } = view;
          const sel = state.selection.main;
          if (!sel.empty) return false;
          const prevChar = state.doc.sliceString(Math.max(0, sel.from - 1), sel.from);
          const nextChar = state.doc.sliceString(sel.from, sel.from + 1);
          
          if (prevChar === '$' && nextChar === '$') {
            const changes = state.changeByRange(range => ({
              changes: { from: range.from - 1, to: range.from + 1, insert: "$$\n\n$$" },
              range: EditorSelection.cursor(range.from + 2)
            }));
            view.dispatch(state.update(changes, { userEvent: "input.type", scrollIntoView: true }));
            return true;
          }
          if (nextChar === '$') {
            view.dispatch({ selection: { anchor: sel.from + 1 } });
            return true;
          }
          const changes = state.changeByRange(range => ({
            changes: { from: range.from, insert: "$$" },
            range: EditorSelection.cursor(range.from + 1)
          }));
          view.dispatch(state.update(changes, { userEvent: "input.type", scrollIntoView: true }));
          return true;
        }
      },
      {
        key: "(",
        run(view) {
          const { state } = view;
          const sel = state.selection.main;
          if (!sel.empty) return false;
          const prev = state.doc.sliceString(Math.max(0, sel.from - 1), sel.from);
          if (prev === '@') {
            const changes = state.changeByRange(range => ({
              changes: { from: range.from, insert: "(" },
              range: EditorSelection.cursor(range.from + 1)
            }));
            view.dispatch(state.update(changes, { userEvent: "input.type", scrollIntoView: true }));
            return true;
          }
          if (prev === '\\') {
            const changes = state.changeByRange(range => ({
              changes: { from: range.from, insert: "( \\)" },
              range: EditorSelection.cursor(range.from + 1)
            }));
            view.dispatch(state.update(changes, { userEvent: "input.type", scrollIntoView: true }));
            return true;
          }
          return false;
        }
      },
      {
        key: "[",
        run(view) {
          const { state } = view;
          const sel = state.selection.main;
          if (!sel.empty) return false;
          const prev = state.doc.sliceString(Math.max(0, sel.from - 1), sel.from);
          if (prev === '@') {
            const changes = state.changeByRange(range => ({
              changes: { from: range.from, insert: "[" },
              range: EditorSelection.cursor(range.from + 1)
            }));
            view.dispatch(state.update(changes, { userEvent: "input.type", scrollIntoView: true }));
            return true;
          }
          if (prev === '\\') {
            const changes = state.changeByRange(range => ({
              changes: { from: range.from, insert: "[ \\]" },
              range: EditorSelection.cursor(range.from + 1)
            }));
            view.dispatch(state.update(changes, { userEvent: "input.type", scrollIntoView: true }));
            return true;
          }
          return false;
        }
      },
      {
        key: "{",
        run(view) {
          const { state } = view;
          const sel = state.selection.main;
          if (!sel.empty) return false;
          const prev = state.doc.sliceString(Math.max(0, sel.from - 1), sel.from);
          if (prev === '@') {
            const changes = state.changeByRange(range => ({
              changes: { from: range.from, insert: "{" },
              range: EditorSelection.cursor(range.from + 1)
            }));
            view.dispatch(state.update(changes, { userEvent: "input.type", scrollIntoView: true }));
            return true;
          }
          if (prev === '\\') {
            const changes = state.changeByRange(range => ({
              changes: { from: range.from, insert: "{ \\}" },
              range: EditorSelection.cursor(range.from + 1)
            }));
            view.dispatch(state.update(changes, { userEvent: "input.type", scrollIntoView: true }));
            return true;
          }
          return false;
        }
      },
      {
        key: "|",
        run(view) {
          const { state } = view;
          const sel = state.selection.main;
          if (!sel.empty) return false;
          const prev = state.doc.sliceString(Math.max(0, sel.from - 1), sel.from);
          if (prev === '@') {
            const changes = state.changeByRange(range => ({
              changes: { from: range.from, insert: "|" },
              range: EditorSelection.cursor(range.from + 1)
            }));
            view.dispatch(state.update(changes, { userEvent: "input.type", scrollIntoView: true }));
            return true;
          }
          return false;
        }
      }
    ]),
    // ─ basicSetup 相当（個別パッケージから手動構築） ─
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    EditorView.lineWrapping,   // 右端で折り返す
    // LaTeX スニペット補完（@ トリガー）
    autocompletion({
      override:        [latexCompletionSource],
      icons:           false,
      activateOnTyping: true,
    }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
    ]),
    StreamLanguage.define(stex), // LaTeXのシンタックスハイライト
    oneDark,          // ベーステーマ
    customTheme,      // カスタム上書き
    // ─ ドキュメント変更ハンドラー ─
    EditorView.updateListener.of(update => {
      if (!update.docChanged) return;
      const content = update.state.doc.toString();
      syncCurrentContent(content);
      updateCharCount(content);
      renderPreview(content);

      if (update.transactions.some(tr => tr.isUserEvent('delete.backward'))) {
        startCompletion(update.view);
      }
    }),
    EditorView.domEventHandlers({
      scroll(event, view) {
        if (event.target === view.scrollDOM) {
          syncScrollToPreview(event.target);
        }
      }
    }),
  ];
}

// ─── エディター初期化 ─────────────────────────────────────────

/** CodeMirror エディターを作成する */
function createEditor(initialContent) {
  if (editorView) editorView.destroy();

  const state = EditorState.create({
    doc:        initialContent,
    extensions: buildExtensions(),
  });

  editorView = new EditorView({
    state,
    parent: document.getElementById('cm-editor'),
  });
}

// ─── タブ切り替えハンドラー ─────────────────────────────────

/**
 * タブ切り替え時に EditorState を保存・復元する
 * @param {number} _index   新しいタブのインデックス（未使用、IDで管理）
 * @param {string} content  新しいタブのテキスト内容
 * @param {string} tabId    新しいタブの ID
 */
function onTabSwitch(_index, content, tabId) {
  // 現在の EditorState を保存（初回は currentTabId が null なのでスキップ）
  if (currentTabId !== null && editorView) {
    tabStateCache.set(currentTabId, editorView.state);
  }

  currentTabId = tabId;

  // 新しいタブの State を取得 or 作成
  let newState = tabStateCache.get(tabId);
  if (!newState) {
    newState = EditorState.create({
      doc:        content,
      extensions: buildExtensions(),
    });
  }

  tabStateCache.set(tabId, newState);
  editorView.setState(newState);

  updateCharCount(content);
  renderPreview(content);
}

/**
 * タブが削除されたときにキャッシュを整理する
 * @param {string} removedTabId
 */
function onTabRemove(removedTabId) {
  tabStateCache.delete(removedTabId);
  if (currentTabId === removedTabId) {
    currentTabId = null;
  }
}

// ─── UI ヘルパー ─────────────────────────────────────────────

let _toastTimer = null;

/**
 * トースト通知を表示する
 * @param {string} message
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/**
 * ツールバーの文字数カウントを更新する
 * @param {string} content
 */
function updateCharCount(content) {
  const el = document.getElementById('char-count');
  if (el) el.textContent = `${content.length.toLocaleString()}文字`;
}

// ─── ドラッグでリサイズ可能なディバイダー ────────────────────

function initResizableDivider() {
  const divider    = document.getElementById('divider');
  const editorPane = document.getElementById('editor-pane');
  const mainArea   = document.getElementById('main-area');

  let isDragging  = false;
  let startX      = 0;
  let startWidth  = 0;

  divider.addEventListener('mousedown', e => {
    isDragging  = true;
    startX      = e.clientX;
    startWidth  = editorPane.getBoundingClientRect().width;
    divider.classList.add('dragging');
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const total    = mainArea.getBoundingClientRect().width;
    const newWidth = Math.max(160, Math.min(total - 160, startWidth + (e.clientX - startX)));
    editorPane.style.flex  = 'none';
    editorPane.style.width = `${newWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    divider.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
  });
}

// ─── 初期化 ─────────────────────────────────────────────────

async function init() {
  const savedTabs = loadTabs();

  // エディターを空で作成（タブ初期化時に内容が設定される）
  createEditor('');

  // タブシステム初期化
  initTabs({
    savedTabs,
    onSwitch:   onTabSwitch,
    getContent: () => editorView?.state.doc.toString() ?? '',
    onRemove:   onTabRemove,
  });

  // ツールバー初期化
  initToolbar(() => editorView);

  // タブ追加ボタン
  document.getElementById('btn-add-tab')
    .addEventListener('click', addTab);

  // エクスポートボタン
  document.getElementById('btn-export')
    .addEventListener('click', () => {
      const content  = editorView?.state.doc.toString() ?? '';
      const tab      = getCurrentTab();
      const filename = `${tab.name.replace(/[\\/:*?"<>|]/g, '_')}.txt`;
      exportAsTxt(content, filename);
    });

  // リサイズディバイダー
  initResizableDivider();

  // スクロール同期 (Preview -> Editor)
  document.getElementById('preview-pane').addEventListener('scroll', (e) => {
    syncScrollToEditor(e.target);
  });
}

init().catch(err => console.error('[main] 初期化エラー:', err));
