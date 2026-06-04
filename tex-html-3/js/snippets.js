/**
 * snippets.js — LaTeX スニペット定義とオートコンプリートソース
 *
 * "@" を入力するとアシストメニューが表示され、
 * Tab キーで確定できる。
 */

import { EditorSelection } from '@codemirror/state';

/* ================================================================
   スニペット定義
   key:   トリガー文字列（@ 始まり）
   value: 展開後テキスト
          {} を含む場合はカーソルを最初の { } 内側に置く
   ================================================================ */
export const LATEX_SNIPPETS = {
  // ─── ギリシャ文字（小文字）────────────────────────────────
  '@a': '\\alpha',
  '@b': '\\beta',
  '@g': '\\gamma',
  '@d': '\\delta',
  '@e': '\\epsilon',
  '@ve': '\\varepsilon',
  '@z': '\\zeta',
  '@h': '\\eta',
  '@q': '\\theta',
  '@vq': '\\vartheta',
  '@i': '\\iota',
  '@k': '\\kappa',
  '@l': '\\lambda',
  '@m': '\\mu',
  '@n': '\\nu',
  '@x': '\\xi',
  '@p': '\\pi',
  '@vp': '\\varpi',
  '@r': '\\rho',
  '@vr': '\\varrho',
  '@s': '\\sigma',
  '@vs': '\\varsigma',
  '@t': '\\tau',
  '@u': '\\upsilon',
  '@f': '\\phi',
  '@vf': '\\varphi',
  '@c': '\\chi',
  '@y': '\\psi',
  '@w': '\\omega',
  // ─── ギリシャ文字（大文字）────────────────────────────────
  '@G': '\\Gamma',
  '@D': '\\Delta',
  '@Q': '\\Theta',
  '@L': '\\Lambda',
  '@X': '\\Xi',
  '@P': '\\Pi',
  '@S': '\\Sigma',
  '@U': '\\Upsilon',
  '@F': '\\Phi',
  '@Y': '\\Psi',
  '@W': '\\Omega',
  // ─── 数学記号 ────────────────────────────────────────────
  '@8': '\\infty',
  '@6': '\\partial',
  '@0': '\\emptyset',
  '@.': '\\cdot',
  '@*': '\\times',
  '@o': '\\circ',
  '@pm': '\\pm',
  '@mp': '\\mp',
  '@...': '\\cdots',
  '@..': '\\ldots',
  '@!!': '\\quad',
  '@!': '\\,',
  // ─── 集合・論理 ──────────────────────────────────────────
  '@in': '\\in',
  '@ni': '\\ni',
  '@nn': '\\notin',
  '@su': '\\subset',
  '@sU': '\\supset',
  '@se': '\\subseteq',
  '@sE': '\\supseteq',
  '@for': '\\forall',
  '@ex': '\\exists',
  '@neg': '\\neg',
  '@and': '\\land',
  '@or': '\\lor',
  // ─── 大小比較 ────────────────────────────────────────────
  '@le': '\\leq',
  '@ge': '\\geq',
  '@ne': '\\neq',
  '@ll': '\\ll',
  '@gg': '\\gg',
  '@~': '\\sim',
  '@~~': '\\approx',
  '@==': '\\equiv',
  '@~=': '\\cong',
  // ─── 矢印 ────────────────────────────────────────────────
  '@->': '\\to',
  '@ri': '\\rightarrow',
  '@Ri': '\\Rightarrow',
  '@li': '\\leftarrow',
  '@Li': '\\Leftarrow',
  '@lr': '\\leftrightarrow',
  '@Lr': '\\Leftrightarrow',
  '@up': '\\uparrow',
  '@dn': '\\downarrow',
  // ─── 演算子・関数 ────────────────────────────────────────
  '@2': '\\sqrt{}',
  '@int': '\\int',
  '@iint': '\\iint',
  '@oint': '\\oint',
  '@sum': '\\sum',
  '@prod': '\\prod',
  // ─── 分数 ────────────────────────────────────────────────
  '@/': '\\frac{}{}',
  // ─── フォント ────────────────────────────────────────────
  '@mb': '\\mathbb{}',
  '@mc': '\\mathcal{}',
  '@mr': '\\mathrm{}',
  '@mf': '\\mathfrak{}',
  '@ms': '\\mathsf{}',
  '@mt': '\\mathtt{}',
  '@tx': '\\text{}',
  // ─── 修飾 ────────────────────────────────────────────────
  '@v': '\\vec{}',
  '@hat': '\\hat{}',
  '@bar': '\\bar{}',
  '@til': '\\tilde{}',
  '@dot': '\\dot{}',
  '@ddt': '\\ddot{}',
  '@ov': '\\overline{}',
  '@und': '\\underline{}',
  '@wht': '\\widehat{}',
  '@wtl': '\\widetilde{}',
  // ─── ブラケット ──────────────────────────────────────────
  '@(': '\\left( \\right)',
  '@[': '\\left[ \\right]',
  '@{': '\\left\\{ \\right\\}',
  '@|': '\\left| \\right|',
  // ─── 行列 ────────────────────────────────────────────────
  '@mat': '\\begin{pmatrix}\n  \n\\end{pmatrix}',
  '@bmt': '\\begin{bmatrix}\n  \n\\end{bmatrix}',
  '@vmt': '\\begin{vmatrix}\n  \n\\end{vmatrix}',
};

// ─── オートコンプリートソース ─────────────────────────────────────

/**
 * CodeMirror 補完ソース。
 * "@" を入力するとマッチするスニペット候補のリストを返す。
 * Tab キーで補完を確定できる（main.js の Tab ハンドラーで acceptCompletion を呼ぶ）。
 * @param {import('@codemirror/autocomplete').CompletionContext} context
 */
export function latexCompletionSource(context) {
  // "@" + 非空白にマッチ（"@" 単体もマッチ）
  const match = context.matchBefore(/@[^\s]*/);
  if (!match) return null;

  const typed = match.text; // 例: "@", "@a", "@ve"

  const options = Object.entries(LATEX_SNIPPETS)
    .filter(([key]) => key.startsWith(typed))
    .map(([key, value]) => {
      // 最初の {} の内側にカーソルを置く
      const braceIdx = value.indexOf('{}');
      const cursorOffset = braceIdx !== -1 ? braceIdx + 1 : value.length;

      return {
        label: key,
        detail: value,
        // キーが短いほど上に表示（完全一致を最上位に）
        boost: -(key.length - typed.length),
        apply(view, _completion, from, to) {
          view.dispatch({
            changes: { from, to, insert: value },
            selection: EditorSelection.cursor(from + cursorOffset),
            userEvent: 'input.complete',
          });
        },
      };
    });

  if (options.length === 0) return null;

  return {
    from: match.from,
    options,
    filter: false, // 自前でプレフィックスフィルタ済み
  };
}
