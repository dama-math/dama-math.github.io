/**
 * toolbar.js — ツールバーボタンのアクション定義
 *
 * 各アクションは選択範囲があればラップ、なければテンプレートを挿入する。
 * Fix #4/#11: カーソル位置をマジックナンバーで指定するのをやめ、
 *             CURSOR マーカー（\x00）をテンプレートに埋め込む方式に変更。
 *             これにより cursorOffset の手動管理が不要になる。
 */

import { EditorSelection } from '@codemirror/state';

/**
 * 選択なし時のカーソル位置を示すマーカー文字（null byte）。
 * 挿入直前にテキストから除去し、その位置にカーソルを置く。
 */
const CURSOR = '\x00';

/* ================================================================
   アクション定義
   wrap(selectedText):
     selectedText が空文字列 → テンプレート文字列（CURSOR マーカー含む）
     selectedText が非空     → 選択テキストをラップした文字列
   ================================================================ */
const ACTIONS = {
  textbf: {
    wrap: s => s ? `\\textbf{${s}}` : `\\textbf{${CURSOR}}`,
  },
  textit: {
    wrap: s => s ? `\\textit{${s}}` : `\\textit{${CURSOR}}`,
  },
  section: {
    wrap: s => s ? `\\section{${s}}` : `\\section{${CURSOR}}`,
  },
  subsection: {
    wrap: s => s ? `\\subsection{${s}}` : `\\subsection{${CURSOR}}`,
  },
  // Fix #4: inline-math の cursorOffset が誤っていた問題を CURSOR マーカーで解決
  //         選択なし: $|$ （| = カーソル位置）
  'inline-math': {
    wrap: s => s ? `$${s}$` : `$${CURSOR}$`,
  },
  // Fix #13: コメントが誤っていた display-math も CURSOR マーカーに統一
  //          選択なし: \[\n|\n\]（| = 空行の先頭）
  'display-math': {
    wrap: s => s ? `\\[\n${s}\n\\]` : `\\[\n${CURSOR}\n\\]`,
  },
  align: {
    wrap: s => s
      ? `\\begin{align*}\n${s}\n\\end{align*}`
      : `\\begin{align*}\n${CURSOR}\n\\end{align*}`,
  },
  itemize: {
    wrap: s => s
      ? `\\begin{itemize}\n\\item ${s}\n\\end{itemize}`
      : `\\begin{itemize}\n\\item ${CURSOR}\n\\end{itemize}`,
  },
  enumerate: {
    wrap: s => s
      ? `\\begin{enumerate}\n\\item ${s}\n\\end{enumerate}`
      : `\\begin{enumerate}\n\\item ${CURSOR}\n\\end{enumerate}`,
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
 *
 * Fix #11: テンプレート内の CURSOR マーカーの位置を自動計算するため、
 *          マジックナンバーの cursorOffset が不要になった。
 *
 * @param {import('@codemirror/view').EditorView} view
 * @param {string} action
 */
function _applyAction(view, action) {
  const def = ACTIONS[action];
  if (!def) return;

  const { state } = view;
  const sel          = state.selection.main;
  const selectedText = state.doc.sliceString(sel.from, sel.to);

  let insertion = def.wrap(selectedText);
  let cursorPos;

  if (selectedText) {
    // 選択範囲あり: 挿入テキスト末尾にカーソル
    cursorPos = sel.from + insertion.length;
  } else {
    // 選択範囲なし: CURSOR マーカーを除去し、その位置にカーソルを置く
    const markerIdx = insertion.indexOf(CURSOR);
    insertion = insertion.replace(CURSOR, '');
    cursorPos = sel.from + (markerIdx !== -1 ? markerIdx : insertion.length);
  }

  view.dispatch({
    changes:   { from: sel.from, to: sel.to, insert: insertion },
    selection: EditorSelection.cursor(cursorPos),
    userEvent: 'input.toolbar',
  });
}
