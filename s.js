let an = null,
  da = null,
  xc = null;
let bv = 0,
  bc = 0,
  lt = 0,
  bf = 0;

function ixa(audioEl) {
  if (xc) return;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaElementSource(audioEl);
  an = ctx.createAnalyser();
  an.fftSize = 256;
  an.smoothingTimeConstant = 0.75;
  da = new Uint8Array(an.frequencyBinCount);
  src.connect(an);
  an.connect(ctx.destination);
  xc = ctx;
}

function gft() {
  if (!an || !da) return null;
  an.getByteFrequencyData(da);
  return da;
}

function gam() {
  const d = gft();
  if (!d) return 0;
  let s = 0;
  for (let i = 0; i < d.length; i++) s += d[i];
  return s / (d.length * 255);
}

function gbs() {
  if (!an || !da) return 0;
  return (da[0] + da[1] + da[2] + da[3]) / (4 * 255);
}

function dtb() {
  const bass = gbs();
  bv = bv * 0.93 + bass * 0.07;
  if (bc > 0) {
    bc--;
    return false;
  }
  if (bass > bv * 1.35 && bass > 0.25) {
    bc = 10;
    bf = 1.0;
    return true;
  }
  return false;
}

(function () {
  const canvas = document.getElementById("bg-canvas");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    65,
    innerWidth / innerHeight,
    0.1,
    500,
  );
  camera.position.z = 35;

  const mouse = { x: 0, y: 0 };
  const camLag = { x: 0, y: 0 };
  const camShake = { x: 0, y: 0 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  });

  const aVert = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
  const aFrag = `
    uniform float uT;
    uniform float uI;
    uniform float uBeat;
    varying vec2 vUv;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
    void main(){
      vec2 uv = vUv;
      float t = uT * 0.22;
      float nx = n(uv * 3.0 + t * 0.4) * 0.05 + n(uv * 6.0 - t * 0.3) * 0.025;
      float ny = n(uv * 2.5 - t * 0.5) * 0.04;
      vec2 w = uv + vec2(nx, ny);
      float y1 = sin(w.x * 7.0 + t) * 0.07 + sin(w.x * 3.0 - t * 0.8) * 0.04;
      float b1=smoothstep(0.22+y1,0.30+y1,w.y)*(1.0-smoothstep(0.46+y1,0.56+y1,w.y));
      float y2=sin(w.x*5.5-t*1.3)*0.06+sin(w.x*11.0+t*0.45)*0.03;
      float b2=smoothstep(0.5+y2,0.58+y2,w.y)*(1.0-smoothstep(0.70+y2,0.78+y2,w.y));
      float y3=sin(w.x*9.0+t*0.9)*0.05+sin(w.x*4.0-t*1.1)*0.03;
      float b3=smoothstep(0.62+y3,0.70+y3,w.y)*(1.0-smoothstep(0.85+y3,0.92+y3,w.y));
      float bot=(1.0-smoothstep(0.0,0.40,w.y))*0.28;
      float top=(1.0-smoothstep(0.60,1.0,w.y))*0.18;
      vec3 green=vec3(0.08,0.74,0.30);
      vec3 teal=vec3(0.04,0.46,0.68);
      vec3 indigo=vec3(0.28,0.04,0.60);
      vec3 gold=vec3(0.60,0.40,0.04);
      vec3 botCol=vec3(0.05,0.28,0.18);
      vec3 col=green*b1+teal*b2*0.8+indigo*top+botCol*bot+gold*b3*0.4;
      float beatBoost=uBeat*0.4;
      float a=(b1*0.28+b2*0.20+b3*0.15+bot*0.09+top*0.06+beatBoost)*(uI+uBeat*0.5);
      gl_FragColor=vec4(col,min(a,0.9));
    }
  `;
  const aU = { uT: { value: 0 }, uI: { value: 0.9 }, uBeat: { value: 0 } };
  const ar = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 180, 1, 1),
    new THREE.ShaderMaterial({
      vertexShader: aVert,
      fragmentShader: aFrag,
      uniforms: aU,
      transparent: true,
      depthWrite: false,
    }),
  );
  ar.position.z = -60;
  scene.add(ar);

  const ig = new THREE.IcosahedronGeometry(9, 5);
  const ig2 = new THREE.IcosahedronGeometry(6.5, 4);
  const ig3 = new THREE.IcosahedronGeometry(4.5, 3);
  const oP1 = ig.attributes.position.array.slice();
  const oP2 = ig2.attributes.position.array.slice();
  const oP3 = ig3.attributes.position.array.slice();
  const im = new THREE.Mesh(
    ig,
    new THREE.MeshBasicMaterial({
      color: 0x1db954,
      wireframe: true,
      transparent: true,
      opacity: 0.065,
    }),
  );
  const im2 = new THREE.Mesh(
    ig2,
    new THREE.MeshBasicMaterial({
      color: 0x0aafcf,
      wireframe: true,
      transparent: true,
      opacity: 0.045,
    }),
  );
  const im3 = new THREE.Mesh(
    ig3,
    new THREE.MeshBasicMaterial({
      color: 0xaa22ff,
      wireframe: true,
      transparent: true,
      opacity: 0.055,
    }),
  );
  im.position.set(0, 0, -14);
  im2.position.set(-16, 7, -22);
  im3.position.set(18, -8, -18);
  [im, im2, im3].forEach((m) => scene.add(m));
  function mio(geo, orig, t, amp, ph) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const i3 = i * 3;
      const ox = orig[i3],
        oy = orig[i3 + 1],
        oz = orig[i3 + 2];
      const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
      if (len < 0.001) continue;
      const nx = ox / len,
        ny = oy / len,
        nz = oz / len;
      const w =
        Math.sin(nx * 3.8 + t * 0.85 + ph) *
        Math.cos(ny * 3.4 + t * 0.65) *
        Math.sin(nz * 4.0 + t * 1.15 + ph * 0.6);
      const d = 1.0 + w * amp;
      pos.array[i3] = ox * d;
      pos.array[i3 + 1] = oy * d;
      pos.array[i3 + 2] = oz * d;
    }
    pos.needsUpdate = true;
  }

  const td = [
    {
      r: 17,
      t: 0.3,
      s: [100, 8],
      c: 0x1db954,
      o: 0.09,
      rx: 0.3,
      ry: 0,
      rz: 0,
      px: 0,
      py: 0,
      pz: -28,
      sp: [0.001, 0.002, 0],
    },
    {
      r: 11,
      t: 0.18,
      s: [80, 6],
      c: 0x0a9fbc,
      o: 0.07,
      rx: 1.1,
      ry: 0.3,
      rz: 0.5,
      px: 13,
      py: -6,
      pz: -20,
      sp: [-0.003, 0.001, 0.002],
    },
    {
      r: 7,
      t: 0.12,
      s: [60, 6],
      c: 0x9922ee,
      o: 0.06,
      rx: 0.8,
      ry: 1.2,
      rz: 0.3,
      px: -19,
      py: 9,
      pz: -22,
      sp: [0.004, -0.002, 0.001],
    },
    {
      r: 5,
      t: 0.08,
      s: [50, 5],
      c: 0x1db954,
      o: 0.08,
      rx: 1.5,
      ry: 0,
      rz: 1.0,
      px: 7,
      py: 13,
      pz: -13,
      sp: [-0.005, 0.003, -0.002],
    },
    {
      r: 3,
      t: 0.05,
      s: [40, 4],
      c: 0x00eeff,
      o: 0.05,
      rx: 0.5,
      ry: 2.0,
      rz: 0.8,
      px: -8,
      py: -14,
      pz: -10,
      sp: [0.006, -0.004, 0.003],
    },
  ];
  const tori = td.map((cfg) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(cfg.r, cfg.t, cfg.s[1], cfg.s[0]),
      new THREE.MeshBasicMaterial({
        color: cfg.c,
        transparent: true,
        opacity: cfg.o,
      }),
    );
    mesh.rotation.set(cfg.rx, cfg.ry, cfg.rz);
    mesh.position.set(cfg.px, cfg.py, cfg.pz);
    mesh._sp = cfg.sp;
    scene.add(mesh);
    return mesh;
  });

  const tk = new THREE.Mesh(
    new THREE.TorusKnotGeometry(5.5, 0.9, 140, 12, 2, 3),
    new THREE.MeshBasicMaterial({
      color: 0x0a2e14,
      wireframe: true,
      transparent: true,
      opacity: 0.055,
    }),
  );
  tk.position.set(22, -13, -35);
  scene.add(tk);
  const tk2 = new THREE.Mesh(
    new THREE.TorusKnotGeometry(3.5, 0.55, 100, 10, 3, 5),
    new THREE.MeshBasicMaterial({
      color: 0x1a0535,
      wireframe: true,
      transparent: true,
      opacity: 0.045,
    }),
  );
  tk2.position.set(-20, 15, -30);
  scene.add(tk2);

  const gd = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 80, 30, 20),
    new THREE.MeshBasicMaterial({
      color: 0x061108,
      wireframe: true,
      transparent: true,
      opacity: 0.055,
    }),
  );
  gd.rotation.x = -Math.PI / 2.4;
  gd.position.set(0, -20, -15);
  scene.add(gd);

  const RPTS = 90;
  const rb = [
    {
      y: 0,
      z: -7,
      c: 0x1db954,
      o: 0.35,
      f: [0.32, 0.75],
      sp: [2.6, 1.9],
      a: [2.2, 1.1],
    },
    {
      y: -2,
      z: -11,
      c: 0x0a9fbc,
      o: 0.18,
      f: [0.26, 0.62],
      sp: [2.1, 1.6],
      a: [3.2, 1.6],
    },
    {
      y: 2,
      z: -14,
      c: 0xaa22ff,
      o: 0.1,
      f: [0.44, 0.92],
      sp: [3.1, 2.3],
      a: [4.5, 2.2],
    },
    {
      y: 0,
      z: -18,
      c: 0x1db954,
      o: 0.05,
      f: [0.2, 0.55],
      sp: [1.5, 1.1],
      a: [6.0, 3.0],
    },
  ];
  const rl = rb.map((def) => {
    const pts = Array.from(
      { length: RPTS },
      (_, i) => new THREE.Vector3((i / (RPTS - 1) - 0.5) * 70, def.y, def.z),
    );
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: def.c,
        transparent: true,
        opacity: def.o,
      }),
    );
    line._d = def;
    scene.add(line);
    return line;
  });
  function urb(t, amp) {
    rl.forEach((r) => {
      const d = r._d;
      const arr = r.geometry.attributes.position.array;
      for (let i = 0; i < RPTS; i++) {
        const x = (i / (RPTS - 1) - 0.5) * 70;
        const y =
          Math.sin(i * d.f[0] + t * d.sp[0]) * amp * d.a[0] +
          Math.sin(i * d.f[1] + t * d.sp[1]) * amp * d.a[1];
        arr[i * 3] = x;
        arr[i * 3 + 1] = d.y + y;
        arr[i * 3 + 2] = d.z;
      }
      r.geometry.attributes.position.needsUpdate = true;
    });
  }

  const NP = 700;
  const pPos = new Float32Array(NP * 3),
    pVel = new Float32Array(NP * 3),
    pCol = new Float32Array(NP * 3);
  const pal = [
    [0.07, 0.6, 0.22],
    [0.04, 0.35, 0.14],
    [0.05, 0.05, 0.3],
    [0.2, 0.04, 0.35],
    [0.02, 0.25, 0.3],
    [0.4, 0.12, 0.08],
  ];
  for (let i = 0; i < NP; i++) {
    const i3 = i * 3;
    pPos[i3] = (Math.random() - 0.5) * 90;
    pPos[i3 + 1] = (Math.random() - 0.5) * 65;
    pPos[i3 + 2] = (Math.random() - 0.5) * 45 - 5;
    pVel[i3] = (Math.random() - 0.5) * 0.006;
    pVel[i3 + 1] = (Math.random() - 0.5) * 0.006;
    pVel[i3 + 2] = (Math.random() - 0.5) * 0.002;
    const c = pal[Math.floor(Math.random() * pal.length)];
    pCol[i3] = c[0];
    pCol[i3 + 1] = c[1];
    pCol[i3 + 2] = c[2];
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const pMesh = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    }),
  );
  scene.add(pMesh);

  const nb = 64;
  const vg = new THREE.BoxGeometry(0.22, 1, 0.22);
  const vm = new THREE.MeshBasicMaterial({
    color: 0x1db954,
    transparent: true,
    opacity: 0.88,
  });
  const vi = new THREE.InstancedMesh(vg, vm, nb);
  vi.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(vi);
  const ni = 32;
  const vg2 = new THREE.BoxGeometry(0.18, 1, 0.18);
  const vm2 = new THREE.MeshBasicMaterial({
    color: 0x1db954,
    transparent: true,
    opacity: 0.65,
  });
  const vi2 = new THREE.InstancedMesh(vg2, vm2, ni);
  vi2.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(vi2);
  const vd = new THREE.Object3D();
  const vcl = new THREE.Color();

  for (let i = 0; i < nb; i++) vi.setColorAt(i, new THREE.Color(0x1db954));
  vi.instanceColor.needsUpdate = true;
  for (let i = 0; i < ni; i++) vi2.setColorAt(i, new THREE.Color(0x1db954));
  vi2.instanceColor.needsUpdate = true;

  const pug = new THREE.IcosahedronGeometry(3.5, 2);
  const pum = new THREE.MeshBasicMaterial({
    color: 0x1db954,
    wireframe: true,
    transparent: true,
    opacity: 0.12,
  });
  const pus = new THREE.Mesh(pug, pum);
  pus.position.set(0, 0, -6);
  scene.add(pus);

  const dg = new THREE.Group();
  const dn = 36,
    dr = 1.8,
    dh = 18;
  for (let i = 0; i < dn; i++) {
    const t = i / dn;
    const angle1 = t * Math.PI * 8;
    const angle2 = angle1 + Math.PI;
    const y = (t - 0.5) * dh;
    const s1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 6),
      new THREE.MeshBasicMaterial({
        color: 0x1db954,
        transparent: true,
        opacity: 0.45,
      }),
    );
    s1.position.set(Math.cos(angle1) * dr, y, Math.sin(angle1) * dr);
    const s2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 6),
      new THREE.MeshBasicMaterial({
        color: 0x0a9fbc,
        transparent: true,
        opacity: 0.45,
      }),
    );
    s2.position.set(Math.cos(angle2) * dr, y, Math.sin(angle2) * dr);
    dg.add(s1, s2);
    if (i % 3 === 0) {
      const rPts = [s1.position.clone(), s2.position.clone()];
      const rLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(rPts),
        new THREE.LineBasicMaterial({
          color: 0x113322,
          transparent: true,
          opacity: 0.3,
        }),
      );
      dg.add(rLine);
    }
  }
  dg.position.set(-28, 0, -18);
  scene.add(dg);

  const sg = new THREE.BufferGeometry();
  const spr = new Float32Array(300 * 3);
  for (let i = 0; i < 300 * 3; i += 3) {
    spr[i] = (Math.random() - 0.5) * 200;
    spr[i + 1] = (Math.random() - 0.5) * 150;
    spr[i + 2] = -50 - Math.random() * 50;
  }
  sg.setAttribute("position", new THREE.BufferAttribute(spr, 3));
  scene.add(
    new THREE.Points(
      sg,
      new THREE.PointsMaterial({
        size: 0.08,
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
      }),
    ),
  );

  let time = 0,
    speed = 1;
  window._setSpeed = (f) => (speed = f);

  function tick() {
    requestAnimationFrame(tick);
    time += 0.0009 * speed;
    const t = time;
    const playing = !!window._musicPlaying;
    const amp = gam();
    const bass = gbs();
    const fft = gft();
    const mpa = playing ? 0.24 + amp * 0.3 : 0.1;
    const rba = playing ? 1.0 + amp * 1.5 : 0.22;
    const tgi = playing ? 1.5 + amp * 0.8 : 0.85;
    const beat = playing && dtb();

    bf *= 0.88;
    aU.uBeat.value = bf;

    aU.uT.value = t;
    aU.uI.value += (tgi - aU.uI.value) * 0.025;

    if (beat) {
      camShake.x = (Math.random() - 0.5) * 0.6;
      camShake.y = (Math.random() - 0.5) * 0.4;
    }
    camShake.x *= 0.8;
    camShake.y *= 0.8;

    mio(ig, oP1, t * 360, mpa, 0);
    mio(ig2, oP2, t * 290, mpa * 0.7, 2.4);
    mio(ig3, oP3, t * 420, mpa * 0.9, 4.8);
    im.rotation.y = t * 36 * 0.1;
    im.rotation.x = Math.sin(t * 24 * 0.1) * 0.18;
    im2.rotation.y = -t * 28 * 0.1;
    im2.rotation.z = t * 20 * 0.1;
    im3.rotation.x = t * 32 * 0.1;
    im3.rotation.y = -t * 25 * 0.1;

    const trs = playing ? 1 + amp * 3 : 1;
    tori.forEach((tor) => {
      tor.rotation.x += tor._sp[0] * trs;
      tor.rotation.y += tor._sp[1] * trs;
      tor.rotation.z += tor._sp[2] * trs;
    });

    tk.rotation.x += 0.004;
    tk.rotation.y += 0.006 * (playing ? 1 + amp : 1);
    tk.rotation.z += 0.002;
    tk2.rotation.x -= 0.003;
    tk2.rotation.y += 0.005 * (playing ? 1 + amp : 1);
    tk2.rotation.z -= 0.003;

    gd.position.z = -15 + Math.sin(t * 10 * 0.1) * 1.5;

    urb(t * 400, rba);

    const mx = mouse.x * 38,
      my = mouse.y * 28;
    const pp = pGeo.attributes.position.array;
    const pc = pGeo.attributes.color.array;
    const baseG = playing ? 0.6 + amp * 0.4 : 0.6;
    for (let i = 0; i < NP; i++) {
      const i3 = i * 3;
      pp[i3] += pVel[i3] * speed;
      pp[i3 + 1] += pVel[i3 + 1] * speed;
      pp[i3 + 2] += pVel[i3 + 2] * speed * 0.3;
      if (pp[i3] > 45) pp[i3] = -45;
      if (pp[i3] < -45) pp[i3] = 45;
      if (pp[i3 + 1] > 33) pp[i3 + 1] = -33;
      if (pp[i3 + 1] < -33) pp[i3 + 1] = 33;
      const dx = pp[i3] - mx,
        dy = pp[i3 + 1] - my;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < 100 && dist2 > 0.01) {
        const d = Math.sqrt(dist2),
          f = ((10 - d) / 10) * 0.06;
        pp[i3] += (dx / d) * f;
        pp[i3 + 1] += (dy / d) * f;
      }

      if (beat && i % 3 === 0) {
        pc[i3 + 1] = Math.min(1, pc[i3 + 1] + 0.3);
      } else {
        pc[i3 + 1] *= 0.995;
      }
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
    pMesh.rotation.y = Math.sin(t * 3 * 0.1) * 0.12;

    const R1 = 14,
      Z1 = -14;
    const R2 = 8,
      Z2 = -9;
    for (let i = 0; i < nb; i++) {
      const angle = (i / nb) * Math.PI * 2;
      let fAmp = 0.04;
      if (fft) {
        const fi = Math.floor(i * (fft.length / nb));
        fAmp = fft[fi] / 255;
      } else {
        fAmp =
          0.03 +
          Math.abs(Math.sin(i * 0.4 + t * 200)) * 0.12 * (playing ? 1 : 0.3);
      }
      const h = playing
        ? 0.05 + fAmp * 9
        : 0.05 + Math.abs(Math.sin(i * 0.35 + t * 60)) * 0.5;
      vd.position.set(Math.cos(angle) * R1, h / 2, Math.sin(angle) * R1 + Z1);
      vd.rotation.y = -angle;
      vd.scale.set(1, h, 1);
      vd.updateMatrix();
      vi.setMatrixAt(i, vd.matrix);
      const hue = 0.35 + fAmp * 0.2;
      vcl.setHSL(hue, 1, 0.35 + fAmp * 0.4);
      vi.setColorAt(i, vcl);
    }
    vi.instanceMatrix.needsUpdate = true;
    if (vi.instanceColor) vi.instanceColor.needsUpdate = true;

    for (let i = 0; i < ni; i++) {
      const angle = (i / ni) * Math.PI * 2;
      let fAmp = 0.03;
      if (fft) {
        const fi = Math.floor(i * (8 / ni));
        fAmp = fft[fi] / 255;
      } else {
        fAmp =
          0.02 +
          Math.abs(Math.sin(i * 0.7 + t * 150)) * 0.08 * (playing ? 1 : 0.2);
      }
      const h = playing
        ? 0.03 + fAmp * 5
        : 0.03 + Math.abs(Math.sin(i * 0.7 + t * 80)) * 0.3;
      vd.position.set(Math.cos(angle) * R2, h / 2, Math.sin(angle) * R2 + Z2);
      vd.rotation.y = -angle;
      vd.scale.set(1, h, 1);
      vd.updateMatrix();
      vi2.setMatrixAt(i, vd.matrix);
      const hue2 = 0.28 + fAmp * 0.25;
      vcl.setHSL(hue2, 1, 0.4 + fAmp * 0.35);
      vi2.setColorAt(i, vcl);
    }
    vi2.instanceMatrix.needsUpdate = true;
    if (vi2.instanceColor) vi2.instanceColor.needsUpdate = true;

    const pScale = 1 + bass * (playing ? 2 : 0.3);
    pus.scale.setScalar(pScale);
    pum.opacity = 0.08 + bass * (playing ? 0.28 : 0.06);
    pus.rotation.y = t * 30 * 0.1;
    pus.rotation.x = t * 22 * 0.1;

    dg.rotation.y += 0.004 + (playing ? amp * 0.02 : 0);

    camLag.x += (mouse.x * 2.5 - camLag.x) * 0.03;
    camLag.y += (mouse.y * 1.8 - camLag.y) * 0.03;
    camera.position.x = camLag.x + camShake.x;
    camera.position.y = camLag.y + camShake.y;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  tick();

  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();

(function () {
  const dot = document.getElementById("cursor-dot");
  const ring = document.getElementById("cursor-ring");
  let cx = 0,
    cy = 0,
    rx = 0,
    ry = 0;
  document.addEventListener("mousemove", (e) => {
    cx = e.clientX;
    cy = e.clientY;
  });
  document.addEventListener("mousedown", () => dot.classList.add("click"));
  document.addEventListener("mouseup", () => dot.classList.remove("click"));
  const ints =
    "button,.nav-item,.pl-item,.card,.play-btn,.add-btn,.vol-track,.prog-track,.m-item,.q-item,.ctx-item,.hero-play-btn,.hero-queue-btn,.s-chip,.disc-wrap,.ep-disc-wrap";
  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(ints)) ring.classList.add("hover");
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(ints)) ring.classList.remove("hover");
  });
  function acr() {
    dot.style.left = cx + "px";
    dot.style.top = cy + "px";
    rx += (cx - rx) * 0.13;
    ry += (cy - ry) * 0.13;
    ring.style.left = rx + "px";
    ring.style.top = ry + "px";
    requestAnimationFrame(acr);
  }
  acr();
})();

