// App 版本號只在 sw.js 的 VERSION 定義一次（審核 B9）；設定頁顯示時從 sw.js 的文字裡讀出來。
export function parseSwVersion(text) {
  return /const VERSION = "([^"]+)"/.exec(text)?.[1] ?? null;
}

// 離線時也讀得到：正在跑的版本＝快取名稱 spanish-tutor-vN 的 N（sw.js 自己不在快取清單裡，離線抓不到，審核 B6）。
// 有多個（新舊版交接中）就取最大的。
export function versionFromCacheNames(names) {
  const nums = (names ?? []).map((n) => /^spanish-tutor-v(\d+)$/.exec(n)?.[1]).filter(Boolean).map(Number);
  return nums.length ? `v${Math.max(...nums)}` : null;
}

export async function loadAppVersion(fetchFn = globalThis.fetch, cacheStorage = globalThis.caches) {
  try {
    const v = versionFromCacheNames(await cacheStorage?.keys?.());
    if (v) return v;
  } catch { /* 沒有 Cache API：改抓 sw.js */ }
  try {
    const res = await fetchFn("sw.js");
    if (!res.ok) return null;
    return parseSwVersion(await res.text());
  } catch {
    return null;
  }
}
