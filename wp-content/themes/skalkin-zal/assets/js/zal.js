// Scene: camera flight along Z through five lit pictures; the midline row changes at each stop.
// Markup: section.scene[data-scene="zal"] > .scene-stage > h2 + figure.zal__stop{5} > .zal__plane(img, video.zal__clip?) + figcaption.zal__row
// Desktop: CSS 3D (perspective per stop). Phone: crossfade with scale. Rest: five stacked panels.
// Film: when every stop has a clip, clip k flies the camera into stop k; one gesture plays one clip, on both widths.
(() => {
  const D = 1300;                        // depth between pictures, px
  const OX = [0, 0.52, -0.5, 0.48, -0.46]; // picture offsets, fraction of the viewport width
  const OY = [0, -0.07, 0.06, -0.06, 0.05];
  const LEVEL = [1, 0.55, 0.32, 0.18, 0.1]; // opacity by distance from the camera

  // the first of n + 1 spans belongs to the first screen fading into the first picture
  const segments = (n) => {
    const span = 1 / n;
    return [...Array(n - 1)].map((_, s) => ({ s, t: (s + 1) * span + 0.03 * span, dur: span * 0.82 }));
  };

  const opening = (tl, { root, q }, span, fade) => {
    const title = q('.zal__title');
    const cord = root.querySelector('.cord');
    // the cord leaves the lamp with the first screen and comes back at the page margin
    gsap.set(cord, { attr: { 'data-side': 0 } });
    tl.fromTo(cord, { autoAlpha: 1 }, { autoAlpha: 0, duration: fade }, 0)
      .set(cord, { attr: { 'data-side': 1 } }, fade)
      .fromTo(cord, { autoAlpha: 0 }, { autoAlpha: 1, duration: span * 0.1, immediateRender: false }, span * 0.76)
      .to(root.querySelector('.hero'), { autoAlpha: 0, duration: fade }, 0)
      .fromTo(title, { autoAlpha: 0 }, { autoAlpha: 1, duration: span * 0.1 }, span * 0.76)
      .to(title, { autoAlpha: 0, duration: 0.01 }, span * 1.02);
  };

  const rows = (tl, list, s, t, dur) => {
    tl.to(list[s], { autoAlpha: 0, y: -18, duration: dur * 0.28, ease: 'power2.in' }, t + dur * 0.08)
      .fromTo(list[s + 1], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: dur * 0.3, ease: 'expo.out' }, t + dur * 0.7);
  };

  // Frames follow the scroll unless the clip plays by itself; one seek at a time, the last wish wins.
  const seek = (v, f) => {
    v.f = f;
    if (v.live || v.readyState < 1 || !v.duration) return;
    if (v.seeking) { v.want = true; return; }
    v.currentTime = f * (v.duration - 0.05);
  };

  // A clip loads when its step is near; play-pause makes mobile Safari decode frames for seeking.
  const wake = (v, root) => {
    if (!v || v.src) return;
    v.addEventListener('seeked', () => { if (v.want) { v.want = false; seek(v, v.f); } });
    v.addEventListener('loadedmetadata', () => {
      const done = () => seek(v, v.at());
      v.play().then(() => { if (!v.live) v.pause(); done(); }, done);
    }, { once: true });
    v.preload = 'auto';
    v.src = root.dataset.film === 'tall' ? v.dataset.tall : v.dataset.wide;
  };

  // Lit card in the last frame of clip 5, fractions of the frame: centre x, y, width, height.
  const CARD = { wide: [0.5003, 0.4588, 0.0255, 0.0546], tall: [0.4972, 0.4891, 0.0472, 0.0375] };
  const FRAME = { wide: [1920, 1080], tall: [720, 1280] };

  // After the last clip the lit card grows over the screen and gives way to the team section.
  const finale = (tl, { root, stage }, plane, row, at, FLY) => {
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
    const t = at + 0.01;
    tl.to(root.querySelector('.cord'), { autoAlpha: 0, duration: 0.005 }, at + 0.002)
      .to(row, { autoAlpha: 0, y: -18, duration: 0.02, ease: 'power2.in' }, t)
      .set(flash, { autoAlpha: 1 }, t)
      .to(o, { k: 1, duration: FLY, ease: 'power3.in', onUpdate: paint }, t)
      .to(plane, { scale: 2.4, duration: FLY, ease: 'power3.in' }, t)
      .set(plane, { autoAlpha: 0 }, t + FLY)
      .to(flash, { autoAlpha: 0, duration: 0.02 }, t + FLY);
  };

  const film = (tl, ctx) => {
    const { root, q } = ctx;
    const clips = q('.zal__clip');
    const planes = q('.zal__plane');
    if (!clips.length || clips.length !== planes.length || (navigator.connection?.saveData && !root.dataset.film)) return false;
    const list = q('.zal__row');
    const n = clips.length, span = 1 / (n + 1), dur = span * 0.86;
    if (!root.dataset.film) root.dataset.film = matchMedia('(orientation: portrait)').matches ? 'tall' : 'wide';
    root.classList.add('is-film');
    planes.forEach((p, i) => gsap.set(p, { autoAlpha: i ? 0 : 1 }));
    list.forEach((r) => gsap.set(r, { autoAlpha: 0, y: 0 }));
    opening(tl, ctx, span, span * 0.05);
    clips.forEach((v, k) => {
      const t = k * span;
      const o = { f: 0 };
      v.at = () => gsap.utils.clamp(0, 1, (tl.progress() - t) / dur); // a refresh moves the timeline without callbacks
      if (k) {
        tl.to(list[k - 1], { autoAlpha: 0, y: -18, duration: dur * 0.1, ease: 'power2.in' }, t)
          .set(planes[k - 1], { autoAlpha: 0 }, t)
          .set(planes[k], { autoAlpha: 1 }, t);
      }
      tl.to(o, { f: 1, duration: dur, ease: 'none', onUpdate: () => seek(v, o.f) }, t)
        .fromTo(list[k], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: dur * 0.16, ease: 'expo.out' }, t + dur * 0.84);
    });
    finale(tl, ctx, planes[n - 1], list[n - 1], n * span, span * 0.8);
    ctx.stops = [...Array(n + 1)].map((_, i) => i * span);
    ctx.clips = clips;
    return true;
  };

  // One gesture, one step: wheel, finger, keys and the lamp cord move the page between the stops,
  // and the clip of that step plays by itself. Past the last stop the page scrolls as usual.
  const RATE = 2;
  const steps = (tl, ctx) => {
    const { root, stops, clips = [] } = ctx;
    const st = tl.scrollTrigger;
    const next = root.nextElementSibling;
    const cord = root.querySelector('.cord');
    const pull = cord.querySelector('.cord__pull');
    const rail = document.querySelector('.rail');
    const { signal } = (ctx.ac = new AbortController());
    const on = { signal }, hard = { signal, capture: true, passive: false };

    const ys = () => [...stops.map((p) => st.start + p * (st.end - st.start)), next.getBoundingClientRect().top + scrollY - rail.offsetHeight];
    const here = (dir) => {
      const Y = ys();
      if (dir > 0) return Y.findIndex((s) => s > scrollY + 2);
      for (let i = Y.length - 1; i >= 0; i--) if (Y[i] < scrollY - 2) return i;
      return -1;
    };
    const takes = (dir) => {
      const Y = ys(), end = Y.at(-1);
      if (scrollY > end + 2) return false;
      if (dir > 0 && scrollY >= end - 2) return false;
      if (dir < 0 && scrollY <= Y[0] + 1) return false;
      return true;
    };
    const ready = (i) => { for (const k of [i - 1, i, i + 1]) wake(clips[k], root); };

    let active = null, last = 0;
    const setY = (y) => {
      last = y;
      if (Stage.lenis) Stage.lenis.scrollTo(y, { immediate: true, force: true });
      else scrollTo({ top: y, behavior: 'instant' });
    };
    const cancel = () => {
      if (!active) return;
      const { tw, clip } = active;
      active = null;
      tw.kill();
      if (clip) { clip.live = false; clip.pause(); seek(clip, clip.at()); }
    };
    const go = (i, dir, quick) => {
      cancel();
      const Y = ys(), o = { y: scrollY };
      const clip = dir > 0 && !quick && Math.abs(scrollY - Y[i - 1]) <= 2 ? clips[i - 1] : null;
      let duration = 0.7, ease = 'power2.inOut';
      if (clip) {
        wake(clip, root);
        clip.live = true;
        clip.playbackRate = RATE;
        clip.currentTime = 0;
        clip.play().catch(() => { clip.live = false; });
        duration = (clip.duration || 7.9) / RATE / 0.86;
        ease = 'none';
      } else if (dir > 0 && !quick) {
        duration = i === Y.length - 1 ? 2.2 : 1.5;
      }
      last = scrollY;
      const tw = gsap.to(o, {
        y: Y[i], duration, ease,
        onUpdate() { if (Math.abs(scrollY - last) > 8) return cancel(); setY(o.y); },
        onComplete() {
          active = null;
          if (clip) { clip.live = false; clip.pause(); seek(clip, 1); }
          ready(i);
        },
      });
      active = { tw, clip, dir };
    };

    const tug = (h) => {
      gsap.killTweensOf(pull);
      gsap.timeline().to(pull, { y: h, duration: 0.16, ease: 'power2.out' }).to(pull, { y: 0, duration: 1.1, ease: 'elastic.out(1, 0.32)' });
    };
    const gesture = (dir) => {
      tug(20);
      if (dir > 0) root.classList.add('is-stepped');
      if (active && active.dir === dir) {
        active.tw.timeScale(3);
        if (active.clip) active.clip.playbackRate = RATE * 3;
        return;
      }
      const i = here(dir);
      if (i >= 0) go(i, dir, !!active);
    };

    // ponytail: a pause while dragging the scrollbar also lands on a stop, the next drag cancels it
    const settle = () => {
      if (active) return;
      const Y = ys(), y = scrollY;
      if (y > Y.at(-1) + 2 || Y.some((s) => Math.abs(s - y) <= 2)) return;
      const i = Y.reduce((b, s, k) => (Math.abs(s - y) < Math.abs(Y[b] - y) ? k : b), 0);
      go(i, Math.sign(Y[i] - y), true);
    };
    ScrollTrigger.addEventListener('scrollEnd', settle);

    // a trackpad swipe keeps sending events for a second: it counts once, small tails do not start a step
    let lastWheel = 0, lastDir = 0, lastAbs = 0, armed = true, taken = false;
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const dir = Math.sign(e.deltaY), now = performance.now(), gap = now - lastWheel, abs = Math.abs(e.deltaY);
      if (dir !== lastDir || gap > 320 || (gap > 140 && abs > lastAbs)) armed = true;
      lastWheel = now; lastDir = dir; lastAbs = abs;
      const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (takes(dir)) {
        eat();
        taken = true;
        if (armed && abs >= 3) { armed = false; gesture(dir); }
      } else if (taken && !armed) eat();
      else taken = false;
    }, hard);

    let startY = null, used = false;
    addEventListener('touchstart', (e) => {
      startY = e.touches.length === 1 && !e.target.closest?.('.cord') ? e.touches[0].clientY : null;
      used = false;
    }, hard);
    addEventListener('touchmove', (e) => {
      if (startY === null || e.touches.length !== 1) return;
      const dy = startY - e.touches[0].clientY, dir = Math.sign(dy);
      if (!dir || (!used && !takes(dir))) return;
      if (e.cancelable) e.preventDefault();
      if (!used && Math.abs(dy) > 24) { used = true; gesture(dir); }
    }, hard);

    addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input,textarea,select,[contenteditable]')) return;
      let dir = 0;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') dir = 1;
      if (e.key === 'ArrowUp' || e.key === 'PageUp') dir = -1;
      if (e.key === ' ' && !e.target.closest?.('a,button,summary,label')) dir = e.shiftKey ? -1 : 1;
      if (!dir || !takes(dir)) return;
      e.preventDefault();
      if (!e.repeat) gesture(dir);
    }, on);

    addEventListener('click', (e) => { if (e.target.closest?.('a[href*="#"]')) cancel(); }, { signal, capture: true });

    // the cord: click, keyboard or a pull of 30 px
    let down = null, pulled = false;
    cord.addEventListener('pointerdown', (e) => { down = e.clientY; pulled = false; cord.setPointerCapture(e.pointerId); gsap.killTweensOf(pull); }, on);
    cord.addEventListener('pointermove', (e) => { if (down !== null) gsap.set(pull, { y: Math.max(0, Math.min(60, e.clientY - down)) }); }, on);
    const up = (e) => {
      if (down === null) return;
      const d = e.clientY - down;
      down = null;
      if (d > 30) { pulled = true; gesture(1); } else gsap.to(pull, { y: 0, duration: 1.1, ease: 'elastic.out(1, 0.32)' });
    };
    cord.addEventListener('pointerup', up, on);
    cord.addEventListener('pointercancel', up, on);
    cord.addEventListener('click', () => { if (!pulled) gesture(1); pulled = false; }, on);

    const nudge = setInterval(() => { if (scrollY <= 4 && !root.classList.contains('is-stepped') && !document.hidden && down === null) tug(12); }, 3200);

    // clips of the current stop once the page is in; a reload in the middle lands on a stop
    const begin = () => (window.requestIdleCallback || setTimeout)(() => {
      ready(Math.max(0, ys().findIndex((s) => s >= scrollY - 2)));
      settle();
    });
    if (document.readyState === 'complete') begin(); else addEventListener('load', begin, { signal, once: true });

    return () => { ctx.ac.abort(); clearInterval(nudge); ScrollTrigger.removeEventListener('scrollEnd', settle); cancel(); };
  };

  const plain = (tl, ctx, n) => {
    opening(tl, ctx, 1 / n, 0.12);
    ctx.stops = [...Array(n + 1)].map((_, i) => i / n);
  };

  window.Scenes = window.Scenes || {};
  Scenes.zal = (root, opts = {}) => Stage.scene(root, {
    hold: opts.hold ?? 5,
    scrub: true,
    after: steps,
    build(tl, ctx) {
      if (film(tl, ctx)) return;
      const { q } = ctx;
      const planes = q('.zal__plane');
      const list = q('.zal__row');
      plain(tl, ctx, planes.length);
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
      hold: opts.hold ?? 5,
      build(tl, ctx) {
        if (film(tl, ctx)) return;
        const { q } = ctx;
        const planes = q('.zal__plane');
        const list = q('.zal__row');
        plain(tl, ctx, planes.length);
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