const trk = [
  {
    id: 1,
    title: "Shape Of You",
    artist: "Ed Sheeran",
    image: "./Images/SOY.jpg",
    url: "./trk/SOY.mp3",
  },
  {
    id: 2,
    title: "Eraser",
    artist: "Ed Sheeran",
    image: "./Images/Eraser.jpg",
    url: "./trk/Eraser.mp3",
  },
  {
    id: 3,
    title: "Perfect",
    artist: "Ed Sheeran",
    image: "./Images/Perfect.jpg",
    url: "./trk/Perfect.mp3",
  },
  {
    id: 4,
    title: "Dive",
    artist: "Ed Sheeran",
    image: "./Images/dive.jpg",
    url: "./trk/Dive.mp3",
  },
  {
    id: 5,
    title: "Castle on the Hill",
    artist: "Ed Sheeran",
    image: "./Images/CH.jpg",
    url: "./trk/COTH.mp3",
  },
  {
    id: 6,
    title: "Senorita",
    artist: "Shawn Mendes",
    image: "./Images/senorita.jpg",
    url: "./trk/senorita.mp3",
  },
  {
    id: 7,
    title: "Beggin'",
    artist: "Maneskin",
    image: "./Images/beggin.jpg",
    url: "./trk/beggin.mp3",
  },
  {
    id: 8,
    title: "In Da Club",
    artist: "50 Cent",
    image: "./Images/idc.jpg",
    url: "./trk/IDC.mp3",
  },
  {
    id: 9,
    title: "Mockingbird",
    artist: "Eminem",
    image: "./Images/mokingbird.webp",
    url: "./trk/mokingbird.mp3",
  },
  {
    id: 10,
    title: "Without Me",
    artist: "Eminem",
    image: "./Images/wm.jpg",
    url: "./trk/WM.mp3",
  },
  {
    id: 11,
    title: "Chuttamalle",
    artist: "Shilpa Rao",
    image:
      "https://c.saavncdn.com/411/Chuttamalle-From-Devara-Part-1-Telugu-2024-20240805181008-500x500.jpg",
    url: "./trk/cuttamalle.mp3",
  },
  {
    id: 12,
    title: "Fa9la",
    artist: "Dhurandhar",
    image: "https://f4.bcbits.com/img/a0293569019_10.jpg",
    url: "./trk/Fa9la.mp3",
  },
  {
    id: 13,
    title: "Shararat",
    artist: "Madhubanti Bagchi",
    image:
      "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcQNBWCoOPC4_xoIliH98qxgtU_6KeWfOJ7cBalt5TC2wb4iZ-Wl",
    url: "./trk/shararat.mp3",
  },
  {
    id: 14,
    title: "Kajra Re",
    artist: "Alisha, Shankar Mahadeevan",
    image: "https://e.snmc.io/i/300/w/ef7b33b93f3fd483ec81e58b6d368988/3696465",
    url: "./trk/kajra.mp3",
  },
  {
    id: 15,
    title: "Kala Chasma",
    artist: "Badshah",
    image:
      "https://www.koimoi.com/wp-content/new-galleries/2016/07/kala-chashma-song-teaser-ft-katrina-kaif-sidharth-malhotra-2.jpg",
    url: "./trk/kala.mp3",
  },
  {
    id: 16,
    title: "Kali Kali Zulfon",
    artist: "Ustad Rahat Fateh Ali Khan",
    image:
      "https://c.saavncdn.com/798/Kali-Kali-Zulfon-Urdu-2025-20250912171624-500x500.jpg",
    url: "./trk/kkz.mp3",
  },
  {
    id: 17,
    title: "Mere Rashke Qamar",
    artist: "Ustad Nusrat Fateh Ali Khan",
    image: "https://i.scdn.co/image/ab67616d00001e020d76db2dd35753ff5e24f84f",
    url: "./trk/mrq.mp3",
  },
  {
    id: 18,
    title: "Sanson ki Mala",
    artist: "Ustad Nusrat Fateh Ali Khan",
    image: "https://i.scdn.co/image/ab67616d00001e02d1a78643014371ca49d7cb22",
    url: "./trk/skm.mp3",
  },
  {
    id: 19,
    title: "Sochta Houn",
    artist: "Ustad Nusrat Fateh Ali Khan",
    image: "https://i.scdn.co/image/ab67616d00001e023a9bb6cf6865fd47824e8726",
    url: "./trk/shkwkmt.mp3",
  },
  {
    id: 20,
    title: "Ye Tune Kya Kiya",
    artist: "Javed Bhasir",
    image: "https://i.ytimg.com/vi/BguYbxZKGOE/hqdefault.jpg?v=61eef018",
    url: "./trk/ytkk.mp3",
  },
];

