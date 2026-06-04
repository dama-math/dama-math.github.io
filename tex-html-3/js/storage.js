/**
 * storage.js — LocalStorage 読み書きユーティリティ
 */

const STORAGE_KEY = 'tex-editor-v3-tabs';

/**
 * タブデータを LocalStorage に保存する
 * @param {Array<{id:string, name:string, content:string}>} tabs
 */
export function saveTabs(tabs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch (err) {
    console.warn('[storage] 保存失敗:', err);
  }
}

/**
 * LocalStorage からタブデータを読み込む
 * @returns {Array<{id:string, name:string, content:string}> | null}
 */
export function loadTabs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch (err) {
    console.warn('[storage] 読み込み失敗:', err);
    return null;
  }
}
