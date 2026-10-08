/* 105 v2 엔진 — 수업 모드(지도안대로 흐르는 슬라이드, 교사 칠판 하나) · 표지·포털·차시 홈.
   위젯 12종은 /app.js 것을 그대로 빌려 쓴다(app.js 는 window.ETH_V2 가 있으면 스스로 시작하지 않는다).
   데이터 형식은 DESIGN_v2.md 5장, lessons_v2/<차시>.json. */
'use strict';
const LVK = { e: 'elem', m: 'mid', h: 'high' }, KLV = { elem: 'e', mid: 'm', high: 'h' };
const LVN = { elem: '초등', mid: '중등', high: '고등' };
const PATH = location.pathname.slice(0).match(/^\/([emh])(?:\/(\d+)(?:\/(\w+))?)?/) || [];
const LID = PATH[2] ? `${LVK[PATH[1]]}-${PATH[2]}` : null;
let DLS = null;
const dlUrl = file => DLS ? DLS.base + file.split('/').map(encodeURIComponent).join('/') : null;
const jget = (k, d) => { try { return JSON.parse(ls.get(k)) ?? d; } catch (e) { return d; } };
const jset = (k, v) => ls.set(k, JSON.stringify(v));
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function loadV2(id) {
  L = await getJSON(`/lessons_v2/${id}.json`);
  L.steps = Object.entries(L.activities).map(([k, a]) => ({ ...a, id: k }));  // review·answerText 가 L.steps 를 찾는다
  MEDIA = Object.fromEntries((L.media || []).map(m => [m.id, m]));
  FILES = new Set(await getJSON(`/api/media/${id}.json`).catch(() => []));
  DLS = await getJSON('/v2/downloads.json').catch(() => null);  // 관련 자료(원자료) 목록 — link 블록·차시 홈 '관련 자료'
  document.body.dataset.tone = L.level;
  document.title = `${L.title} · AI 윤리`;
  const th = `/${KLV[L.level]}/theme.css`;  // 학생 폰은 주소에 학교급이 없어서 여기서 붙인다
  if (![...document.styleSheets].some(x => x.href?.endsWith(th))) document.head.append(h('link', { rel: 'stylesheet', href: th }));
}
const actOf = sl => sl && sl.layout === 'activity' ? L.steps.find(a => a.id === sl.activity) : null;

/* ---------- 클릭형 블록(LESSON_SCHEMA_v2.md) ---------- */
const OPEN = {};                         // 가림막·뒤집기 카드 열린 상태 {'sl3:2': true, 'sl4:1:0': true}
const murl = (id, exts) => { const f = mfile(id, exts); return f ? `/media/${L.id}/${f}` : null; };
// 아이콘은 Lucide 기호(static/v2/icons, ISC) — 학교급 색으로 칠한다(CSS mask). 생성 아이콘은 지저분해서 안 쓴다
const ico = id => MEDIA[id]?.lucide ? h('span', { class: 'ico', style: `--ico:url(/v2/icons/${MEDIA[id].lucide}.svg)`, role: 'img', 'aria-label': MEDIA[id].desc || '' }) : null;
function block(b, key, redraw) {
  switch (b.type) {
    case 'lettering': return h('div', { class: 'b-letter' }, b.text);
    case 'stamp': return h('div', { class: 'b-stamp' }, h('span', {}, b.text));
    case 'words': {  // 단어 고르기 — 눌러서 핵심 단어를 고르고 [키워드만 남기기]로 나머지를 빼 본다(키워드 다이어트 등)
      const wrap = h('div', { class: 'b-words' });
      const ws = b.text.split(/\s+/).map((w, j) => h('button', { class: 'w' + (OPEN[`${key}:${j}`] ? ' on' : ''), onclick: e => {
        OPEN[`${key}:${j}`] = !OPEN[`${key}:${j}`]; e.currentTarget.classList.toggle('on'); SFX.pop(); } }, w));
      const btn = h('button', { class: 'go w-diet', onclick: () => { wrap.classList.toggle('diet'); SFX.reveal(); btn.textContent = wrap.classList.contains('diet') ? '문장 다시 보기' : (b.hint || '키워드만 남기기'); } }, b.hint || '키워드만 남기기');
      wrap.append(h('p', { class: 'w-line' }, ws), btn);
      return wrap;
    }
    case 'cover': {
      const open = !!OPEN[key];
      const el = h('button', { class: 'b-cover' + (open ? ' open' : ''), 'data-key': key, onclick: () => {
          OPEN[key] = !OPEN[key]; if (OPEN[key]) SFX.reveal();
          const nu = tidyText(block(b, key, redraw)); nu.className = el.className.replace(/\bopen\b/, '').trim() + (OPEN[key] ? ' open' : ''); el.replaceWith(nu);  // 그 자리에서만 바꾼다
        } }, open ? (b.id ? [b.text ? h('span', { class: 'cv-text' }, b.text) : null, (m => (MEDIA[b.id]?.src === 'teacher' && m.classList.add('t-fig'), b.size && m.classList.add('t-' + b.size), m))(mediaEl(b.id, true))] : h('span', { class: 'cv-text' }, b.text)) : h('span', { class: 'cv-hint' }, b.hint || '눌러서 확인'));  // id 가 있으면 그림 예시 답(결과물 예시 등)
      return el;
    }
    case 'flip': return h('div', { class: 'b-flip' }, b.items.map((it, j) => {
      const k = `${key}:${j}`, open = !!OPEN[k];
      return h('button', { class: 'fl-card' + (open ? ' open' : ''), onclick: e => { OPEN[k] = !OPEN[k]; SFX.flip(); e.currentTarget.classList.toggle('open', OPEN[k]); } },
        h('span', { class: 'fl-in' }, h('span', { class: 'fl-front' }, it.front), h('span', { class: 'fl-back' }, it.back)));
    }));
    case 'icons': return h('div', { class: 'b-icons', style: `--n:${Math.min(b.items.length, 6)}` }, b.items.map((it, j) => {
      return h('figure', { style: `--d:${j * 0.12}s` }, ico(it.id) || h('span', { class: 'ic-ph' }, String(j + 1)), h('figcaption', {}, it.text));
    }));
    case 'media': {
      if (MEDIA[b.id]?.kind === 'icon') return ico(b.id) ? h('div', { class: 'b-ico' }, ico(b.id)) : h('span', { class: 'b-none' });
      // 영상을 끈 뒤 파일이 없는 clip_x·v_x 는 같은 이름 그림 m_x → 원본 그림(from) 순으로 대신한다. 다 없으면 빈칸 대신 아예 뺀다
      const id = [b.id, 'm_' + b.id.replace(/^(clip|v|m)_/, ''), MEDIA[b.id]?.from].find(x => x && mfile(x, ['png', 'jpg', 'webp', 'mp4']));
      if (!id) return h('span', { class: 'b-none' });
      const el = mediaEl(id, true); if (MEDIA[b.id]?.kind === 'icon') el.classList.add('is-icon');
      if (MEDIA[id]?.src === 'teacher') el.classList.add('t-fig');  // 교사 원자료 그림 — 글자가 든 수업 그림이라 자르지 않는다(v2.css)
      if (b.size) el.classList.add('t-' + b.size);
      return el;
    }
    case 'link': {  // 교사 웹 활동지 — 관련 자료의 같은 파일을 새 창으로 연다(교사 화면에서 시연·진행)
      const url = dlUrl(b.file);
      return url ? h('a', { class: 'b-link', href: url, target: '_blank', rel: 'noopener' }, h('span', { class: 'bl-ic', 'aria-hidden': 'true' }, '↗'), b.hint || '자료 열기') : h('span', { class: 'b-none' });
    }
    case 'gallery': {  // 교사 그림 여러 장 나란히(사례 A·B, 단계 그림 등) — 그림은 자르지 않는다
      const items = b.items.filter(it => mfile(it.id, ['png', 'jpg', 'webp']));
      const cols = items.length <= 3 ? items.length : items.length === 4 ? 2 : 3;
      return items.length ? h('div', { class: 'b-gallery' + (b.size ? ' t-' + b.size : ''), style: `grid-template-columns:repeat(${cols},minmax(0,1fr))` }, items.map(it =>
        h('figure', {}, h('img', { src: murl(it.id, ['png', 'jpg', 'webp']), alt: MEDIA[it.id]?.desc || '', loading: 'lazy' }), it.text ? h('figcaption', {}, it.text) : null))) : h('span', { class: 'b-none' });
    }
    case 'text': if (b.big) return h('p', { class: 'b-text big' }, b.text);
    default: return blocks([b], true).firstChild || h('span');
  }
}
// 블록마다 몇 번째 클릭에 나오는지(with 는 앞과 같이)
const buildSteps = sl => { let k = -1; return (sl.blocks || []).map((b, i) => (i === 0 || !b.with) ? ++k : k); };
const buildCount = sl => { const st = buildSteps(sl); return st.length ? st[st.length - 1] + 1 : 0; };

