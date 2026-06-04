/**
 * snippets.js — LaTeX スニペット定義とオートコンプリートソース
 *
 * "@" を入力するとアシストメニューが表示され、
 * Tab キーで確定できる。
 */

import { EditorSelection } from '@codemirror/state';

/* ================================================================
   スニペット定義
   key:   トリガー文字列（@ 始まり、または英大文字など）
   value: 展開後テキスト
   ================================================================ */
export const LATEX_SNIPPETS = {
  // ─── ギリシャ文字（小文字）────────────────────────────────
  '@a': '\\alpha',
  '@b': '\\beta',
  '@c': '\\chi',
  '@d': '\\delta',
  '@e': '\\epsilon',
  '@ve': '\\varepsilon',
  '@f': '\\phi',
  '@vf': '\\varphi',
  '@g': '\\gamma',
  '@h': '\\eta',
  '@i': '\\iota',
  '@k': '\\kappa',
  '@l': '\\lambda',
  '@m': '\\mu',
  '@n': '\\nu',
  '@p': '\\pi',
  '@vp': '\\varpi',
  '@q': '\\theta',
  '@vq': '\\vartheta',
  '@r': '\\rho',
  '@vr': '\\varrho',
  '@s': '\\sigma',
  '@vs': '\\varsigma',
  '@t': '\\tau',
  '@u': '\\upsilon',
  '@o': '\\omega',
  '@x': '\\xi',
  '@y': '\\psi',
  '@z': '\\zeta',
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
  '@%': '\\frac{}{}',
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

  // ─── LaTeX Workshop Snippets (環境・フォント) ──────────────
  // Environments
  'beq': '\\begin{equation}\n  \n\\end{equation}',
  'bseq': '\\begin{equation*}\n  \n\\end{equation*}',
  'bal': '\\begin{align}\n  \n\\end{align}',
  'bsal': '\\begin{align*}\n  \n\\end{align*}',
  'bga': '\\begin{gather}\n  \n\\end{gather}',
  'bsga': '\\begin{gather*}\n  \n\\end{gather*}',
  'bmu': '\\begin{multline}\n  \n\\end{multline}',
  'bsmu': '\\begin{multline*}\n  \n\\end{multline*}',
  'bit': '\\begin{itemize}\n  \\item \n\\end{itemize}',
  'ben': '\\begin{enumerate}\n  \\item \n\\end{enumerate}',
  'bspl': '\\begin{split}\n  \n\\end{split}',
  'bcas': '\\begin{cases}\n  \n\\end{cases}',
  'bfr': '\\begin{frame}\n  \n\\end{frame}',
  'bfi': '\\begin{figure}\n  \n\\end{figure}',
  'bta': '\\begin{table}\n  \n\\end{table}',
  // Sectioning
  'spa': '\\part{}',
  'sch': '\\chapter{}',
  'sse': '\\section{}',
  'sss': '\\subsection{}',
  'ss2': '\\subsubsection{}',
  'spg': '\\paragraph{}',
  'ssp': '\\subparagraph{}',
  // Handy
  '__': '_{}',
  '**': '^{}',
  '...': '\\dots',
  // Fonts
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
  // Math Fonts
  'mrm': '\\mathrm{}',
  'msf': '\\mathsf{}',
  'mbf': '\\mathbf{}',
  'mbb': '\\mathbb{}',
  'mca': '\\mathcal{}',
  'mit': '\\mathit{}',
  'mtt': '\\mathtt{}',
};

// ─── オートコンプリートソース ─────────────────────────────────────

/**
 * CodeMirror 補完ソース。
 * @param {import('@codemirror/autocomplete').CompletionContext} context
 */
export function latexCompletionSource(context) {
  // @始まり、または小文字英字、_、*、. にマッチ
  const match = context.matchBefore(/@[^\s]*|[a-z]{1,4}|_{1,2}|\*{1,2}|\.{1,3}/);
  if (!match) return null;

  const typed = match.text;

  // 英字のみのトリガーの場合、直前が英字やバックスラッシュなら無視（\b などを誤爆させない）
  if (/^[a-z]{1,4}$/.test(typed)) {
    const prevChar = match.from === 0 ? '' : context.state.sliceDoc(match.from - 1, match.from);
    if (/[a-zA-Z\\]/.test(prevChar)) return null;
  }

  const options = Object.entries(LATEX_SNIPPETS)
    .filter(([key]) => key.startsWith(typed))
    .map(([key, value]) => {
      // 最初の {} の内側、または行列等の環境の中央にカーソルを置く
      const braceIdx = value.indexOf('{}');
      const envIdx = value.indexOf('\n  \n');
      const itemIdx = value.indexOf('\\item \n');
      const rightIdx = value.indexOf(' \\right');

      let cursorOffset = value.length;
      if (braceIdx !== -1) {
        cursorOffset = braceIdx + 1;
      } else if (envIdx !== -1) {
        cursorOffset = envIdx + 3;
      } else if (itemIdx !== -1) {
        cursorOffset = itemIdx + 6; // \item の後
      } else if (rightIdx !== -1) {
        cursorOffset = rightIdx; // ' \right' の手前
      }

      return {
        label: key,
        detail: value,
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
