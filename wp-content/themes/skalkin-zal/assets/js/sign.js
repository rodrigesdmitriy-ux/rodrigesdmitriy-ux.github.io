// The surname painted on the hall's wall: letters are baked to a normal map from the live font
// and lit by the hall lamp and the pointer. Without WebGL2 the styled text stays as it is.
(() => {
  // Euclidean distance to the nearest empty pixel (Felzenszwalb), squared values on one line
  const edt1 = (f, n, d, v, z) => {
    let k = 0;
    v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s;
      do { const r = v[k]; s = (f[q] + q * q - f[r] - r * r) / (2 * q - 2 * r); } while (s <= z[k] && --k > -1);
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; }
  };
  const distance = (alpha, W, H) => {
    const g = new Float64Array(W * H);
    for (let i = 0; i < g.length; i++) g[i] = alpha[i] > 127 ? 1e12 : 0;
    const m = Math.max(W, H), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) f[y] = g[x + y * W];
      edt1(f, H, d, v, z);
      for (let y = 0; y < H; y++) g[x + y * W] = d[y];
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) f[x] = g[x + y * W];
      edt1(f, W, d, v, z);
      for (let x = 0; x < W; x++) g[x + y * W] = Math.sqrt(d[x]);
    }
    return g;
  };

  // 3x3 box, so the normals of a curve do not step
  const smooth = (a, W, H) => {
    const o = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      const u = Math.max(0, y - 1) * W, m = y * W, d = Math.min(H - 1, y + 1) * W;
      for (let x = 0; x < W; x++) {
        const l = Math.max(0, x - 1), r = Math.min(W - 1, x + 1);
        o[m + x] = (a[u + l] + a[u + x] + a[u + r] + a[m + l] + a[m + x] + a[m + r] + a[d + l] + a[d + x] + a[d + r]) / 9;
      }
    }
    return o;
  };

  // RG: normal, B: letter coverage, A: height
  const bake = (lines, W, H, bevel) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff';
    x.textBaseline = 'alphabetic';
    for (const l of lines) {
      x.font = l.font;
      if ('letterSpacing' in x) { x.letterSpacing = l.spacing; x.fillText(l.text, l.x, l.y); continue; }
      let at = l.x; // browsers without canvas letter spacing set it glyph by glyph
      for (const ch of l.text) { x.fillText(ch, at, l.y); at += x.measureText(ch).width + parseFloat(l.spacing); }
    }
    const px = x.getImageData(0, 0, W, H).data;
    const alpha = new Uint8Array(W * H);
    for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4 + 3];
    const dist = distance(alpha, W, H);
    let h = new Float32Array(W * H);
    for (let i = 0; i < h.length; i++) h[i] = alpha[i] > 127 ? Math.min((dist[i] - 1 + alpha[i] / 255) / bevel, 1) : 0;
    h = smooth(smooth(h, W, H), W, H);
    const out = new Uint8Array(W * H * 4);
    const at = (a, b) => h[Math.max(0, Math.min(W - 1, a)) + Math.max(0, Math.min(H - 1, b)) * W];
    for (let b = 0; b < H; b++) {
      for (let a = 0; a < W; a++) {
        const i = a + b * W, o = i * 4;
        const nx = at(a - 1, b - 1) + 2 * at(a - 1, b) + at(a - 1, b + 1) - at(a + 1, b - 1) - 2 * at(a + 1, b) - at(a + 1, b + 1);
        const ny = at(a - 1, b - 1) + 2 * at(a, b - 1) + at(a + 1, b - 1) - at(a - 1, b + 1) - 2 * at(a, b + 1) - at(a + 1, b + 1);
        out[o] = Math.max(0, Math.min(255, 127.5 + nx * bevel * 11));
        out[o + 1] = Math.max(0, Math.min(255, 127.5 - ny * bevel * 11));
        out[o + 2] = alpha[i];
        out[o + 3] = h[i] * 255;
      }
    }
    return out;
  };

  const VS = `#version 300 es
  out vec2 v; void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); v = p; gl_Position = vec4(p * 2. - 1., 0., 1.); }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 v; out vec4 o;
  uniform sampler2D map;
  uniform vec2 res;    // px
  uniform vec2 lamp;   // beam centre x, in width fractions; beam half width
  uniform vec3 ptr;    // pointer x, y in canvas fractions, strength
  uniform float on;    // lamp, 0..1
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 uv = vec2(v.x, 1. - v.y);
    vec4 t = texture(map, uv);
    float a = t.b;
    float aspect = res.x / res.y;
    vec3 P = vec3(v.x * aspect, v.y, 0.);
    vec3 V = vec3(0., 0., 1.);

    // cast bronze: a calm face, the light lives on the chamfer
    vec3 N = normalize(vec3((t.rg - .5) * 2., 1.));
    float edge = clamp(length(t.rg - .5) * 5., 0., 1.);
    float mottle = vn(P.xy * 1.7) * .55 + vn(P.xy * 5.) * .3 + vn(P.xy * 19.) * .15;

    // lamp above the exhibit, its pool falls off along the wall
    float dx = (v.x - lamp.x) / lamp.y;
    float pool = exp(-dx * dx * .34) * on;
    vec3 Ll = normalize(vec3((lamp.x - v.x) * aspect * .5, 1.5, .85));
    float dl = max(dot(N, Ll), 0.);
    float sl = pow(max(dot(N, normalize(Ll + V)), 0.), 22.);

    // room fill, so the far letters still read
    float df = max(dot(N, normalize(vec3(0., .75, .9))), 0.);

    // pointer torch
    vec3 Lp = vec3(ptr.x * aspect, ptr.y, .42) - P;
    float d2 = dot(Lp, Lp); Lp = normalize(Lp);
    float dp = max(dot(N, Lp), 0.);
    float sp = pow(max(dot(N, normalize(Lp + V)), 0.), 40.);
    float att = ptr.z / (1. + d2 * 9.);

    float rise = mix(.5, 1., smoothstep(.12, .88, v.y));
    vec3 metal = vec3(.71, .5, .29) * (.8 + mottle * .4);
    vec3 c = metal * (df * (.05 + .36 * on) * rise + dl * pool * .95 * rise + dp * att * .85);
    c += vec3(1., .86, .62) * edge * (sl * pool * 1.05 + df * df * df * .1 * on + sp * att * .8);
    c += (h21(gl_FragCoord.xy * .37) - .5) * .008;

    // soft shadow on the wall: letters stand off it, the lamp is above and to the side
    float sh = 0.;
    for (int i = 1; i <= 5; i++) {
      float k = float(i) / 5.;
      sh += textureLod(map, uv + vec2((v.x - lamp.x) * .02 * k, -.06 * k), 1. + 2.6 * k).b;
    }
    sh *= .2 * .82;
    o = vec4(max(c, 0.) * a, a + (1. - a) * sh);
  }`;

  const shader = (gl, type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };

  // the canvas covers `box`; every [data-sign-line] inside it is drawn in its own computed font
  window.Sign = (box, { beam = [0.5, 0.22], still = false } = {}) => {
    const canvas = box.querySelector('canvas');
    const gl = canvas && canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) return null;
    let U;
    const setup = () => {
      const prog = gl.createProgram();
      gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);
      gl.bindVertexArray(gl.createVertexArray());
      const u = (n) => gl.getUniformLocation(prog, n);
      U = { res: u('res'), lamp: u('lamp'), ptr: u('ptr'), on: u('on') };
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return true;
    };
    if (!setup()) return null;

    const state = { on: still ? 1 : 0, px: 0.5, py: 0.5, tx: 0.5, ty: 0.5, tz: 0, pz: 0, raf: 0, last: 0, run: false, touch: matchMedia('(pointer: coarse)').matches, t0: performance.now() };

    const layout = () => {
      const b = box.getBoundingClientRect();
      const scale = Math.min(devicePixelRatio || 1, 3, 4096 / b.width);
      const W = Math.round(b.width * scale), H = Math.round(b.height * scale);
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U.res, W, H);
      const lines = [...box.querySelectorAll('[data-sign-line]')].map((el) => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        const font = `${s.fontStyle} ${s.fontWeight} ${parseFloat(s.fontSize) * scale}px ${s.fontFamily}`;
        const m = document.createElement('canvas').getContext('2d');
        m.font = font;
        const q = m.measureText('Н');
        const text = s.textTransform === 'uppercase' ? el.textContent.toUpperCase() : el.textContent;
        const y = (r.top - b.top) * scale + (r.height * scale - (q.fontBoundingBoxAscent + q.fontBoundingBoxDescent)) / 2 + q.fontBoundingBoxAscent;
        return { text, font, spacing: `${parseFloat(s.letterSpacing || 0) * scale || 0}px`, x: (r.left - b.left) * scale, y };
      });
      const size = parseFloat(getComputedStyle(box.querySelector('[data-sign-line]')).fontSize) * scale;
      const px = bake(lines, W, H, Math.max(2, size * (state.bevel || 0.009)));
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.generateMipmap(gl.TEXTURE_2D);
      draw();
    };

    const draw = () => {
      gl.uniform2f(U.lamp, beam[0], beam[1]);
      gl.uniform3f(U.ptr, state.px, state.py, state.pz);
      gl.uniform1f(U.on, state.on);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now) => {
      state.raf = state.run ? requestAnimationFrame(frame) : 0;
      if (now - state.last < 32) return;
      state.last = now;
      const t = (now - state.t0) / 1000;
      if (state.touch) { // no pointer on a phone: the torch walks along the letters by itself
        state.tx = 0.5 + Math.sin(t * 0.45) * 0.42;
        state.ty = 0.55 + Math.sin(t * 0.7) * 0.25;
        state.tz = 0.8;
      }
      state.px += (state.tx - state.px) * 0.09;
      state.py += (state.ty - state.py) * 0.09;
      state.pz += (state.tz - state.pz) * 0.06;
      draw();
    };

    // the styled text stands in until the context comes back
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      cancelAnimationFrame(state.raf);
      box.classList.replace('is-lit', 'is-plain');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      if (!setup()) return;
      layout();
      box.classList.replace('is-plain', 'is-lit');
      cancelAnimationFrame(state.raf);
      if (state.run) state.raf = requestAnimationFrame(frame);
    });

    const api = {
      canvas,
      layout,
      draw,
      state,
      pointer(cx, cy) {
        const b = box.getBoundingClientRect();
        state.tx = (cx - b.left) / b.width;
        state.ty = 1 - (cy - b.top) / b.height;
        state.tz = 1;
      },
      leave() { state.tz = 0; },
      start() { if (still || state.run) return; state.run = true; state.raf = requestAnimationFrame(frame); },
      stop() { state.run = false; },
    };
    layout();
    box.classList.add('is-lit');
    return api;
  };
})();