function slideBody(sl, build, board, redraw) {
  const has = id => mfile(id, ['png', 'jpg', 'webp', 'mp4']);  // 파일 없는 그림은 자리표시 대신 아예 안 그린다
  const inBlocks = new Set((sl.blocks || []).flatMap(b => b.type === 'media' ? [b.id] : b.type === 'gallery' ? b.items.map(it => it.id) : []));  // 본문에 이미 있는 그림은 옆 칸에 또 안 넣는다
  const bgId = MEDIA[sl.bg]?.from || sl.bg;
  const prev = L.slides[L.slides.indexOf(sl) - 1], prevSet = new Set(prev?.layout !== 'activity' ? prev?.assets || [] : []);  // 나눈 장에서 같은 그림이 연달아 나오지 않게
  const media = dedupe(sl.assets || []).filter(id => has(id) && !inBlocks.has(id) && id !== bgId && MEDIA[id]?.kind !== 'icon' && !prevSet.has(id)).slice(0, 2);
  const st = buildSteps(sl);
  const bl = h('div', { class: 'blocks' }, (sl.blocks || []).map((b, i) => {
    const el = block(b, `${sl.id}:${i}`, redraw); el.classList.add(st[i] < build ? 'shown' : 'hold');
    if (sl.layout === 'title' && (b.text || '').replace(/\s/g, '') === L.title.replace(/\s/g, '')) el.hidden = true;  // 표지에 같은 제목 두 번 X
    return el;
  }));
  if (sl.layout === 'title') return h('div', { class: 'sl-title' },
    h('small', { class: 'sl-area' }, `${LVN[L.level]} ${L.no}차시 · ${L.area || ''}`),
    h('h1', { class: 'b-letter' }, L.title), h('p', { class: 'sl-no' }, `${L.no} / 10`), bl);
  const out = h('div', { class: 'sl-main' + (media.length ? ' has-media' : '') },
    h('div', { class: 'sl-text' }, bl), media.length ? h('div', { class: 'sl-media' }, media.map(id => mediaEl(id, true))) : null);
  const bd = sl.layout === 'result' && sl.act && board ? board(sl.act) : null;
  if (bd && !bd.classList.contains('b-none')) out.prepend(bd);  // 아직 안 센 결과는 칸을 만들지 않는다(빈 칸이 2칸 배치를 밀어냈다)
  return out;
}
// 슬라이드 배경 — 그림 위에 부드러운 카메라 이동(CSS transform, GPU) + 빛 입자. 생성 루프 영상은 미세하게 떨려서 쓰지 않는다(2026-10-06).
// 배경이 없는 슬라이드는 앞 슬라이드 배경을 이어 쓴다 → 수업 내내 화면이 살아 있다.
function bgOf(sl) {
  const idx = L.slides.indexOf(sl);
  for (let i = idx; i >= 0; i--) {
    const b = L.slides[i].bg; const img = b && murl(MEDIA[b]?.from || b, ['png', 'jpg', 'webp']);
    if (img) return { img, k: i };
  }
  for (const s of L.slides) { const b = s.bg; const img = b && murl(MEDIA[b]?.from || b, ['png', 'jpg', 'webp']); if (img) return { img, k: 0 }; }
  return null;
}
function slideDeco(sl) {
  const out = [], bg = bgOf(sl);
  if (bg) out.push(h('div', { class: 'sl-bgwrap' }, h('img', { class: 'sl-bg pan' + (bg.k % 2 ? ' pan2' : ''), src: bg.img, alt: '' }), h('i', { class: 'sl-fx' })));
  const c = sl.char && murl(sl.char, ['png', 'webp']);
  if (c) out.push(h('img', { class: 'sl-char', src: c, alt: '' }));
  return out;
}

