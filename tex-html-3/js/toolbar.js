/**
 * toolbar.js — ツールバーボタンのアクション定義
 *
 * 各アクションは選択範囲があればラップ、なければテンプレートを挿入し
 * カーソルを適切な位置（{} の内側など）に置く。
 */

import { EditorSelection } from '@codemirror/state';

/* ================================================================
   アクション定義
   wrap(selectedText):  挿入テキストを返す（選択あり / なしで分岐）
   cursorOffset:        選択なし時のカーソル位置（文字列先頭からのオフセット）
   ================================================================ */
const ACTIONS = {
  textbf: {
    wrap: s => s ? `\\textbf{${s}}` : '\\textbf{}',
    cursorOffset: 8,  // \textbf{ の次
  },
  textit: {
    wrap: s => s ? `\\textit{${s}}` : '\\textit{}',
    cursorOffset: 8,
  },
  section: {
    wrap: s => s ? `\\section{${s}}` : '\\section{}',
    cursorOffset: 9,
  },
  subsection: {
    wrap: s => s ? `\\subsection{${s}}` : '\\subsection{}',
    cursorOffset: 12,
  },
  'inline-math': {
    wrap: s => s ? `$${s}$` : '$  $',
    cursorOffset: 1,
  },
  'display-math': {
    wrap: s => s ? `\\[\n${s}\n\\]` : '\\[\n\n\\]',
    cursorOffset: 3,  // \[ の後の改行の次
  },
  align: {
    wrap: s => s
      ? `\\begin{align*}\n${s}\n\\end{align*}`
      : '\\begin{align*}\n\n\\end{align*}',
    cursorOffset: 15, // \begin{align*}\n の次
  },
  itemize: {
    wrap: s => s
      ? `\\begin{itemize}\n\\item ${s}\n\\end{itemize}`
      : '\\begin{itemize}\n\\item \n\\end{itemize}',
    cursorOffset: 22, // \\item の後
  },
  enumerate: {
    wrap: s => s
      ? `\\begin{enumerate}\n\\item ${s}\n\\end{enumerate}`
      : '\\begin{enumerate}\n\\item \n\\end{enumerate}',
    cursorOffset: 24,
  },
};

/**
 * ツールバーを初期化する
 * @param {() => import('@codemirror/view').EditorView | null} getView
 */
export function initToolbar(getView) {
  const container = document.getElementById('toolbar-buttons');
  container.addEventListener('click', e => {
    const btn = e.target.closest('.tb-btn[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === 'export') return; // main.js 側で処理

    const view = getView();
    if (!view) return;

    _applyAction(view, action);
    view.focus();
  });
}

/**
 * アクションをエディターに適用する
 * @param {import('@codemirror/view').EditorView} view
 * @param {string} action
 */
function _applyAction(view, action) {
  const def = ACTIONS[action];
  if (!def) return;

  const { state } = view;
  const sel          = state.selection.main;
  const selectedText = state.doc.sliceString(sel.from, sel.to);
  const insertion    = def.wrap(selectedText);

  // カーソル位置: 選択範囲があれば挿入後末尾、なければ定義オフセット
  const cursorPos = selectedText
    ? sel.from + insertion.length
    : sel.from + def.cursorOffset;

  view.dispatch({
    changes:   { from: sel.from, to: sel.to, insert: insertion },
    selection: EditorSelection.cursor(cursorPos),
    userEvent: 'input.toolbar',
  });
}
