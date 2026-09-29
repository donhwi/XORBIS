(function () {
  'use strict';

  var root = document.documentElement;
  var hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var SVGNS = 'http://www.w3.org/2000/svg';

  if (!hasGsap || reduce) root.classList.remove('js-motion');

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function mmss(sec) {
    sec = Math.round(sec);
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---------- 정적 도식 생성 ---------- */

  // 쿼터뷰 바닥 0.5m 격자 (10×10m → 20칸)
  $$('.floorgrid').forEach(function (g) {
    var cx = 300, cy = 70, a = 19, b = 11;
    for (var i = 1; i < 20; i++) {
      var t = i / 2;
      el('line', { x1: cx + t * a, y1: cy + t * b, x2: cx + t * a - 10 * a, y2: cy + t * b + 10 * b }, g);
      el('line', { x1: cx - t * a, y1: cy + t * b, x2: cx - t * a + 10 * a, y2: cy + t * b + 10 * b }, g);
    }
  });

  // ② 락 7쌍
  var LOCK_X = [150, 240, 330, 420, 510, 600, 690];
  var P1 = [11, 16, 17, 20, 24, 26, 28];
  var P2 = [140, 170, 220, 260, 290, 300, 310];
  var locksG = $('#svg-sync .locks');
  var lockEls = [];
  if (locksG) {
    LOCK_X.forEach(function (x, i) {
      var g = el('g', { class: 'lock' }, locksG);
      el('line', { x1: x, y1: 98, x2: x, y2: 202, stroke: '#2EF2C4', 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: .7, class: 'lock__line' }, g);
      var icon = el('g', { class: 'lock__icon', fill: '#000', stroke: '#2EF2C4', 'stroke-width': 1.3 }, g);
      el('path', { d: 'M' + (x - 4) + ' 146 v-4 a4 4 0 0 1 8 0 v4', fill: 'none' }, icon);
      el('rect', { x: x - 7, y: 146, width: 14, height: 11 }, icon);
      el('circle', { cx: x, cy: 90, r: 3.5, fill: '#000', stroke: '#2EF2C4', 'stroke-width': 1.3 }, g);
      el('circle', { cx: x, cy: 210, r: 3.5, fill: '#000', stroke: '#2EF2C4', 'stroke-width': 1.3 }, g);
      var t1 = el('text', { x: x, y: 74, 'font-size': 12, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle' }, g); t1.textContent = P1[i];
      var t2 = el('text', { x: x, y: 238, 'font-size': 12, 'font-weight': 700, fill: '#fff', 'text-anchor': 'middle' }, g); t2.textContent = P2[i];
      lockEls.push(g);
    });
  }

  // 한전 기기 20대 (운영 14, 예비 6)
  var devG = $('#svg-kepco .devices');
  var devs = [];
  if (devG) {
    for (var r = 0; r < 4; r++) {
      el('path', { d: 'M290 ' + (65 + r * 78) + ' H330', stroke: '#2EF2C4', 'stroke-width': 1, opacity: .45, fill: 'none', class: 'branch' }, devG);
    }
    for (var i = 0; i < 20; i++) {
      var col = i % 5, row = Math.floor(i / 5);
      var x = 330 + col * 84, y = 40 + row * 78;
      var on = i < 14;
      var g = el('g', { class: 'dev ' + (on ? 'on' : 'off'), 'data-cx': x, 'data-cy': y + 25 }, devG);
      // 불투명 바탕: 미러링 선이 기기 뒤로 지나가게 가린다
      el('rect', { x: x, y: y, width: 64, height: 50, fill: '#000', class: 'dev__base' }, g);
      el('rect', on
        ? { x: x, y: y, width: 64, height: 50, fill: 'rgba(46,242,196,.08)', stroke: '#2EF2C4', 'stroke-width': 1.2 }
        : { x: x, y: y, width: 64, height: 50, fill: 'none', stroke: '#444', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, g);
      el('rect', { x: x + 20, y: y + 17, width: 24, height: 11, rx: 3, fill: 'none', stroke: on ? '#2EF2C4' : '#444', 'stroke-width': 1.2 }, g);
      var lab = el('text', { x: x + 6, y: y + 45, 'font-size': 9, fill: on ? '#bfbfbf' : '#555' }, g);
      lab.textContent = (i < 9 ? '0' : '') + (i + 1);
      devs.push(g);
    }
  }

  /* ---------- 공통 인터랙션 (모션 설정과 무관) ---------- */

  // 스포트라이트 테두리
  $$('[data-spot]').forEach(function (n) {
    n.addEventListener('pointermove', function (e) {
      var b = n.getBoundingClientRect();
      n.style.setProperty('--mx', (e.clientX - b.left) + 'px');
      n.style.setProperty('--my', (e.clientY - b.top) + 'px');
    });
  });

  // 계룡 스테이지: 4종 도면을 차례로 그리고, 아래 탭에 진행 막대를 채운다. 탭에 올리면 그 도면에서 멈춘다
  (function () {
    var stage = $('.stage'), vr4 = $('.vr4');
    if (!stage || !vr4) return;
    var arts = $$('.st-art', stage), tabs = $$('.vr4 li', vr4);
    var lb = $('.st-lb', stage), no = $('.st-no', stage);
    var LABELS = ['ARMY · SIDE VIEW', 'NAVY · SIDE VIEW', 'AIR FORCE · TOP VIEW', 'DMZ · 4 PLAYERS'];
    var DUR = [4, 4, 4, 6.5];
    var motion = hasGsap && !reduce;
    var cur = 0, held = false, active = false, tl = null;

    function show(i) {
      cur = i;
      arts.forEach(function (a, k) { a.classList.toggle('is-on', k === i); });
      tabs.forEach(function (t, k) { t.classList.toggle('is-on', k === i); });
      stage.classList.toggle('is-dmz', i === 3);
      lb.textContent = LABELS[i];
      no.textContent = '0' + (i + 1) + ' / 04';
      if (!motion) return;
      if (tl) tl.kill();
      gsap.set($$('.vr4__prog', vr4), { scaleX: 0 });
      var art = arts[i];
      tl = gsap.timeline({ paused: !active });
      tl.fromTo($$('.d', art), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out', stagger: .1 }, 0);
      if (i === 3) {
        var ta = $$('.ta', art), tb = $$('.tb', art);
        tl.fromTo('#st-clip rect', { attr: { height: 0 } }, { attr: { height: 146 }, duration: .8, ease: 'expo.out' }, .6)
          .fromTo(ta.concat(tb), { opacity: 0 }, { opacity: 1, duration: .3 }, .9);
        // [시작점, 꺾이는 점, 도착점]: 두 명씩 한 팀이 가로로 간 뒤 직각으로 꺾어 가운데로 들어간다
        [[ta[0], 200, 34, 126, 34, 126, 84], [ta[1], 210, 34, 126, 34, 126, 74],
         [tb[0], 40, 150, 114, 150, 114, 98], [tb[1], 30, 150, 114, 150, 114, 108]].forEach(function (d) {
          tl.set(d[0], { attr: { cx: d[1], cy: d[2] } }, 0)
            .to(d[0], { attr: { cx: d[3] }, duration: 1.3, ease: 'power1.inOut' }, 1.3)
            .to(d[0], { attr: { cy: d[6] }, duration: .9, ease: 'power1.inOut' }, 2.65);
        });
      }
      if (held) { gsap.set($('.vr4__prog', tabs[i]), { scaleX: 1 }); return; }
      tl.fromTo($('.vr4__prog', tabs[i]), { scaleX: 0 }, { scaleX: 1, duration: DUR[i], ease: 'none' }, 0)
        .call(function () { show((cur + 1) % 4); });
    }

    tabs.forEach(function (t, k) {
      t.addEventListener('click', function () { held = false; show(k); });
      t.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse') return; held = true; show(k); });
    });
    vr4.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'mouse' || !held) return; held = false; show(cur); });
    if (!motion) return;

    var scan = gsap.fromTo($('.st-scan', stage), { attr: { y: 0 } }, { attr: { y: 298 }, duration: 3.2, ease: 'none', repeat: -1, paused: true });
    // 포인터를 따라 도면이 살짝 따라 움직인다
    if (finePointer) {
      var par = $('.st-par', stage);
      stage.addEventListener('pointermove', function (e) {
        var b = stage.getBoundingClientRect();
        gsap.to(par, { x: ((e.clientX - b.left) / b.width - .5) * 16, y: ((e.clientY - b.top) / b.height - .5) * 10, duration: .6, ease: 'power2.out' });
      });
      stage.addEventListener('pointerleave', function () { gsap.to(par, { x: 0, y: 0, duration: .8, ease: 'power2.out' }); });
    }
    show(0);
    ScrollTrigger.create({ trigger: stage, start: 'top 85%', end: 'bottom top', onToggle: function (st) {
      active = st.isActive;
      if (active) { if (tl) tl.play(); scan.play(); } else { if (tl) tl.pause(); scan.pause(); }
    } });
  })();

  // 한전 미러링 경로
  var mirror = $('#svg-kepco .mirror');
  var fnMir = $('#svg-kepco .fn-mir');
  function showMirror(g) {
    if (!mirror || !g.classList.contains('on')) return;
    var cx = +g.getAttribute('data-cx'), cy = +g.getAttribute('data-cy');
    mirror.setAttribute('d', 'M240 190 H290 V' + cy + ' H' + cx);
    if (fnMir) fnMir.classList.add('is-lit');
    if (hasGsap && !reduce) {
      var len = mirror.getTotalLength();
      gsap.fromTo(mirror, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: .45, ease: 'power3.out' });
    }
  }
  function hideMirror() {
    if (!mirror) return;
    mirror.setAttribute('d', '');
    if (fnMir) fnMir.classList.remove('is-lit');
  }
  devs.forEach(function (g) {
    g.addEventListener('pointerenter', function () { showMirror(g); });
    g.addEventListener('pointerleave', hideMirror);
    g.addEventListener('click', function () { showMirror(g); });
  });

  // 엘리스 플레이어
  var player = $('[data-player]');
  var pVideo = player && $('.player__video', player);
  function playFull(at) {
    if (!pVideo) return;
    player.classList.add('is-playing');
    pVideo.controls = true;
    var go = function () {
      if (typeof at === 'number') pVideo.currentTime = at;
      pVideo.play().catch(function () {});
    };
    if (pVideo.readyState >= 1) go();
    else { pVideo.preload = 'auto'; pVideo.addEventListener('loadedmetadata', go, { once: true }); pVideo.load(); }
  }
  if (player) {
    $('.player__play', player).addEventListener('click', function () { playFull(); });
    $$('[data-seek]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = +b.getAttribute('data-seek');
        if (lenis) lenis.scrollTo(player, { offset: -80, duration: 1.2 });
        else player.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        playFull(t);
      });
    });
  }

  // 히어로 영상
  var heroVideo = $('.hero__video');

  /* ---------- 모션을 쓰지 않는 경우 ---------- */
  var lenis = null;
  if (!hasGsap || reduce) {
    if (heroVideo) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); }
    $$('[data-count]').forEach(function (n) { n.textContent = mmss(+n.getAttribute('data-count')); });
    if (hasGsap) {
      gsap.set('.wrist__front', { autoAlpha: 0 });
      gsap.set('.wrist__side', { opacity: 1 });
      gsap.set('.wrist__beam, .wrist__panel', { opacity: 1 });
      var ang = $('[data-angle]'); if (ang) ang.textContent = '90';
    } else {
      $$('.wrist__side, .wrist__beam, .wrist__panel').forEach(function (n) { n.style.opacity = 1; });
      var fr = $('.wrist__front'); if (fr) fr.style.opacity = 0;
    }
    $$('#svg-flow .node').forEach(function (n) { n.style.opacity = 1; });
    return;
  }

  /* ---------- 모션 ---------- */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
  gsap.ticker.lagSmoothing(0);

  // 앵커 이동
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: id === '#top' ? 0 : -60, duration: 1.4 });
    });
  });

  // 해독(decode) 효과: 글자가 기호에서 원래 글자로 풀린다
  var GLYPHS = '#/_01XR<>';
  function decode(node, duration) {
    if (!node) return;
    var final = node.getAttribute('data-final');
    if (!final) { final = node.textContent; node.setAttribute('data-final', final); }
    if (node._tw) node._tw.kill();
    var o = { p: 0 }, lastTick = -1;
    node._tw = gsap.to(o, {
      p: 1, duration: (duration || 900) / 1000, ease: 'none',
      onUpdate: function () {
        var tick = Math.floor(o.p * (duration || 900) / 35);
        if (tick === lastTick) return;
        lastTick = tick;
        var n = Math.floor(o.p * final.length), out = final.slice(0, n);
        for (var i = n; i < final.length; i++) {
          var c = final[i];
          out += (c === ' ' || c === '·') ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        node.textContent = out;
      },
      onComplete: function () { node.textContent = final; }
    });
  }

  function prepDraw(nodes) {
    nodes.forEach(function (n) {
      var len = n.getTotalLength ? n.getTotalLength() : 0;
      if (n.tagName === 'polygon') { var p = n.points; len = 0; for (var i = 0; i < p.numberOfItems; i++) { var a = p.getItem(i), b = p.getItem((i + 1) % p.numberOfItems); len += Math.hypot(b.x - a.x, b.y - a.y); } }
      n.style.strokeDasharray = len;
      n.style.strokeDashoffset = len;
    });
    return nodes;
  }

  var mm = gsap.matchMedia();

  mm.add({ desktop: '(min-width: 1024px)', mobile: '(max-width: 1023px)' }, function (ctx) {
    var isDesk = ctx.conditions.desktop;

    /* 진행 막대 */
    gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

    /* NAV: 내리면 숨고 올리면 나타난다 */
    var nav = $('[data-nav]');
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        var y = self.scroll();
        nav.classList.toggle('is-hidden', self.direction === 1 && y > 240);
        nav.classList.toggle('is-solid', y > 80);
      }
    });
    var links = $$('[data-link]');
    $$('[data-section]').forEach(function (sec) {
      ScrollTrigger.create({
        trigger: sec, start: 'top 50%', end: 'bottom 50%',
        onToggle: function (self) {
          if (!self.isActive) return;
          var key = sec.getAttribute('data-section');
          links.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('data-link') === key); });
        }
      });
    });

    /* HERO 진입 */
    var hero = gsap.timeline({ defaults: { ease: 'expo.out' } });
    hero
      .set('.hero__scan', { transformOrigin: '50% 0%' })
      .to('.hero__scan', { scaleY: 1, duration: .8, ease: 'power2.inOut' })
      .to('.hero__scan', { opacity: .35, duration: .6 }, '>-0.1')
      .fromTo('.hero__video', { scale: 1.18 }, { scale: 1.02, duration: 2.2 }, 0)
      .fromTo('.hero__title .line > span', { y: 0, yPercent: 110 }, {
        yPercent: 0, duration: 1.1, stagger: .15,
        onStart: function () { $$('.hero__title [data-decode]').forEach(function (n, i) { gsap.delayedCall(i * .15, decode, [n, 900]); }); }
      }, .45)
      .to('.hero__for', { opacity: 1, duration: .8, onStart: function () { decode($('.hero__for .decode'), 700); } }, .6)
      .fromTo('.hero__tags li', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .7, stagger: .06 }, .9)
      .fromTo('.hero__who', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .8 }, 1.1)
      .fromTo('.skills div', { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: .8, stagger: .07 }, 1.0);

    if (heroVideo) {
      heroVideo.play().catch(function () {});
      ScrollTrigger.create({
        trigger: '.hero', start: 'top top', end: 'bottom top',
        onToggle: function (self) { if (self.isActive) heroVideo.play().catch(function () {}); else heroVideo.pause(); }
      });
    }

    // 스크롤하면 영상 프레임이 안쪽으로 접힌다
    gsap.fromTo('.hero__media', { clipPath: 'inset(0% 0% 0% 0%)' }, {
      clipPath: isDesk ? 'inset(0% 4% 14% 4%)' : 'inset(0% 0% 10% 0%)', ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.4 }
    });
    gsap.to('.hero__inner', {
      yPercent: -18, opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: '30% top', end: 'bottom top', scrub: 0.4 }
    });

    /* 마키: 스크롤 속도만큼 빨라진다 */
    var track = $('.marquee__track');
    var mq = gsap.to(track, { xPercent: -50, duration: isDesk ? 38 : 26, ease: 'none', repeat: -1 });
    ScrollTrigger.create({ trigger: '.marquee', start: 'top bottom', end: 'bottom top', onToggle: function (s) { s.isActive ? mq.play() : mq.pause(); } });
    var boost = gsap.quickTo(mq, 'timeScale', { duration: .6, ease: 'power3.out' });
    lenis.on('scroll', function (e) { boost(1 + Math.min(Math.abs(e.velocity) / 8, 3)); });

    /* 섹션 헤드라인 줄 마스크 */
    $$('.h2, .h3, .contact__title').forEach(function (h) {
      if (h.closest('.hero')) return;
      gsap.fromTo($$('.line > span', h), { y: 0, yPercent: 110 }, {
        yPercent: 0, duration: 1, ease: 'expo.out', stagger: .08,
        scrollTrigger: { trigger: h, start: 'top 85%' }
      });
    });

    /* 본문 블록 올라오기 */
    gsap.utils.toArray('.case__side, .dive__text, .legend, .rbac__list, .about__lead, .how__lead, .course, .contact__mail, .contact__note').forEach(function (n) {
      gsap.from(n, { opacity: 0, y: 32, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: n, start: 'top 85%' } });
    });
    ScrollTrigger.batch('.vr4 li, .card, .timeline li, .facts li', {
      start: 'top 88%',
      onEnter: function (b) { gsap.fromTo(b, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .08, overwrite: true }); }
    });
    gsap.set('.vr4 li, .card, .timeline li, .facts li', { opacity: 0 });

    /* WORK 타일: 아래에서 위로 열린다 */
    ScrollTrigger.batch('.tile', {
      start: 'top 85%',
      onEnter: function (b) {
        gsap.fromTo(b, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power4.out', stagger: .12, clearProps: 'clipPath' });
        gsap.fromTo(b.map(function (t) { return $('.tile__media > *', t); }), { scale: 1.15 }, { scale: 1, duration: 1.4, ease: 'expo.out', stagger: .12, clearProps: 'transform' });
      }
    });
    gsap.set('.tile', { clipPath: 'inset(100% 0% 0% 0%)' });

    $$('.tile').forEach(function (t) {
      var sub = $('[data-decode-hover]', t);
      t.addEventListener('pointerenter', function () { if (sub) decode(sub, 520); });
    });

    // 엘리스 타일: 올리면 루프 영상 미리보기
    if (finePointer) {
      $$('[data-preview]').forEach(function (t) {
        var v;
        t.addEventListener('pointerenter', function () {
          if (!v) {
            v = document.createElement('video');
            v.src = 'assets/video/alice-loop.mp4'; v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('aria-hidden', 'true');
            $('.tile__media', t).appendChild(v);
          }
          v.currentTime = 0; v.play().catch(function () {});
          t.classList.add('is-previewing');
        });
        t.addEventListener('pointerleave', function () { t.classList.remove('is-previewing'); if (v) v.pause(); });
      });
    }

    /* 자석 버튼 */
    if (finePointer) {
      $$('[data-magnetic]').forEach(function (b) {
        var qx = gsap.quickTo(b, 'x', { duration: .5, ease: 'power3.out' });
        var qy = gsap.quickTo(b, 'y', { duration: .5, ease: 'power3.out' });
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect();
          qx((e.clientX - (r.left + r.width / 2)) * .3);
          qy((e.clientY - (r.top + r.height / 2)) * .3);
        });
        b.addEventListener('pointerleave', function () { gsap.to(b, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1, 0.4)' }); });
      });
    }

    /* DMZ ① 플레이 구조: 스크롤에 맞춰 선이 그려진다 */
    (function () {
      var svg = $('#svg-play'); if (!svg) return;
      var grid = prepDraw($$('.floorgrid line', svg));
      var draws = prepDraw($$('[data-draw]', svg));
      var tl = gsap.timeline({ scrollTrigger: { trigger: '#dmz-play', start: 'top 80%', end: 'center 50%', scrub: 0.6 } });
      tl.to(draws[0], { strokeDashoffset: 0, duration: 1, ease: 'none' })
        .to(grid, { strokeDashoffset: 0, duration: .8, stagger: .02, ease: 'none' }, .2)
        .to(draws.slice(1, 3), { strokeDashoffset: 0, duration: .6, stagger: .15, ease: 'none' }, .9)
        .from($$('.players use', svg), { opacity: 0, duration: .5, stagger: .12 }, 1.2)
        .to(draws.slice(3), { strokeDashoffset: 0, duration: .6, stagger: .1, ease: 'none' }, 1.6)
        .from($$('.labels > *', svg), { opacity: 0, duration: .5, stagger: .08 }, 1.8);

      if (finePointer) {
        var fig = svg.parentNode;
        var rx = gsap.quickTo(svg, 'rotationX', { duration: .8, ease: 'power3.out' });
        var ry = gsap.quickTo(svg, 'rotationY', { duration: .8, ease: 'power3.out' });
        fig.addEventListener('pointermove', function (e) {
          var r = fig.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - .5) * 10);
          rx(-((e.clientY - r.top) / r.height - .5) * 8);
        });
        fig.addEventListener('pointerleave', function () { rx(0); ry(0); });
      }
    })();

    /* DMZ ② 동기화: 먼저 온 팀이 락에서 기다리고, 그동안 적이 다시 생성된다 */
    (function () {
      var svg = $('#svg-sync'); if (!svg) return;
      var lanes = prepDraw($$('[data-draw]', svg));
      var r1 = $('.r1', svg), r2 = $('.r2', svg), ring = $('.respawn', svg);
      var timers = $$('[data-count]');
      var tl = gsap.timeline({ scrollTrigger: { trigger: '#dmz-sync', start: 'top 65%' } });
      tl.to(lanes, { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut', stagger: .1 })
        .from(lockEls.map(function (g) { return $('.lock__line', g); }), { scaleY: 0, transformOrigin: '50% 50%', duration: .5, stagger: .06, ease: 'power3.out' }, .5)
        .from(lockEls.map(function (g) { return $('.lock__icon', g); }), { opacity: 0, y: -6, duration: .4, stagger: .06 }, .7)
        .from(lockEls.map(function (g) { return $$('text', g); }), { opacity: 0, duration: .4, stagger: .04 }, .8);

      var t0 = tl.duration() + .2, t = t0;
      LOCK_X.forEach(function (x, i) {
        var p1First = i % 2 === 0;
        var fast = p1First ? r1 : r2, slow = p1First ? r2 : r1;
        var fastY = p1First ? 90 : 210;
        tl.to(fast, { attr: { cx: x }, duration: .35, ease: 'power2.inOut' }, t)
          .to(slow, { attr: { cx: x }, duration: .75, ease: 'power2.inOut' }, t)
          .fromTo(ring, { attr: { cx: x - 22, cy: fastY, r: 6 }, opacity: .9 }, { attr: { r: 18 }, opacity: 0, duration: .4, ease: 'power2.out' }, t + .35)
          .to($('.lock__icon', lockEls[i]), { fill: '#2EF2C4', duration: .15, yoyo: true, repeat: 1 }, t + .75);
        t += .85;
      });
      tl.to(r1, { attr: { cx: 730 }, duration: .35, ease: 'power2.in' }, t)
        .to(r2, { attr: { cx: 730 }, duration: .6, ease: 'power2.in' }, t);
      var end1 = t + .35, end2 = t + .6;
      timers.forEach(function (n, i) {
        var target = +n.getAttribute('data-count'), o = { v: 0 };
        tl.to(o, { v: target, duration: (i === 0 ? end1 : end2) - t0, ease: 'none', onUpdate: function () { n.textContent = mmss(o.v); } }, t0);
      });
    })();

    /* DMZ ③ 두 팀이 각자 트리거 → 이벤트 → 네비를 지나 마지막 공간에서 만난다 */
    (function () {
      var svg = $('#svg-flow'); if (!svg) return;
      var steps = $$('#dmz-flow .steps li');
      var routes = { A: $('#routeA', svg), B: $('#routeB', svg) };
      var lens = { A: routes.A.getTotalLength(), B: routes.B.getTotalLength() };
      var dots = { A: $$('.ta', svg), B: $$('.tb', svg) };
      var pos = { A: { p: 0 }, B: { p: 0 } };
      // 트리거와 네비 지점까지의 경로 비율
      var at = { A: 305 / lens.A, B: 305 / lens.B };
      var nodes = $$('.node', svg), meet = $$('.meet, .meet-label', svg), fin = $('.final', svg);
      function node(kind, team) { return $('.n-' + kind + '[data-team="' + team + '"]', svg); }
      function place(team) {
        var L = lens[team], d = pos[team].p * L;
        dots[team].forEach(function (c, i) {
          var pt = routes[team].getPointAtLength(Math.max(0, d - i * 16));
          c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y);
        });
      }
      function lit(idx) { return function () { steps.forEach(function (s, i) { s.classList.toggle('is-lit', i === idx); }); }; }
      function arrive(team) {
        return gsap.timeline()
          .to(node('trigger', team), { opacity: 1, duration: .25 })
          .call(lit(0))
          .to(node('event', team), { opacity: 1, duration: .2 }, .3)
          .fromTo($$('path', node('event', team)), { scale: .3, transformOrigin: '50% 50%' }, { scale: 1, duration: .4, ease: 'back.out(2.4)', stagger: .07 }, .3)
          .call(lit(1), null, .3)
          .to(node('nav', team), { opacity: 1, duration: .25 }, .7)
          .call(lit(2), null, .7);
      }
      function walk(team, to, dur) {
        return gsap.to(pos[team], { p: to, duration: dur, ease: 'power1.inOut', onUpdate: function () { place(team); } });
      }
      gsap.set('#svg-flow .froute', { opacity: 0 });
      var loop = gsap.timeline({ repeat: -1, repeatDelay: .8, paused: true });
      loop.set(nodes, { opacity: .25 })
        .set(meet, { opacity: 0 })
        .set(fin, { opacity: .6 })
        .set([pos.A, pos.B], { p: 0 })
        .call(function () { place('A'); place('B'); lit(-1)(); })
        .set(dots.A.concat(dots.B), { opacity: 1 })
        // 출발 지점과 걸리는 시간이 서로 다르다
        .add(walk('A', at.A, 1.5), 0)
        .add(walk('B', at.B, 2.1), .2)
        .add(arrive('A'), 1.5)
        .add(arrive('B'), 2.3)
        .add(walk('A', 1, 1.4), 2.5)
        .add(walk('B', 1, 1.5), 3.3)
        // 먼저 온 팀이 기다리고, 네 명이 모이면 마지막 공간이 열린다
        .to(fin, { opacity: 1, duration: .3 }, 4.8)
        .fromTo('#svg-flow .meet', { opacity: 1, scale: .4, transformOrigin: '50% 50%' }, { scale: 1, duration: .6, ease: 'expo.out' }, 4.8)
        .to('#svg-flow .meet-label', { opacity: 1, duration: .3 }, 4.9)
        .call(lit(-1), null, 4.8)
        .to({}, { duration: 1.6 })
        .to(dots.A.concat(dots.B).concat(meet), { opacity: 0, duration: .4 });
      gsap.to('#svg-flow .froute', { opacity: .7, duration: 1, scrollTrigger: { trigger: '#dmz-flow', start: 'top 70%' } });
      ScrollTrigger.create({
        trigger: '#dmz-flow', start: 'top 70%', end: 'bottom 20%',
        onToggle: function (s) { s.isActive ? loop.play() : loop.pause(); }
      });
    })();

    /* DMZ ④ 손목 네비: 컨트롤러를 90° 꺾으면 네비가 뜨고, 되돌리면 사라진다. 보이는 동안 자동 반복 */
    (function () {
      var sec = $('#dmz-wrist'); if (!sec) return;
      var ang = $('[data-angle]'), a = { v: 0 };
      gsap.set('.wrist__side', { opacity: 0, rotationX: 70 });
      gsap.set('.wrist__beam', { opacity: 0, scaleY: 0, transformOrigin: '50% 100%' });
      gsap.set('.wrist__panel', { opacity: 0, scale: .5, transformOrigin: '50% 100%' });
      var tl = gsap.timeline({ paused: true, repeat: -1, yoyo: true, repeatDelay: .5 });
      tl.to({}, { duration: .5 })
        .to('.wrist__front', { rotation: 90, duration: 1.1, ease: 'power2.inOut' })
        .to(a, { v: 90, duration: 1.1, ease: 'power2.inOut', onUpdate: function () { ang.textContent = Math.round(a.v); } }, '<')
        .to('.wrist__front', { opacity: 0, duration: .35, ease: 'none' }, '-=.3')
        .to('.wrist__side', { opacity: 1, rotationX: 0, duration: .6, ease: 'power3.out' }, '<')
        .to('.wrist__beam', { opacity: 1, scaleY: 1, duration: .45, ease: 'power2.out' }, '-=.1')
        .to('.wrist__panel', { opacity: 1, scale: 1, duration: .5, ease: 'back.out(2.2)' }, '-=.3')
        .to({}, { duration: 1.8 });
      ScrollTrigger.create({
        trigger: '.wrist__stage', start: 'top 85%', end: 'bottom 15%',
        onToggle: function (s) { s.isActive ? tl.play() : tl.pause(); }
      });
    })();

    /* 엘리스: 프레임이 스크롤에 맞춰 넓어진다 */
    gsap.fromTo('.player__frame', { clipPath: isDesk ? 'inset(6% 6% 6% 6%)' : 'inset(4% 4% 4% 4%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: '.player', start: 'top 95%', end: 'top 45%', scrub: 0.5 }
    });
    $$('[data-count-to]').forEach(function (n) {
      var to = +n.getAttribute('data-count-to'), o = { v: 0 };
      n.textContent = '0';
      gsap.to(o, { v: to, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: n, start: 'top 88%' }, onUpdate: function () { n.textContent = Math.round(o.v); } });
    });
    ScrollTrigger.batch('.course__strip li', {
      start: 'top 90%',
      onEnter: function (b) { gsap.fromTo(b, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .06 }); }
    });
    gsap.set('.course__strip li', { opacity: 0 });

    /* 한전: 기기가 켜지고 운영 기기가 숨 쉬듯 깜빡인다 */
    (function () {
      var svg = $('#svg-kepco'); if (!svg) return;
      var buses = prepDraw($$('[data-draw]', svg));
      var tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 70%' } });
      tl.from('#svg-kepco .console', { opacity: 0, x: -20, duration: .7, ease: 'expo.out' })
        .to(buses, { strokeDashoffset: 0, duration: .6, stagger: .1, ease: 'power2.inOut' }, .3)
        .from('#svg-kepco .branch', { opacity: 0, duration: .3, stagger: .05 }, .7)
        .from(devs, { opacity: 0, scale: .7, transformOrigin: '50% 50%', duration: .5, stagger: { each: .04, from: 'start' }, ease: 'back.out(1.6)' }, .8)
        .from('#svg-kepco .fn', { opacity: 0, x: -10, duration: .4, stagger: .1 }, .6);
      var breathe = gsap.to(devs.filter(function (g) { return g.classList.contains('on'); }).map(function (g) { return g.children[1]; }), {
        fillOpacity: .25, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: { each: .2, from: 'random' }, paused: true
      });
      ScrollTrigger.create({ trigger: svg, start: 'top 80%', end: 'bottom 10%', onToggle: function (s) { s.isActive ? breathe.play() : breathe.pause(); } });
    })();

    /* BIOPOP: 권한 선이 위에서 아래로 그려진다 */
    (function () {
      var svg = $('#svg-rbac'); if (!svg) return;
      var lines = prepDraw($$('[data-draw]', svg));
      var nodes = $$('.rnodes circle', svg);
      var tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 70%' } });
      tl.from(nodes[0], { scale: 0, transformOrigin: '50% 50%', duration: .5, ease: 'back.out(2)' })
        .to(lines.slice(0, 2), { strokeDashoffset: 0, duration: .5, ease: 'power2.out' }, .3)
        .from(nodes.slice(1, 3), { scale: 0, transformOrigin: '50% 50%', duration: .5, ease: 'back.out(2)', stagger: .08 }, .7)
        .to(lines.slice(2), { strokeDashoffset: 0, duration: .5, ease: 'power2.out', stagger: .05 }, 1)
        .from(nodes.slice(3), { scale: 0, transformOrigin: '50% 50%', duration: .45, ease: 'back.out(2)', stagger: .06 }, 1.35)
        .from('#svg-rbac .tenants rect', { opacity: 0, duration: .6, stagger: .15 }, 1.5)
        .from('#svg-rbac text', { opacity: 0, duration: .4, stagger: .03 }, 1.2);
    })();

    /* HOW I WORK ① 노션: 태스크가 컨펌대기에서 한 번 반려됐다가 승인을 받아 완료로 간다 */
    (function () {
      var svg = $('#svg-notion'); if (!svg) return;
      var card = $('.ncard', svg), box = $('.ncard__box', svg), chips = $('.nchips', svg);
      var no = $('.nstamp--no', svg), ok = $('.nstamp--ok', svg), heads = $$('.nh', svg);
      function hl(i) { return function () { heads.forEach(function (h) { h.classList.toggle('is-on', +h.getAttribute('data-col') === i); }); }; }
      function move(x, d) { return { x: x, duration: d || .7, ease: 'power2.inOut' }; }
      var tl = gsap.timeline({ repeat: -1, repeatDelay: .6, paused: true });
      tl.set(card, { x: 18, y: 214, opacity: 1 })
        .set(box, { fill: '#0b0b0b', stroke: '#8a8a8a' })
        .set([chips, no, ok], { opacity: 0 })
        .call(hl(0))
        .to(card, move(144), .6).call(hl(1), null, .9)
        .to(card, move(270), 1.8).call(hl(2), null, 2.1)
        .to(box, { stroke: '#2EF2C4', duration: .3 }, 2.3)
        .to(chips, { opacity: 1, duration: .3 }, 2.5)
        .to(no, { opacity: 1, duration: .25 }, 3.1)
        .to(card, move(396), 3.7).call(hl(3), null, 4)
        .to(no, { opacity: 0, duration: .25 }, 3.8)
        .to(box, { stroke: '#8a8a8a', duration: .3 }, 3.8)
        .to(card, move(270), 5).call(hl(2), null, 5.3)
        .to(box, { stroke: '#2EF2C4', duration: .3 }, 5.4)
        .to(ok, { opacity: 1, duration: .25 }, 5.8)
        .to(card, move(522, .8), 6.4).call(hl(4), null, 6.8)
        .to(ok, { opacity: 0, duration: .25 }, 6.6)
        .to(box, { fill: '#06221b', duration: .3 }, 7.1)
        .to({}, { duration: 1.2 })
        .to(card, { opacity: 0, duration: .4 });
      ScrollTrigger.create({ trigger: svg, start: 'top 80%', end: 'bottom 10%', onToggle: function (s) { s.isActive ? tl.play() : tl.pause(); } });
    })();

    /* HOW I WORK ② Jira: 상태가 바뀔 때마다 자동화가 기록과 알림을 남기고, 아래에 데이터가 쌓인다 */
    (function () {
      var svg = $('#svg-jira'); if (!svg) return;
      var tok = $('.jtok', svg), bars = $$('.jbar', svg);
      function q(s) { return $(s, svg); }
      function on(cls) { return function () { $$('.jn', svg).forEach(function (n) { n.classList.toggle('is-on', n.classList.contains(cls)); }); }; }
      function lab(cls) { return function () { $$('.jl', svg).forEach(function (n) { n.classList.toggle('is-on', n.classList.contains(cls)); }); }; }
      var toasts = $$('.jt', svg);
      var pop = { opacity: 1, y: 0, duration: .35, ease: 'expo.out' };
      var tl = gsap.timeline({ repeat: -1, repeatDelay: .6, paused: true });
      tl.set(toasts, { opacity: 0, y: 6 })
        .set(bars, { scaleX: 0, transformOrigin: '0% 50%' })
        .set(tok, { attr: { cx: 48, cy: 84 }, opacity: 1 })
        .call(on('jn--doing')).call(lab('none'))
        .to(q('.jt--start'), pop, .4)
        .call(lab('jl--pr'), null, 1.3)
        .to(tok, { attr: { cx: 268 }, duration: .8, ease: 'power2.inOut' }, 1.3)
        .to(q('.jt--start'), { opacity: 0, duration: .3 }, 1.5)
        .call(on('jn--wait'), null, 2.1)
        .to(q('.jt--pr'), pop, 2.1)
        .to(q('.jt--pr'), { opacity: 0, duration: .3 }, 3.2)
        .call(lab('jl--no'), null, 3.3)
        .to(tok, { attr: { cy: 244 }, duration: .7, ease: 'power2.inOut' }, 3.3)
        .call(on('jn--redo'), null, 4)
        .to(q('.jt--no'), pop, 4)
        .to(bars[1], { scaleX: .35, duration: .6, ease: 'power2.out' }, 4)
        .to(q('.jt--no'), { opacity: 0, duration: .3 }, 5.1)
        .call(lab('jl--re'), null, 5.2)
        .to(tok, { attr: { cy: 84 }, duration: .7, ease: 'power2.inOut' }, 5.2)
        .call(on('jn--wait'), null, 5.9)
        .call(lab('jl--ok'), null, 6.3)
        .to(tok, { attr: { cx: 488 }, duration: .8, ease: 'power2.inOut' }, 6.3)
        .call(on('jn--done'), null, 7.1)
        .to(q('.jt--done'), pop, 7.1)
        .to(bars[0], { scaleX: .7, duration: .7, ease: 'power2.out' }, 7.1)
        .to(bars[2], { scaleX: .55, duration: .7, ease: 'power2.out' }, 7.3)
        .to({}, { duration: 1.4 })
        .to([tok, q('.jt--done')], { opacity: 0, duration: .4 });
      ScrollTrigger.create({ trigger: svg, start: 'top 80%', end: 'bottom 10%', onToggle: function (s) { s.isActive ? tl.play() : tl.pause(); } });
    })();

    /* CONTACT 배경 */
    gsap.fromTo('.contact__bg', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