// 실험실(alien_lab)은 칠판에서 좌우 두 칸 — 왼쪽 생명체·데이터 카드, 오른쪽 예상·판단·기록(세로로 길어 화면 맞춤에서 글자가 너무 작아졌다)
function twoCol(el) {
  if (!el.classList?.contains('lab')) return el;
  const kids = [...el.children], cut = kids.findIndex((k, i) => i > 1 && k.matches('p.q'));
  if (cut < 0) return el;
  el.replaceChildren(h('div', { class: 'lab-l' }, kids.slice(0, cut)), h('div', { class: 'lab-r' }, kids.slice(cut)));
  el.classList.add('lab2'); return el;
}
// 내용이 슬라이드보다 길면 zoom 으로 줄인다(위젯 글자가 rem 이라 font-size 로는 안 줄어서 zoom). 0.5 아래로는 안 줄이고 그땐 스크롤
function fitSlide(stage, box) {
  box.style.zoom = 1;
  const cs = getComputedStyle(stage);
  const H = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const W = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  // 크기는 .sl-fit 의 레이아웃 값으로 잰다. stage.scroll* 로 재면 넘어올 때 미끄러지는 애니메이션(translateX)·도장 확대(scale 2.4)·제목 떠오르기가
  // 넘침으로 잡혀, 넘치지 않는 장도 0.75배로 줄어든 채 남았다. 세로는 transform 이 안 섞이는 offsetHeight(.sl-fit 은 flex:1 이라 넘치면 같이 늘어난다),
  // 가로는 표처럼 칸 밖으로 나가는 경우가 있어 scrollWidth — 애니메이션이 끝나면 render() 가 한 번 더 맞춘다. 둘 다 zoom 전 좌표라 z 를 곱한다
  const size = z => ({ h: box.offsetHeight * z, w: box.scrollWidth * z });
  // 글 칸은 한 줄 40자 안팎으로 묶어 두는데(v2.css '줄 길이'), 그 때문에 넘치면 글자를 줄이기 전에 먼저 폭 제한을 푼다 — 교실 TV 는 줄 길이보다 글자 크기가 먼저
  box.classList.remove('wide');
  if (size(1).h > H + 2) box.classList.add('wide');
  // 0.75배까지만 줄인다 — 그래도 넘치는 장은 split_dense.py 가 두 장으로 나눈다(PPT 는 줄여 넣는 게 아니라 장을 나눈다)
  // 결과 장은 인원을 다 세면 막대가 길어진다 — 잘리기보다 조금 더 줄이는 쪽(0.65배까지)
  const MIN = stage.classList.contains('layout-result') ? 0.65 : 0.75;
  for (let z = 1, k = 0, s = size(1); (s.h > H + 2 || s.w > W + 2) && z > MIN && k < 16; k++, s = size(z)) {
    z = Math.max(MIN, z * Math.min(0.96, (H / s.h) + 0.03, (W / s.w) + 0.03)); box.style.zoom = z;
  }
}
addEventListener('resize', () => { const st = $('.slide'), bx = $('.sl-fit'); if (st && bx) fitSlide(st, bx); });

// 화면 글 다듬기 — 데이터(원문 글자)는 그대로 두고 그릴 때만 손본다
// 1) 줄은 띄어쓰기에서만 바꾼다: 괄호·가운뎃점·빗금·따옴표 앞뒤에서도 줄이 바뀌어 '사람|(당사자)', '교사·|부모', '음성/|음악',
//    '‘내일 날씨’|라고', '_____|라고'처럼 낱말이 갈라졌다 → 그 자리에 낱말 잇기(U+2060, 보이지 않음).
//    단 9자 넘는 묶음('개발자·기업·운용자')은 잇지 않는다 — 좁은 칸에서 통째로 안 들어가 오히려 낱말 한가운데서 끊겼다
const JOIN_BEFORE = '(\\[{「『‘“〈《·•・/~–—…-', JOIN_AFTER = '·•・/~–—…%#)\\]}」』’”〉》-';
const NOBR = new RegExp(`(?<=[^\\s\\u2060])(?=[${JOIN_BEFORE}])|(?<=[${JOIN_AFTER}])(?=[^\\s\\u2060])|(?<=[^\\s\\u2060_])(?=_)|(?<=_)(?=[^\\s\\u2060_])`, 'gu');
//    긴 묶음도 줄 첫머리 금칙은 지킨다 — 가운뎃점·빗금·줄임표·닫는 괄호는 앞 글자에, 닫는 괄호 뒤 토씨는 괄호에 붙인다('작성자|·기관', '-Check)|이')
const LEAD = /(?<=[^\s\u2060])(?=[·•・/…%)\]}」』’”〉》])|(?<=[)\]}」』’”〉》])(?=[가-힣])/gu;
const joinWord = w => w.replace(w.replace(/_+/g, '_').length <= 9 ? NOBR : LEAD, '\u2060');  // 빈칸 밑줄 묶음은 한 글자로 센다
// 2) 좁은 칸(카드·캡션·보기·표)에 긴 영어 낱말이 있으면 칸보다 길어 ')'·'&'만 다음 줄로 떨어졌다 → 그 칸만 글자를 조금 줄인다(.lw)
const NARROW = '.fl-front, .fl-back, figcaption, .vo-t';  // 표 칸은 뺀다 — 한 칸만 작아지면 표가 들쭉날쭉했다
// 3) 긴 발문·긴 예시 답(가림막)은 크고 굵은 글씨 그대로면 대여섯 줄이 빽빽했다 → 한 단계 작고 줄간격 넓게(.lq)
function tidyText(root) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  // 띄어 쓴 줄표(' — ')는 앞말에 붙여 줄 끝에 남긴다(다음 줄 첫머리에 '—'가 왔다)
  for (let n; (n = tw.nextNode());) { const t = n.data.replace(/ ([—–]) /g, '\u00a0$1 ').replace(/\S+/g, joinWord); if (t !== n.data) n.data = t; }
  root.querySelectorAll(NARROW).forEach(el => el.classList.toggle('lw', /[A-Za-z]{11,}/.test(el.textContent)));
  root.querySelectorAll('.vq-q, .b-text.big, .cv-text').forEach(el => el.classList.toggle('lq', el.textContent.replace(/\u2060/g, '').length > 70));
  return root;
}

