/**
 * snippets.js — LaTeX スニペット定義とオートコンプリートソース
 *
 * Fix #10: @ トリガー（AT_SNIPPETS）と英字/記号トリガー（WORD_SNIPPETS）を
 *          別々のオブジェクトと補完ソース関数に分割した。
 *          これにより matchBefore の正規表現が単純化され、
 *          各グループのメンテナンス性が向上する。
 */

import { EditorSelection } from '@codemirror/state';

/* ================================================================
   AT スニペット（@ から始まるトリガー）
   ================================================================ */
export const AT_SNIPPETS = {
  // ─── ギリシャ文字（小文字）────────────────────────────────
  '@a':  '\\alpha',
  '@b':  '\\beta',
  '@c':  '\\chi',
  '@d':  '\\delta',
  '@e':  '\\epsilon',
  '@ve': '\\varepsilon',
  '@f':  '\\phi',
  '@vf': '\\varphi',
  '@g':  '\\gamma',
  '@h':  '\\eta',
  '@i':  '\\iota',
  '@k':  '\\kappa',
  '@l':  '\\lambda',
  '@m':  '\\mu',
  '@n':  '\\nu',
  '@p':  '\\pi',
  '@vp': '\\varpi',
  '@q':  '\\theta',
  '@vq': '\\vartheta',
  '@r':  '\\rho',
  '@vr': '\\varrho',
  '@s':  '\\sigma',
  '@vs': '\\varsigma',
  '@t':  '\\tau',
  '@u':  '\\upsilon',
  '@o':  '\\omega',
  '@x':  '\\xi',
  '@y':  '\\psi',
  '@z':  '\\zeta',
  // ─── ギリシャ文字（大文字）────────────────────────────────
  '@D': '\\Delta',
  '@F': '\\Phi',
  '@G': '\\Gamma',
  '@L': '\\Lambda',
  '@P': '\\Pi',
  '@Q': '\\Theta',
  '@S': '\\Sigma',
  '@U': '\\Upsilon',
  '@W': '\\Omega',
  '@X': '\\Xi',
  '@Y': '\\Psi',
  // ─── 数学記号 ────────────────────────────────────────────
  '@.': '\\cdot',
  '@8': '\\infty',
  '@6': '\\partial',
  '@@': '\\circ',
  '@0': '^\\circ',
  '@=': '\\equiv',
  '@*': '\\times',
  '@<': '\\leq',
  '@>': '\\geq',
  '@+': '\\bigcup',
  '@-': '\\bigcap',
  '@,': '\\nonumber',
  '@&': '\\wedge',
  // ─── 関数・演算子 ────────────────────────────────────────
  '@/': '\\frac{}{}',
  '@%': '\\frac{}{}',  // @/ の別名（どちらでも入力しやすい方を使用可）
  '@^': '\\hat{}',
  '@_': '\\bar{}',
  '@;': '\\dot{}',
  '@:': '\\ddot{}',
  '@2': '\\sqrt{}',
  '@I': '\\int_{}^{}',
  // ─── ブラケット ──────────────────────────────────────────
  '@(': '\\left(  \\right)',
  '@{': '\\left\\{  \\right\\}',
  '@[': '\\left[  \\right]',
  '@|': '\\left|  \\right|',
};

/* ================================================================
   ワードスニペット（英字 2〜4 文字 / 記号トリガー）
   ================================================================ */
