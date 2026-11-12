(function(){
  'use strict';
  const cfg = window.TH2_CONFIG;
  const rand = window.TH2_RANDOM;
  const form = document.getElementById('entryForm');
  const button = document.getElementById('startButton');
  const message = document.getElementById('message');
  const result = document.getElementById('result');
  const surveyLink = document.getElementById('surveyLink');
  const key = 'th2-assignment-' + (cfg && cfg.studyKey || 'invalid');
  let configOkay = false;
  let simulateStorageFailure = false;

  function show(text){ message.textContent = text; }
  function getStored() {
    try {
      if (simulateStorageFailure) return null;
      const obj = JSON.parse(localStorage.getItem(key) || 'null');
      return obj && rand.GROUPS.includes(obj.group) && /^TEST-P-[a-f0-9-]{32,36}$/i.test(obj.participantId || '') && Number.isFinite(Date.parse(obj.assignedAt)) && rand.safeSource(obj.source) === obj.source ? obj : null;
    } catch(e){ return null; }
  }
  function store(assignment){
    try {
      if (simulateStorageFailure) return false;
      const serialized = JSON.stringify(assignment);
      localStorage.setItem(key, serialized);
      return localStorage.getItem(key) === serialized;
    } catch(e){ return false; }
  }
  // v0.2 (Claude): trình duyệt cũ (iOS < 15.4, WebView Android cũ trong Zalo/Facebook) không có randomUUID
  // → tạo mã 128 bit bằng crypto.getRandomValues thay vì chặn người tham gia.
  function makeId(prefix){
    let hex;
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      hex = crypto.randomUUID();
    } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const b = new Uint8Array(16); crypto.getRandomValues(b);
      hex = Array.from(b, function(x){ return x.toString(16).padStart(2,'0'); }).join('');
    } else {
      throw new Error('Trình duyệt không hỗ trợ sinh số ngẫu nhiên an toàn.');
    }
    return prefix + hex;
  }
  function openAssigned(assignment) {
    const url = rand.makeFormUrl(cfg, assignment);
    surveyLink.href = url;
    result.hidden = false;
    const lost = assignment.participantId.startsWith('TEST-N-');
    show(lost ? 'Không lưu được nhóm trên trình duyệt này. Lượt TEST được đánh dấu TEST-N-; mở lại có thể nhận mã và nhóm khác.' : 'Lượt TEST đã được ghi nhớ trên trình duyệt này. Không dùng để thu mẫu chính thức.');
    button.disabled = true;
    if (cfg.autoRedirect === true) {
      window.location.assign(url);
    }
  }

  try {
    if (cfg && cfg.launchEnabled === true && cfg.mode === 'PILOT' && cfg.dataMode === 'TEST') {
      rand.validateConfig(cfg);
      configOkay = true;
      button.disabled = false;
      document.getElementById('testTools').hidden = false;
      document.getElementById('studyNotice').querySelector('strong').textContent = cfg.mode === 'PRODUCTION' ? 'Thông tin trước khi tham gia' : 'Chỉ chạy thử nghiệm kỹ thuật — không phải nghiên cứu chính thức.';
    } else {
      show('Chưa cấu hình đủ bốn Google Forms hoặc chưa bật thử nghiệm. Không thể tiếp tục.');
    }
  } catch(err){ show('Cấu hình lỗi: ' + err.message); }

  document.getElementById('newTest').addEventListener('click', function(){
    if (!configOkay) return;
    try { localStorage.removeItem(key); } catch(e) {}
    simulateStorageFailure = document.getElementById('simulateStorageFailure').checked;
    result.hidden = true; surveyLink.href = '#'; button.disabled = false;
    show(simulateStorageFailure ? 'TEST: đang mô phỏng bộ nhớ bị từ chối. Chưa tạo lượt mới.' : 'Đã xóa riêng mã phân nhóm TEST trên trình duyệt này. Chưa tạo lượt mới.');
  });

  form.addEventListener('submit', function(event){
    event.preventDefault();
    if (!configOkay) return;
    const age = form.elements.age.value;
    const reviews = form.elements.reviews.value;
    if (age !== 'yes' || reviews !== 'yes') {
      show(age === 'no' || reviews === 'no' ? 'Cảm ơn bạn. Bạn chưa đáp ứng điều kiện tham gia nghiên cứu này.' : 'Vui lòng trả lời hai câu điều kiện.');
      return;
    }
    if (!document.getElementById('consent').checked) {
      show('Chỉ tiếp tục khi bạn tự nguyện đồng ý.');
      return;
    }
    try {
      const prior = getStored();
      if (prior) { openAssigned(prior); return; }
      const assignment = {
        group: rand.drawGroup(typeof crypto === 'undefined' ? null : crypto),
        participantId: makeId('TEST-P-'),
        assignedAt: new Date().toISOString(),
        source: rand.safeSource(new URLSearchParams(location.search).get('src'))
      };
      // v0.2 (Claude): nếu trình duyệt chặn bộ nhớ, vẫn cho làm tiếp nhưng đổi tiền tố mã thành N-
      // (= nhóm KHÔNG được ghi nhớ; có thể bị chia lại nếu mở link lần nữa). Quy tắc xử lý khi phân tích: xem README.
      if (!store(assignment)) assignment.participantId = 'TEST-N-' + assignment.participantId.slice(7);
      openAssigned(assignment);
    } catch(err){ show('Không thể chuẩn bị bảng hỏi: ' + err.message); }
  });
})();