// 활동 → 선택형 질문 목록 [{q, options}] — 원래 객관식·분류·척도는 그대로, 서술형은 to_vote.py 가 원문 보기로 만든 act.vote
function voteQs(a) {
  if (a.vote?.length) return a.vote;
  if (a.widget === 'choice') return [{ q: a.q, options: a.options }];
  if (a.widget === 'sort') return a.items.map(it => ({ q: it, options: a.bins }));
  if (a.widget === 'rate') return a.items.map(it => ({ q: it, options: a.scale }));
  if (a.widget === 'custom' && a.data?.predict) return [{ q: a.data.q, options: a.data.predict }];
  if (a.widget === 'branch') { const n = a.nodes[a.start]; return [{ q: (n.blocks || []).map(b => b.text).filter(Boolean).join(' '), options: (n.choices || []).map(c => c.label) }]; }
  const fq = (a.fields || []).map(f => [f.prefix, f.label, f.suffix].filter(Boolean).join(' ')).filter(Boolean);
  // 원자료에 보기로 쓸 문구가 없는 서술형(예: 나의 실천 약속) — 질문을 크게, 모둠별 발표를 체크(보기를 지어내지 않는다)
  return [{ q: a.q || a.card_title || fq.join(' / ') || a.title || '', options: Array.from({ length: a.groups || 6 }, (_, i) => `${i + 1}모둠 발표`), talk: true }];
}

/* ======================= 수업 모드(교사 칠판) /e/3/class =======================
   학생 기기 동시 접속 없음(2026-10-06 대표님 결정) — 활동은 교사가 칠판에서 반 의견을 받아 직접 조작한다.
   낸 의견은 이 기기에만 쌓이고(모둠별로 여러 번 내도 됨) [결과 정리]로 모아 본다. */
