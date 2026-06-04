/**
 * export.js — テキストファイルへのエクスポート機能
 */

/**
 * テキスト内容を .txt ファイルとしてダウンロードする
 * @param {string} content  エクスポートするテキスト
 * @param {string} filename ファイル名（拡張子含む）
 */
export function exportAsTxt(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
