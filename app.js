/* 105 AI 윤리 30차시 엔진 — 교사 칠판(board) · 학생 폰(phone) · 혼자 보기(preview)
   차시 JSON 한 장(lessons/<id>.json)을 위젯으로 그린다. 형식은 LESSON_SCHEMA.md.
   원칙(교사 의도): 정답 먼저 공개 X, 점수·등급 X, 칠판은 익명, 다음 단계는 교사가 연다. */
'use strict';
const P = location.pathname.slice(0);
const MODE = window.ETH_V2 || (P.startsWith('/t/') ? 'board' : P.startsWith('/preview/') ? 'preview' : 'phone');  // v2 화면은 ETH_V2 로 모드를 정하고 위젯만 빌려 쓴다
const CODE = (P.match(/\/(?:t|s)\/(\d{4})/) || [])[1];
const PREVIEW_ID = (P.match(/\/preview\/([a-z]+-\d+)/) || [])[1];
const POLL = Math.max(200, +new URLSearchParams(location.search).get('poll') || +(() => { try { return localStorage.getItem('eth_poll'); } catch (e) { return 0; } })() || 1500);  // ?poll=·eth_poll 은 자동 검수용
// 실제 개인정보 차단(교사 의도: 가상 정보만) — 휴대폰·일반전화·이메일·주민번호 꼴. ponytail: 주소·실명은 꼴이 없어 못 잡는다
const PII = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|0\d{1,2}-\d{3,4}-\d{4}|[\w.+-]+@[\w-]+\.[\w.]+|\d{6}-?[1-4]\d{6}/;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
             set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v; else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};

const SUBMIT = window.ETH_V2 ? '의견 담기' : '제출하기';  // v2 는 교사가 칠판에서 반 의견을 담는다
let L = null, FILES = new Set(), MEDIA = {}, ST = null, CUR = null, TKEY = null, TOKEN = null;
const LOCAL = {};          // preview 모드 답 저장
const DRAFT = {};          // 단계별 작성 중 값(폴링으로 다시 그려도 안 날아가게)

/* ---------------- 소리: 효과음은 WebAudio로 합성(파일 없음), 칠판에서만 기본 ---------------- */
const SFX = (() => {
  // 효과음은 WebAudio 로 합성(파일 없음). 칠판·v2 수업에서만. 학교급마다 음색이 다르다(초 통통·중 팝·고 절제)
  let ctx = null;
  const on = () => MODE === 'board' && ls.get('eth_sfx') !== '0';
  const tone = (f, t0, d, type = 'sine', g = 0.08, f2) => {
    const o = ctx.createOscillator(), v = ctx.createGain(), t = ctx.currentTime + t0;
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + 0.012); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(v).connect(ctx.destination); o.start(t); o.stop(t + d + 0.03);
  };
  const noise = (t0, d, g = 0.05, from = 800, to = 3200) => {  // 휙 — 필터 걸린 잡음
    const n = ctx.createBufferSource(), buf = ctx.createBuffer(1, ctx.sampleRate * d, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const f = ctx.createBiquadFilter(), v = ctx.createGain(), t = ctx.currentTime + t0;
    f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + d);
    v.gain.setValueAtTime(0.0001, t); v.gain.exponentialRampToValueAtTime(g, t + d * .35); v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    n.buffer = buf; n.connect(f).connect(v).connect(ctx.destination); n.start(t); n.stop(t + d);
  };
  const tone_ = () => document.body.dataset.tone || 'elem';
  const play = seq => { if (!on()) return; try { ctx = ctx || new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); seq(tone_()); } catch (e) {} };
  return {
    pop: () => play(t => tone(t === 'high' ? 660 : 880, 0, 0.12, 'triangle', t === 'high' ? 0.03 : 0.05)),
    next: () => play(t => { noise(0, 0.32, t === 'high' ? 0.025 : 0.04); if (t !== 'high') { tone(523, 0.05, 0.18); tone(784, 0.13, 0.22); } }),
    reveal: () => play(t => { (t === 'high' ? [392, 494, 587] : [523, 659, 784, 1047]).forEach((f, i) => tone(f, i * 0.08, 0.45, 'triangle', t === 'high' ? 0.04 : 0.06)); }),
    flip: () => play(() => { noise(0, 0.14, 0.05, 2000, 6000); tone(1200, 0.05, 0.08, 'sine', 0.03); }),
    stamp: () => play(() => { tone(140, 0, 0.25, 'sine', 0.22, 60); noise(0, 0.08, 0.08, 300, 900); }),
    sparkle: () => play(() => { [1319, 1568, 1976, 2637].forEach((f, i) => tone(f, i * 0.05, 0.3, 'sine', 0.03)); }),
    start: () => play(t => { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.3, t === 'mid' ? 'square' : 'triangle', 0.035)); }),
  };
})();

/* ---------------- 미디어: 파일이 있으면 쓰고, 없으면 설명이 보이는 자리표시 ---------------- */
const mfile = (id, exts) => exts.map(e => `${id}.${e}`).find(n => FILES.has(n));
// 같은 단계에 영상과 그 원본 그림이 같이 있으면 그림은 빼고 영상만(영상이 그림을 포스터로 씀)
const dedupe = ids => ids.filter(id => !ids.some(o => MEDIA[o]?.kind === 'video' && MEDIA[o].from === id)).filter(id => MEDIA[id]?.kind !== 'tts' && MEDIA[id]?.kind !== 'bgm');
function mediaEl(id, big) {
  const m = MEDIA[id] || { id, desc: '' };
  if (!m.desc && m.from && MEDIA[m.from]) m.desc = MEDIA[m.from].desc;
  const base = `/media/${L.id}/`;
  if (m.kind === 'video' || mfile(id, ['mp4'])) {
    const v = mfile(id, ['mp4']), poster = mfile(m.from || id, ['png', 'jpg', 'webp']);
    if (v) return h('figure', { class: 'media' }, h('video', { src: base + v, poster: poster ? base + poster : false, autoplay: true, muted: true, loop: true, playsinline: true }));
    if (poster) return h('figure', { class: 'media' }, h('img', { src: base + poster, alt: m.desc || '' }));
  }
  // AI 영상을 끈 뒤(2026-10-06) clip_x·v_x 는 파일이 없다 — 같은 이름의 그림 m_x 로 대신한다(빈 회색 칸이 남았다)
  const img = mfile(id, ['png', 'jpg', 'webp']) || mfile('m_' + id.replace(/^(clip|v|m)_/, ''), ['png', 'jpg', 'webp']);
  if (img) return h('figure', { class: 'media' }, h('img', { src: base + img, alt: m.desc || '', loading: 'lazy' }));
  return h('figure', { class: 'media ph' + (big ? ' big' : '') }, h('span', { class: 'ph-k' }, m.kind === 'video' ? '영상' : '그림'), h('figcaption', {}, m.desc || id));
}
let AUDIO = null;
function playTTS(id, btn) {
  const f = mfile(id, ['mp3']);
  if (AUDIO) { AUDIO.pause(); AUDIO = null; document.querySelectorAll('.tts.on').forEach(b => b.classList.remove('on')); fade(BGM, BGM_VOL, 600); return; }
  if (!f) { if ('speechSynthesis' in window && MEDIA[id]) { const u = new SpeechSynthesisUtterance(MEDIA[id].text); u.lang = 'ko-KR'; speechSynthesis.cancel(); speechSynthesis.speak(u); } return; }
  AUDIO = new Audio(`/media/${L.id}/${f}`); btn && btn.classList.add('on'); fade(BGM, BGM_VOL * .3, 300);  // 읽어 주는 동안 배경음은 작게
  AUDIO.onended = () => { AUDIO = null; btn && btn.classList.remove('on'); fade(BGM, BGM_VOL, 800); }; AUDIO.play().catch(() => {});
}
let BGM = null;
const BGM_VOL = 0.22;
const fade = (a, to, ms = 600) => { if (!a) return; const from = a.volume, t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / ms); a.volume = from + (to - from) * k; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
function toggleBGM(btn) {
  const f = mfile('bgm', ['mp3']);
  if (BGM) { const b = BGM; fade(b, 0, 500); setTimeout(() => b.pause(), 520); BGM = null; btn && btn.classList.remove('on'); ls.set('eth_bgm', '0'); return; }
  if (!f) return toast('배경음악 파일이 아직 없어요.');
  BGM = new Audio(`/media/${L.id}/${f}`); BGM.loop = true; BGM.volume = 0; BGM.play().then(() => fade(BGM, AUDIO ? BGM_VOL * .3 : BGM_VOL, 1200)).catch(() => {});
  btn && btn.classList.add('on'); ls.set('eth_bgm', '1');
}

