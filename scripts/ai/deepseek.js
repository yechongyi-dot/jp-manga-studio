'use strict';
// AI 管线独立 DeepSeek 客户端（不 import 手动的 jp-parser，避免与旧/手动代码耦合打架）。
// 支持 JSON 模式(response_format)。瞬时错误退避重试，鍵错误即失败。
const https = require('https');

function chatOnce(apiKey, messages, { temperature = 0.7, maxTokens = 3000, json = false } = {}) {
  return new Promise((resolve, reject) => {
    const payload = { model: 'deepseek-chat', messages, temperature, max_tokens: maxTokens };
    if (json) payload.response_format = { type: 'json_object' };
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, timeout: 90000,
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (res.statusCode !== 200) return reject(new Error(`DeepSeek HTTP ${res.statusCode}: ${p.error?.message || data.slice(0, 200)}`));
          const c = p.choices?.[0]?.message?.content;
          if (!c) return reject(new Error('DeepSeek 返回内容为空'));
          resolve(c);
        } catch (e) { reject(new Error('DeepSeek 响应解析失败: ' + data.slice(0, 200))); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('DeepSeek 请求超时(90s)')));
    req.on('error', reject);
    req.end(body);
  });
}

async function chat(apiKey, messages, opts = {}) {
  let lastErr;
  for (let a = 1; a <= 3; a++) {
    try { return await chatOnce(apiKey, messages, opts); }
    catch (e) {
      lastErr = e;
      const retryable = /HTTP (429|5\d\d)|超时|timeout|ECONNRESET|ETIMEDOUT|socket hang up|EAI_AGAIN|ENOTFOUND/i.test(e.message || '');
      if (!retryable || a === 3) break;
      await new Promise(r => setTimeout(r, a * 1500));
    }
  }
  throw lastErr;
}

function getKey() { return (process.env.DEEPSEEK_KEY || process.env.DEEPSEEK_API_KEY || '').trim(); }

module.exports = { chat, getKey };