async function classMain() {
  await loadV2(LID);
  // PPT 고정 화면 — 1920×1080 한 장을 창 크기에 맞춰 통째로 줄이고 키운다(v2.css 'PPT 고정 화면')
  const scale = () => document.body.style.setProperty('--k', Math.min(innerWidth / 1920, innerHeight / 1080));
  scale(); addEventListener('resize', scale);
  const root = $('#app'), KEY = 'eth2_' + LID;
  const S = jget(KEY, {}), save = () => jset(KEY, S);
  S.idx = Math.min(S.idx || 0, L.slides.length - 1); S.build ??= 0; S.start ??= Date.now();
  let notes = ls.get('eth2_notes') === '1';
  const ANS = jget(KEY + '_ans', {}), REV = {};
  const VOTES = jget(KEY + '_votes', {});  // 선택형 집계 {활동: {질문: {보기: 인원}}}      // 활동별 담은 의견 {활동: [값…]}
  const plan = L.slides.map((_, i) => L.slides.slice(0, i + 1).reduce((a, s) => a + (s.min || 0), 0));

  let enterDir = 0, autoRead = ls.get('eth2_autoread') === '1';
  const go = (i, build = 0) => {
    if (i < 0 || i >= L.slides.length) return;
    if (i !== S.idx) {
      enterDir = i > S.idx ? 1 : -1;
      if (AUDIO) playTTS();  // 읽던 것은 멈춘다
      actOf(L.slides[i]) ? SFX.start() : SFX.next();
    }
    S.idx = i; S.build = build; save(); render();
  };
  const next = () => {
    const sl = L.slides[S.idx];
    // 이미 나온 가림막이 닫혀 있으면 → 는 먼저 그걸 연다(결과 공개를 키 하나로)
    const st = buildSteps(sl), shut = (sl.blocks || []).findIndex((b, i) => b.type === 'cover' && st[i] < S.build && !OPEN[`${sl.id}:${i}`]);
    if (shut >= 0) { const btn = document.querySelector(`.b-cover[data-key="${sl.id}:${shut}"]`); return btn ? btn.click() : (OPEN[`${sl.id}:${shut}`] = true, render()); }
    if (S.build < buildCount(sl)) {
      S.build++; save();
      const st = buildSteps(sl), nowShown = (sl.blocks || []).filter((b, i) => st[i] === S.build - 1);
      nowShown.some(b => b.type === 'stamp') ? SFX.stamp() : SFX.pop(); applyBuild();
    } else go(S.idx + 1);
  };
  const prev = () => { if (S.build > 0 && S.build <= buildCount(L.slides[S.idx])) { S.build--; save(); applyBuild(); } else go(S.idx - 1, 99); };
  // 같은 슬라이드 안에서 블록 보이기·숨기기는 클래스만 바꾼다(화면 전체를 다시 그리면 배경·그림이 깜빡였다)
  const applyBuild = () => {
    const sl = L.slides[S.idx], st = buildSteps(sl), bl = document.querySelector('.slide .sl-text > .blocks, .slide .sl-title > .blocks');
    if (!bl) return render();
    [...bl.children].forEach((el, i) => { const on = st[i] < S.build; el.classList.toggle('shown', on); el.classList.toggle('hold', !on); });
    const nb = document.querySelector('.cl-bar .go'); if (nb) nb.disabled = S.idx === L.slides.length - 1 && S.build >= buildCount(sl);
  };

  // 활동 결과(담은 의견 전부)를 칠판용으로 — 결과 슬라이드(layout result)도 이걸 끼운다
  function actBoard(aid, reveal) {
    const a = L.steps.find(x => x.id === aid); if (!a) return h('p', { class: 'hint' }, '활동을 찾지 못했어요.');
    const ans = (ANS[aid] || []).map((v, k) => ({ mid: k + 1, grp: 0, v }));
    const ctx = { revealed: !!reveal, pinned: ans.map(x => x.mid), drawerItems: [], panels: [],
      drawer(items) { this.drawerItems = items; }, panel(el) { this.panels.push(el); } };
    // 활동은 선택형 손들기라(2026-10-06) 결과는 VOTES 에 있다 — 센 인원을 질문별 막대로. 아직 안 셌으면 결과 칸을 아예 그리지 않는다
    if (reveal && !ans.length) {
      const V = VOTES[aid] || {}, qs = voteQs(a);
      if (!Object.values(V).some(o => Object.values(o).some(Boolean))) return h('span', { class: 'b-none' });
      return h('div', { class: 'result-board vres' }, qs.map((q, qi) => { const o = V[qi] || {}, n = Object.values(o).reduce((x, y) => x + y, 0), mx = Math.max(0, ...Object.values(o));
        return n ? h('div', { class: 'vq' }, q.q ? h('p', { class: 'vq-q' }, q.q) : null, q.options.map((t, oi) => h('div', { class: 'vo' + ((o[oi] || 0) === mx ? ' top' : '') },
          h('span', { class: 'vo-btn' }, h('span', { class: 'vo-t' }, t), h('b', { class: 'vo-n' }, o[oi] || 0)), h('i', { class: 'vo-bar', style: `width:${Math.round(100 * (o[oi] || 0) / n)}%` })))) : null; }));
    }
    const el = (W[a.widget] || W.scene).board(a, ans, ctx);
    return h('div', { class: 'result-board' }, el, ...ctx.panels);
  }

  function render() {
    const sl = L.slides[S.idx], act = actOf(sl);
    // 위 막대: 차시명만(타이머·도입/전개/정리 시간 표시는 대표님 지시로 뺐다 2026-10-06)
    const top = h('header', { class: 'cl-top' },
      h('div', { class: 'cl-tt' }, h('small', {}, `${LVN[L.level]} ${L.no}차시`), h('b', {}, L.title)),
      h('span', { class: 'cl-sub' }, sl.sub || ''));
    const deco = slideDeco(sl);
    const lettered = (sl.blocks || []).some(b => b.type === 'lettering');  // 레터링이 있으면 같은 제목을 또 쓰지 않는다
    const stage = h('section', { class: `slide layout-${sl.layout}` + (deco.some(x => x.classList.contains('sl-bgwrap')) ? ' has-bg' : '') + (deco.some(x => x.classList.contains('sl-char')) ? ' has-char' : ''), 'data-phase': sl.phase,
      onclick: e => { if (!act && !e.target.closest('button, a, input, textarea, select, video[controls]')) next(); } },  // 빈 곳 클릭 = 다음
      ...deco,
      sl.sub || sl.phase ? h('span', { class: 'sl-chip' }, sl.sub || sl.phase) : null,
      sl.layout !== 'title' && sl.title && !lettered ? h('h2', { class: 'sl-h' }, sl.title) : null);
    let actCtl = null;
    if (!act) stage.append(slideBody(sl, S.build, aid => actBoard(aid, true), render));
    else {
      // 선택형(손들기 집계) — 학생은 손을 들고 교사가 보기를 눌러 +1(대표님 2026-10-06). 결과는 막대로
      const qs = voteQs(act), V = (VOTES[act.id] ||= {}), tot = qi => Object.values(V[qi] || {}).reduce((a, b) => a + b, 0);
      const rev = !!REV[act.id];
      const card = (q, qi) => {
        const n = tot(qi), mx = Math.max(0, ...Object.values(V[qi] || {}));
        return h('div', { class: 'vq' + (q.talk ? ' talk' : '') + (q.options.some(o => String(o).length > 12) ? ' long' : '') }, q.q && q.q.trim() !== (sl.title || '').trim() ? h('p', { class: 'vq-q' }, q.q) : null  /* 제목과 같은 질문은 두 번 쓰지 않는다 */, q.talk ? h('p', { class: 'vq-talk' }, '모둠에서 이야기 나눈 뒤 발표한 모둠을 표시해요') : null, h('div', { class: 'vq-opts' }, q.options.map((o, oi) => {
          const c = (V[qi] || {})[oi] || 0;
          return h('div', { class: 'vo' + (rev && c && c === mx ? ' top' : '') },
            h('button', { class: 'vo-btn', onclick: () => { (V[qi] ||= {})[oi] = q.talk ? (c ? 0 : 1) : c + 1; jset(KEY + '_votes', VOTES); SFX.pop(); render(); } },
              h('span', { class: 'vo-t' }, o), h('b', { class: 'vo-n' }, q.talk ? (c ? '✓' : '') : c)),
            h('i', { class: 'vo-bar', style: `width:${n ? Math.round(100 * c / n) : 0}%` }),
            c ? h('button', { class: 'vo-minus', title: '하나 빼기', onclick: () => { V[qi][oi] = c - 1; jset(KEY + '_votes', VOTES); render(); } }, '−') : null);
        })));
      };
      // 질문 여러 개가 같은 보기를 쓰면(분류·척도) 질문=줄, 보기=칸인 표 한 장 — 질문마다 카드를 쌓으면 화면을 몇 장씩 넘쳤다
      const same = qs.length > 2 && qs.every(q => !q.talk && q.options.join('\u0001') === qs[0].options.join('\u0001'));
      const bump = (qi, oi, d) => { const c = (V[qi] ||= {})[oi] || 0; V[qi][oi] = Math.max(0, c + d); jset(KEY + '_votes', VOTES); if (d > 0) SFX.pop(); render(); };
      const matrix = (a, b) => h('table', { class: 'vmx' },  // 줄이 7개 넘으면 두 표로 나눠 양옆에
        h('thead', {}, h('tr', {}, h('th', {}), qs[0].options.map(o => h('th', {}, o)))),
        h('tbody', {}, qs.map((q, qi) => qi < a || qi >= b ? null : (() => { const mx = Math.max(0, ...Object.values(V[qi] || {}));
          return h('tr', {}, h('th', { scope: 'row' }, q.q), q.options.map((_, oi) => { const c = (V[qi] || {})[oi] || 0;
            return h('td', { class: rev && c && c === mx ? 'top' : '' }, h('button', { class: 'vmx-b', onclick: () => bump(qi, oi, 1) }, c || ''),
              c ? h('button', { class: 'vo-minus', title: '하나 빼기', onclick: () => bump(qi, oi, -1) }, '−') : null); })); })())));
      const media = dedupe(sl.assets || []).filter(id => mfile(id, ['png', 'jpg', 'webp'])).slice(0, 1)
      // 그림은 보기 4개 이하·짧은 보기일 때만 옆에 — 보기가 많거나 길면 보기 칸이 비좁아진다
      if (qs.length !== 1 || qs[0].options.length > 4 || qs[0].options.some(o => String(o).length > 12)) media.length = 0;
      stage.append(sl.intro ? h('p', { class: 'sl-intro' }, sl.intro) : h('span'),
        h('div', { class: 'vote' + (qs.length > 1 ? ' multi' : '') + (media.length && qs.length === 1 ? ' with-media' : '') },
          same ? (qs.length > 7 ? h('div', { class: 'vmx2' }, matrix(0, Math.ceil(qs.length / 2)), matrix(Math.ceil(qs.length / 2), qs.length)) : matrix(0, qs.length)) : h('div', { class: 'vote-qs' }, qs.map(card)),
          media.length && qs.length === 1 ? h('div', { class: 'sl-media' }, mediaEl(media[0], true)) : null));
      const all = qs.reduce((a, _, qi) => a + tot(qi), 0);
      actCtl = h('div', { class: 'act-ctl' },
        h('span', { class: 'act-n' }, '손든 학생 ', h('b', {}, all)),
        h('button', { class: 'go', disabled: !all, onclick: () => { REV[act.id] = !REV[act.id]; if (REV[act.id]) SFX.sparkle(); render(); } }, rev ? '강조 끄기' : '결과 정리'),
        h('button', { class: 'ghost', disabled: !all, onclick: () => { if (confirm('센 인원을 지울까요?')) { VOTES[act.id] = {}; jset(KEY + '_votes', VOTES); render(); } } }, '비우기'));
    }
    tidyText(stage);
    const noteBox = null;  // 발문 노트는 뺐다(대표님 2026-10-06)
    const bar = h('footer', { class: 'cl-bar' },
      h('a', { class: 'ghost', href: `/${KLV[L.level]}/${L.no}`, title: '차시 화면으로' }, '← 차시'),
      h('a', { class: 'ghost', href: '/', title: '첫 화면으로' }, '홈'),
      h('span', { class: 'sep' }),
      h('button', { class: 'ghost', onclick: prev, disabled: S.idx === 0 && S.build === 0 }, '◀'),
      h('button', { class: 'go', onclick: next, disabled: S.idx === L.slides.length - 1 && S.build >= buildCount(sl) }, '▶'),
      h('span', { class: 'cl-count' }, `${S.idx + 1} / ${L.slides.length}`),
      actCtl,
      h('select', { class: 'jump', onchange: e => go(+e.target.value, 99) }, L.slides.map((x, k) => h('option', { value: k, selected: k === S.idx }, `${k + 1}. ${x.title || x.sub || ''}`))),
      h('span', { class: 'sp' }),
      h('button', { class: 'ghost' + (BGM ? ' on' : ''), onclick: e => toggleBGM(e.currentTarget) }, '배경음'),
      h('button', { class: 'ghost', onclick: () => { if (confirm('처음 슬라이드로 돌아갈까요? 세어 둔 인원도 지워집니다.')) { for (const k in VOTES) delete VOTES[k]; jset(KEY + '_votes', VOTES); for (const k in OPEN) delete OPEN[k]; go(0); } } }, '처음으로'),
      h('button', { class: 'ghost', onclick: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}) }, '전체 화면'));
    // 같은 활동 장에서 보기를 누른 것 — 보기 칸과 아래 막대만 바꾼다(장 전체를 다시 그려 그림·배경이 깜빡였다)
    const oldStage = document.querySelector('.slide');
    if (act && !enterDir && oldStage?.dataset.idx === String(S.idx)) {
      const nv = stage.querySelector('.vote'), ov = oldStage.querySelector('.vote');
      if (nv && ov) {
        const om = ov.querySelector('.sl-media'), nm = nv.querySelector('.sl-media'); if (om && nm) nm.replaceWith(om);  // 그림은 그대로
        ov.replaceWith(nv); document.querySelector('.cl-bar .act-ctl')?.replaceWith(actCtl);
        return fitSlide(oldStage, oldStage.querySelector('.sl-fit'));
      }
    }
    stage.dataset.idx = S.idx;
    // 화면 맞춤 — 내용을 .sl-fit 에 모아 슬라이드 높이에 맞게 줄인다(파워포인트처럼 스크롤 없이 한 화면). 배경·캐릭터는 그대로
    const fitBox = h('div', { class: 'sl-fit' });
    [...stage.children].filter(c => !c.classList.contains('sl-bgwrap') && !c.classList.contains('sl-char')).forEach(c => fitBox.append(c));
    stage.append(fitBox);
    const oldBg = document.querySelector('.slide > .sl-bgwrap'), newBg = stage.querySelector(':scope > .sl-bgwrap');
    if (oldBg && newBg && oldBg.querySelector('img')?.getAttribute('src') === newBg.querySelector('img')?.getAttribute('src')) { newBg.replaceWith(oldBg); stage.classList.add('same-bg'); }
    const oldChar = document.querySelector('.slide > .sl-char'), newChar = stage.querySelector(':scope > .sl-char');
    if (oldChar && newChar && oldChar.getAttribute('src') === newChar.getAttribute('src')) { newChar.replaceWith(oldChar); oldChar.classList.add('stay'); }
    if (enterDir) { stage.classList.add(enterDir > 0 ? 'enter-r' : 'enter-l'); enterDir = 0; }
    root.replaceChildren(top, h('div', { class: 'cl-body' + (noteBox ? ' with-side' : '') }, ...[stage, noteBox].filter(Boolean)), bar);
    const fit = () => fitSlide(stage, fitBox);
    fit(); fitBox.querySelectorAll('img, video').forEach(m => m.addEventListener(m.tagName === 'IMG' ? 'load' : 'loadedmetadata', fit, { once: true }));
    // 등장 애니메이션(미끄러져 들어오기·도장·떠오르기)이 끝나면 한 번 더 맞춘다 — 가로는 transform 이 섞이는 scrollWidth 로 재기 때문
    requestAnimationFrame(() => Promise.all(stage.getAnimations({ subtree: true })
      .filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished)).then(fit, () => {}));
    // 가림막·카드를 열면 내용이 길어진다 — 크기가 바뀔 때마다 다시 맞춘다(열고 나서 아래가 잘렸다)
    new ResizeObserver(() => fit()).observe(fitBox.querySelector('.sl-main, .vote, .sl-title') || fitBox);
  }

  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {});
  });
  render();
}