/* ---------------- 블록(scene·reveal·branch 공용) ---------------- */
function blocks(list, big) {
  return h('div', { class: 'blocks' }, (list || []).map(b => {
    switch (b.type) {
      case 'text': return h('p', { class: 'b-text' }, b.text);
      case 'bubble': return h('div', { class: 'b-bubble' }, b.who ? h('b', {}, b.who) : null, h('span', {}, b.text));
      // 원문 항목에 이미 ·, -, ① 같은 머리표가 있으면 목록 점을 빼고 들여쓰기만(점이 두 번 찍혔다)
      case 'list': return h('ul', { class: 'b-list' + (b.items.some(i => /^\s*[·\-–•※①-⑳○●◎△]/.test(i)) ? ' own' : '') }, b.items.map(i => h('li', { class: /^\s*[-–]/.test(i) ? 'sub' : '' }, i)));
      case 'table': return h('div', { class: 'b-table' }, h('table', {},
        b.head ? h('thead', {}, h('tr', {}, b.head.map(x => h('th', {}, x)))) : null,
        h('tbody', {}, b.rows.map(r => h('tr', {}, (Array.isArray(r) ? r : [r]).map(x => h('td', {}, x)))))));
      case 'media': return mediaEl(b.id, big);
      case 'concept': return h('div', { class: 'b-concept' }, h('em', {}, b.term || '핵심 개념'), h('p', {}, b.text));
      default: return null;
    }
  }));
}

/* ---------------- 공통 조각 ---------------- */
const field = (f, val, onInput) => {
  const inp = h(f.long ? 'textarea' : 'input', { class: 'inp', maxlength: f.long ? 1000 : 300, rows: f.long ? 4 : false, placeholder: f.placeholder || '' });
  inp.value = val || ''; inp.addEventListener('input', () => onInput(inp.value));
  return h('label', { class: 'field' }, h('span', { class: 'f-label' }, f.label || ''),
    f.prefix || f.suffix ? h('div', { class: 'frame' }, f.prefix ? h('span', { class: 'pre' }, f.prefix) : null, inp, f.suffix ? h('span', { class: 'suf' }, f.suffix) : null) : inp);
};
const bar = (label, n, total, hot) => h('div', { class: 'bar' + (hot ? ' hot' : '') },
  h('span', { class: 'bar-l' }, label), h('span', { class: 'bar-t' }, h('i', { style: `width:${total ? Math.round(100 * n / total) : 0}%` })), h('span', { class: 'bar-n' }, `${n}`));
const wallCard = (text, extra) => h('div', { class: 'wcard' }, extra ? h('small', {}, extra) : null, h('p', {}, text));
const valText = v => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(valText).filter(Boolean).join(' / ');
  return Object.entries(v).filter(([k]) => !k.startsWith('_')).map(([, x]) => valText(x)).filter(Boolean).join(' / ');
};

/* ---------------- 위젯 ---------------- */
// 각 위젯: phone(s, mine, api) → 요소, board(s, answers, ctx) → 요소
// api.submit(value) 제출 / api.draft(value) 임시값 / api.others 공개된 다른 친구 답(없으면 null)
const W = {};

W.scene = {
  phone: s => s.board_only ? h('p', { class: 'look' }, '선생님 화면을 보세요.') : blocks(s.blocks),
  board: s => blocks(s.blocks, true),
};

W.choice = {
  phone(s, mine, api) {
    const d = DRAFT[s.id] ||= { pick: mine?.pick ?? (s.multi ? [] : null), reason: mine?.reason || '' };
    const opts = h('div', { class: 'opts' }, s.options.map((o, i) => {
      const on = s.multi ? d.pick.includes(i) : d.pick === i;
      return h('button', { class: 'opt' + (on ? ' on' : ''), onclick: () => {
        if (s.multi) d.pick = on ? d.pick.filter(x => x !== i) : [...d.pick, i]; else d.pick = i;
        SFX.pop(); api.redraw(); } }, o);
    }));
    const box = h('div', {}, h('p', { class: 'q' }, s.q), opts);
    if (s.reason) box.append(field({ label: s.reason, long: true }, d.reason, v => d.reason = v));
    box.append(h('button', { class: 'go', onclick: () => {
      if (s.multi ? !d.pick.length : d.pick == null) return toast('하나 이상 골라 주세요.');
      api.submit({ pick: d.pick, reason: d.reason });
    } }, mine ? '고쳐서 다시 내기' : SUBMIT));
    if (mine && s.feedback) {
      const picks = [].concat(mine.pick).map(i => s.options[i]);
      picks.forEach(p => s.feedback[p] && box.append(h('div', { class: 'fb' }, s.feedback[p])));
    }
    if (api.others) box.append(dist(s, api.others));
    return box;
  },
  board(s, ans, ctx) {
    const box = h('div', {}, h('p', { class: 'q big' }, s.q));
    if (ctx.revealed) box.append(dist(s, ans.map(a => a.v)));
    else box.append(h('div', { class: 'opts static' }, s.options.map(o => h('div', { class: 'opt' }, o))));
    ctx.drawer(ans.filter(a => a.v.reason).map(a => ({ mid: a.mid, text: a.v.reason, extra: [].concat(a.v.pick).map(i => s.options[i]).join(', ') })));
    return box;
  },
};
function dist(s, vals) {
  const cnt = s.options.map(() => 0);
  vals.forEach(v => [].concat(v.pick).forEach(i => cnt[i] != null && cnt[i]++));
  const n = vals.length;
  return h('div', { class: 'dist' }, s.options.map((o, i) => bar(o, cnt[i], n, cnt[i] === Math.max(...cnt) && cnt[i] > 0)), h('small', {}, `응답 ${n}명`));
}

