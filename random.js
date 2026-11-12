/* Logic có thể kiểm thử riêng bằng Node. Không ghi dữ liệu lên server. */
(function (root, factory) {
  'use strict';
  const moduleValue = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = moduleValue;
  root.TH2_RANDOM = moduleValue;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const GROUPS = Object.freeze(['G1', 'G2', 'G3', 'G4']);
  const ENTRY_RE = /^entry\.\d+$/;
  const SOURCE_RE = /^[a-zA-Z0-9_-]{1,32}$/;

  function drawGroup(cryptoAPI) {
    if (!cryptoAPI || typeof cryptoAPI.getRandomValues !== 'function') {
      throw new Error('Trình duyệt không hỗ trợ sinh số ngẫu nhiên an toàn.');
    }
    const a = new Uint32Array(1);
    cryptoAPI.getRandomValues(a);
    return GROUPS[a[0] & 3]; // 4 chia hết cho 2^32: không có sai lệch modulo.
  }

  function safeSource(input) {
    const s = String(input || '').trim();
    return SOURCE_RE.test(s) ? s : 'khong_ro';
  }

  function validateConfig(config) {
    if (!config || !/^[A-Za-z0-9_-]{4,64}$/.test(config.studyKey || '')) {
      throw new Error('studyKey không hợp lệ.');
    }
    if (config.mode !== 'PILOT' && config.mode !== 'PRODUCTION') {
      throw new Error('mode phải là PILOT hoặc PRODUCTION.');
    }
    const uniqueUrls = new Set();
    for (const g of GROUPS) {
      const item = config.forms && config.forms[g];
      if (!item || !item.url) throw new Error('Chưa điền link Form cho ' + g + '.');
      let url;
      try { url = new URL(item.url); } catch (e) { throw new Error('Link Form của ' + g + ' không hợp lệ.'); }
      if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || !/^\/forms\/d\/(?:e\/)?[^/]+\/viewform\/?$/.test(url.pathname)) {
        throw new Error('Form ' + g + ' cần URL đầy đủ dạng https://docs.google.com/forms/d/e/.../viewform.');
      }
      const canonical = url.origin + url.pathname;
      if (uniqueUrls.has(canonical)) throw new Error('Hai nhóm đang dùng cùng một Form: ' + g + '.');
      uniqueUrls.add(canonical);
      const fields = item.fields || {};
      if (!['participantId','source','startedAt'].every(k => ENTRY_RE.test(fields[k] || ''))) throw new Error('Cần đủ ba entry ID kỹ thuật của ' + g + '.');
      const nonEmpty = Object.values(fields).filter(Boolean);
      if (nonEmpty.some(x => !ENTRY_RE.test(x))) {
        throw new Error('Mã prefill Google Forms phải có dạng entry.123456.');
      }
      if (new Set(nonEmpty).size !== nonEmpty.length) {
        throw new Error('Các trường prefill của ' + g + ' bị trùng entry ID.');
      }
    }
    return true;
  }

  function makeFormUrl(config, assignment) {
    validateConfig(config);
    if (!GROUPS.includes(assignment.group)) throw new Error('Nhóm không hợp lệ.');
    const item = config.forms[assignment.group];
    const u = new URL(item.url);
    const fields = item.fields || {};
    const values = {
      participantId: assignment.participantId,
      source: assignment.source,
      startedAt: assignment.assignedAt
    };
    for (const [key, value] of Object.entries(values)) {
      if (fields[key]) u.searchParams.set(fields[key], value);
    }
    return u.href;
  }

  return { GROUPS, drawGroup, safeSource, validateConfig, makeFormUrl };
});
