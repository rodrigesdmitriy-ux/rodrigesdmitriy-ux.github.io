// Page behaviour: rail, first screen, reveals, row of steps, footer crossfade, cookie choice.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = !!(window.gsap && window.ScrollTrigger);

  if (window.Stage) { Stage.smooth({ lerp: 0.1 }); Stage.init(); }

  // rail: its name appears after the first screen, its ground once the scene has left
  const rail = document.querySelector('.rail');
  const hero = document.querySelector('.hero');
  if (rail && hero) {
    const zal = hero.closest('.zal');
    const dock = () => {
      rail.classList.toggle('is-past', scrollY > 10);
      const end = zal.classList.contains('is-live') ? zal : hero;
      rail.classList.toggle('is-solid', end.getBoundingClientRect().bottom < rail.offsetHeight);
    };
    addEventListener('scroll', dock, { passive: true });
    addEventListener('resize', dock);
    dock();
  }
  if (rail) rail.querySelectorAll('.rail__drop a').forEach((a) => a.addEventListener('click', () => rail.querySelector('details').removeAttribute('open')));

  if (hero) {
    // the default key keeps only the laptop and stool, gaps between the legs cut out
    const SHAPES = {
      wide: { size: [1672, 941], lamp: 960, out: [867,166,1152,164,1138,367,1140,376,1148,392,1149,404,1136,425,1098,430,1046,433,1048,646,1066,745,1035,748,1027,633,845,633,818,720,790,722,833,432,793,428,778,410,780,396,784,385,851,358], holes: [[866,433,1016,433,1025,616,857,604]] },
      tall: { size: [720, 1280], lamp: 360, out: [230,477,489,477,489,660,505,700,511,715,505,737,463,743,488,983,460,983,452,879,261,879,252,983,223,983,248,743,211,737,205,715,215,700,230,660], holes: [[275,743,438,743,452,879,261,879]] },
    };
    const shape = () => SHAPES[matchMedia('(orientation: portrait)').matches ? 'tall' : 'wide'];
    const key = hero.querySelector('.hero__key:not(.is-cut) img');
    const clipKey = () => {
      const { size, out, holes } = shape();
      const W = key.clientWidth, H = key.clientHeight, s = Math.max(W / size[0], H / size[1]);
      const ox = (W - size[0] * s) / 2, oy = (H - size[1] * s) / 2;
      const ring = (r) => { const pts = []; for (let i = 0; i < r.length; i += 2) pts.push(`${(ox + r[i] * s).toFixed(1)}px ${(oy + r[i + 1] * s).toFixed(1)}px`); return pts; };
      const o = ring(out), path = [...o, o[0]];
      for (const h of holes) { const r = ring(h); path.push(...r, r[0], o[0]); }
      key.style.clipPath = `polygon(evenodd, ${path.join(',')})`;
    };
    if (key) { clipKey(); addEventListener('resize', clipKey); }

    // the lamp lights the surname; the pointer carries a second light and shifts the depth
    const box = hero.querySelector('.sign');
    const pic = hero.querySelector('.hero__pic');
    const keyBox = hero.querySelector('.hero__key');
    const loop = hero.querySelector('.hero__loop');
    const first = box.querySelector('.sign__first');
    const beam = [0.5, 0.24];
    const aim = () => {
      const { size, lamp } = shape();
      const s = Math.max(innerWidth / size[0], innerHeight / size[1]);
      first.toggleAttribute('data-sign-line', size[0] === 720);
      beam[0] = 0.5 + (lamp / size[0] - 0.5) * size[0] * s / innerWidth;
    };
    let sign = null;
    const light = () => {
      aim();
      sign = window.Sign ? Sign(box, { beam, still: reduced }) : null;
      if (!sign) { box.classList.add('is-plain'); return; }
      if (reduced || !live) { sign.state.on = 1; sign.draw(); return; }
      sign.start();
      const on = sign.state;
      gsap.timeline()
        .to(on, { on: 0.55, duration: 0.1 }, 0.25).to(on, { on: 0.12, duration: 0.08 })
        .to(on, { on: 0.8, duration: 0.09 }).to(on, { on: 0.3, duration: 0.12 })
        .to(on, { on: 1, duration: 1.2, ease: 'power2.out' });
      let wait = 0;
      addEventListener('resize', () => { clearTimeout(wait); wait = setTimeout(() => { aim(); sign.layout(); }, 200); });
      if (!matchMedia('(pointer: coarse)').matches) {
        addEventListener('pointermove', (e) => sign.pointer(e.clientX, e.clientY), { passive: true });
        document.documentElement.addEventListener('pointerleave', () => sign.leave());
      }
    };
    const fonts = document.fonts ? document.fonts.load('900 200px "TikTok Wide"', 'Скалкин') : Promise.resolve();
    fonts.catch(() => {}).then(() => (window.requestIdleCallback || setTimeout)(light));

    if (live && !reduced) {
      const layers = [pic, keyBox].filter(Boolean);
      const hand = !matchMedia('(pointer: coarse)').matches;
      gsap.fromTo(layers, { scale: 1.05 }, { scale: hand ? 1.015 : 1, duration: 2.6, ease: 'expo.out' });
      if (hand) {
        gsap.set(box, { yPercent: -50, y: 0 });
        const moves = [...layers.map((l) => [gsap.quickTo(l, 'x', { duration: 1.1, ease: 'power3' }), gsap.quickTo(l, 'y', { duration: 1.1, ease: 'power3' }), 8]), [gsap.quickTo(box, 'x', { duration: 1.4, ease: 'power3' }), gsap.quickTo(box, 'y', { duration: 1.4, ease: 'power3' }), 5]];
        addEventListener('pointermove', (e) => {
          if (scrollY > 4) return;
          const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
          for (const [mx, my, k] of moves) { mx(-nx * 2 * k); my(-ny * 2 * k); }
        }, { passive: true });
      }
    }

    // hero loop: wide screens only, the still frame stays on phones and for saved data
    const playLoop = loop && !reduced && !navigator.connection?.saveData && matchMedia('(min-width: 1100px) and (orientation: landscape)').matches;
    if (playLoop) {
      loop.addEventListener('playing', () => loop.classList.add('is-on'), { once: true });
      addEventListener('load', () => { loop.src = loop.dataset.src; loop.play().catch(() => {}); }, { once: true });
    }
    // light and loop rest once the first screen is left
    let away = false;
    const rest = () => {
      const now = scrollY > 4;
      if (now === away) return;
      away = now;
      if (sign && !reduced) { if (now) sign.stop(); else sign.start(); }
      if (playLoop && loop.src) { if (now) loop.pause(); else loop.play().catch(() => {}); }
    };
    addEventListener('scroll', rest, { passive: true });
  }

  // project board: the row in the upper third of the screen takes the poster
  const board = document.querySelector('.board');
  if (board) {
    const rows = [...document.querySelectorAll('.px')];
    const pics = [...board.querySelectorAll('img')];
    const num = board.querySelector('.board__num'), label = board.querySelector('.board__label');
    let on = -1;
    const show = (i) => {
      if (i === on || !rows[i]) return;
      const first = on < 0;
      on = i;
      rows.forEach((r, k) => r.classList.toggle('is-on', k === i));
      pics.forEach((p, k) => p.classList.toggle('is-on', k === i));
      num.textContent = rows[i].querySelector('.px__num').textContent;
      num.style.setProperty('--n', num.textContent.trim().length);
      label.textContent = rows[i].querySelector('.px__label').textContent;
      if (!first && !reduced) num.animate([{ transform: 'translateY(12%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    };
    show(0);
    const band = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) show(rows.indexOf(e.target)); }, { rootMargin: '-35% 0px -65% 0px' });
    rows.forEach((r, i) => { band.observe(r); r.addEventListener('pointerenter', () => show(i)); r.addEventListener('focusin', () => show(i)); });
  }

  // entrances, once
  // a fully clipped element never intersects, so [data-open] is watched through its parent
  const seen = (entries, obs) => {
    for (const e of entries) if (e.isIntersecting) { (e.target.__reveal || e.target).classList.add('is-in'); obs.unobserve(e.target); }
  };
  const io = new IntersectionObserver(seen, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
  // pictures start opening just before they enter, so no closed frame reaches the screen
  const early = new IntersectionObserver(seen, { rootMargin: '0px 0px 20% 0px', threshold: 0 });
  document.querySelectorAll('[data-open], .step__img').forEach((el) => { el.parentElement.__reveal = el; early.observe(el.parentElement); });

  // task swap: the six steps refill with a short rise
  const row = document.querySelector('.steps');
  document.querySelectorAll('.pick input').forEach((r) => r.addEventListener('change', () => {
    if (reduced || !row) return;
    row.classList.remove('is-swap'); void row.offsetWidth; row.classList.add('is-swap');
  }));

  // footer pictures crossfade, six seconds each
  const pics = [...document.querySelectorAll('.foot__pics img')];
  if (pics.length > 1 && !reduced) {
    let j = 0;
    setInterval(() => {
      if (document.hidden) return;
      pics[j].classList.remove('is-on');
      j = (j + 1) % pics.length;
      pics[j].classList.add('is-on');
    }, 6000);
  }

  // cookie window: Metrika loads only after consent; the footer link reopens the choice
  const box = document.getElementById('cookie');
  if (box) {
    const NAME = 'sd_cookie';
    const choice = (document.cookie.match(/(?:^|; )sd_cookie=(yes|no)/) || [])[1];
    const metrika = () => {
      const id = Number(box.dataset.metrika);
      if (!id || window.ym) return;
      window.ym = function () { (window.ym.a = window.ym.a || []).push(arguments); };
      window.ym.l = Date.now();
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://mc.yandex.ru/metrika/tag.js';
      document.head.appendChild(s);
      window.ym(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
    };
    const open = () => { box.hidden = false; box.querySelector('[data-cookie]').focus({ preventScroll: true }); };
    box.querySelectorAll('[data-cookie]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.cookie;
      document.cookie = `${NAME}=${v}; max-age=${60 * 60 * 24 * 180}; path=/; SameSite=Lax`;
      box.hidden = true;
      if (v === 'yes') metrika();
      else if (window.ym) location.reload(); // a revoked consent unloads the counter
    }));
    document.querySelectorAll('[data-cookie-open]').forEach((b) => b.addEventListener('click', open));
    if (choice === 'yes') metrika();
    else if (!choice) box.hidden = false;
  }
})();
