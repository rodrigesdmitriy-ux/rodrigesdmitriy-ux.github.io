// Page behaviour: rail docking, reveals, hero drift, row of steps, footer crossfade, cookie choice.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = !!(window.gsap && window.ScrollTrigger);

  if (window.Stage) { Stage.smooth({ lerp: 0.1 }); Stage.init(); }

  // rail takes the page ground before the hero sentence reaches it; inner pages start docked
  const rail = document.querySelector('.rail');
  const lead = document.querySelector('.hero-detail .statement');
  if (rail && lead) {
    const dock = () => rail.classList.toggle('is-solid', lead.getBoundingClientRect().top < rail.offsetHeight + 24);
    addEventListener('scroll', dock, { passive: true });
    addEventListener('resize', dock);
    dock();
  }
  if (rail) rail.querySelectorAll('.rail__drop a').forEach((a) => a.addEventListener('click', () => rail.querySelector('details').removeAttribute('open')));

  // the default key keeps only the laptop and stool (gaps between the legs cut out), so it never lies over the rail's text
  const OUTLINE = [867,166,1152,164,1138,367,1140,376,1148,392,1149,404,1136,425,1098,430,1122,560,1134,690,1105,693,1098,618,1048,646,1066,745,1035,748,1027,633,913,633,912,679,885,681,887,633,845,633,818,720,790,722,833,432,793,428,778,410,780,396,784,385,851,358];
  const HOLES = [[866,433,896,433,894,584,858,598], [926,433,1016,433,1019,569,918,569], [1046,433,1071,433,1080,568,1052,568]];
  const SRC = [1672, 941];
  const key = document.querySelector('.hero-shot--key:not(.is-cut) img');
  const clipKey = () => {
    const W = key.clientWidth, H = key.clientHeight, s = Math.max(W / SRC[0], H / SRC[1]);
    const free = [W - SRC[0] * s, H - SRC[1] * s];
    const [ox, oy] = getComputedStyle(key).objectPosition.split(' ').map((v, i) => (v.endsWith('%') ? free[i] * parseFloat(v) / 100 : parseFloat(v)));
    const ring = (r) => { const pts = []; for (let i = 0; i < r.length; i += 2) pts.push(`${(ox + r[i] * s).toFixed(1)}px ${(oy + r[i + 1] * s).toFixed(1)}px`); return pts; };
    const out = ring(OUTLINE), path = [...out, out[0]];
    for (const h of HOLES) { const r = ring(h); path.push(...r, r[0], out[0]); }
    key.style.clipPath = `polygon(evenodd, ${path.join(',')})`;
  };
  if (key) { clipKey(); addEventListener('resize', clipKey); }

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

  // hero loop: wide screens only, the still frame stays on phones and for saved data
  const loop = document.querySelector('.hero-shot__loop');
  if (loop && !reduced && !navigator.connection?.saveData && matchMedia('(min-width: 1100px)').matches) {
    loop.addEventListener('playing', () => loop.classList.add('is-on'), { once: true });
    loop.src = loop.dataset.src;
    new IntersectionObserver(([e]) => { if (e.isIntersecting) loop.play().catch(() => {}); else loop.pause(); }).observe(loop);
  }

  // hero: both layers of the exhibit drift together, the detail picture drifts on its own
  if (live && !reduced && document.querySelector('[data-shot]')) {
    gsap.to('[data-shot]', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: document.body, start: 0, end: () => innerHeight, scrub: true } });
    gsap.fromTo('.hero-detail__pic img', { yPercent: -6, scale: 1.08 }, { yPercent: 6, scale: 1, ease: 'none', scrollTrigger: { trigger: '.hero-detail', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

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