W.write = {
  phone(s, mine, api) {
    const d = DRAFT[s.id] ||= { ...(mine || {}) };
    const box = h('div', {}, s.fields.map((f, i) => field(f, d['f' + i], v => d['f' + i] = v)));
    box.append(h('button', { class: 'go', onclick: () => {
      if (!s.fields.some((_, i) => (d['f' + i] || '').trim())) return toast('한 칸 이상 적어 주세요.');
      api.submit({ ...d });
    } }, mine ? '고쳐서 다시 내기' : SUBMIT));
    if (api.pinned?.length) box.append(h('div', { class: 'wall small' }, api.pinned.map(v => wallCard(writeText(s, v)))));
    return box;
  },
  board(s, ans, ctx) {
    const box = h('div', {}, s.fields.map(f => h('p', { class: 'q big' }, [f.prefix, f.label, f.suffix].filter(Boolean).join(' '))));
    const pinned = ans.filter(a => ctx.pinned.includes(a.mid));
    box.append(h('div', { class: 'wall' }, pinned.map(a => wallCard(writeText(s, a.v), a.grp ? `${a.grp}모둠` : ''))));
    if (!pinned.length) box.append(h('p', { class: 'hint' }, s.wall === false ? `${ans.length}명이 적었어요.` : `${ans.length}명이 적었어요. 오른쪽 교사 패널에서 카드를 골라 띄우세요.`));
    ctx.drawer(ans.map(a => ({ mid: a.mid, text: writeText(s, a.v), extra: a.grp ? `${a.grp}모둠` : '' })));
    return box;
  },
};
const writeText = (s, v) => s.fields.map((f, i) => (v['f' + i] || '').trim() ? [f.prefix, v['f' + i], f.suffix].filter(Boolean).join(' ') : '').filter(Boolean).join('\n');

W.sort = {
  phone(s, mine, api) {
    const d = DRAFT[s.id] ||= { put: { ...(mine?.put || {}) }, reason: mine?.reason || '' };
    const box = h('div', {}, s.q ? h('p', { class: 'q' }, s.q) : null);
    s.items.forEach((it, i) => box.append(h('div', { class: 'sort-item' }, h('p', {}, it),
      h('div', { class: 'bins' }, s.bins.map((b, j) => h('button', { class: 'bin' + (d.put[i] === j ? ' on' : ''), onclick: () => { d.put[i] = j; SFX.pop(); api.redraw(); } }, b))))));
    if (s.reason) box.append(field({ label: s.reason, long: true }, d.reason, v => d.reason = v));
    box.append(h('button', { class: 'go', onclick: () => {
      if (Object.keys(d.put).length < s.items.length) return toast('모든 카드를 칸에 넣어 주세요.');
      api.submit({ put: d.put, reason: d.reason });
    } }, mine ? '고쳐서 다시 내기' : SUBMIT));
    if (api.others) box.append(sortDist(s, api.others));
    return box;
  },
  board(s, ans, ctx) {
    const box = h('div', {}, s.q ? h('p', { class: 'q big' }, s.q) : null);
    box.append(ctx.revealed ? sortDist(s, ans.map(a => a.v)) : h('div', { class: 'cards' }, s.items.map(i => h('div', { class: 'card-s' }, i))));
    ctx.drawer(ans.filter(a => a.v.reason).map(a => ({ mid: a.mid, text: a.v.reason })));
    return box;
  },
};
function sortDist(s, vals) {
  return h('div', { class: 'sortdist' }, s.items.map((it, i) => {
    const c = s.bins.map(() => 0); vals.forEach(v => v.put?.[i] != null && c[v.put[i]]++);
    return h('div', { class: 'sd-row' }, h('p', {}, it), h('div', { class: 'sd-bins' }, s.bins.map((b, j) => h('span', { class: c[j] === Math.max(...c) && c[j] ? 'hot' : '' }, `${b} ${c[j]}`))));
  }));
}

W.rate = {
  phone(s, mine, api) {
    const d = DRAFT[s.id] ||= { r: { ...(mine?.r || {}) } };
    const box = h('div', {}, s.q ? h('p', { class: 'q' }, s.q) : null, h('div', { class: 'rate' }, s.items.map((it, i) =>
      h('div', { class: 'rate-row' }, h('p', {}, it), h('div', { class: 'scale' }, s.scale.map((sc, j) =>
        h('button', { class: 'sc' + (d.r[i] === j ? ' on' : ''), onclick: () => { d.r[i] = j; SFX.pop(); api.redraw(); } }, sc)))))));
    box.append(h('button', { class: 'go', onclick: () => {
      if (Object.keys(d.r).length < s.items.length) return toast('모든 문항에 표시해 주세요.');
      api.submit({ r: d.r });
    } }, mine ? '고쳐서 다시 내기' : SUBMIT));
    return box;
  },
  board(s, ans, ctx) {
    const box = h('div', {}, s.q ? h('p', { class: 'q big' }, s.q) : null, h('ul', { class: 'b-list big' }, s.items.map(i => h('li', {}, i))),
      h('p', { class: 'hint' }, `${ans.length}명이 표시했어요.`));
    const tbl = h('div', { class: 'ratedist' }, s.items.map((it, i) => {
      const c = s.scale.map(() => 0); ans.forEach(a => a.v.r?.[i] != null && c[a.v.r[i]]++);
      return h('div', { class: 'sd-row' }, h('p', {}, it), h('div', { class: 'sd-bins' }, s.scale.map((sc, j) => h('span', {}, `${sc} ${c[j]}`))));
    }));
    if (s.private === false && ctx.revealed) box.append(tbl); else ctx.panel(tbl);
    return box;
  },
};