/* ======================= 표지 · 학교급 포털 · 차시 홈 ======================= */
async function portalMain() {
  const k = PATH[1], lv = LVK[k], all = (await getJSON('/api/v2/lessons.json')).filter(l => l.level === lv).sort((a, b) => a.no - b.no);
  document.body.dataset.tone = lv;
  const thumb = l => l.cover ? h('img', { src: l.cover, alt: '', loading: 'lazy' }) : h('span', { class: 'p-ph' }, l.no);
  // 학교급마다 세계관이 다르다: 초등 하늘섬 지도 / 중등 웹툰 연재 목록 / 고등 매거진 표지
  const card = {
    e: l => h('a', { class: 'isle', href: `/e/${l.no}`, style: `--i:${l.no}` }, h('span', { class: 'isle-pic' }, thumb(l)),
      h('small', {}, `섬 ${l.no}`), h('b', {}, l.title), jget('eth2_' + l.id, {}).idx ? h('i', { class: 'isle-done' }, '탐험 중') : null),
    m: l => h('a', { class: 'ep', href: `/m/${l.no}` }, h('span', { class: 'ep-pic' }, thumb(l)), h('small', {}, `${l.no}화`), h('b', {}, l.title), h('span', {}, l.area || '')),
    h: l => h('a', { class: 'mag', href: `/h/${l.no}` }, h('span', { class: 'mag-pic' }, thumb(l)), h('i', { class: 'mag-no' }, String(l.no).padStart(2, '0')),
      h('span', { class: 'mag-tx' }, h('small', {}, l.area || ''), h('b', {}, l.title))),
  }[k];
  $('#list').className = 'p-' + k;
  $('#list').replaceChildren(...all.map(card));
  if (k === 'h' && all.length) {  // 고등: 넷플릭스식 — 위에 큰 추천 배너(호를 차례로 바꿔 보여 줌), 아래 10호 포스터 5×2
    let i = 0;
    const feat = h('section', { class: 'feat-h' });
    const show = () => { const l = all[i % all.length]; i++;
      feat.replaceChildren(h('div', { class: 'fh-pic' }, l.cover ? h('img', { src: l.cover, alt: '' }) : null),
        h('div', { class: 'fh-tx' }, h('small', {}, `No. ${String(l.no).padStart(2, '0')} · ${l.area || ''}`), h('b', {}, l.title),
          h('p', {}, (l.goal || [])[0] || ''), h('a', { class: 'fh-go', href: `/h/${l.no}` }, '수업 보기 →'))); };
    show(); setInterval(show, 7000);
    $('#list').before(feat, h('h2', { class: 'row-t' }, '전체 10호'));
  }
}
// 지도안 칸 글 — 원문 줄바꿈과 머리표(▣ • - ※ ▶)를 지켜 지도안처럼 들여 쓴다
const planLines = t => String(t || '').split('\n').filter(x => x.trim()).map(x => {
  const v = x.trim(), k = /^[▣■]/.test(v) ? ' pl-h' : /^[•∙◦]/.test(v) ? ' pl-b' : /^[-–]/.test(v) ? ' pl-s' : /^※/.test(v) ? ' pl-n' : '';
  return h('div', { class: 'pl-l' + k }, v);
});
const fmtSize = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;
async function homeMain() {
  await loadV2(LID);
  const done = jget('eth2_' + LID, {}), unit = { elem: '섬', mid: '화', high: '호' }[L.level];
  // 표지 그림 — 슬라이드 순서대로 처음 나오는 실제 배경·그림(루프 영상이 있으면 영상)
  let vid = null, img = null;
  for (const s of L.slides) {
    for (const id of [s.bg, ...(s.assets || [])].filter(Boolean)) {
      vid = vid || murl(id, ['mp4']); img = img || murl(MEDIA[id]?.from || id, ['png', 'jpg', 'webp']);
    }
    if (img) break;
  }
  // 교사 자료 중심으로 다시 짠 차시(teacher_first)는 지도안의 [활동N] 수를 센다 — 손들기 장 수를 세면 활동 셋인 차시가 '활동 1개'로 보였다
  const acts = L.teacher_first ? new Set(L.slides.map(s => (s.sub || '').match(/^\[?활동\s*(\d+)/)?.[1]).filter(Boolean)).size
    : L.slides.filter(s => s.layout === 'activity').length;
  const files = DLS, dl = files?.lessons?.[LID] || [];
  // 수업 지도안 — 교사용 지도서의 '기본 정보'·'교수·학습 과정안'을 원문 그대로(L.plan). 아직 옮기지 않은 차시는 차시 데이터·슬라이드로 채운다
  const P = L.plan || {};
  const info = P.info?.length ? P.info : [['학년', L.grade], ['수업 모형', L.model], ['성취기준', (L.standards || []).join('\n')],
    ['학습 목표', (L.goal || []).map((g, i) => `${i + 1}. ${g}`).join('\n')], ['준비물', (L.prep || []).join(', ')]].filter(r => r[1]);
  const infoRows = info.map(r => typeof r[0] === 'string' ? [r] : r), infoCols = Math.max(1, ...infoRows.map(r => r.length));
  const steps = P.steps?.length ? P.steps : L.slides.reduce((out, s) => {
    const k = s.sub || s.phase, last = out[out.length - 1];
    if (last && last.step === k && last.phase === s.phase) { if (s.title && !last.activity.includes(s.title)) last.activity += '\n' + s.title; }
    else out.push({ phase: s.phase, step: k, subs: [k], activity: s.title || '' });
    return out;
  }, []);
  // 시간은 이 디지털 교과서의 슬라이드 시간(sub 별 합) — 지도서에 시간이 적혀 있으면 슬라이드도 그 시간으로 짠다
  const minOf = st => st.min ?? (st.subs ? L.slides.filter(s => st.subs.includes(s.sub)).reduce((a, s) => a + (s.min || 0), 0) : null);
  const sess = steps.some(st => st.session != null);  // 지도서 과정안이 차시(1·2교시)로 나뉜 경우
  const span = (i, key) => { const n = steps.slice(i).findIndex(x => x[key] !== steps[i][key]); return n < 0 ? steps.length - i : n; };
  const rows = steps.map((st, i) => {
    const m = minOf(st);
    return h('tr', {},
      sess && (i === 0 || steps[i - 1].session !== st.session) ? h('th', { class: 'pl-ph', scope: 'rowgroup', rowspan: span(i, 'session') }, st.session ?? '') : null,
      i === 0 || steps[i - 1].phase !== st.phase || (sess && steps[i - 1].session !== st.session)
        ? h('th', { class: 'pl-ph', scope: 'rowgroup', rowspan: Math.min(span(i, 'phase'), sess ? span(i, 'session') : Infinity) }, st.phase) : null,
      h('th', { class: 'pl-step', scope: 'row' }, st.step),
      h('td', { class: 'pl-act' }, planLines(st.activity)),
      h('td', { class: 'pl-min' }, m == null ? '' : `${Math.round(m * 10) / 10}분`),
      h('td', { class: 'pl-mat' }, planLines(st.materials)));
  });
  $('#app').replaceChildren(
    h('header', { class: 'hm-hero' },
      vid ? h('video', { src: vid, poster: img || false, autoplay: true, muted: true, loop: true, playsinline: true }) : img ? h('img', { src: img, alt: '' }) : null,
      h('div', { class: 'hm-in' },
        h('a', { class: 'back', href: `/${PATH[1]}/` }, `← ${LVN[L.level]} 차시 목록`),
        h('span', { class: 'hm-no' }, `${L.no}${unit}`),
        h('h1', { class: 'b-letter' }, L.title),
        h('p', { class: 'hm-meta' }, [L.area, L.grade, `${L.minutes}분`, `슬라이드 ${L.slides.length}장`].filter(Boolean).join(' · ')),
        h('div', { class: 'row' },
          h('a', { class: 'go big', href: `/${PATH[1]}/${L.no}/class` }, done.idx ? `이어서 수업하기 · ${done.idx + 1}번 슬라이드` : '수업 시작'),
          done.idx ? h('a', { class: 'ghost big', href: `/${PATH[1]}/${L.no}/class`, onclick: () => jset('eth2_' + LID, {}) }, '처음부터') : null))),
    h('main', { class: 'home' },
      h('section', { class: 'hm-card pl-card' }, h('h3', {}, '수업 지도안'),
        h('div', { class: 'pl-wrap' }, h('table', { class: 'pl-info' },
          // 지도서 '기본 정보' 표처럼 한 줄에 칸 여럿(학년 | 차시 | 수업 모형) — 행 = [이름, 값] 하나 또는 그 묶음, 짧은 행의 마지막 칸이 남는 폭을 채운다
          h('tbody', {}, infoRows.map(r => h('tr', {}, r.map(([k, v], j) => [h('th', { scope: 'row' }, k),
            h('td', { colspan: j === r.length - 1 && r.length < infoCols ? 2 * (infoCols - r.length) + 1 : false }, planLines(v))]))))))),
      h('section', { class: 'hm-card pl-card' }, h('h3', {}, `교수·학습 과정 · ${L.minutes}분`),
        h('div', { class: 'flow' }, (L.phases || []).map(p => h('div', { class: 'ph', style: `flex:${p.min}` }, h('b', {}, p.name),
          h('small', {}, `${p.min}분 · ${L.slides.filter(s => s.phase === p.name).length}장`)))),
        h('div', { class: 'pl-wrap' }, h('table', { class: 'pl-steps' },
          h('thead', {}, h('tr', {}, [sess ? '차시' : null, '단계', '학습 과정', '교수·학습 활동', '시간', '자료(▶) 및 유의점(※)'].filter(Boolean).map(t => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, rows))),
        // 원문 준비물엔 학생 기기·QR이 있을 수 있지만 이 디지털 교과서는 교사 화면 하나로 진행한다(2026-10-06)
        h('p', { class: 'pl-note' }, `시간은 이 디지털 교과서의 슬라이드 진행 기준입니다. 교실 TV(또는 전자칠판) 하나로 진행하며 슬라이드 ${L.slides.length}장${acts ? `, 활동 ${acts}개` : ''}입니다.`)),
      dl.length ? h('section', { class: 'hm-card pl-card' }, h('h3', {}, '관련 자료'),
        h('ul', { class: 'dl-list' }, dl.map(e => {
          const name = e.file.split('/').pop(), ext = name.split('.').pop().toLowerCase();
          const url = files.base + e.file.split('/').map(encodeURIComponent).join('/');
          return h('li', {}, h('span', { class: `dl-ext dl-${ext}` }, ext.toUpperCase()),
            h('span', { class: 'dl-tx' }, h('b', {}, e.label), h('small', {}, `${name} · ${fmtSize(e.size)}`)),
            ext === 'html' ? h('a', { class: 'ghost', href: url, target: '_blank', rel: 'noopener' }, '열기') : null,
            h('a', { class: 'go', href: url, download: name }, '내려받기'));
        }))) : null));
}

// 포털·차시 홈 공통 상단 메뉴·하단 제작 문구(표지와 같은 한 벌)
function siteChrome() {
  const cur = PATH[1];
  document.body.prepend(h('header', { class: 'site-nav' }, h('div', { class: 'sn-in' },
    h('a', { class: 'sn-brand', href: '/' }, h('i', {}, 'AI'), 'AI 윤리 디지털 교과서'),
    h('nav', {}, [['e', '초등'], ['m', '중등'], ['h', '고등']].map(([k, t]) => h('a', { href: `/${k}/`, class: k === cur ? 'on' : '' }, t))))));
  document.body.append(h('footer', { class: 'site-foot' }, h('div', { class: 'sn-in' },
    h('p', {}, '이 자료는 광주광역시교육청 AI교육원과 광주교육대학교 산학협력단이 함께 개발한 AI 윤리 교수·학습 자료입니다.'),
    h('small', {}, '삽화·영상은 AI로 제작했습니다'))));
}

window.addEventListener('DOMContentLoaded', () => {
  if (['portal', 'home'].includes(document.body.dataset.page)) siteChrome();
  const run = { class: classMain, portal: portalMain, home: homeMain }[document.body.dataset.page];
  run && run().catch(e => $('#app').replaceChildren(h('p', { class: 'look' }, '화면을 불러오지 못했어요. 새로고침해 주세요.'), h('small', {}, e.message)));
});
