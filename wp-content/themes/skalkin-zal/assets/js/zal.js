// Scene: camera flight along Z through five lit pictures; the midline row changes at each stop.
// Markup: section.scene[data-scene="zal"] > .scene-stage > h2 + figure.zal__stop{5} > .zal__plane(img, video.zal__clip?) + figcaption.zal__row
// Desktop: CSS 3D (perspective per stop). Phone: crossfade with scale. Rest: five stacked panels.
// Film: when every stop has a clip, the scroll scrubs clip k, which flies the camera into stop k, on both widths.
(() => {
  const D = 1300;                        // depth between pictures, px
  const OX = [0, 0.52, -0.5, 0.48, -0.46]; // picture offsets, fraction of the viewport width
  const OY = [0, -0.07, 0.06, -0.06, 0.05];
  const LEVEL = [1, 0.55, 0.32, 0.18, 0.1]; // opacity by distance from the camera

  const segments = (n) => {
    const span = 0.94 / (n - 1);
    return [...Array(n - 1)].map((_, s) => ({ s, t: 0.03 + s * span, dur: span * 0.82 }));
  };

  const rows = (tl, list, s, t, dur) => {
    tl.to(list[s], { autoAlpha: 0, y: -18, duration: dur * 0.28, ease: 'power2.in' }, t + dur * 0.08)
      .fromTo(list[s + 1], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: dur * 0.3, ease: 'expo.out' }, t + dur * 0.7);
  };

  const seek = (v, f) => {
    v.f = f;
    if (v.readyState >= 1 && v.duration) v.currentTime = f * (v.duration - 0.05);
  };

  // Clips load when the scene is near; play-pause makes mobile Safari decode frames for seeking.
  // the clip size is picked once per page load, a window dragged across 767px keeps it (object-fit covers).
  const load = (root, clips) => {
    const tall = root.dataset.film === 'tall';
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting || navigator.connection?.saveData) return;
      io.disconnect();
      clips.forEach((v) => {
        v.addEventListener('loadedmetadata', () => {
          const done = () => seek(v, v.f || 0);
          v.play().then(() => { v.pause(); done(); }, done);
        }, { once: true });
        v.preload = 'auto';
        v.src = tall ? v.dataset.tall : v.dataset.wide;
      });
    }, { rootMargin: '100% 0px' });
    io.observe(root);
  };

  // Lit card in the last frame of clip 5, fractions of the frame: centre x, y, width, height.
  const CARD = { wide: [0.5003, 0.4588, 0.0255, 0.0546], tall: [0.4972, 0.4891, 0.0472, 0.0375] };
  const FRAME = { wide: [1920, 1080], tall: [720, 1280] };
  const FLY = 0.09;

  // After the last clip the lit card grows over the screen and gives way to the team section.
  const finale = (tl, { root, stage, q }, plane, row, at) => {
    const kind = root.dataset.film;
    const [fx, fy, fw, fh] = CARD[kind];
    const [vw, vh] = FRAME[kind];
    const flash = stage.querySelector('.zal__flash') || stage.appendChild(Object.assign(document.createElement('div'), { className: 'zal__flash' }));
    const o = { k: 0 };
    const rect = () => {
      const W = stage.clientWidth, H = stage.clientHeight, s = Math.max(W / vw, H / vh);
      return { W, H, x: W / 2 + (fx - 0.5) * vw * s, y: H / 2 + (fy - 0.5) * vh * s, w: fw * vw * s, h: fh * vh * s };
    };
    const paint = () => {
      const r = rect(), k = 1 - o.k;
      plane.style.transformOrigin = `${r.x}px ${r.y}px`;
      flash.style.clipPath = `inset(${(r.y - r.h / 2) * k}px ${(r.W - r.x - r.w / 2) * k}px ${(r.H - r.y - r.h / 2) * k}px ${(r.x - r.w / 2) * k}px)`;
    };
    paint();
    const t = at + 0.06;
    tl.to(row, { autoAlpha: 0, y: -18, duration: 0.02, ease: 'power2.in' }, t)
      .set(flash, { autoAlpha: 1 }, t)
      .to(o, { k: 1, duration: FLY, ease: 'power3.in', onUpdate: paint }, t)
      .to(plane, { scale: 2.4, duration: FLY, ease: 'power3.in' }, t)
      .set(plane, { autoAlpha: 0 }, t + FLY)
      .to(flash, { autoAlpha: 0, duration: 0.04 }, t + FLY);
  };

  const film = (tl, ctx) => {
    const { root, q } = ctx;
    const clips = q('.zal__clip');
    const planes = q('.zal__plane');
    if (!clips.length || clips.length !== planes.length || (navigator.connection?.saveData && !root.dataset.film)) return false;
    const list = q('.zal__row');
    if (!root.dataset.film) { root.dataset.film = matchMedia('(orientation: portrait)').matches ? 'tall' : 'wide'; load(root, clips); }
    root.classList.add('is-film');
    planes.forEach((p, i) => gsap.set(p, { autoAlpha: i ? 0 : 1 }));
    list.forEach((r) => gsap.set(r, { autoAlpha: 0, y: 0 }));
    const span = 0.96 / clips.length;
    tl.to(q('.zal__title'), { autoAlpha: 0, duration: 0.02 }, 0.02 + span * 0.5); // later frames need the space
    clips.forEach((v, k) => {
      const t = 0.02 + k * span;
      const dur = span * 0.7;
      const o = { f: 0 };
      if (k) {
        tl.to(list[k - 1], { autoAlpha: 0, y: -18, duration: dur * 0.2, ease: 'power2.in' }, t)
          .set(planes[k - 1], { autoAlpha: 0 }, t)
          .set(planes[k], { autoAlpha: 1 }, t);
      }
      tl.to(o, { f: 1, duration: dur, ease: 'none', onUpdate: () => seek(v, o.f) }, t)
        .fromTo(list[k], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: dur * 0.25, ease: 'expo.out' }, t + dur * 0.8);
    });
    finale(tl, ctx, planes[planes.length - 1], list[list.length - 1], 0.02 + (clips.length - 1) * span + span * 0.7);
    return true;
  };

  window.Scenes = window.Scenes || {};
  Scenes.zal = (root, opts = {}) => Stage.scene(root, {
    hold: opts.hold ?? 4,
    scrub: 1.1,
    build(tl, ctx) {
      if (film(tl, ctx)) return;
      const { q } = ctx;
      const planes = q('.zal__plane');
      const list = q('.zal__row');
      const W = () => window.innerWidth;
      const H = () => window.innerHeight;
      const lvl = (k) => (k < 0 ? 0 : LEVEL[k] ?? 0);
      planes.forEach((p, i) => gsap.set(p, {
        xPercent: -50, yPercent: -50, x: () => OX[i % 5] * W(), y: () => OY[i % 5] * H(), z: -i * D, autoAlpha: lvl(i), scale: 1,
      }));
      list.forEach((r, i) => gsap.set(r, { autoAlpha: i ? 0 : 1, y: 0 }));
      for (const { s, t, dur } of segments(planes.length)) {
        const k = s + 1; // arriving stop
        planes.forEach((p, i) => {
          const v = { z: (k - i) * D, x: () => (OX[i % 5] - OX[k % 5]) * W(), y: () => (OY[i % 5] - OY[k % 5]) * H(), duration: dur, ease: 'power3.inOut' };
          if (i !== s) v.autoAlpha = lvl(i - k);
          tl.to(p, v, t);
        });
        tl.to(planes[s], { autoAlpha: 0, duration: dur * 0.4, ease: 'power2.in' }, t + dur * 0.3);
        rows(tl, list, s, t, dur);
      }
    },
    phone: {
      hold: opts.hold ?? 4,
      build(tl, ctx) {
        if (film(tl, ctx)) return;
        const { q } = ctx;
        const planes = q('.zal__plane');
        const list = q('.zal__row');
        planes.forEach((p, i) => gsap.set(p, { autoAlpha: i ? 0 : 1, scale: i ? 1.18 : 1 }));
        list.forEach((r, i) => gsap.set(r, { autoAlpha: i ? 0 : 1, y: 0 }));
        for (const { s, t, dur } of segments(planes.length)) {
          tl.to(list[s], { autoAlpha: 0, y: -18, duration: dur * 0.2, ease: 'power2.in' }, t)
            .to(planes[s], { scale: 1.1, duration: dur, ease: 'power2.inOut' }, t)
            .to(planes[s + 1], { autoAlpha: 1, scale: 1, duration: dur * 0.7, ease: 'power3.inOut' }, t + dur * 0.15)
            .fromTo(list[s + 1], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: dur * 0.25, ease: 'expo.out' }, t + dur * 0.75);
        }
      },
    },
  });
})();