let pls = [
  { id: 1, name: "Chill Vibes", trk: [] },
  { id: 2, name: "Workout Mix", trk: [] },
  { id: 3, name: "Focus Flow", trk: [] },
  { id: 4, name: "Party Hits", trk: [] },
  { id: 5, name: "Road Trip", trk: [] },
];
let plc = 6;
const lk = new Set();
const aud = new Audio();
const S = {
  current: null,
  playing: false,
  shuffle: false,
  repeat: "off",
  volume: 0.7,
  prevVol: 0.7,
  curPL: null,
};
let queue = [];
let rcy = [];
let cx = null;
let hi = 0,
  ht = null;

const viz = document.getElementById("viz");
const vctx = viz.getContext("2d");
function dvz() {
  requestAnimationFrame(dvz);
  const W = viz.offsetWidth;
  const H = 36;
  viz.width = W;
  viz.height = H;
  vctx.clearRect(0, 0, W, H);
  if (!S.playing) return;
  const bars = 52,
    bw = Math.floor(W / bars) - 1,
    t = Date.now() / 700;
  let fftData = null;
  if (an && da) {
    an.getByteFrequencyData(da);
    fftData = da;
  }
  for (let i = 0; i < bars; i++) {
    let raw;
    if (fftData) {
      raw = fftData[Math.floor((i * fftData.length) / bars)] / 255;
    } else {
      const phase = (i / bars) * Math.PI * 4;
      raw =
        Math.abs(Math.sin(phase + t * 1.4)) * 0.5 +
        Math.abs(Math.sin(phase * 1.7 + t * 0.95)) * 0.3 +
        Math.abs(Math.sin(phase * 0.5 + t * 2.2)) * 0.2;
    }
    const h = Math.max(2, raw * H * 0.92),
      x = i * (bw + 1),
      y = H - h,
      alpha = 0.3 + (h / H) * 0.7;
    const grad = vctx.createLinearGradient(0, y, 0, H);
    grad.addColorStop(0, `rgba(29,185,84,${alpha})`);
    grad.addColorStop(1, `rgba(29,185,84,${alpha * 0.3})`);
    vctx.fillStyle = grad;
    if (vctx.roundRect) {
      vctx.beginPath();
      vctx.roundRect(x, y, bw, h, 2);
      vctx.fill();
    } else vctx.fillRect(x, y, bw, h);
  }
}
dvz();