export const WORD_SNIPPETS = {
  // ─── 環境 ────────────────────────────────────────────────
  'beq':  '\\begin{equation}\n  \n\\end{equation}',
  'bseq': '\\begin{equation*}\n  \n\\end{equation*}',
  'bal':  '\\begin{align}\n  \n\\end{align}',
  'bsal': '\\begin{align*}\n  \n\\end{align*}',
  'bga':  '\\begin{gather}\n  \n\\end{gather}',
  'bsga': '\\begin{gather*}\n  \n\\end{gather*}',
  'bmu':  '\\begin{multline}\n  \n\\end{multline}',
  'bsmu': '\\begin{multline*}\n  \n\\end{multline*}',
  'bit':  '\\begin{itemize}\n  \\item \n\\end{itemize}',
  'ben':  '\\begin{enumerate}\n  \\item \n\\end{enumerate}',
  'bspl': '\\begin{split}\n  \n\\end{split}',
  'bcas': '\\begin{cases}\n  \n\\end{cases}',
  'bfr':  '\\begin{frame}\n  \n\\end{frame}',
  'bfi':  '\\begin{figure}\n  \n\\end{figure}',
  'bta':  '\\begin{table}\n  \n\\end{table}',
  // ─── 章立て ──────────────────────────────────────────────
  'spa': '\\part{}',
  'sch': '\\chapter{}',
  'sse': '\\section{}',
  'sss': '\\subsection{}',
  'ss2': '\\subsubsection{}',
  'spg': '\\paragraph{}',
  'ssp': '\\subparagraph{}',
  // ─── 便利な略記 ──────────────────────────────────────────
  '__':  '_{}',
  '**':  '^{}',
  '...': '\\dots',
  // ─── テキストフォント ────────────────────────────────────
  'fno': '\\textnormal{}',
  'frm': '\\textrm{}',
  'fem': '\\emph{}',
  'fsf': '\\textsf{}',
  'ftt': '\\texttt{}',
  'fit': '\\textit{}',
  'fsl': '\\textsl{}',
  'fsc': '\\textsc{}',
  'ful': '\\underline{}',
  'fuc': '\\uppercase{}',
  'flc': '\\lowercase{}',
  'fbf': '\\textbf{}',
  'fss': '\\textsuperscript{}',
  'fbs': '\\textsubscript{}',
  // ─── 数式フォント ────────────────────────────────────────
  'mrm': '\\mathrm{}',
  'msf': '\\mathsf{}',
  'mbf': '\\mathbf{}',
  'mbb': '\\mathbb{}',
  'mca': '\\mathcal{}',
  'mit': '\\mathit{}',
  'mtt': '\\mathtt{}',
};

// ─── カーソルオフセット計算 ──────────────────────────────────────

/**
 * スニペット展開後のカーソル位置を計算する
 * @param {string} value 展開後テキスト
 * @returns {number} 挿入先頭からのカーソルオフセット
 */
function computeCursorOffset(value) {
  const braceIdx = value.indexOf('{}');
  const envIdx   = value.indexOf('\n  \n');
  const itemIdx  = value.indexOf('\\item \n');
  const rightIdx = value.indexOf(' \\right');

  if (braceIdx !== -1) return braceIdx + 1;  // {} の内側
  if (envIdx   !== -1) return envIdx + 3;    // 環境本体の先頭（\n  \n の真ん中）
  if (itemIdx  !== -1) return itemIdx + 6;   // \item の直後
  if (rightIdx !== -1) return rightIdx;      // \right の直前のスペース位置
  return value.length;
}

/**
 * 補完オプションオブジェクトを生成する
 * @param {string} key    スニペットキー
 * @param {string} value  展開後テキスト
 * @param {string} typed  現在入力済みの文字列
 */
function _makeOption(key, value, typed) {
  const cursorOffset = computeCursorOffset(value);
  return {
    label:  key,
    detail: value,
    boost:  -(key.length - typed.length),
    apply(view, _completion, from, to) {
      view.dispatch({
        changes:   { from, to, insert: value },
        selection: EditorSelection.cursor(from + cursorOffset),
        userEvent: 'input.complete',
      });
    },
  };
}

// ─── オートコンプリートソース ────────────────────────────────────

/**
 * @ トリガーの補完ソース
 * @param {import('@codemirror/autocomplete').CompletionContext} context
 */
export function atSnippetSource(context) {
  const match = context.matchBefore(/@[^\s]*/);
  if (!match) return null;

  const typed   = match.text;
  const options = Object.entries(AT_SNIPPETS)
    .filter(([key]) => key.startsWith(typed))
    .map(([key, value]) => _makeOption(key, value, typed));

  if (options.length === 0) return null;
  return { from: match.from, options, filter: false };
}

/**
 * ワードトリガーの補完ソース（英字 2〜4 文字 / 記号）
 * @param {import('@codemirror/autocomplete').CompletionContext} context
 */
export function wordSnippetSource(context) {
  const match = context.matchBefore(/[a-z]{1,4}|_{1,2}|\*{1,2}|\.{1,3}/);
  if (!match) return null;

  const typed = match.text;

  // 直前が英字やバックスラッシュなら無視（\beta などの途中を誤爆させない）
  const prevChar = match.from === 0
    ? ''
    : context.state.sliceDoc(match.from - 1, match.from);
  if (/[a-zA-Z\\]/.test(prevChar)) return null;

  const options = Object.entries(WORD_SNIPPETS)
    .filter(([key]) => key.startsWith(typed))
    .map(([key, value]) => _makeOption(key, value, typed));

  if (options.length === 0) return null;
  return { from: match.from, options, filter: false };
}