W.reveal = {
  phone(s, mine, api) {
    const d = DRAFT[s.id] ||= { at: mine?.at || 0, a: { ...(mine?.a || {}) } };
    const box = h('div', { class: 'clues' });
    s.clues.forEach((c, i) => {
      if (i > d.at) return box.append(h('div', { class: 'clue locked' }, h('b', {}, c.title || `단서 ${i + 1}`), h('span', {}, '앞 단계를 마치면 열려요')));
      const el = h('div', { class: 'clue' + (i === d.at ? ' cur' : '') }, h('b', {}, c.title || `단서 ${i + 1}`), blocks(c.blocks));
      if (c.ask) el.append(field({ label: c.ask, long: true }, d.a[i], v => d.a[i] = v));
      if (c.code) el.append(field({ label: (s.ui && s.ui.code) || '잠금 코드' }, d.a['c' + i], v => d.a['c' + i] = v));
      if (i === d.at) el.append(h('button', { class: 'go', onclick: () => {
        if (c.ask && !(d.a[i] || '').trim()) return toast('생각을 적어야 다음이 열려요.');
        if (c.code && norm(d.a['c' + i]) !== norm(c.code)) return toast('코드가 맞지 않아요. 단서를 다시 살펴보세요.');
        d.at = Math.min(i + 1, s.clues.length); SFX.reveal(); api.submit({ at: d.at, a: d.a }, true);
      } }, i === s.clues.length - 1 ? '마치기' : '다음 단서 열기'));
      box.append(el);
    });
    if (d.at >= s.clues.length) box.append(h('p', { class: 'done' }, '모든 단서를 확인했어요.'));
    return box;
  },
  board(s, ans, ctx) {
    const box = h('div', {}, h('div', { class: 'clue-steps' }, s.clues.map((c, i) => {
      const n = ans.filter(a => (a.v.at || 0) > i).length;
      return h('div', { class: 'cs' }, h('b', {}, c.title || `단서 ${i + 1}`), h('span', {}, `${n}명 통과`));
    })));
    if (ctx.revealed) s.clues.forEach(c => box.append(h('div', { class: 'clue' }, h('b', {}, c.title || ''), blocks(c.blocks, true))));
    ctx.drawer(ans.flatMap(a => Object.entries(a.v.a || {}).filter(([k]) => !k.startsWith('c')).map(([k, t]) => ({ mid: a.mid, text: t, extra: s.clues[k]?.title || '' }))));
    return box;
  },
};
const norm = x => String(x || '').replace(/\s+/g, '').toLowerCase();

W.review = {
  phone(s, mine, api) {
    const d = DRAFT[s.id] ||= { ...(mine || {}) };
    const my = api.allMine || {};
    const box = h('div', {}, h('div', { class: 'b-table' }, h('table', {}, h('tbody', {}, s.refs.map(r => {
      const st = L.steps.find(x => x.id === r.step);
      return h('tr', {}, h('th', {}, r.label), h('td', {}, my[r.step] ? answerText(st, my[r.step]) : '—'));
    })))));
    (s.fields || []).forEach((f, i) => box.append(field(f, d['f' + i], v => d['f' + i] = v)));
    if ((s.fields || []).length) box.append(h('button', { class: 'go', onclick: () => api.submit({ ...d }) }, mine ? '고쳐서 다시 내기' : SUBMIT));
    return box;
  },
  board(s, ans, ctx) {
    const box = h('div', {}, h('ul', { class: 'b-list big' }, s.refs.map(r => h('li', {}, r.label))));
    if (s.fields?.length) ctx.drawer(ans.map(a => ({ mid: a.mid, text: writeText(s, a.v) })));
    return box;
  },
};
function answerText(st, v) {
  if (!st || !v) return '';
  if (st.widget === 'choice') return [[].concat(v.pick).map(i => st.options[i]).join(', '), v.reason].filter(Boolean).join(' — ');
  if (st.widget === 'write' || st.widget === 'review') return writeText(st.fields ? st : { fields: [] }, v);
  if (st.widget === 'sort') return st.items.map((it, i) => `${it} → ${st.bins[v.put?.[i]] ?? '?'}`).join('\n');
  if (st.widget === 'allocate') return st.items.map((it, i) => `${it} ${v.n?.[i] || 0}${st.unit || ''}`).join(', ');
  if (st.widget === 'card') return st.fields.map(f => v[f.key]).filter(Boolean).join(' / ');
  if (st.widget === 'mark') return Object.keys(v.m || {}).length + '곳 표시' + (v.reason ? ` — ${v.reason}` : '');
  if (st.widget === 'custom') return [v.predict, v.result].filter(Boolean).join(' → ');
  return valText(v);
}

W.card = {
  phone(s, mine, api) {
    const d = DRAFT[s.id] ||= { ...(mine || {}) };
    const preview = h('div', { class: 'card-out', id: 'card-' + s.id });
    const draw = () => { preview.replaceChildren(cardView(s, d, ST?.nick)); };
    const box = h('div', {}, s.fields.map(f => field(f, d[f.key], v => { d[f.key] = v; draw(); })));
    draw();
    box.append(h('p', { class: 'hint' }, (s.ui && s.ui.preview) || '완성된 모습'), preview,
      h('div', { class: 'row' },
        h('button', { class: 'go', onclick: () => {
          if (!s.fields.some(f => (d[f.key] || '').trim())) return toast('한 칸 이상 적어 주세요.');
          api.submit({ ...d });
        } }, mine ? '고쳐서 다시 내기' : SUBMIT),
        h('button', { class: 'ghost', onclick: () => saveCard(preview, s.card_title) }, '이미지로 저장'),
        h('button', { class: 'ghost', onclick: () => printCard(preview) }, '인쇄·PDF')));
    return box;
  },
  board(s, ans, ctx) {
    const pinned = ans.filter(a => ctx.pinned.includes(a.mid));
    const box = h('div', {}, h('p', { class: 'q big' }, s.card_title),
      pinned.length ? h('div', { class: 'gallery' }, pinned.map(a => cardView(s, a.v))) :
        h('div', { class: 'gallery ghosted' }, cardView(s, {})), h('p', { class: 'hint' }, `${ans.length}명이 완성했어요.`));
    ctx.drawer(ans.map(a => ({ mid: a.mid, text: s.fields.map(f => a.v[f.key]).filter(Boolean).join(' / ') })));
    return box;
  },
};
function cardView(s, d, nick) {
  return h('div', { class: 'cardv' }, h('div', { class: 'cardv-h' }, h('b', {}, s.card_title), nick ? h('small', {}, nick) : null),
    h('dl', {}, s.fields.flatMap(f => [h('dt', {}, f.label), h('dd', {}, d[f.key] || '…')])),
    s.footer ? h('p', { class: 'cardv-f' }, s.footer) : null);
}
function saveCard(el, title) {
  if (!window.html2canvas) return toast('잠시 뒤 다시 눌러 주세요.');
  html2canvas(el, { backgroundColor: null, scale: 2 }).then(c => {
    const a = h('a', { href: c.toDataURL('image/png'), download: `${title || 'card'}.png` }); document.body.append(a); a.click(); a.remove();
  });
}
function printCard(el) { document.body.classList.add('printing'); el.classList.add('print-me'); window.print(); el.classList.remove('print-me'); document.body.classList.remove('printing'); }