const fmt = (s) =>
  isNaN(s)
    ? "0:00"
    : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

aud.addEventListener("timeupdate", () => {
  if (!isNaN(aud.duration)) {
    const p = (aud.currentTime / aud.duration) * 100;
    document.getElementById("prog-fill").style.width = p + "%";
    document.getElementById("t-cur").textContent = fmt(aud.currentTime);
    document.getElementById("t-dur").textContent = fmt(aud.duration);

    if (document.getElementById("ep-prog-fill"))
      document.getElementById("ep-prog-fill").style.width = p + "%";
    if (document.getElementById("ep-t-cur"))
      document.getElementById("ep-t-cur").textContent = fmt(aud.currentTime);
  }
});
aud.addEventListener("ended", () => {
  if (S.repeat === "one") {
    aud.currentTime = 0;
    aud.play();
  } else pn();
});
aud.addEventListener("loadedmetadata", () => {
  document.getElementById("t-dur").textContent = fmt(aud.duration);
  if (document.getElementById("ep-t-dur"))
    document.getElementById("ep-t-dur").textContent = fmt(aud.duration);
});
aud.addEventListener("error", () => st("Could not load this track"));

function ps(song) {
  if (S.current?.id === song.id) {
    tp();
    return;
  }
  S.current = song;
  aud.src = song.url;
  aud.load();
  aud.volume = S.volume;
  ixa(aud);
  if (xc && xc.state === "suspended") xc.resume();
  rcy = rcy.filter((s) => s.id !== song.id);
  rcy.unshift(song);
  if (rcy.length > 10) rcy.pop();
  const onReady = () => {
    aud.removeEventListener("canplay", onReady);
    aud
      .play()
      .then(() => {
        S.playing = true;
        window._musicPlaying = true;
        ui();
        uh();
        window._setSpeed?.(3);
      })
      .catch(() => st("Tap play to start ▶"));
  };
  aud.addEventListener("canplay", onReady);
  ui();
  uh();
  rqp();
}

