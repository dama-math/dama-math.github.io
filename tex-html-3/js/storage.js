/**
 * storage.js — LocalStorage 読み書きユーティリティ
 */

const STORAGE_KEY = 'tex-editor-v3-tabs';
const ACTIVE_TAB_KEY = 'tex-editor-v3-active-tab';
const CLOSED_TABS_KEY = 'tex-editor-v3-closed-tabs';

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

export function saveActiveTabId(id) {
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, id);
  } catch (err) {
    console.warn('[storage] アクティブタブID保存失敗:', err);
  }
}

export function loadActiveTabId() {
  try {
    return localStorage.getItem(ACTIVE_TAB_KEY);
  } catch (err) {
    return null;
  }
}

/**
 * 閉じたタブの履歴を LocalStorage に保存する
 * @param {Array<{tab:{id:string, name:string, content:string}, index:number, closedAt:number}>} closedTabs
 */
export function saveClosedTabs(closedTabs) {
  try {
    localStorage.setItem(CLOSED_TABS_KEY, JSON.stringify(closedTabs));
  } catch (err) {
    console.warn('[storage] 閉じたタブの保存失敗:', err);
  }
}

/**
 * LocalStorage から閉じたタブの履歴を読み込む
 * @returns {Array<{tab:{id:string, name:string, content:string}, index:number, closedAt:number}>}
 */
export function loadClosedTabs() {
  try {
    const raw = localStorage.getItem(CLOSED_TABS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[storage] 閉じたタブの読み込み失敗:', err);
    return [];
  }
}

