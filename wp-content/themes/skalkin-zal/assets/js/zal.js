// Scene: camera flight along Z through five lit pictures; the midline row changes at each stop.
// Markup: section.scene[data-scene="zal"] > .scene-stage > h2 + figure.zal__stop{5} > .zal__plane(img, video.zal__clip?) + figcaption.zal__row
// Desktop: CSS 3D (perspective per stop). Phone: crossfade with scale. Rest: five stacked panels.
// Film: when every stop has a clip, clip k flies the camera into stop k and ends on the sharp still of that stop;
// one gesture forward plays one clip, a step back is a dissolve.
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
      .fromTo(q('.scene-stage'), { '--top': 0 }, { '--top': 1, duration: span * 0.46, ease: 'none' }, span * 0.3)
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
      v.play().then(() => { if (!v.live) v.pause(); done(); }, () => { v.blocked = true; done(); });
    }, { once: true });
    v.preload = 'auto';
    v.src = root.dataset.film === 'tall' ? v.dataset.tall : v.dataset.wide;
  };

  // Clip format follows the device orientation; returns true when loaded clips were dropped.
  const format = (root, clips) => {
    const kind = matchMedia('(orientation: portrait)').matches ? 'tall' : 'wide';
    if (root.dataset.film === kind) return false;
    root.dataset.film = kind;
    let dropped = false;
    for (const v of clips) if (v.src) { v.removeAttribute('src'); v.load(); dropped = true; }
    return dropped;
  };

  // Lit card in the last frame of clip 5, fractions of the frame: centre x, y, width, height.
  const CARD = { wide: [0.5003, 0.4588, 0.0255, 0.0546], tall: [0.4983, 0.4893, 0.0451, 0.0355] };
  const FRAME = { wide: [1920, 1080], tall: [720, 1280] };

  // After the last clip the lit card grows over the screen and gives way to the team section.
  const finale = (tl, { root, stage }, plane, row, at, FLY) => {
    const flash = stage.querySelector('.zal__flash') || stage.appendChild(Object.assign(document.createElement('div'), { className: 'zal__flash' }));
    const o = { k: 0 };
    const rect = () => {
      const kind = root.dataset.film;
      const [fx, fy, fw, fh] = CARD[kind];
      const [vw, vh] = FRAME[kind];
      const W = stage.clientWidth, H = stage.clientHeight, s = Math.max(W / vw, H / vh);
      return { W, H, x: W / 2 + (fx - 0.5) * vw * s, y: H / 2 + (fy - 0.5) * vh * s, w: fw * vw * s, h: fh * vh * s };
    };
    const paint = () => {
      const r = rect(), k = 1 - o.k;
      plane.style.transformOrigin = `${r.x}px ${r.y}px`;
      flash.style.setProperty('--card', `inset(${(r.y - r.h / 2) * k}px ${(r.W - r.x - r.w / 2) * k}px ${(r.H - r.y - r.h / 2) * k}px ${(r.x - r.w / 2) * k}px)`);
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
    format(root, clips);
    root.classList.add('is-film', 'is-boot');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('is-boot')));
    planes.forEach((p, i) => gsap.set(p, { autoAlpha: i ? 0 : 1 }));
    list.forEach((r) => gsap.set(r, { autoAlpha: 0, y: 0 }));
    opening(tl, ctx, span, span * 0.05);
    clips.forEach((v, k) => {
      const t = k * span;
      const o = { f: 0 };
      const still = planes[k].querySelector('img');
      v.at = () => gsap.utils.clamp(0, 1, (tl.progress() - t) / dur); // a refresh moves the timeline without callbacks
      if (k) {
        tl.to(list[k - 1], { autoAlpha: 0, y: -18, duration: dur * 0.1, ease: 'power2.in' }, t)
          .set(planes[k], { autoAlpha: 1 }, t)
          .to(planes[k - 1], { autoAlpha: 0, duration: span * 0.03, ease: 'none' }, t);
      }
      // arrival: the clip ends on the still and holds it, the sharp still takes over inside that hold
      tl.to(o, { f: 1, duration: dur, ease: 'none', onUpdate: () => seek(v, o.f) }, t)
        .fromTo(still, { autoAlpha: 0 }, { autoAlpha: 1, duration: dur * 0.07, ease: 'sine.inOut' }, t + dur * 0.92)
        .fromTo(list[k], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: dur * 0.16, ease: 'expo.out' }, t + dur * 0.84);
    });
    finale(tl, ctx, planes[n - 1], list[n - 1], n * span, span * 0.8);
    ctx.stops = [...Array(n + 1)].map((_, i) => i * span);
    ctx.clips = clips;
    return true;
  };

  // One gesture, one step: wheel, finger, keys and the lamp cord move the page between the stops,
  // and the clip of that step plays by itself. Past the last stop the page scrolls as usual.
  const RATE = 1; // the clips carry their own speed
  const HURRY = 2; // a repeated gesture: 30 frames a second doubled fall evenly on a 60 Hz screen
  const steps = (tl, ctx) => {
    const { root, stage, stops, clips = [] } = ctx;
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

    // step counter and the way past the film
    const skip = root.querySelector('.zal__skip');
    const mark = () => {
      const p = (scrollY - st.start) / (st.end - st.start), end = stops.length - 1;
      let i = end;
      while (i > 0 && stops[i] > p + 0.001) i--;
      skip.classList.toggle('is-on', i > 0 && p <= stops[end] + 0.001);
      if (i > 0 && p > 0) root.classList.add('is-stepped'); // the hint belongs to the first screen
      skip.firstElementChild.textContent = `${i} / ${end}`;
    };
    mark();
    addEventListener('scroll', mark, { signal, passive: true });

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
      root.dispatchEvent(new Event('zal:cancel'));
    };
    const go = (i, dir, quick) => {
      const keep = document.activeElement === cord || !!active?.keep;
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
        root.dispatchEvent(new CustomEvent('zal:flight', { detail: { k: i, clip } }));
        // the scroll follows the clip, then passes the rest of the span quickly
        const run = (clip.duration || 5) / RATE, a = run / (run + 0.2);
        duration = run + 0.2;
        ease = (p) => (p < a ? (p / a) * 0.86 : 0.86 + ((p - a) / (1 - a)) * 0.14);
      } else if (dir > 0 && !quick) {
        duration = i === Y.length - 1 ? 2.2 : 1.5;
      }
      last = scrollY;
      const tw = gsap.to(o, {
        y: Y[i], duration, ease,
        onUpdate() { if (Math.abs(scrollY - last) > 8) return cancel(); setY(o.y); },
        onComplete() {
          active = null;
          landed = performance.now();
          if (clip) { clip.live = false; clip.pause(); seek(clip, 1); }
          ready(i);
          // the cord is hidden past the last stop: focus goes on to the section it opened
          if (keep && i === Y.length - 1) {
            const h = next.querySelector('h2');
            h.tabIndex = -1;
            h.focus({ preventScroll: true });
          }
        },
      });
      active = { tw, clip, dir, i, keep };
      if (!clip) return;
      // the clip is the clock: a late start holds the scroll with it; a clip stuck for over a second lets the scroll go on alone
      tw.pause();
      let was = -1, seen = performance.now();
      const tick = () => {
        if (active?.tw !== tw) return gsap.ticker.remove(tick);
        const now = performance.now(), ct = clip.currentTime;
        if (ct !== was) { was = ct; seen = now; }
        if (!clip.ended && clip.live && now - seen < 1500) return tw.time(ct / RATE);
        gsap.ticker.remove(tick);
        tw.play();
      };
      gsap.ticker.add(tick);
    };

    const tug = (h) => {
      gsap.killTweensOf(pull);
      gsap.timeline().to(pull, { y: h, duration: 0.16, ease: 'power2.out' }).to(pull, { y: 0, duration: 1.1, ease: 'elastic.out(1, 0.32)' });
    };
    // Back, an interrupted step or a clip that cannot play: a dissolve to the still of the stop.
    const veil = clips.length ? (stage.querySelector('.zal__veil') || stage.appendChild(Object.assign(document.createElement('img'), { className: 'zal__veil', alt: '' }))) : null;
    const heroPic = root.querySelector('.hero__pic img');
    let jumping = false, waiting = false, queued = 0, patience = 3500, dissolve = null, wait = null, heading = 0, landed = 0;
    const jump = (i) => {
      cancel();
      jumping = true;
      const still = i > 0 && clips[i - 1] ? clips[i - 1].closest('.zal__plane').querySelector('img') : heroPic;
      veil.src = still.currentSrc || still.src;
      const tl = dissolve = gsap.timeline({
        paused: true,
        onComplete() {
          jumping = false;
          landed = performance.now();
          dissolve = null;
          ready(i);
          if (queued) { const d = queued; queued = 0; gesture(d); }
        },
      })
        .set(veil, { autoAlpha: 0, scale: 1.02 })
        .to(veil, { autoAlpha: 1, scale: 1, duration: 0.32, ease: 'power1.inOut' })
        .call(() => setY(ys()[i]))
        .to(veil, { autoAlpha: 0, duration: 0.3, ease: 'power1.out' }, '+=0.05');
      veil.decode().catch(() => {}).then(() => { if (dissolve === tl) tl.play(); });
    };
    // a clip that is not ready yet gets a moment; after the first miss the wait is short
    const whenPlayable = (clip, then) => {
      waiting = true;
      wake(clip, root);
      const stop = () => {
        clip.removeEventListener('canplay', done);
        clip.removeEventListener('error', done);
        clearTimeout(timer);
        waiting = false;
        wait = null;
      };
      const done = () => { stop(); then(); };
      wait = stop;
      const timer = setTimeout(done, patience);
      clip.addEventListener('canplay', done);
      clip.addEventListener('error', done);
    };
    const gesture = (dir) => {
      tug(20);
      heading = dir;
      if (dir > 0) root.classList.add('is-stepped');
      if (waiting) return;
      if (jumping) { queued = dir; return; }
      if (active && active.dir === dir) {
        active.tw.timeScale(HURRY);
        if (active.clip) active.clip.playbackRate = RATE * HURRY;
        return;
      }
      const i = here(dir);
      if (i < 0) return;
      if (!clips.length) return go(i, dir, !!active);
      if (dir < 0 || active) return jump(i);
      const clip = clips[i - 1];
      if (!clip || clip.readyState >= 3) return go(i, dir, false);
      if (clip.blocked) return jump(i);
      whenPlayable(clip, () => {
        if (clip.readyState >= 2 && !clip.blocked) return go(i, dir, false);
        patience = 600;
        jump(i);
      });
    };

    // ponytail: a pause while dragging the scrollbar also lands on a stop, the next drag cancels it
    let leaving = 0;
    const settle = () => {
      if (active || performance.now() < leaving) return;
      const Y = ys(), y = scrollY;
      if (y > Y.at(-1) + 2 || Y.some((s) => Math.abs(s - y) <= 2)) return;
      const i = Y.reduce((b, s, k) => (Math.abs(s - y) < Math.abs(Y[b] - y) ? k : b), 0);
      go(i, Math.sign(Y[i] - y), true);
    };
    ScrollTrigger.addEventListener('scrollEnd', settle);

    const refit = () => {
      if (clips.length && format(root, clips)) ready(Math.max(0, ys().findIndex((s) => s >= scrollY - 2)));
      if (active) go(active.i, active.dir, true); else settle();
    };
    ScrollTrigger.addEventListener('refresh', refit);
    // ScrollTrigger holds its own refresh until the scroll ends, too late for a running step;
    // a phone's address bar changes only the height and must not interrupt a clip
    let width = innerWidth;
    addEventListener('resize', () => {
      if (active && (!Stage.touch || innerWidth !== width)) ScrollTrigger.refresh();
      width = innerWidth;
    }, on);

    // a trackpad swipe keeps sending events for a second: it counts once; slow small deltas add up, and a tail never re-arms
    let lastWheel = 0, lastDir = 0, lastAbs = 0, sum = 0, armed = true, taken = false, fired = 0;
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const dir = Math.sign(e.deltaY), now = performance.now(), gap = now - lastWheel, abs = Math.abs(e.deltaY) * [1, 16, innerHeight][e.deltaMode];
      if (dir !== lastDir) sum = 0;
      // a mouse notch: large, separate, does not decay
      const big = abs >= 48 && gap > 40, notch = big && abs >= lastAbs && now - fired > 300;
      // notches during a step and right after it belong to the gesture that began it: no hurry, no second step
      if (big && dir === heading && (active || jumping || waiting || (gap < 350 && now - landed < 500))) armed = false;
      else if (gap > 320 || (abs >= 3 && (dir !== lastDir || (gap > 140 && abs > lastAbs))) || notch) armed = true;
      if (armed) sum += abs;
      lastWheel = now; lastDir = dir; lastAbs = abs;
      const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (takes(dir)) {
        eat();
        taken = true;
        if (armed && sum >= 3) { armed = false; sum = 0; fired = now; gesture(dir); }
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

    addEventListener('click', (e) => { if (!e.target.closest?.('a[href*="#"]')) return;
      leaving = performance.now() + 3000;
      cancel();
      wait?.();
      if (dissolve) { dissolve.kill(); dissolve = null; jumping = false; queued = 0; gsap.set(veil, { autoAlpha: 0 }); }
    }, { signal, capture: true });

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
      if (scrollY > 4) ready(Math.max(0, ys().findIndex((s) => s >= scrollY - 2)));
      else {
        // behind the loader the first clip is wanted at once
        setTimeout(() => wake(clips[0], root), document.documentElement.classList.contains('is-loading') ? 0 : 1200);
        for (const e of ['pointermove', 'touchstart', 'wheel', 'keydown']) addEventListener(e, () => ready(0), { signal, once: true, passive: true });
      }
      settle();
    });
    if (document.readyState === 'complete') begin(); else addEventListener('load', begin, { signal, once: true });

    return () => { ctx.ac.abort(); clearInterval(nudge); ScrollTrigger.removeEventListener('scrollEnd', settle); ScrollTrigger.removeEventListener('refresh', refit); cancel(); };
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