function tp() {
  if (!S.current) {
    ps(trk[0]);
    return;
  }
  ixa(aud);
  if (xc && xc.state === "suspended") xc.resume();
  if (aud.paused) {
    aud.play().then(() => {
      S.playing = true;
      window._musicPlaying = true;
      ui();
      window._setSpeed?.(3);
    });
  } else {
    aud.pause();
    S.playing = false;
    window._musicPlaying = false;
    ui();
    window._setSpeed?.(1);
  }
}

function pn() {
  if (!S.current) {
    ps(trk[0]);
    return;
  }
  if (queue.length > 0) {
    const next = queue.shift();
    rqp();
    ps(next);
    return;
  }
  const list = S.curPL ? S.curPL.trk : trk;
  if (!list.length) return;
  if (S.shuffle) {
    ps(list[Math.floor(Math.random() * list.length)]);
  } else {
    const idx = list.findIndex((s) => s.id === S.current.id);
    if (idx === -1 || idx === list.length - 1) {
      if (S.repeat !== "off") ps(list[0]);
      else {
        S.playing = false;
        window._musicPlaying = false;
        ui();
      }
    } else ps(list[idx + 1]);
  }
}

function ppv() {
  if (!S.current) {
    ps(trk[0]);
    return;
  }
  if (aud.currentTime > 3) {
    aud.currentTime = 0;
    return;
  }
  const list = S.curPL ? S.curPL.trk : trk;
  if (!list.length) return;
  const idx = list.findIndex((s) => s.id === S.current.id);
  ps(list[(idx - 1 + list.length) % list.length]);
}

function aq(song) {
  queue.push(song);
  st(`"${song.title}" added to queue ✓`);
  rqp();
}

function ui() {
  const song = S.current;
  const player = document.getElementById("player-bar");
  if (song) {
    document.getElementById("np-img").src = song.image;
    document.getElementById("np-title").textContent = song.title;
    document.getElementById("np-artist").textContent = song.artist;
    const lb = document.getElementById("like-btn");
    if (lk.has(song.id)) {
      lb.textContent = "♥";
      lb.classList.add("liked");
    } else {
      lb.textContent = "♡";
      lb.classList.remove("liked");
    }

    uep(song);
  }
  const disc = document.getElementById("disc");
  const pp = document.getElementById("btn-play");
  const epDisc = document.getElementById("ep-disc");
  const epPP = document.getElementById("ep-btn-play");
  if (S.playing) {
    disc.classList.add("spinning", "playing-glow");
    pp.textContent = "⏸";
    player.classList.add("is-playing");
    if (epDisc) epDisc.classList.add("spin");
    if (epPP) epPP.textContent = "⏸";
  } else {
    disc.classList.remove("spinning", "playing-glow");
    pp.textContent = "▶";
    player.classList.remove("is-playing");
    if (epDisc) epDisc.classList.remove("spin");
    if (epPP) epPP.textContent = "▶";
  }
}

function uep(song) {
  if (!song) return;
  const ei = document.getElementById("ep-img");
  const eb = document.getElementById("ep-bg");
  const et = document.getElementById("ep-song-title");
  const ea = document.getElementById("ep-song-artist");
  const el = document.getElementById("ep-like-btn");
  const ell = document.getElementById("ep-like-label");
  if (ei) ei.src = song.image;
  if (eb) eb.style.backgroundImage = `url(${song.image})`;
  if (et) et.textContent = song.title;
  if (ea) ea.textContent = song.artist;
  if (el) {
    if (lk.has(song.id)) {
      el.textContent = "♥";
      el.classList.add("liked");
      if (ell) ell.textContent = "Saved to Liked Songs";
    } else {
      el.textContent = "♡";
      el.classList.remove("liked");
      if (ell) ell.textContent = "Add to Liked Songs";
    }
  }
}

function uh() {
  document
    .querySelectorAll(".card")
    .forEach((c) => c.classList.remove("playing"));
  if (S.current)
    document
      .querySelectorAll(`.card[data-id="${S.current.id}"]`)
      .forEach((c) => c.classList.add("playing"));
}

function mc(song) {
  const c = document.createElement("div");
  c.className = "card";
  c.dataset.id = song.id;
  if (S.current?.id === song.id) c.classList.add("playing");
  c.innerHTML = `
    <div class="c-art">
      <img src="${song.image}" alt="${song.title}" loading="lazy"
           onerror="this.src='https://picsum.photos/seed/${song.id}/200'">
    </div>
    <div class="c-title">${song.title}</div>
    <div class="c-sub artist-link" data-artist="${song.artist}">${song.artist}</div>
    <div class="play-btn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
    <div class="add-btn">+</div>
    <div class="now-bars"><span></span><span></span><span></span></div>
  `;
  c.onclick = () => ps(song);
  c.querySelector(".play-btn").onclick = (e) => {
    e.stopPropagation();
    ps(song);
  };
  c.querySelector(".add-btn").onclick = (e) => {
    e.stopPropagation();
    om(song);
  };
  c.querySelector(".c-sub").onclick = (e) => {
    e.stopPropagation();
    ra(song.artist);
  };
  c.addEventListener("mousemove", (e) => {
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = `translateY(-6px) scale(1.015) perspective(500px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg)`;
    c.style.transition =
      "border-color .38s ease,background .38s ease,box-shadow .38s ease";
  });
  c.addEventListener("mouseleave", () => {
    c.style.transform = "";
    c.style.transition = "";
  });
  c.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    scm(e, song);
  });
  return c;
}

function fg(id, list) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = "";
  list.forEach((s) => el.appendChild(mc(s)));
}

const ms = document.getElementById("main-scroll");

function gr() {
  const h = new Date().getHours();
  return h < 12
    ? "Good morning ☀️"
    : h < 17
      ? "Good afternoon 🌤"
      : "Good evening 🌙";
}

let hv = null;
const hf = trk.slice(0, 5);

