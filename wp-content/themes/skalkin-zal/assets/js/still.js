// Living stills: while the film rests on a stop, its still keeps a light of its own and the pointer carries a lamp,
// as on the first screen. zal.js reports the stop with zal:rest; the canvas covers the still and draws it again.
(() => {
  const root = document.querySelector('.zal');
  if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'zal__live';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) return;

  // per stop, image fractions: a point of the story, the area it plays in, the beam the dust floats in (from, to, half width)
  const LOOK = { table: 1, catalog: 2, press: 3, screens: 4, cards: 5 };
  const GEO = {
    wide: {
      table: { at: [0.5, 0.4], area: [0, 0, 1, 1], beam: [0.5, -0.05, 0.5, 0.42, 0.08] },
      catalog: { at: [0.508, 0.465], area: [0, 0, 1, 1], beam: [0.1, -0.05, 0.4, 0.55, 0.16] },
      press: { at: [0.47, 0.22], area: [0.22, 0.16, 0.78, 0.8], beam: [0.48, -0.05, 0.48, 0.3, 0.14] },
      screens: { at: [0.5, 0.45], area: [0, 0, 1, 1], beam: [0.5, -0.05, 0.5, 0.3, 0.12] },
      cards: { at: [0.5003, 0.4588], area: [0, 0, 1, 1], beam: [0.12, -0.05, 0.42, 0.45, 0.18] },
    },
    tall: {
      table: { at: [0.5, 0.45], area: [0, 0, 1, 1], beam: [0.5, -0.05, 0.5, 0.42, 0.12] },
      catalog: { at: [0.501, 0.445], area: [0, 0, 1, 1], beam: [0.3, -0.05, 0.5, 0.45, 0.25] },
      press: { at: [0.5, 0.3], area: [0.11, 0.28, 0.89, 0.79], beam: [0.52, -0.05, 0.52, 0.3, 0.2] },
      screens: { at: [0.5, 0.45], area: [0, 0, 1, 1], beam: [0.5, -0.05, 0.5, 0.2, 0.16] },
      cards: { at: [0.4983, 0.4893], area: [0, 0, 1, 1], beam: [0.2, -0.05, 0.42, 0.42, 0.22] },
    },
  };
  const PLAIN = { at: [0.5, 0.5], area: [0, 0, 1, 1], beam: [0.5, -0.05, 0.5, 0.4, 0.12] };

  const VS = `#version 300 es
  out vec2 v; void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 v; out vec4 o;
  uniform sampler2D img, cells;
  uniform vec2 cover, shift, at, texel;
  uniform vec4 area;
  uniform vec3 ptr;     // lamp in image fractions, strength
  uniform float zoom, t, amt, asp;
  uniform int look;
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
  float hgt(vec2 uv) { return luma(textureLod(img, uv, 2.).rgb); }
  void main() {
    vec2 p = vec2(v.x, 1. - v.y);
    vec2 uv = .5 + (p - .5) * cover / zoom + shift;
    vec3 c = texture(img, uv).rgb;
    float y = luma(c);
    vec3 L = c * c, warm = vec3(1., .78, .5);
    vec2 A = vec2(asp, 1.), q = (uv - at) * A;
    float rel = y / (luma(textureLod(img, uv, 5.).rgb) + .03); // brighter than the room around: lamps, brass, paper

    // the lights of the room breathe, each a little on its own
    L *= 1. + amt * smoothstep(.45, .92, y) * ((vn(uv * 6. + t * .35) - .5) * .16 + sin(t * 1.3 + uv.x * 7.) * .025);

    if (look == 1) {
      // the table: the lamps brighten one after another, from the far end of the table towards us
      float w = pow(.5 + .5 * sin(t * 1.1 - length(q) * 12.), 3.);
      L *= 1. + amt * smoothstep(.2, .6, y) * smoothstep(1., 1.6, rel) * w * 1.1;
    } else if (look == 2) {
      // the catalogue: the open drawer flares, a ring of glints leaves it over the brass of every other drawer
      float k = fract(t / 6.), d = length(q);
      float ring = exp(-pow((d - k * .9) / .04, 2.)) * (1. - k) * smoothstep(0., .08, k);
      float brass = smoothstep(1.15, 1.8, rel) * smoothstep(.04, .2, y) * smoothstep(.02, .1, c.r - c.b);
      L += amt * ring * brass * (L * 2.5 + warm * .05);
      L *= 1. + amt * exp(-dot(q, q) / .0015) * smoothstep(.45, .85, y) * .8 * exp(-k * 5.);
    } else if (look == 3) {
      // the press: a band of light climbs the stack layer by layer
      float k = fract(t / 4.5), yb = mix(area.w, area.y, k);
      float band = exp(-pow((uv.y - yb) / .03, 2.)) * step(area.x, uv.x) * step(uv.x, area.z);
      float grey = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
      L *= 1. + amt * band * smoothstep(.15, .55, y) * (1. - smoothstep(.15, .45, grey)) * 1.1;
    } else if (look >= 4) {
      vec4 m = texture(cells, uv);
      if (m.r > .5 && look == 4) {
        // the screens: pages go live one by one, a dark reload and a flash; now and then a release runs row by row
        float ph = fract(t / 12. + m.g * 7.31), on = step(m.g, .42);
        L *= (1. - amt * on * smoothstep(.9, .99, ph) * .8) * (1. + amt * on * exp(-ph * 9.) * 1.4);
        L *= 1. + amt * exp(-pow((m.b - (fract(t / 16.) * 1.4 - .2)) / .03, 2.)) * .6;
      } else if (m.r > .5) {
        // the cards: four agents take the tasks in turn, a card flares when it is done and keeps a glow for a while
        float lit = 0., kept = 0.;
        for (int w = 0; w < 4; w++) {
          float d = fract(t / 60. + float(w) * .25 + .07) - m.b;
          lit += exp(-pow(d / .0045, 2.));
          kept += d > 0. ? exp(-d / .025) : 0.;
        }
        L *= 1. + amt * (lit * 1.6 + kept * .35);
        L += amt * warm * lit * .015;
      }
      if (look == 5) L *= 1. + amt * exp(-dot(q, q) / .0005) * smoothstep(.5, .9, y) * (.2 + .2 * sin(t * 1.2));
    }

    // the pointer's lamp brings out the relief of whatever it passes
    vec2 e = texel * 4.;
    vec3 N = normalize(vec3((hgt(uv - vec2(e.x, 0.)) - hgt(uv + vec2(e.x, 0.))) * 3., (hgt(uv - vec2(0., e.y)) - hgt(uv + vec2(0., e.y))) * 3., 1.));
    vec3 Lp = vec3((ptr.xy - uv) * A, .22);
    float att = ptr.z * amt / (1. + dot(Lp, Lp) * 20.);
    Lp = normalize(Lp);
    float spec = pow(max(dot(N, normalize(Lp + vec3(0., 0., 1.))), 0.), 24.);
    L += L * warm * max(dot(N, Lp), 0.) * att * 3.2 + warm * spec * att * smoothstep(.08, .4, y) * .4 + warm * att * .004;
    o = vec4(sqrt(L), 1.);
  }`;
  // dust in the beam: drifts along it, catches the pointer's lamp and gives way to it
  const DVS = `#version 300 es
  uniform vec2 cover, shift;
  uniform vec3 ptr;
  uniform vec4 beam;
  uniform float zoom, t, amt, asp, spread, px;
  out float a;
  float h(float n) { return fract(sin(n * 91.345) * 47453.21); }
  void main() {
    float i = float(gl_VertexID), s = fract(h(i) + t * (.004 + .008 * h(i + 3.)));
    vec2 A = vec2(asp, 1.), dir = beam.zw - beam.xy, side = normalize(vec2(-dir.y, dir.x) * A) / A;
    vec2 pos = beam.xy + dir * s * 1.15 + side * (h(i + 1.) - .5) * spread * 2. * (.25 + s) + vec2(sin(t * .37 + i), cos(t * .29 + i * 1.7)) * .006;
    vec2 d = (pos - ptr.xy) * A;
    float r = length(d);
    pos += r < .1 ? d / A / max(r, 1e-3) * (.1 - r) * .3 * ptr.z : vec2(0.);
    a = sin(3.1416 * clamp(s, 0., 1.)) * (.2 + .8 * pow(.5 + .5 * sin(t * (.5 + h(i + 6.)) + i), 2.)) * amt * (1. + 2.5 * ptr.z / (1. + r * r * 120.));
    vec2 p = (pos - shift - .5) * zoom / cover + .5;
    gl_Position = vec4(p.x * 2. - 1., 1. - p.y * 2., 0., 1.);
    gl_PointSize = px * (1. + 2.5 * h(i + 7.) * h(i + 7.));
  }`;
  const DFS = `#version 300 es
  precision mediump float;
  in float a; out vec4 o;
  void main() { float r = 1. - length(gl_PointCoord - .5) * 2.; o = vec4(vec3(1., .85, .62) * a * r * r * max(r, 0.) * .6, 1.); }`;

  const program = (vs, fs) => {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    const u = {};
    for (let i = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i--;) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
    return { p, u };
  };
  const still = program(VS, FS), dust = program(DVS, DFS);
  if (!still || !dust) return;
  gl.bindVertexArray(gl.createVertexArray());
  const texture = (filter) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter === gl.LINEAR ? gl.LINEAR_MIPMAP_LINEAR : filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return t;
  };
  const imgTex = texture(gl.LINEAR), cellTex = texture(gl.NEAREST);

  const touch = matchMedia('(pointer: coarse)').matches;
  const MOTES = innerWidth < 700 ? 36 : 70;
  const S = { k: 0, amt: 0, t0: performance.now(), since: 0, last: 0, raf: 0, rest: 0, look: 0, geo: PLAIN, asp: 16 / 9, dpr: 1,
    cover: [1, 1], zoom: 1, shift: [0, 0], texel: [0, 0], tx: 0.5, ty: 0.5, tz: 0, px: 0.5, py: 0.5, pz: 0, iw: 1, ih: 1, token: 0 };

  // object-fit: cover of the still inside the canvas
  const fit = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(4.5e6 / Math.max(1, r.width * r.height)));
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const s = Math.max(r.width / S.iw, r.height / S.ih);
    S.cover = [r.width / (S.iw * s), r.height / (S.ih * s)];
    S.dpr = dpr;
    return { w: Math.round(S.iw * s * dpr), h: Math.round(S.ih * s * dpr) };
  };

  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const show = async (k) => {
    const plane = root.querySelectorAll('.zal__plane')[k - 1];
    const img = plane?.querySelector('img');
    if (!img) return;
    const token = ++S.token;
    const kind = root.dataset.film === 'tall' ? 'tall' : 'wide';
    const name = plane.dataset.look || '';
    try {
      await img.decode();
      S.iw = img.naturalWidth; S.ih = img.naturalHeight;
      plane.appendChild(canvas);
      const size = fit();
      let src = img;
      if (size.w < S.iw && window.createImageBitmap) src = await createImageBitmap(img, { resizeWidth: size.w, resizeHeight: size.h, resizeQuality: 'high' }).catch(() => img);
      const urls = (plane.dataset.light || '').split(',');
      const map = LOOK[name] >= 4 && urls[kind === 'tall' ? 1 : 0] ? await load(urls[kind === 'tall' ? 1 : 0]) : null;
      if (token !== S.token) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);
      S.texel = [1 / (src.width || S.iw), 1 / (src.height || S.ih)];
      if (src !== img) src.close?.();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, cellTex);
      if (map) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, map);
      S.look = map || LOOK[name] < 4 ? LOOK[name] || 0 : 0;
      S.geo = GEO[kind][name] || PLAIN;
      S.asp = S.iw / S.ih;
      S.k = k; S.amt = 0; S.since = performance.now();
      draw(performance.now());
      canvas.classList.add('is-on');
      run();
    } catch (e) { /* the still stays as it is */ }
  };
  const hide = () => {
    S.token++;
    S.k = 0;
    canvas.classList.remove('is-on');
    clearTimeout(S.rest);
    S.rest = setTimeout(() => { if (!S.k) { stop(); S.amt = 0; } }, 300);
  };

  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
  const draw = (now) => {
    const t = (now - S.t0) / 1000;
    S.amt = S.k ? ease(Math.min(1, (now - S.since) / 2600)) : S.amt;
    if (touch) { // no pointer: the lamp walks over the still by itself
      S.tx = 0.5 + Math.sin(t * 0.37) * 0.3;
      S.ty = 0.5 + Math.sin(t * 0.53) * 0.22;
      S.tz = 0.55;
    }
    S.px += (S.tx - S.px) * 0.08; S.py += (S.ty - S.py) * 0.08; S.pz += (S.tz - S.pz) * 0.06;
    // a slow push in, the frame leans away from the pointer
    S.zoom = 1 + S.amt * (0.014 + 0.005 * Math.sin(t * 0.18));
    const m = (1 - 1 / S.zoom) / 2;
    S.shift = [(S.px - 0.5) * 2 * m * S.cover[0] * 0.9, (S.py - 0.5) * 2 * m * S.cover[1] * 0.9];
    const lamp = [0.5 + (S.px - 0.5) * S.cover[0] / S.zoom + S.shift[0], 0.5 + (S.py - 0.5) * S.cover[1] / S.zoom + S.shift[1]];
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(still.p);
    const u = still.u;
    gl.uniform1i(u.img, 0); gl.uniform1i(u.cells, 1);
    gl.uniform2f(u.cover, S.cover[0], S.cover[1]); gl.uniform2f(u.shift, S.shift[0], S.shift[1]);
    gl.uniform2f(u.at, S.geo.at[0], S.geo.at[1]); gl.uniform2f(u.texel, S.texel[0], S.texel[1]);
    gl.uniform4f(u.area, ...S.geo.area);
    gl.uniform3f(u.ptr, lamp[0], lamp[1], S.pz);
    gl.uniform1f(u.zoom, S.zoom); gl.uniform1f(u.t, t); gl.uniform1f(u.amt, S.amt); gl.uniform1f(u.asp, S.asp);
    gl.uniform1i(u.look, S.look);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(dust.p);
    const d = dust.u, b = S.geo.beam;
    gl.uniform2f(d.cover, S.cover[0], S.cover[1]); gl.uniform2f(d.shift, S.shift[0], S.shift[1]);
    gl.uniform3f(d.ptr, lamp[0], lamp[1], S.pz);
    gl.uniform4f(d.beam, b[0], b[1], b[2], b[3]); gl.uniform1f(d.spread, b[4]);
    gl.uniform1f(d.zoom, S.zoom); gl.uniform1f(d.t, t); gl.uniform1f(d.amt, S.amt); gl.uniform1f(d.asp, S.asp);
    gl.uniform1f(d.px, 2.2 * S.dpr);
    gl.drawArrays(gl.POINTS, 0, MOTES);
  };
  const frame = (now) => {
    S.raf = requestAnimationFrame(frame);
    if (now - S.last < 32) return;
    S.last = now;
    draw(now);
  };
  const run = () => { if (!S.raf && !document.hidden) S.raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(S.raf); S.raf = 0; };

  let dead = false;
  root.addEventListener('zal:rest', (e) => { if (dead) return; if (e.detail.k) show(e.detail.k); else hide(); });
  if (!touch) {
    addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      S.tx = (e.clientX - r.left) / r.width; S.ty = (e.clientY - r.top) / r.height; S.tz = 1;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { S.tz = 0; });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (S.k) run(); });
  let wait = 0;
  addEventListener('resize', () => { clearTimeout(wait); wait = setTimeout(() => { if (S.k) show(S.k); }, 250); });
  canvas.addEventListener('webglcontextlost', () => { dead = true; hide(); canvas.remove(); });

  // read-only state for checks
  window.sdStill = Object.freeze({ get k() { return S.k; }, get amt() { return S.amt; }, get look() { return S.look; }, get running() { return !!S.raf; } });
})();