W.allocate = {
  phone(s, mine, api) {
    const d = DRAFT[s.id] ||= { n: [...(mine?.n || s.items.map(() => 0))], reason: mine?.reason || '' };
    const used = d.n.reduce((a, b) => a + b, 0);
    const box = h('div', {}, s.q ? h('p', { class: 'q' }, s.q) : null, h('p', { class: 'left' }, `남은 ${s.unit || ''} ${s.total - used}`));
    s.items.forEach((it, i) => box.append(h('div', { class: 'alloc' }, h('p', {}, it),
      h('div', { class: 'step' }, h('button', { onclick: () => { if (d.n[i] > 0) { d.n[i]--; api.redraw(); } } }, '−'),
        h('b', {}, d.n[i]), h('button', { onclick: () => { if (used < s.total) { d.n[i]++; SFX.pop(); api.redraw(); } } }, '+')))));
    if (s.reason) box.append(field({ label: s.reason, long: true }, d.reason, v => d.reason = v));
    box.append(h('button', { class: 'go', onclick: () => {
      if (used !== s.total) return toast(`${s.unit || ''} ${s.total}개를 모두 나눠 주세요.`);
      api.submit({ n: d.n, reason: d.reason });
    } }, mine ? '고쳐서 다시 내기' : SUBMIT));
    if (api.others) box.append(allocDist(s, api.others));
    return box;
  },
  board(s, ans, ctx) {
    const box = h('div', {}, s.q ? h('p', { class: 'q big' }, s.q) : null);
    box.append(ctx.revealed ? allocDist(s, ans.map(a => a.v)) : h('div', { class: 'cards' }, s.items.map(i => h('div', { class: 'card-s' }, i))));
    ctx.drawer(ans.filter(a => a.v.reason).map(a => ({ mid: a.mid, text: a.v.reason })));
    return box;
  },
};
function allocDist(s, vals) {
  const avg = s.items.map((_, i) => vals.length ? vals.reduce((a, v) => a + (v.n?.[i] || 0), 0) / vals.length : 0);
  return h('div', { class: 'dist' }, s.items.map((it, i) => bar(it, Math.round(avg[i] * 10) / 10, s.total, false)), h('small', {}, `${vals.length}명 평균(비교 토의용)`));
}