function rh() {
  clearInterval(hv);
  const recent = rcy.length ? rcy : trk.slice(0, 5);
  ms.innerHTML = `
    <!-- Hero -->
    <div class="hero-section" id="hero-section" style="transition:opacity .3s">
      <div class="hero-bg" id="hero-bg"></div>
      <div class="hero-tint"></div>
      <div class="hero-content">
        <div class="hero-art"><img id="hero-img" src="" alt=""></div>
        <div>
          <div class="hero-badge">🎵 Featured</div>
          <div class="hero-title" id="hero-title"></div>
          <div class="hero-artist" id="hero-artist"></div>
          <div class="hero-actions">
            <button class="hero-play-btn" id="hero-play">▶ Play Now</button>
            <button class="hero-queue-btn" id="hero-queue">＋ Add to Queue</button>
          </div>
        </div>
      </div>
      <div class="hero-dots" id="hero-dots"></div>
    </div>

    <h1 class="greeting">${gr()}</h1>
    <p class="greeting-sub">Here's what's trending for you today</p>
    ${rcy.length ? '<h2 class="sec">Recently Played</h2><div class="grid" id="g-recent"></div>' : ""}
    <h2 class="sec">Recommended</h2><div class="grid" id="g-rec"></div>
    <h2 class="sec">Indian Songs</h2><div class="grid" id="g-indian"></div>
    <h2 class="sec">Qawali</h2><div class="grid" id="g-qawali"></div>
  `;
  if (rcy.length) fg("g-recent", recent.slice(0, 5));
  fg("g-rec", trk.slice(5, 10));
  fg("g-indian", trk.slice(10, 15));
  fg("g-qawali", trk.slice(15, 20));
  const dotsEl = document.getElementById("hero-dots");
  hf.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "hero-dot" + (i === 0 ? " active" : "");
    d.onclick = () => {
      hi = i;
      ux(true);
    };
    dotsEl.appendChild(d);
  });
  hi = 0;
  ux(false);
  hv = setInterval(() => {
    const hs = document.getElementById("hero-section");
    if (!hs) {
      clearInterval(hv);
      return;
    }
    hs.style.opacity = "0";
    setTimeout(() => {
      hi = (hi + 1) % hf.length;
      ux(false);
      hs.style.opacity = "1";
    }, 300);
  }, 5000);
}

function ux(userClick) {
  const song = hf[hi];
  const hbg = document.getElementById("hero-bg");
  const himg = document.getElementById("hero-img");
  const htit = document.getElementById("hero-title");
  const hart = document.getElementById("hero-artist");
  const hplay = document.getElementById("hero-play");
  const hq = document.getElementById("hero-queue");
  if (!hbg) return;
  hbg.style.backgroundImage = `url(${song.image})`;
  himg.src = song.image;
  himg.onerror = () => (himg.src = `https://picsum.photos/seed/${song.id}/200`);
  htit.textContent = song.title;
  hart.textContent = song.artist;
  hplay.onclick = () => ps(song);
  hq.onclick = () => aq(song);
  document
    .querySelectorAll(".hero-dot")
    .forEach((d, i) => d.classList.toggle("active", i === hi));
}

const gn = [
  { label: "🎵 All", filter: null },
  { label: "🇬🇧 Ed Sheeran", filter: "Ed Sheeran" },
  { label: "🎤 Hip-Hop", filter: "Eminem,50 Cent" },
  {
    label: "🌶️ Indian",
    filter: "Shilpa Rao,Badshah,Madhubanti Bagchi,Alisha, Shankar Mahadeevan",
  },
  {
    label: "🎶 Qawali",
    filter:
      "Ustad Nusrat Fateh Ali Khan,Ustad Rahat Fateh Ali Khan,Javed Bhasir",
  },
  { label: "🌍 Pop", filter: "Shawn Mendes,Maneskin" },
];

function rs() {
  clearInterval(hv);
  ms.innerHTML = `
    <h1 class="greeting" style="margin-bottom:16px">Search</h1>
    <div class="s-wrap">
      <span class="s-ico">⌕</span>
      <input class="s-inp" id="s-inp" placeholder="Search trk, artists…" autofocus>
    </div>
    <div class="s-chips" id="s-chips"></div>
    <h2 class="sec">Results</h2>
    <div class="grid" id="g-search"></div>
  `;
  const inp = document.getElementById("s-inp");
  const chipsEl = document.getElementById("s-chips");
  let activeGenre = null;
  gn.forEach((g) => {
    const ch = document.createElement("div");
    ch.className = "s-chip" + (g.filter === null ? " active" : "");
    ch.textContent = g.label;
    ch.onclick = () => {
      activeGenre = g.filter;
      document
        .querySelectorAll(".s-chip")
        .forEach((c) => c.classList.remove("active"));
      ch.classList.add("active");
      run();
    };
    chipsEl.appendChild(ch);
  });
  const run = () => {
    const q = inp.value.toLowerCase().trim();
    let list = trk;
    if (activeGenre) {
      const artists = activeGenre.split(",").map((a) => a.toLowerCase().trim());
      list = list.filter((s) =>
        artists.some((a) => s.artist.toLowerCase().includes(a)),
      );
    }
    if (q)
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q),
      );
    fg("g-search", list);
  };
  inp.addEventListener("input", run);
  run();
}

function rl() {
  clearInterval(hv);
  ms.innerHTML = `
    <h1 class="greeting">Your Library</h1>
    <button class="new-btn" id="btn-new">＋ New Playlist</button>
    <div class="grid" id="g-lib"></div>
  `;
  document.getElementById("btn-new").onclick = cpl;
  const grid = document.getElementById("g-lib");
  pls.forEach((pl) => {
    const c = document.createElement("div");
    c.className = "card";
    c.innerHTML = `
      <div class="c-art" style="background:linear-gradient(135deg,#071d0e 0%,#150730 100%);
        display:flex;align-items:center;justify-content:center;font-size:42px">🎵</div>
      <div class="c-title">${pl.name}</div>
      <div class="c-sub">${pl.trk.length} song${pl.trk.length !== 1 ? "s" : ""}</div>
      <div class="play-btn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
    `;
    c.addEventListener("mousemove", (e) => {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = `translateY(-6px) scale(1.015) perspective(500px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg)`;
      c.style.transition =
        "border-color .38s ease,background .38s ease,box-shadow .38s ease";
    });
    c.addEventListener("mouseleave", () => {
      c.style.transform = "";
      c.style.transition = "";
    });
    c.onclick = () => rpl(pl);
    c.querySelector(".play-btn").onclick = (e) => {
      e.stopPropagation();
      if (pl.trk.length) {
        S.curPL = pl;
        ps(pl.trk[0]);
      } else st("This playlist is empty");
    };
    grid.appendChild(c);
  });
}

function rpl(pl) {
  clearInterval(hv);
  ms.innerHTML = `
    <button class="back-btn" id="back-btn">← Back to Library</button>
    <h1 class="greeting">${pl.name}</h1>
    <p class="greeting-sub" style="margin-bottom:24px">${pl.trk.length} song${pl.trk.length !== 1 ? "s" : ""}</p>
    ${pl.trk.length ? '<div class="grid" id="g-pl"></div>' : '<p style="color:var(--muted);margin-top:16px">Empty playlist — add trk from Home or Search.</p>'}
  `;
  document.getElementById("back-btn").onclick = rl;
  if (pl.trk.length) {
    const grid = document.getElementById("g-pl");
    pl.trk.forEach((song) => {
      const card = mc(song);
      const rem = document.createElement("div");
      rem.className = "add-btn";
      rem.style = "right:62px;font-size:20px";
      rem.textContent = "×";
      rem.title = "Remove";
      rem.onclick = (e) => {
        e.stopPropagation();
        pl.trk = pl.trk.filter((s) => s.id !== song.id);
        rpl(pl);
      };
      card.appendChild(rem);
      grid.appendChild(card);
    });
  }
}

function rlk() {
  clearInterval(hv);
  const liked = trk.filter((s) => lk.has(s.id));
  ms.innerHTML = `
    <button class="back-btn" id="back-btn">← Back</button>
    <h1 class="greeting">Liked Songs ♥</h1>
    <p class="greeting-sub" style="margin-bottom:24px">${liked.length} song${liked.length !== 1 ? "s" : ""}</p>
    ${liked.length ? '<div class="grid" id="g-liked"></div>' : '<p style="color:var(--muted);margin-top:16px">Like trk using the ♡ button in the player.</p>'}
  `;
  document.getElementById("back-btn").onclick = rl;
  if (liked.length) fg("g-liked", liked);
}

