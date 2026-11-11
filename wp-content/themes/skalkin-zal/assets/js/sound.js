// Scene sound, off by default: a jazz loop while the scene is on screen, one flight per clip with its on-screen actions, the cord click.
// Nothing is fetched until the visitor turns it on; zal.js reports flights with zal:flight and zal:cancel.
(() => {
  const btn = document.querySelector('.sound');
  const zal = document.querySelector('.zal');
  const rail = document.querySelector('.rail');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!btn || !zal || !rail || !AC) return;

  const urls = {};
  for (const u of btn.dataset.sounds.split(',')) urls[u.trim().split('/').pop().split(/[.?]/)[0]] = u.trim();
  const LOOP = [0.5, 51.7]; // the jazz loops inside its periodic margins, s
  const DUCK = 0.5; // the jazz steps back while a flight plays
  const buffers = {}, pending = {}, flights = new Set();
  let ctx = null, out = null, bed = null, bedOn = false, on = false, flight = null, sleep = 0;

  const fade = (param, v, t) => { const now = ctx.currentTime; param.cancelScheduledValues(now); param.setTargetAtTime(v, now, t / 3); };
  const get = (name) => pending[name] ||= fetch(urls[name])
    .then((r) => r.arrayBuffer())
    .then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)))
    .then((b) => (buffers[name] = b), () => { delete pending[name]; });
  const tall = () => (zal.dataset.film === 'tall' ? '-tall' : '');

  const startBed = (buf) => {
    if (bedOn || !buf) return;
    bedOn = true;
    const s = ctx.createBufferSource();
    Object.assign(s, { buffer: buf, loop: true, loopStart: LOOP[0], loopEnd: LOOP[1] });
    s.connect(bed);
    s.start(0, LOOP[0]);
  };
  const scene = () => {
    if (!ctx) return;
    const solid = rail.classList.contains('is-solid');
    const busy = [...flights].some((f) => f.src);
    fade(bed.gain, on && !solid ? (busy ? DUCK : 1) : 0, solid ? 0.6 : busy ? 0.5 : 2);
  };

  const where = (f) => f.pos + (ctx.currentTime - f.at) * f.speed;
  const cut = (f, t) => {
    if (!f?.src) return;
    fade(f.gain.gain, 0, t);
    f.src.stop(ctx.currentTime + t);
    f.src = null;
    scene();
  };
  const stopFlight = (f, t) => {
    if (!f) return;
    clearInterval(f.watch);
    f.clip.removeEventListener('ratechange', f.rate);
    cut(f, t);
  };

  // the flight follows its clip: it starts when the clip moves, from the clip's time and at its rate,
  // drops out while the clip stalls and comes back where the picture is
  const play = ({ k, clip }) => {
    const name = `flight-${k}${tall()}`, buf = buffers[name];
    if (!buf) return void get(name);
    const f = (flight = { clip, name, src: null, last: -1, still: 0, born: performance.now() });
    const begin = () => {
      const src = (f.src = ctx.createBufferSource()), gain = (f.gain = ctx.createGain());
      src.buffer = buf;
      src.playbackRate.value = f.speed = clip.playbackRate;
      src.connect(gain).connect(out);
      if (f.again) { gain.gain.value = 0; fade(gain.gain, 1, 0.12); }
      f.again = true;
      f.pos = clip.currentTime;
      f.at = ctx.currentTime;
      src.start(0, f.pos);
      src.onended = () => { if (f.src === src) f.src = null; if (!f.src) flights.delete(f); scene(); };
      flights.add(f);
      scene();
    };
    f.rate = () => {
      if (!f.src) return;
      f.pos = where(f);
      f.at = ctx.currentTime;
      f.speed = clip.playbackRate;
      f.src.playbackRate.setValueAtTime(f.speed, ctx.currentTime);
    };
    clip.addEventListener('ratechange', f.rate);
    f.watch = setInterval(() => {
      const ct = clip.currentTime;
      // past the end of the picture the tail plays on by itself
      if (clip.ended || ct >= clip.duration - 0.1) { clearInterval(f.watch); clip.removeEventListener('ratechange', f.rate); return; }
      const moving = ct !== f.last && !clip.paused;
      f.last = ct;
      f.still = moving ? 0 : f.still + 1;
      if (f.src && (f.still > 1 || Math.abs(where(f) - ct) > 0.12)) cut(f, 0.15);
      else if (!f.src && moving && ct > 0) begin();
      else if (!f.again && performance.now() - f.born > 1500) stopFlight(f, 0);
    }, 100);
  };
  zal.addEventListener('zal:flight', (e) => { if (on) play(e.detail); });
  zal.addEventListener('zal:cancel', () => { stopFlight(flight, 0.15); flight = null; });

  zal.querySelector('.cord')?.addEventListener('click', () => {
    if (!on || !buffers.chain) return;
    const s = ctx.createBufferSource();
    s.buffer = buffers.chain;
    s.connect(out);
    s.start();
  });

  const toggle = (want) => {
    on = want;
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? btn.dataset.turnOff : btn.dataset.turnOn);
    if (on) {
      if (!ctx) {
        ctx = new AC();
        out = ctx.createGain();
        bed = ctx.createGain();
        out.gain.value = bed.gain.value = 0;
        bed.connect(out);
        out.connect(ctx.destination);
        // older iOS opens the output only for a sound started inside the tap
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, 22050);
        s.connect(ctx.destination);
        s.start();
      }
      if (navigator.audioSession) navigator.audioSession.type = 'playback'; // heard with the ring switch off, like a video
      clearTimeout(sleep);
      ctx.resume();
      fade(out.gain, 1, 0.3);
      get('jazz').then(startBed);
      get('chain');
      for (let k = 1; k <= 5; k++) get(`flight-${k}${tall()}`);
      scene();
    } else if (ctx) {
      for (const f of flights) stopFlight(f, 0.3);
      stopFlight(flight, 0.3);
      flight = null;
      fade(out.gain, 0, 0.3);
      sleep = setTimeout(() => ctx.suspend(), 450);
    }
  };
  btn.addEventListener('click', () => toggle(!on));

  // the toggle exists only while the film plays
  const fit = () => {
    const ok = zal.classList.contains('is-live') && zal.classList.contains('is-film');
    if (btn.hidden !== !ok) { btn.hidden = !ok; rail.classList.toggle('has-sound', ok); }
    if (!ok && on) toggle(false);
  };
  new MutationObserver(fit).observe(zal, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(scene).observe(rail, { attributes: true, attributeFilter: ['class'] });
  fit();
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  // read-only state for checks
  window.sdSound = Object.freeze({
    get on() { return on; },
    get state() { return ctx ? ctx.state : 'none'; },
    get playing() {
      const list = [];
      if (on && bedOn && ctx.state === 'running' && bed.gain.value > 0.01) list.push('jazz');
      for (const f of flights) if (f.src) list.push(`${f.name}@${where(f).toFixed(2)}`);
      return list;
    },
    get at() { return flight?.src ? where(flight) : null; },
    get bed() { return bed ? bed.gain.value : null; },
  });
})();
