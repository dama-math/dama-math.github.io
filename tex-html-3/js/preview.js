/**
 * preview.js — KaTeX を使ったリアルタイムプレビュー
 *
 * LaTeX テキストを HTML に変換し、KaTeX でレンダリングする。
 * エラーは throwOnError: false で赤い span として inline 表示。
 */

/**
 * 波括弧のネストを考慮して、LaTeX コマンド（\section{...}, \textbf{...} 等）を安全に置換する。
 *
 * @param {string} text - 入力テキスト
 * @param {string} cmd - コマンド名（例: 'section'）
 * @param {string|((inner: string) => string)} template - 囲むタグ名（例: 'h2'）またはコールバック関数
 * @returns {string}
 */
function replaceBracedCommand(text, cmd, template) {
  const prefixRegex = new RegExp(`\\\\${cmd}\\*?\\s*\\{`, 'g');
  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = prefixRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const argStart = matchStart + match[0].length;
    let depth = 1;
    let i = argStart;
    const len = text.length;

    while (i < len && depth > 0) {
      const char = text[i];
      if (char === '\\') {
        // エスケープ文字（\{ や \} など）をスキップ
        i += 2;
        continue;
      }
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
      }
      i++;
    }

    if (depth === 0) {
      const argContent = text.slice(argStart, i - 1);
      result += text.slice(lastIndex, matchStart);
      if (typeof template === 'function') {
        result += template(argContent);
      } else {
        result += `<${template}>${argContent}</${template}>`;
      }
      lastIndex = i;
      prefixRegex.lastIndex = i;
    } else {
      result += text.slice(lastIndex, argStart);
      lastIndex = argStart;
      prefixRegex.lastIndex = argStart;
    }
  }

  result += text.slice(lastIndex);
  return result;
}

/**
 * LaTeX テキストをプレビュー領域に描画する
 * @param {string} text - エディターの現在の内容
 * @returns {string[]} - KaTeX エラーメッセージのリスト
 */
export function renderPreview(text) {
  const preview = document.getElementById('preview');
  if (!preview) return [];

  let html = text;

  // Fix #5: & を先に変換してから < > を変換する（逆順だと &lt; が二重エスケープされる）
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ─── LaTeX 環境 → HTML 変換 ────────────────────────────────
  html = html
    .replace(/\\begin\{quote\}/g,     '<blockquote>')
    .replace(/\\end\{quote\}/g,       '</blockquote>')
    .replace(/\\begin\{itemize\}/g,   '<ul>')
    .replace(/\\end\{itemize\}/g,     '</ul>')
    .replace(/\\begin\{enumerate\}/g, '<ol>')
    .replace(/\\end\{enumerate\}/g,   '</ol>')
    .replace(/\\item(?:\s*)/g,        '<li>');

  // 波括弧のネストを考慮したコマンド変換（\section{$a^{bc}$} などに対応）
  html = replaceBracedCommand(html, 'section', 'h2');
  html = replaceBracedCommand(html, 'subsection', 'h3');
  html = replaceBracedCommand(html, 'subsubsection', 'h4');
  html = replaceBracedCommand(html, 'textbf', 'strong');
  html = replaceBracedCommand(html, 'textit', 'em');

  // ─── 数式環境の変換 ─────────────────────────────────────────
  html = html
    .replace(/\\begin\{align\*?\}/g,    '\\[\\begin{aligned}')
    .replace(/\\end\{align\*?\}/g,      '\\end{aligned}\\]')
    .replace(/\\begin\{gather\*?\}/g,   '\\[\\begin{gathered}')
    .replace(/\\end\{gather\*?\}/g,     '\\end{gathered}\\]')
    .replace(/\\begin\{equation\*?\}/g, '\\[')
    .replace(/\\end\{equation\*?\}/g,   '\\]');

  // 数式ブロックをプレースホルダーに退避
  const mathBlocks = [];
  html = html.replace(
    /(\$\$.*?\$\$|\\\[.*?\\\]|\$.*?\$|\\\(.*?\\\))/gs,
    m => {
      mathBlocks.push(m);
      return `__MATH_BLOCK_${mathBlocks.length - 1}__`;
    }
  );

  // ─── 改行 → <br> ────────────────────────────────────────────
  html = html
    .replace(/\n/g, '<br>')
    .replace(/(<\/h[2-6]>)(<br>)+/g, '$1')
    .replace(/<(ul|ol)><br>/g,        '<$1>')
    .replace(/<br><\/(ul|ol)>/g,      '</$1>');

  // 数式ブロックを復元
  html = html.replace(
    /__MATH_BLOCK_(\d+)__/g,
    (_, i) => mathBlocks[i]
  );

  // ディスプレイ数式直後の無駄な改行を除去
  html = html
    .replace(/\\\]<br>/g, '\\]')
    .replace(/\$\$<br>/g, '$$$$');

  preview.innerHTML = html;

  // ─── KaTeX レンダリング ──────────────────────────────────────
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(preview, {
      delimiters: [
        { left: '$$',  right: '$$',  display: true  },
        { left: '$',   right: '$',   display: false },
        { left: '\\[', right: '\\]', display: true  },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,   // エラーも表示を継続
      errorColor:   '#f85149', // エラーを赤で表示
      strict:       false,
      output:       'html',
    });
  }

  // エラー要素を収集して返す
  return Array.from(preview.querySelectorAll('.katex-error'))
    .map(el => el.title || el.textContent);
}