function ra(artistName) {
  clearInterval(hv);
  const artistSongs = trk.filter((s) => s.artist === artistName);
  const cover =
    artistSongs[0]?.image || "https://picsum.photos/seed/artist/400";
  ms.innerHTML = `
    <button class="back-btn" id="back-btn">← Back</button>
    <div class="artist-hero">
      <img class="artist-hero-img" src="${cover}" onerror="this.src='https://picsum.photos/seed/art/400'" alt="">
      <div class="artist-hero-info">
        <div class="artist-hero-name">${artistName}</div>
        <div class="artist-hero-count">${artistSongs.length} song${artistSongs.length !== 1 ? "s" : ""}</div>
      </div>
    </div>
    <div class="grid" id="g-artist"></div>
  `;
  document.getElementById("back-btn").onclick = () =>
    window.history.go(-1) || rh();
  fg("g-artist", artistSongs);
}

function rqp() {
  const body = document.getElementById("qp-body");
  if (!body) return;
  body.innerHTML = "";

  if (S.current) {
    const lbl = document.createElement("div");
    lbl.className = "qp-section-label";
    lbl.textContent = "Now Playing";
    body.appendChild(lbl);
    body.appendChild(mq(S.current, false, true));
  }

  if (queue.length) {
    const lbl = document.createElement("div");
    lbl.className = "qp-section-label";
    lbl.textContent = "Next in Queue";
    body.appendChild(lbl);
    queue.forEach((s, idx) => {
      const el = mq(s, true, false);
      const rem = el.querySelector(".q-rem");
      if (rem)
        rem.onclick = (e) => {
          e.stopPropagation();
          queue.splice(idx, 1);
          rqp();
          st("Removed from queue");
        };
      body.appendChild(el);
    });
  }
  const list = S.curPL ? S.curPL.trk : trk;
  const curIdx = S.current ? list.findIndex((s) => s.id === S.current.id) : -1;
  const upcoming = list.slice(curIdx + 1, curIdx + 8);
  if (upcoming.length) {
    const lbl = document.createElement("div");
    lbl.className = "qp-section-label";
    lbl.textContent = "Up Next";
    body.appendChild(lbl);
    upcoming.forEach((s) => body.appendChild(mq(s, false, false)));
  }
  if (!S.current && !queue.length) {
    const em = document.createElement("div");
    em.className = "q-empty";
    em.innerHTML = "Nothing playing yet.<br>Pick a song to get started 🎵";
    body.appendChild(em);
  }
}

function mq(song, removable, isCurrent) {
  const el = document.createElement("div");
  el.className = "q-item" + (isCurrent ? " current" : "");
  el.innerHTML = `
    <img class="q-art" src="${song.image}" onerror="this.src='https://picsum.photos/seed/${song.id}/80'" alt="">
    <div class="q-info">
      <div class="q-title">${song.title}</div>
      <div class="q-artist">${song.artist}</div>
    </div>
    ${removable ? '<button class="q-rem" title="Remove">×</button>' : ""}
  `;
  if (!isCurrent)
    el.onclick = () => {
      ps(song);
    };
  return el;
}

document.getElementById("btn-queue").onclick = () => {
  const qp = document.getElementById("queue-panel");
  qp.classList.toggle("open");
  document
    .getElementById("btn-queue")
    .classList.toggle("active-q", qp.classList.contains("open"));
  if (qp.classList.contains("open")) rqp();
};
document.getElementById("qp-close").onclick = () => {
  document.getElementById("queue-panel").classList.remove("open");
  document.getElementById("btn-queue").classList.remove("active-q");
};

function oe() {
  const ep = document.getElementById("expanded-player");
  ep.classList.add("open");
  ui();
}
function ce() {
  document.getElementById("expanded-player").classList.remove("open");
}

document.getElementById("btn-expand").onclick = oe;
document.getElementById("disc-wrap-btn").onclick = () => {
  if (S.current) oe();
};
document.getElementById("ep-close-btn").onclick = ce;
document.getElementById("ep-btn-play").onclick = tp;
document.getElementById("ep-btn-next").onclick = pn;
document.getElementById("ep-btn-prev").onclick = ppv;
document.getElementById("ep-btn-shuffle").onclick = () => {
  S.shuffle = !S.shuffle;
  document.getElementById("ep-btn-shuffle").classList.toggle("on", S.shuffle);
  document.getElementById("btn-shuffle").classList.toggle("on", S.shuffle);
  st(S.shuffle ? "Shuffle on" : "Shuffle off");
};
document.getElementById("ep-btn-repeat").onclick = () => {
  const modes = ["off", "all", "one"],
    i = modes.indexOf(S.repeat);
  S.repeat = modes[(i + 1) % 3];
  const on = S.repeat !== "off";
  document.getElementById("ep-btn-repeat").classList.toggle("on", on);
  document.getElementById("btn-repeat").classList.toggle("on", on);
  document.getElementById("ep-btn-repeat").textContent =
    S.repeat === "one" ? "↺" : "↻";
  st(`Repeat: ${S.repeat}`);
};
document.getElementById("ep-like-btn").onclick = () => {
  if (!S.current) return;
  const id = S.current.id;
  if (lk.has(id)) {
    lk.delete(id);
    st("Removed from Liked Songs");
  } else {
    lk.add(id);
    st("Added to Liked Songs ♥");
    sh();
  }
  ui();
};
document.getElementById("ep-song-artist").onclick = () => {
  if (S.current) {
    ce();
    ra(S.current.artist);
  }
};
const et = document.getElementById("ep-prog-track");
let ed = false;
const es = (e) => {
  if (!S.current || isNaN(aud.duration)) return;
  const r = et.getBoundingClientRect();
  aud.currentTime =
    Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * aud.duration;
};
et.addEventListener("mousedown", (e) => {
  ed = true;
  es(e);
});
document.addEventListener("mousemove", (e) => {
  if (ed) es(e);
});
document.addEventListener("mouseup", () => {
  ed = false;
});
const ev = document.getElementById("ep-vol-track");
let evd = false;
const sev = (e) => {
  const r = ev.getBoundingClientRect();
  const v = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  S.volume = v;
  aud.volume = v;
  document.getElementById("ep-vol-fill").style.width = v * 100 + "%";
  document.getElementById("vol-fill").style.width = v * 100 + "%";
  uvi();
};
ev.addEventListener("mousedown", (e) => {
  evd = true;
  sev(e);
});
document.addEventListener("mousemove", (e) => {
  if (evd) sev(e);
});
document.addEventListener("mouseup", () => {
  evd = false;
});

