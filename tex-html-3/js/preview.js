/**
 * preview.js — KaTeX を使ったリアルタイムプレビュー
 *
 * LaTeX テキストを HTML に変換し、KaTeX でレンダリングする。
 * エラーは throwOnError: false で赤い span として inline 表示。
 */

/**
 * LaTeX テキストをプレビュー領域に描画する
 * @param {string} text - エディターの現在の内容
 * @returns {string[]} - KaTeX エラーメッセージのリスト
 */
export function renderPreview(text) {
  const preview = document.getElementById('preview');
  if (!preview) return [];

  let html = text;

  // < > をエンティティに変換（XSS対策 & HTML衝突防止）
  html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ─── LaTeX 環境 → HTML 変換 ────────────────────────────────
  html = html
    .replace(/\\begin\{quote\}/g,     '<blockquote>')
    .replace(/\\end\{quote\}/g,       '</blockquote>')
    .replace(/\\begin\{itemize\}/g,   '<ul>')
    .replace(/\\end\{itemize\}/g,     '</ul>')
    .replace(/\\begin\{enumerate\}/g, '<ol>')
    .replace(/\\end\{enumerate\}/g,   '</ol>')
    .replace(/\\item(?:\s*)/g,        '<li>')
    .replace(/\\textbf\{([^}]+)\}/g,  '<strong>$1</strong>')
    .replace(/\\textit\{([^}]+)\}/g,  '<em>$1</em>')
    .replace(/\\section\*?\{([^}]+)\}/g,       '<h2>$1</h2>')
    .replace(/\\subsection\*?\{([^}]+)\}/g,    '<h3>$1</h3>')
    .replace(/\\subsubsection\*?\{([^}]+)\}/g, '<h4>$1</h4>');

  // ─── 数式環境の変換 ─────────────────────────────────────────
  html = html
    .replace(/\\begin\{align\*?\}/g,    '\\[\\begin{aligned}')
    .replace(/\\end\{align\*?\}/g,      '\\end{aligned}\\]')
    .replace(/\\begin\{gather\*?\}/g,   '\\[\\begin{gathered}')
    .replace(/\\end\{gather\*?\}/g,     '\\end{gathered}\\]')
    .replace(/\\begin\{equation\*?\}/g, '\\[')
    .replace(/\\end\{equation\*?\}/g,   '\\]');

  // 数式ブロック内の改行を除去
  html = html.replace(
    /(\$\$.*?\$\$|\\\[.*?\\\]|\$.*?\$|\\\(.*?\\\))/gs,
    m => m.replace(/\n/g, '')
  );

  // ─── 改行 → <br> ────────────────────────────────────────────
  html = html
    .replace(/\n/g, '<br>')
    .replace(/(<\/h[2-6]>)(<br>)+/g, '$1')
    .replace(/<(ul|ol)><br>/g,        '<$1>')
    .replace(/<\/(ul|ol)><br>/g,      '</$1>')
    .replace(/\\\]<br>/g,             '\\]');

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
