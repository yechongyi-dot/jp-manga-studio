'use strict';
// AI 管线公用小工具。

// 并发受限 map：保持输入顺序返回结果。fn 抛错则该项结果为 onError(默认 null)，不中断整体。
async function mapConc(items, limit, fn, onError = () => null) {
  const results = new Array(items.length);
  let idx = 0;
  const lim = Math.max(1, limit | 0);
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try { results[i] = await fn(items[i], i); }
      catch (e) { results[i] = onError(e, items[i], i); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(lim, items.length || 1) }, worker));
  return results;
}

module.exports = { mapConc };