function scm(e, song) {
  cx = song;
  const menu = document.getElementById("ctx-menu");
  menu.classList.add("show");
  let x = e.clientX,
    y = e.clientY;
  const mw = 190,
    mh = 180;
  if (x + mw > window.innerWidth) x = window.innerWidth - mw - 10;
  if (y + mh > window.innerHeight) y = window.innerHeight - mh - 10;
  menu.style.left = x + "px";
  menu.style.top = y + "px";
  document.getElementById("ctx-like").textContent = lk.has(song.id)
    ? "♥  Liked"
    : "♡  Like Song";
}
function hcm() {
  document.getElementById("ctx-menu").classList.remove("show");
  cx = null;
}
document.addEventListener("click", hcm);
document.addEventListener("contextmenu", (e) => {
  if (!e.target.closest(".card")) hcm();
});
document.getElementById("ctx-play").onclick = () => {
  if (cx) ps(cx);
};
document.getElementById("ctx-queue").onclick = () => {
  if (cx) aq(cx);
};
document.getElementById("ctx-like").onclick = () => {
  if (!cx) return;
  const id = cx.id;
  if (lk.has(id)) {
    lk.delete(id);
    st("Removed from Liked Songs");
  } else {
    lk.add(id);
    st("Added to Liked Songs ♥");
    sh();
  }
  ui();
};
document.getElementById("ctx-playlist").onclick = () => {
  if (cx) om(cx);
};
document.getElementById("ctx-artist").onclick = () => {
  if (cx) ra(cx.artist);
};
function sh() {
  const lb = document.getElementById("like-btn");
  const rect = lb.getBoundingClientRect();
  for (let i = 0; i < 5; i++) {
    const h = document.createElement("div");
    h.className = "heart-burst";
    h.textContent = "♥";
    h.style.left =
      rect.left + rect.width / 2 + (Math.random() - 0.5) * 30 + "px";
    h.style.top =
      rect.top + rect.height / 2 + (Math.random() - 0.5) * 20 + "px";
    h.style.animationDelay = i * 0.08 + "s";
    h.style.fontSize = 14 + Math.random() * 10 + "px";
    h.style.color = `hsl(${130 + Math.random() * 40},100%,60%)`;
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 700);
  }
}
document.getElementById("btn-play").onclick = tp;
document.getElementById("btn-next").onclick = pn;
document.getElementById("btn-prev").onclick = ppv;

document.getElementById("btn-shuffle").onclick = function () {
  S.shuffle = !S.shuffle;
  this.classList.toggle("on", S.shuffle);
  document.getElementById("ep-btn-shuffle").classList.toggle("on", S.shuffle);
  st(S.shuffle ? "Shuffle on" : "Shuffle off");
};

document.getElementById("btn-repeat").onclick = function () {
  const modes = ["off", "all", "one"],
    i = modes.indexOf(S.repeat);
  S.repeat = modes[(i + 1) % 3];
  this.classList.toggle("on", S.repeat !== "off");
  this.textContent = S.repeat === "one" ? "↺" : "↻";
  document.getElementById("ep-btn-repeat").textContent =
    S.repeat === "one" ? "↺" : "↻";
  document
    .getElementById("ep-btn-repeat")
    .classList.toggle("on", S.repeat !== "off");
  st(`Repeat: ${S.repeat}`);
};

const pt = document.getElementById("prog-track");
let dp = false;
const sk = (e) => {
  if (!S.current || isNaN(aud.duration)) return;
  const r = pt.getBoundingClientRect();
  aud.currentTime =
    Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * aud.duration;
};
pt.addEventListener("mousedown", (e) => {
  dp = true;
  sk(e);
});
document.addEventListener("mousemove", (e) => {
  if (dp) sk(e);
});
document.addEventListener("mouseup", () => {
  dp = false;
});
pt.addEventListener("touchstart", (e) => sk(e.touches[0]), {
  passive: true,
});
pt.addEventListener("touchmove", (e) => sk(e.touches[0]), {
  passive: true,
});
const vt = document.getElementById("vol-track");
let dv = false;
const sv = (e) => {
  const r = vt.getBoundingClientRect();
  const v = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  S.volume = v;
  aud.volume = v;
  document.getElementById("vol-fill").style.width = v * 100 + "%";
  if (document.getElementById("ep-vol-fill"))
    document.getElementById("ep-vol-fill").style.width = v * 100 + "%";
  uvi();
};
vt.addEventListener("mousedown", (e) => {
  dv = true;
  sv(e);
});
document.addEventListener("mousemove", (e) => {
  if (dv) sv(e);
});
document.addEventListener("mouseup", () => {
  dv = false;
});

document.getElementById("vol-btn").onclick = () => {
  if (aud.volume > 0) {
    S.prevVol = aud.volume;
    aud.volume = 0;
    S.volume = 0;
  } else {
    aud.volume = S.prevVol || 0.7;
    S.volume = aud.volume;
  }
  document.getElementById("vol-fill").style.width = S.volume * 100 + "%";
  uvi();
};

function uvi() {
  const ico = S.volume === 0 ? "🔇" : S.volume < 0.5 ? "🔉" : "🔊";
  document.getElementById("vol-btn").textContent = ico;
  const epVB = document.getElementById("ep-vol-btn");
  if (epVB) epVB.textContent = ico;
}

document.getElementById("like-btn").onclick = (e) => {
  if (!S.current) return;
  const id = S.current.id;
  if (lk.has(id)) {
    lk.delete(id);
    st("Removed from Liked Songs");
  } else {
    lk.add(id);
    st("Added to Liked Songs ♥");
    sh();
  }
  ui();
};
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.code === "Space") {
    e.preventDefault();
    tp();
  } else if (e.code === "ArrowRight") pn();
  else if (e.code === "ArrowLeft") ppv();
  else if (e.code === "KeyM") document.getElementById("vol-btn").click();
  else if (e.code === "KeyQ") {
    document.getElementById("btn-queue").click();
  } else if (e.code === "KeyF") {
    const ep = document.getElementById("expanded-player");
    if (ep.classList.contains("open")) ce();
    else if (S.current) oe();
  } else if (e.code === "KeyL") {
    if (S.current) document.getElementById("like-btn").click();
  } else if (e.code === "ArrowUp") {
    e.preventDefault();
    const v = Math.min(1, S.volume + 0.05);
    S.volume = v;
    aud.volume = v;
    document.getElementById("vol-fill").style.width = v * 100 + "%";
    uvi();
  } else if (e.code === "ArrowDown") {
    e.preventDefault();
    const v = Math.max(0, S.volume - 0.05);
    S.volume = v;
    aud.volume = v;
    document.getElementById("vol-fill").style.width = v * 100 + "%";
    uvi();
  } else if (e.code === "Escape") {
    ce();
    hcm();
  }
});
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-item")
      .forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    const v = item.dataset.view;
    if (v === "home") rh();
    else if (v === "search") rs();
    else if (v === "library") rl();
  });
});
document.getElementById("sb-create").onclick = cpl;
document.getElementById("sb-liked").onclick = () => {
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  document.querySelector('[data-view="library"]').classList.add("active");
  rlk();
};
document.getElementById("sb-episodes").onclick = () =>
  st("Episodes coming soon 🎙");

function cpl() {
  const name = prompt("Playlist name:");
  if (!name?.trim()) return;
  pls.push({ id: plc++, name: name.trim(), trk: [] });
  usp();
  rl();
  st(`Created "${name.trim()}" ✓`);
}

function om(song) {
  const list = document.getElementById("m-list");
  list.innerHTML = "";
  pls.forEach((pl) => {
    const el = document.createElement("div");
    el.className = "m-item";
    el.textContent = pl.name;
    el.onclick = () => {
      if (pl.trk.find((s) => s.id === song.id)) st(`Already in "${pl.name}"`);
      else {
        pl.trk.push(song);
        st(`Added to "${pl.name}" ✓`);
      }
      clm();
    };
    list.appendChild(el);
  });
  document.getElementById("modal").classList.add("open");
}
function clm() {
  document.getElementById("modal").classList.remove("open");
}
document.getElementById("m-close").onclick = clm;
document.getElementById("modal").onclick = (e) => {
  if (e.target.id === "modal") clm();
};

function usp() {
  const c = document.getElementById("sb-pls");
  c.innerHTML = "";
  pls.forEach((pl) => {
    const el = document.createElement("div");
    el.className = "pl-item";
    el.textContent = pl.name;
    el.onclick = () => {
      document
        .querySelectorAll(".nav-item")
        .forEach((i) => i.classList.remove("active"));
      document.querySelector('[data-view="library"]').classList.add("active");
      rpl(pl);
    };
    c.appendChild(el);
  });
}

let tt;
function st(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove("show"), 2600);
}
aud.volume = S.volume;
window._musicPlaying = false;
rh();
usp();
ui();
rqp();

setTimeout(
  () => st("Shortcuts: Space=Play  Q=Queue  F=Fullscreen  L=Like"),
  1200,
);