W.mark = {
  units(s) {
    if (s.unit === 'marked') {
      const out = []; let i = 0;
      s.passage.replace(/\[\[(.+?)\]\]|([^\[]+|\[)/g, (m, mk, plain) => { out.push(mk ? { t: mk, k: i++ } : { t: plain }); return m; });
      return out;
    }
    const parts = s.unit === 'word' ? s.passage.split(/(\s+)/) : s.passage.split(/(?<=[.!?。…])\s+|\n/);
    let k = 0;
    return parts.filter(p => p !== '').map(p => /^\s+$/.test(p) ? { t: p } : { t: p + (s.unit === 'word' ? '' : ' '), k: k++ });
  },
  phone(s, mine, api) {
    const d = DRAFT[s.id] ||= { m: { ...(mine?.m || {}) }, reason: mine?.reason || '' };
    const acts = s.actions?.length ? s.actions : ['표시'];
    const box = h('div', {}, s.q ? h('p', { class: 'q' }, s.q) : null,
      s.actions?.length ? h('p', { class: 'hint' }, `누를 때마다 ${acts.join(' → ')} → 지우기`) : null);
    box.append(h('div', { class: 'passage' }, W.mark.units(s).map(u => u.k == null ? u.t :
      h('span', { class: 'unit' + (d.m[u.k] != null ? ' on a' + d.m[u.k] : ''), onclick: () => {
        const cur = d.m[u.k]; if (cur == null) d.m[u.k] = 0; else if (cur + 1 < acts.length) d.m[u.k] = cur + 1; else delete d.m[u.k];
        SFX.pop(); api.redraw();
      } }, u.t, d.m[u.k] != null && s.actions?.length ? h('sup', {}, acts[d.m[u.k]]) : null))));
    if (s.reason) box.append(field({ label: s.reason, long: true }, d.reason, v => d.reason = v));
    box.append(h('button', { class: 'go', onclick: () => {
      if (!Object.keys(d.m).length) return toast('한 곳 이상 표시해 주세요.');
      api.submit({ m: d.m, reason: d.reason });
    } }, mine ? '고쳐서 다시 내기' : SUBMIT));
    if (api.others) box.append(markHeat(s, api.others));
    return box;
  },
  board(s, ans, ctx) {
    const box = h('div', {}, s.q ? h('p', { class: 'q big' }, s.q) : null);
    box.append(ctx.revealed ? markHeat(s, ans.map(a => a.v)) : h('div', { class: 'passage big' }, W.mark.units(s).map(u => u.t)));
    ctx.drawer(ans.filter(a => a.v.reason).map(a => ({ mid: a.mid, text: a.v.reason })));
    return box;
  },
};
function markHeat(s, vals) {
  const n = vals.length || 1;
  return h('div', {}, h('div', { class: 'passage big' }, W.mark.units(s).map(u => {
    if (u.k == null) return u.t;
    const c = vals.filter(v => v.m?.[u.k] != null).length;
    return h('span', { class: 'heat', style: `--h:${(c / n).toFixed(2)}`, title: `${c}명` }, u.t, c ? h('sup', {}, c) : null);
  })), h('small', {}, `${vals.length}명이 표시한 곳 — 진할수록 많이 표시`));
}

W.branch = {
  phone(s, mine, api) {
    const d = DRAFT[s.id] ||= { path: [...(mine?.path || [s.start])] };
    const cur = d.path[d.path.length - 1], node = s.nodes[cur] || { blocks: [], choices: [] };
    const box = h('div', { class: 'branch' }, blocks(node.blocks));
    box.append(h('div', { class: 'opts' }, (node.choices || []).map(c => h('button', { class: 'opt', onclick: () => {
      d.path.push(c.to); SFX.pop(); api.submit({ path: d.path }, true);
    } }, c.label))));
    if (d.path.length > 1) box.append(h('button', { class: 'ghost', onclick: () => { d.path.pop(); api.redraw(); } }, '앞 장면으로'));
    if (!(node.choices || []).length) box.append(h('button', { class: 'ghost', onclick: () => { d.path = [s.start]; api.submit({ path: d.path }, true); } }, '처음부터 다시'));
    return box;
  },
  board(s, ans) {
    const cnt = {}; ans.forEach(a => (a.v.path || []).forEach(n => cnt[n] = (cnt[n] || 0) + 1));
    const start = s.nodes[s.start];
    return h('div', {}, blocks(start?.blocks, true), h('div', { class: 'nodes' }, Object.keys(s.nodes).map(k => {
      const first = (s.nodes[k].blocks || []).find(b => b.text);
      return h('div', { class: 'node' }, h('b', {}, `${cnt[k] || 0}명`), h('span', {}, first ? first.text.slice(0, 40) : k));
    })));
  },
};

/* 초3 AI 판단 실험실 — 교사 웹앱 classifier.ts 그대로 */
function classify(test, set, over = {}) {
  if (!set.length) return { decision: '데이터 없음', summary: '학습 데이터가 없습니다.', top: [] };
  const sc = set.map(it => ({ it, p: over[it.id] || it.planet,
    s: (it.color === test.color) + (it.eyes === test.eyes) + (it.antennae === test.antennae) + (it.pattern === test.pattern) }));
  const max = Math.max(...sc.map(x => x.s)), top = sc.filter(x => x.s === max), ids = top.map(x => x.it.id).join(', ');
  const a = top.filter(x => x.p === 'A').length, b = top.filter(x => x.p === 'B').length;
  if (a && !b) return { decision: 'A행성', top, summary: `가장 닮은 학습 데이터(${ids})가 모두 A행성 출신이어서 A행성으로 판단했어요.` };
  if (b && !a) return { decision: 'B행성', top, summary: `가장 닮은 학습 데이터(${ids})가 모두 B행성 출신이어서 B행성으로 판단했어요.` };
  return { decision: '판단하기 어려움', top, summary: `가장 닮은 학습 데이터에 A행성과 B행성이 같은 점수로 섞여 있어 (${ids}), 어느 쪽인지 명확히 판단하기 어려워요.` };
}
function alienSVG(a, label) {
  const fill = a.color === 'purple' ? '#9b6bff' : '#46c97a', eyes = a.eyes || 1;
  const ex = eyes === 1 ? [50] : eyes === 2 ? [38, 62] : [30, 50, 70];
  const pat = a.pattern === 'dots' ? [[35, 70], [55, 78], [68, 66], [45, 86]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#fff8"/>`).join('')
    : [62, 72, 82].map(y => `<rect x="24" y="${y}" width="52" height="4" rx="2" fill="#fff8"/>`).join('');
  const ant = a.antennae ? '<path d="M40 22 L32 6 M60 22 L68 6" stroke="#555" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="6" r="4" fill="#ffcf4a"/><circle cx="68" cy="6" r="4" fill="#ffcf4a"/>' : '';
  return h('div', { class: 'alien', html: `<svg viewBox="0 0 100 104">${ant}<ellipse cx="50" cy="62" rx="32" ry="38" fill="${fill}"/>${pat}${ex.map(x => `<circle cx="${x}" cy="46" r="9" fill="#fff"/><circle cx="${x}" cy="47" r="4.5" fill="#222"/>`).join('')}<path d="M40 84 Q50 90 60 84" stroke="#3337" stroke-width="3" fill="none"/></svg>` },
    label ? h('small', {}, label) : null);
}
const alienInfo = a => [a.colorLabel, `눈 ${a.eyes}개`, a.antennae ? '더듬이 있음' : '더듬이 없음', a.patternLabel].join(' · ');
const CUSTOM = {};
CUSTOM.alien_lab = {
  phone(s, mine, api) {
    const D = s.data, d = DRAFT[s.id] ||= { over: { ...(mine?.over || {}) }, add: [...(mine?.add || [])], predict: mine?.predict || null, result: mine?.result || null, reason: mine?.reason || '' };
    const set = [...D.dataset, ...(D.extras || []).filter(x => d.add.includes(x.id))];
    const box = h('div', { class: 'lab' }, D.q ? h('p', { class: 'q' }, D.q) : null,
      h('div', { class: 'lab-test' }, alienSVG(D.test), h('div', {}, h('b', {}, D.test.name || '미지의 생명체'), h('p', {}, alienInfo(D.test)))));
    box.append(h('div', { class: 'lab-set' }, set.map(it => {
      const p = d.over[it.id] || it.planet;
      return h('button', { class: 'lab-card p' + p + (d.over[it.id] ? ' changed' : ''), onclick: () => {
        if (D.mode !== 'relabel') return; d.over[it.id] = p === 'A' ? 'B' : 'A'; if (d.over[it.id] === it.planet) delete d.over[it.id];
        d.result = null; SFX.pop(); api.redraw();
      } }, alienSVG(it), h('b', {}, `${it.id} · ${p}행성`), h('small', {}, alienInfo(it)));
    })));
    if (D.mode === 'add' && D.extras?.length) box.append(h('p', { class: 'hint' }, (s.ui && s.ui.add) || '더할 데이터를 고르세요'),
      h('div', { class: 'lab-set extra' }, D.extras.map(it => h('button', { class: 'lab-card p' + it.planet + (d.add.includes(it.id) ? ' on' : ''), onclick: () => {
        d.add = d.add.includes(it.id) ? d.add.filter(x => x !== it.id) : [...d.add, it.id]; d.result = null; SFX.pop(); api.redraw();
      } }, alienSVG(it), h('b', {}, `${it.id} · ${it.planet}행성`)))));
    box.append(h('p', { class: 'q' }, (s.ui && s.ui.predict) || '결과를 먼저 예상해 보세요'), h('div', { class: 'opts' }, (D.predict || []).map(o =>
      h('button', { class: 'opt' + (d.predict === o ? ' on' : ''), onclick: () => { d.predict = o; api.redraw(); } }, o))));
    box.append(h('button', { class: 'go', disabled: !d.predict, onclick: () => {
      const r = classify(D.test, set, d.over); d.result = r.decision; d.summary = r.summary; SFX.reveal(); api.redraw();
    } }, (s.ui && s.ui.judge) || 'AI에게 판단 맡기기'));
    if (d.result) {
      box.append(h('div', { class: 'lab-result' }, h('b', {}, d.result), h('p', {}, d.summary || classify(D.test, set, d.over).summary),
        h('small', {}, d.predict === d.result ? '내 예상과 같아요' : '내 예상과 달라요 — 어떤 데이터가 판단을 바꿨을까요?')));
      if (D.reason) box.append(field({ label: D.reason, long: true }, d.reason, v => d.reason = v));
      box.append(h('button', { class: 'go', onclick: () => api.submit({ over: d.over, add: d.add, predict: d.predict, result: d.result, reason: d.reason }) }, mine ? '고쳐서 다시 내기' : '실험 기록 내기'));
    }
    return box;
  },
  board(s, ans, ctx) {
    const D = s.data;
    const box = h('div', { class: 'lab' }, D.q ? h('p', { class: 'q big' }, D.q) : null,
      h('div', { class: 'lab-test big' }, alienSVG(D.test), h('div', {}, h('b', {}, D.test.name || '미지의 생명체'), h('p', {}, alienInfo(D.test)))),
      h('div', { class: 'lab-set' }, D.dataset.map(it => h('div', { class: 'lab-card p' + it.planet }, alienSVG(it), h('b', {}, `${it.id} · ${it.planet}행성`)))));
    if (ctx.revealed) {
      const res = {}; ans.forEach(a => res[a.v.result] = (res[a.v.result] || 0) + 1);
      box.append(h('div', { class: 'dist' }, Object.entries(res).map(([k, n]) => bar(k, n, ans.length, false)), h('small', {}, `실험 기록 ${ans.length}건`)));
    }
    ctx.drawer(ans.filter(a => a.v.reason).map(a => ({ mid: a.mid, text: a.v.reason, extra: `${a.v.predict} → ${a.v.result}` })));
    return box;
  },
};
W.custom = { phone: (s, m, a) => (CUSTOM[s.name] || W.scene).phone(s, m, a), board: (s, a, c) => (CUSTOM[s.name] || W.scene).board(s, a, c) };

/* ---------------- 화면 공통 ---------------- */
function toast(msg) {
  const t = h('div', { class: 'toast' }, msg); document.body.append(t);
  setTimeout(() => t.classList.add('out'), 1800); setTimeout(() => t.remove(), 2300);
}
const stepIdx = id => L.steps.findIndex(s => s.id === id);
async function getJSON(u, opt) {
  const r = await fetch(u, { cache: 'no-store', ...(opt || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || '연결이 잠시 끊겼어요.'), { status: r.status });
  return j;
}
const post = (u, b) => getJSON(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

async function loadLesson(id) {
  L = await getJSON(`/lessons/${id}.json`);
  MEDIA = Object.fromEntries((L.media || []).map(m => [m.id, m]));
  FILES = new Set(await getJSON(`/api/media/${id}.json`).catch(() => []));
  document.body.dataset.tone = L.level;
  document.title = `${L.title} · AI 윤리`;
}

function header(s) {
  const i = stepIdx(s.id);
  return h('div', { class: 'step-h' }, h('span', { class: 'phase' }, s.phase || ''), h('h2', {}, s.title || ''),
    h('div', { class: 'progress' }, h('i', { style: `width:${Math.round(100 * (i + 1) / L.steps.length)}%` })));
}

/* ---------------- 학생 폰 · 혼자 보기 ---------------- */
async function phoneMain() {
  const root = $('#app');
  if (MODE === 'phone') {
    TOKEN = ls.get('eth_tok_' + CODE);
    if (!TOKEN) return location.replace(`/?c=${CODE}`);
  }
  let lastKey = '';
  const render = () => {
    const s = L.steps.find(x => x.id === CUR) || L.steps[0];
    const mine = MODE === 'preview' ? LOCAL[s.id] : ST.mine[s.id];
    const api = {
      others: MODE === 'preview' ? null : ST.others, pinned: MODE === 'preview' ? [] : ST.pinned,
      allMine: MODE === 'preview' ? LOCAL : ST.mine,
      redraw: render,
      submit: async (v, quiet) => {
        if (PII.test(JSON.stringify(v))) return toast('전화번호·이메일 같은 실제 개인정보는 쓰지 말고 가상 정보로 써 주세요.');
        if (MODE === 'preview') { LOCAL[s.id] = v; if (!quiet) toast('저장했어요(미리보기).'); return render(); }
        try { await post('/api/answer', { code: CODE, token: TOKEN, step: s.id, value: v }); ST.mine[s.id] = v; if (!quiet) toast('제출했어요!'); tick(true); }
        catch (e) { toast(e.message); }
      },
    };
    const w = W[s.widget] || W.scene;
    const media = dedupe(s.media || []).length && !s.board_only ? h('div', { class: 'media-row' }, dedupe(s.media).map(id => mediaEl(id))) : null;
    const body = h('main', { class: 'phone-body', 'data-widget': s.widget }, header(s), media, w.phone(s, mine, api),
      s.narration ? h('button', { class: 'tts ghost', onclick: e => playTTS(s.narration, e.currentTarget) }, '읽어 주기') : null);
    if (MODE === 'preview') {
      const i = stepIdx(s.id);
      body.append(h('div', { class: 'row nav' },
        h('button', { class: 'ghost', disabled: i === 0, onclick: () => { CUR = L.steps[i - 1].id; render(); scrollTo(0, 0); } }, '이전'),
        h('span', {}, `${i + 1} / ${L.steps.length}`),
        h('button', { class: 'ghost', disabled: i === L.steps.length - 1, onclick: () => { CUR = L.steps[i + 1].id; render(); scrollTo(0, 0); } }, '다음')));
    }
    const top = h('div', { class: 'phone-top' }, h('b', {}, L.title), MODE === 'phone' ? h('span', {}, ST.nick + (ST.grp ? ` · ${ST.grp}모둠` : '')) : h('span', {}, '미리보기'));
    const focus = document.activeElement && document.activeElement.closest('.field') ? [...document.querySelectorAll('.inp')].indexOf(document.activeElement) : -1;
    root.replaceChildren(top, body);
    if (focus >= 0) { const el = document.querySelectorAll('.inp')[focus]; el && el.focus(); }
  };
  const tick = async (force) => {
    try {
      ST = await getJSON(`/api/state?code=${CODE}&token=${encodeURIComponent(TOKEN)}`);
      $('#net') && $('#net').remove();
    } catch (e) {
      if (e.status === 403) { return location.replace(`/?c=${CODE}`); }
      if (e.status === 404) { root.replaceChildren(h('p', { class: 'look' }, e.message)); return; }
      if (!$('#net')) document.body.append(h('div', { id: 'net', class: 'net' }, '연결을 다시 잡는 중…'));
      return;
    }
    if (!L) await loadLesson(ST.lesson);
    const key = ST.step + '|' + JSON.stringify(ST.others) + '|' + JSON.stringify(ST.pinned) + '|' + ST.revealed;
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (ST.step !== CUR) { CUR = ST.step; SFX.next(); render(); scrollTo(0, 0); }
    else if ((force || key !== lastKey) && !typing) render();
    lastKey = key;
  };
  if (MODE === 'preview') { await loadLesson(PREVIEW_ID); CUR = L.steps[0].id; ST = { mine: LOCAL }; return render(); }
  await tick(); setInterval(tick, POLL);
}

/* ---------------- 교사 칠판 ---------------- */
async function boardMain() {
  TKEY = ls.get('eth_tkey_' + CODE) || new URLSearchParams(location.hash.slice(1)).get('k');
  if (location.hash) { ls.set('eth_tkey_' + CODE, TKEY); history.replaceState(null, '', location.pathname); }
  const root = $('#app');
  let B = null, lastKey = '', drawerOpen = ls.get('eth_drawer') === '1', view = null;
  const joinURL = `${location.origin}/?c=${CODE}`;
  const qr = (n = 4) => { const q = qrcode(0, 'M'); q.addData(joinURL); q.make(); return h('div', { class: 'qr', html: q.createSvgTag(n, 0) }); };
  const go = async (sid) => { await post('/api/control', { code: CODE, tkey: TKEY, step: sid }).catch(e => toast(e.message)); SFX.next(); tick(true); };
  const render = () => {
    const s = L.steps.find(x => x.id === (view || B.step)) || L.steps[0];
    const i = stepIdx(s.id), live = s.id === B.step;
    const ctx = { revealed: !!B.revealed[s.id], pinned: B.pinned[s.id] || [], drawerItems: [], panels: [],
      drawer(items) { this.drawerItems = items; }, panel(el) { this.panels.push(el); } };
    const w = W[s.widget] || W.scene;
    const hasMedia = dedupe(s.media || []).length > 0;
    const stage = h('section', { class: 'stage' + (hasMedia ? ' has-media' : ''), 'data-widget': s.widget }, header(s),
      hasMedia ? h('div', { class: 'media-col' }, dedupe(s.media).map(id => mediaEl(id, true))) : null,
      h('div', { class: 'widget-col' }, w.board(s, B.answers, ctx),
        !['write', 'card'].includes(s.widget) && ctx.drawerItems.some(it => ctx.pinned.includes(it.mid)) ?
          h('div', { class: 'wall' }, ctx.drawerItems.filter(it => ctx.pinned.includes(it.mid)).map(it => wallCard(it.text, it.extra))) : null));
    const n = B.members.length, done = B.done[s.id] || 0;
    const hasResult = !['scene', 'write', 'review', 'card', 'branch'].includes(s.widget);
    const controls = h('div', { class: 'controls' },
      h('button', { class: 'ghost', disabled: i === 0, onclick: () => go(L.steps[i - 1].id) }, '◀ 이전'),
      h('select', { class: 'jump', onchange: e => go(e.target.value) }, L.steps.map((x, k) => h('option', { value: x.id, selected: x.id === s.id }, `${k + 1}. ${x.phase || ''} ${x.title || ''}`))),
      h('button', { class: 'go', disabled: i === L.steps.length - 1, onclick: () => go(L.steps[i + 1].id) }, '다음 열기 ▶'),
      hasResult ? h('button', { class: 'ghost' + (ctx.revealed ? ' on' : ''), onclick: async () => {
        await post('/api/control', { code: CODE, tkey: TKEY, reveal: !ctx.revealed, for: s.id }); if (!ctx.revealed) SFX.reveal(); tick(true);
      } }, ctx.revealed ? '결과 숨기기' : '결과 공개') : null,
      s.narration ? h('button', { class: 'ghost tts', onclick: e => playTTS(s.narration, e.currentTarget) }, '읽어 주기') : null,
      h('button', { class: 'ghost' + (BGM ? ' on' : ''), onclick: e => toggleBGM(e.currentTarget) }, '배경음'),
      h('button', { class: 'ghost', onclick: () => { drawerOpen = !drawerOpen; ls.set('eth_drawer', drawerOpen ? '1' : '0'); render(); } }, drawerOpen ? '교사 패널 닫기' : '교사 패널'),
      h('button', { class: 'ghost', onclick: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}) }, '전체 화면'));
    const drawer = drawerOpen ? h('aside', { class: 'drawer' },
      h('h3', {}, '교사 패널'), h('p', { class: 'hint' }, '학생 폰엔 안 보이지만 칠판을 비추는 중이면 반 전체가 봐요. 이름 없이 내용만 나옵니다. ☆를 누르면 왼쪽 큰 화면에 띄워요.'),
      (s.notes || []).length ? h('div', { class: 'notes' }, h('b', {}, '지도서 발문·유의점'), s.notes.map(t => h('p', {}, t))) : null,
      ...ctx.panels,
      ctx.drawerItems.length ? h('div', { class: 'dlist' }, ctx.drawerItems.map(it => h('div', { class: 'ditem' + (ctx.pinned.includes(it.mid) ? ' pinned' : '') },
        h('button', { class: 'pin', title: '칠판에 띄우기', onclick: async () => { await post('/api/control', { code: CODE, tkey: TKEY, pin: it.mid, for: s.id }); SFX.pop(); tick(true); } }, ctx.pinned.includes(it.mid) ? '★' : '☆'),
        h('div', {}, it.extra ? h('small', {}, it.extra) : null, h('p', {}, it.text))))) : h('p', { class: 'hint' }, '아직 들어온 글이 없어요.')) : null;
    const top = h('header', { class: 'board-top' },
      h('div', { class: 'join', onclick: () => document.body.classList.toggle('qr-big') }, qr(3), h('div', {}, h('small', {}, '수업 코드'), h('b', {}, CODE))),
      h('div', { class: 'tt' }, h('small', {}, `${{ elem: '초등', mid: '중등', high: '고등' }[L.level]} ${L.no}차시 · ${L.area || ''}`), h('b', {}, L.title)),
      h('div', { class: 'cnt' }, h('b', {}, `${done}/${n}`), h('small', {}, live ? '이 단계 응답' : '미리 보는 중')));
    const big = h('div', { class: 'qr-overlay', onclick: () => document.body.classList.remove('qr-big') }, qr(10), h('p', {}, joinURL.replace(/^https?:\/\//, '')), h('b', {}, CODE));
    root.replaceChildren(top, h('div', { class: 'board-body' + (drawerOpen ? ' with-drawer' : '') }, stage, drawer), controls, big);
  };
  const tick = async (force) => {
    try { B = await getJSON(`/api/board?code=${CODE}&tkey=${encodeURIComponent(TKEY || '')}`); $('#net') && $('#net').remove(); }
    catch (e) {
      if (e.status === 403) return root.replaceChildren(h('p', { class: 'look' }, '이 기기에는 수업방 열쇠가 없어요. 수업을 만든 기기에서 열어 주세요.'), h('a', { href: '/t', class: 'go' }, '새 수업 만들기'));
      if (!$('#net')) document.body.append(h('div', { id: 'net', class: 'net' }, '연결을 다시 잡는 중…')); return;
    }
    if (!L) await loadLesson(B.lesson);
    const key = JSON.stringify([B.step, B.answers, B.members.length, B.revealed, B.pinned, B.done]);
    if (force || key !== lastKey) { if (B.answers.length > JSON.parse(lastKey || '[0,[]]')[1].length && !force) SFX.pop(); lastKey = key; render(); }
  };
  await tick(); setInterval(tick, POLL);
}

if (!window.ETH_V2) window.addEventListener('DOMContentLoaded', () => (MODE === 'board' ? boardMain : phoneMain)().catch(e => {
  $('#app').replaceChildren(h('p', { class: 'look' }, '화면을 불러오지 못했어요. 새로고침해 주세요.'), h('small', {}, e.message));
}));
