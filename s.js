let audioAnalyser = null,
  frequencyData = null,
  audioContext = null;
let bassAverage = 0,
  beatCooldown = 0,
  lastTime = 0,
  beatFlash = 0;

function initAudioContext(audioElement) {
  if (audioContext) return;

  const context = new (window.AudioContext || window.webkitAudioContext)();
  const sourceNode = context.createMediaElementSource(audioElement);
  audioAnalyser = context.createAnalyser();
  audioAnalyser.fftSize = 256;
  audioAnalyser.smoothingTimeConstant = 0.75;
  frequencyData = new Uint8Array(audioAnalyser.frequencyBinCount);
  sourceNode.connect(audioAnalyser);
  audioAnalyser.connect(context.destination);
  audioContext = context;
}

function getFrequencyData() {
  if (!audioAnalyser || !frequencyData) return null;
  audioAnalyser.getByteFrequencyData(frequencyData);
  return frequencyData;
}

function getAverageAmplitude() {
  const data = getFrequencyData();
  if (!data) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i];
  return sum / (data.length * 255);
}

function getBassLevel() {
  if (!audioAnalyser || !frequencyData) return 0;
  return (frequencyData[0] + frequencyData[1] + frequencyData[2] + frequencyData[3]) / (4 * 255);
}

function detectBeat() {
  const currentBass = getBassLevel();
  bassAverage = bassAverage * 0.93 + currentBass * 0.07;
  if (beatCooldown > 0) {
    beatCooldown--;
    return false;
  }
  if (currentBass > bassAverage * 1.35 && currentBass > 0.25) {
    beatCooldown = 10;
    beatFlash = 1.0;
    return true;
  }
  return false;
}

(function () {
  const backgroundCanvas = document.getElementById("bg-canvas");
  const renderer = new THREE.WebGLRenderer({
    canvas: backgroundCanvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 500);
  camera.position.z = 35;

  const mousePosition = { x: 0, y: 0 };
  const cameraLag = { x: 0, y: 0 };
  const cameraShake = { x: 0, y: 0 };

  window.addEventListener("mousemove", (event) => {
    mousePosition.x = (event.clientX / innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / innerHeight) * 2 + 1;
  });

  const vertexShaderSource = `varying vec2 vTexCoord;void main(){vTexCoord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

  const fragmentShaderSource = `
    uniform float uTime;
    uniform float uIntensity;
    uniform float uBeat;
    varying vec2 vTexCoord;
    float hash(vec2 position){return fract(sin(dot(position,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 position){vec2 intPart=floor(position),fracPart=fract(position);vec2 smoothFrac=fracPart*fracPart*(3.0-2.0*fracPart);
      return mix(mix(hash(intPart),hash(intPart+vec2(1,0)),smoothFrac.x),mix(hash(intPart+vec2(0,1)),hash(intPart+vec2(1,1)),smoothFrac.x),smoothFrac.y);}
    void main(){
      vec2 uv = vTexCoord;
      float animTime = uTime * 0.22;
      float noiseX = noise(uv * 3.0 + animTime * 0.4) * 0.05 + noise(uv * 6.0 - animTime * 0.3) * 0.025;
      float noiseY = noise(uv * 2.5 - animTime * 0.5) * 0.04;
      vec2 warpedCoord = uv + vec2(noiseX, noiseY);
      float wave1Y = sin(warpedCoord.x * 7.0 + animTime) * 0.07 + sin(warpedCoord.x * 3.0 - animTime * 0.8) * 0.04;
      float band1 = smoothstep(0.22+wave1Y,0.30+wave1Y,warpedCoord.y)*(1.0-smoothstep(0.46+wave1Y,0.56+wave1Y,warpedCoord.y));
      float wave2Y = sin(warpedCoord.x*5.5-animTime*1.3)*0.06+sin(warpedCoord.x*11.0+animTime*0.45)*0.03;
      float band2 = smoothstep(0.5+wave2Y,0.58+wave2Y,warpedCoord.y)*(1.0-smoothstep(0.70+wave2Y,0.78+wave2Y,warpedCoord.y));
      float wave3Y = sin(warpedCoord.x*9.0+animTime*0.9)*0.05+sin(warpedCoord.x*4.0-animTime*1.1)*0.03;
      float band3 = smoothstep(0.62+wave3Y,0.70+wave3Y,warpedCoord.y)*(1.0-smoothstep(0.85+wave3Y,0.92+wave3Y,warpedCoord.y));
      float bottomGlow = (1.0-smoothstep(0.0,0.40,warpedCoord.y))*0.28;
      float topGlow = (1.0-smoothstep(0.60,1.0,warpedCoord.y))*0.18;
      vec3 green = vec3(0.08,0.74,0.30);
      vec3 teal = vec3(0.04,0.46,0.68);
      vec3 indigo = vec3(0.28,0.04,0.60);
      vec3 gold = vec3(0.60,0.40,0.04);
      vec3 bottomColor = vec3(0.05,0.28,0.18);
      vec3 finalColor = green*band1+teal*band2*0.8+indigo*topGlow+bottomColor*bottomGlow+gold*band3*0.4;
      float beatBoost = uBeat*0.4;
      float alpha = (band1*0.28+band2*0.20+band3*0.15+bottomGlow*0.09+topGlow*0.06+beatBoost)*(uIntensity+uBeat*0.5);
      gl_FragColor = vec4(finalColor,min(alpha,0.9));
    }
  `;

  const shaderUniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0.9 },
    uBeat: { value: 0 },
  };

  const auroraPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 180, 1, 1),
    new THREE.ShaderMaterial({
      vertexShader: vertexShaderSource,
      fragmentShader: fragmentShaderSource,
      uniforms: shaderUniforms,
      transparent: true,
      depthWrite: false,
    }),
  );
  auroraPlane.position.z = -60;
  scene.add(auroraPlane);

  const icosahedronGeometry1 = new THREE.IcosahedronGeometry(9, 5);
  const icosahedronGeometry2 = new THREE.IcosahedronGeometry(6.5, 4);
  const icosahedronGeometry3 = new THREE.IcosahedronGeometry(4.5, 3);
  const originalPositions1 = icosahedronGeometry1.attributes.position.array.slice();
  const originalPositions2 = icosahedronGeometry2.attributes.position.array.slice();
  const originalPositions3 = icosahedronGeometry3.attributes.position.array.slice();

  const icosahedronMesh1 = new THREE.Mesh(
    icosahedronGeometry1,
    new THREE.MeshBasicMaterial({ color: 0x1db954, wireframe: true, transparent: true, opacity: 0.065 }),
  );
  const icosahedronMesh2 = new THREE.Mesh(
    icosahedronGeometry2,
    new THREE.MeshBasicMaterial({ color: 0x0aafcf, wireframe: true, transparent: true, opacity: 0.045 }),
  );
  const icosahedronMesh3 = new THREE.Mesh(
    icosahedronGeometry3,
    new THREE.MeshBasicMaterial({ color: 0xaa22ff, wireframe: true, transparent: true, opacity: 0.055 }),
  );
  icosahedronMesh1.position.set(0, 0, -14);
  icosahedronMesh2.position.set(-16, 7, -22);
  icosahedronMesh3.position.set(18, -8, -18);
  [icosahedronMesh1, icosahedronMesh2, icosahedronMesh3].forEach((mesh) => scene.add(mesh));

  function morphIcosahedron(geometry, originalPositions, time, amplitude, phase) {
    const positionAttribute = geometry.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
      const index3 = i * 3;
      const originalX = originalPositions[index3];
      const originalY = originalPositions[index3 + 1];
      const originalZ = originalPositions[index3 + 2];
      const length = Math.sqrt(originalX * originalX + originalY * originalY + originalZ * originalZ);
      if (length < 0.001) continue;
      const normalX = originalX / length;
      const normalY = originalY / length;
      const normalZ = originalZ / length;
      const wave =
        Math.sin(normalX * 3.8 + time * 0.85 + phase) *
        Math.cos(normalY * 3.4 + time * 0.65) *
        Math.sin(normalZ * 4.0 + time * 1.15 + phase * 0.6);
      const displacement = 1.0 + wave * amplitude;
      positionAttribute.array[index3] = originalX * displacement;
      positionAttribute.array[index3 + 1] = originalY * displacement;
      positionAttribute.array[index3 + 2] = originalZ * displacement;
    }
    positionAttribute.needsUpdate = true;
  }

  const torusConfigs = [
    {
      radius: 17,
      tubeRadius: 0.3,
      segments: [100, 8],
      color: 0x1db954,
      opacity: 0.09,
      rotationX: 0.3,
      rotationY: 0,
      rotationZ: 0,
      positionX: 0,
      positionY: 0,
      positionZ: -28,
      spinSpeed: [0.001, 0.002, 0],
    },
    {
      radius: 11,
      tubeRadius: 0.18,
      segments: [80, 6],
      color: 0x0a9fbc,
      opacity: 0.07,
      rotationX: 1.1,
      rotationY: 0.3,
      rotationZ: 0.5,
      positionX: 13,
      positionY: -6,
      positionZ: -20,
      spinSpeed: [-0.003, 0.001, 0.002],
    },
    {
      radius: 7,
      tubeRadius: 0.12,
      segments: [60, 6],
      color: 0x9922ee,
      opacity: 0.06,
      rotationX: 0.8,
      rotationY: 1.2,
      rotationZ: 0.3,
      positionX: -19,
      positionY: 9,
      positionZ: -22,
      spinSpeed: [0.004, -0.002, 0.001],
    },
    {
      radius: 5,
      tubeRadius: 0.08,
      segments: [50, 5],
      color: 0x1db954,
      opacity: 0.08,
      rotationX: 1.5,
      rotationY: 0,
      rotationZ: 1.0,
      positionX: 7,
      positionY: 13,
      positionZ: -13,
      spinSpeed: [-0.005, 0.003, -0.002],
    },
    {
      radius: 3,
      tubeRadius: 0.05,
      segments: [40, 4],
      color: 0x00eeff,
      opacity: 0.05,
      rotationX: 0.5,
      rotationY: 2.0,
      rotationZ: 0.8,
      positionX: -8,
      positionY: -14,
      positionZ: -10,
      spinSpeed: [0.006, -0.004, 0.003],
    },
  ];

  const torusMeshes = torusConfigs.map((config) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(config.radius, config.tubeRadius, config.segments[1], config.segments[0]),
      new THREE.MeshBasicMaterial({ color: config.color, transparent: true, opacity: config.opacity }),
    );
    mesh.rotation.set(config.rotationX, config.rotationY, config.rotationZ);
    mesh.position.set(config.positionX, config.positionY, config.positionZ);
    mesh._spinSpeed = config.spinSpeed;
    scene.add(mesh);
    return mesh;
  });

  const torusKnot1 = new THREE.Mesh(
    new THREE.TorusKnotGeometry(5.5, 0.9, 140, 12, 2, 3),
    new THREE.MeshBasicMaterial({ color: 0x0a2e14, wireframe: true, transparent: true, opacity: 0.055 }),
  );
  torusKnot1.position.set(22, -13, -35);
  scene.add(torusKnot1);

  const torusKnot2 = new THREE.Mesh(
    new THREE.TorusKnotGeometry(3.5, 0.55, 100, 10, 3, 5),
    new THREE.MeshBasicMaterial({ color: 0x1a0535, wireframe: true, transparent: true, opacity: 0.045 }),
  );
  torusKnot2.position.set(-20, 15, -30);
  scene.add(torusKnot2);

  const gridPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 80, 30, 20),
    new THREE.MeshBasicMaterial({ color: 0x061108, wireframe: true, transparent: true, opacity: 0.055 }),
  );
  gridPlane.rotation.x = -Math.PI / 2.4;
  gridPlane.position.set(0, -20, -15);
  scene.add(gridPlane);

  const RIPPLE_POINTS = 90;
  const rippleConfigs = [
    { baseY: 0, depth: -7,  color: 0x1db954, opacity: 0.35, frequencies: [0.32, 0.75], speeds: [2.6, 1.9], amplitudes: [2.2, 1.1] },
    { baseY: -2, depth: -11, color: 0x0a9fbc, opacity: 0.18, frequencies: [0.26, 0.62], speeds: [2.1, 1.6], amplitudes: [3.2, 1.6] },
    { baseY: 2,  depth: -14, color: 0xaa22ff, opacity: 0.1,  frequencies: [0.44, 0.92], speeds: [3.1, 2.3], amplitudes: [4.5, 2.2] },
    { baseY: 0,  depth: -18, color: 0x1db954, opacity: 0.05, frequencies: [0.2,  0.55], speeds: [1.5, 1.1], amplitudes: [6.0, 3.0] },
  ];

  const rippleLines = rippleConfigs.map((config) => {
    const points = Array.from(
      { length: RIPPLE_POINTS },
      (_, i) => new THREE.Vector3((i / (RIPPLE_POINTS - 1) - 0.5) * 70, config.baseY, config.depth),
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: config.color, transparent: true, opacity: config.opacity }),
    );
    line._config = config;
    scene.add(line);
    return line;
  });

  function updateRippleLines(time, amplitude) {
    rippleLines.forEach((rippleLine) => {
      const config = rippleLine._config;
      const positionArray = rippleLine.geometry.attributes.position.array;
      for (let i = 0; i < RIPPLE_POINTS; i++) {
        const xPos = (i / (RIPPLE_POINTS - 1) - 0.5) * 70;
        const yPos =
          Math.sin(i * config.frequencies[0] + time * config.speeds[0]) * amplitude * config.amplitudes[0] +
          Math.sin(i * config.frequencies[1] + time * config.speeds[1]) * amplitude * config.amplitudes[1];
        positionArray[i * 3] = xPos;
        positionArray[i * 3 + 1] = config.baseY + yPos;
        positionArray[i * 3 + 2] = config.depth;
      }
      rippleLine.geometry.attributes.position.needsUpdate = true;
    });
  }

  const PARTICLE_COUNT = 700;
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particleVelocities = new Float32Array(PARTICLE_COUNT * 3);
  const particleColors = new Float32Array(PARTICLE_COUNT * 3);

  const colorPalette = [
    [0.07, 0.6, 0.22],
    [0.04, 0.35, 0.14],
    [0.05, 0.05, 0.3],
    [0.2, 0.04, 0.35],
    [0.02, 0.25, 0.3],
    [0.4, 0.12, 0.08],
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const index3 = i * 3;
    particlePositions[index3] = (Math.random() - 0.5) * 90;
    particlePositions[index3 + 1] = (Math.random() - 0.5) * 65;
    particlePositions[index3 + 2] = (Math.random() - 0.5) * 45 - 5;
    particleVelocities[index3] = (Math.random() - 0.5) * 0.006;
    particleVelocities[index3 + 1] = (Math.random() - 0.5) * 0.006;
    particleVelocities[index3 + 2] = (Math.random() - 0.5) * 0.002;
    const selectedColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    particleColors[index3] = selectedColor[0];
    particleColors[index3 + 1] = selectedColor[1];
    particleColors[index3 + 2] = selectedColor[2];
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
  const particlesMesh = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0.55, sizeAttenuation: true }),
  );
  scene.add(particlesMesh);

  const OUTER_BAR_COUNT = 64;
  const outerBarGeometry = new THREE.BoxGeometry(0.22, 1, 0.22);
  const outerBarMaterial = new THREE.MeshBasicMaterial({ color: 0x1db954, transparent: true, opacity: 0.88 });
  const outerBarInstancedMesh = new THREE.InstancedMesh(outerBarGeometry, outerBarMaterial, OUTER_BAR_COUNT);
  outerBarInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(outerBarInstancedMesh);

  const INNER_BAR_COUNT = 32;
  const innerBarGeometry = new THREE.BoxGeometry(0.18, 1, 0.18);
  const innerBarMaterial = new THREE.MeshBasicMaterial({ color: 0x1db954, transparent: true, opacity: 0.65 });
  const innerBarInstancedMesh = new THREE.InstancedMesh(innerBarGeometry, innerBarMaterial, INNER_BAR_COUNT);
  innerBarInstancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(innerBarInstancedMesh);

  const barTransformHelper = new THREE.Object3D();
  const barColor = new THREE.Color();

  for (let i = 0; i < OUTER_BAR_COUNT; i++) outerBarInstancedMesh.setColorAt(i, new THREE.Color(0x1db954));
  outerBarInstancedMesh.instanceColor.needsUpdate = true;
  for (let i = 0; i < INNER_BAR_COUNT; i++) innerBarInstancedMesh.setColorAt(i, new THREE.Color(0x1db954));
  innerBarInstancedMesh.instanceColor.needsUpdate = true;

  const pulseGeometry = new THREE.IcosahedronGeometry(3.5, 2);
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0x1db954, wireframe: true, transparent: true, opacity: 0.12 });
  const pulseSphere = new THREE.Mesh(pulseGeometry, pulseMaterial);
  pulseSphere.position.set(0, 0, -6);
  scene.add(pulseSphere);

  const dnaGroup = new THREE.Group();
  const DNA_STRAND_COUNT = 36;
  const DNA_HELIX_RADIUS = 1.8;
  const DNA_HELIX_HEIGHT = 18;

  for (let i = 0; i < DNA_STRAND_COUNT; i++) {
    const strandProgress = i / DNA_STRAND_COUNT;
    const strand1Angle = strandProgress * Math.PI * 8;
    const strand2Angle = strand1Angle + Math.PI;
    const verticalPosition = (strandProgress - 0.5) * DNA_HELIX_HEIGHT;

    const strand1Node = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x1db954, transparent: true, opacity: 0.45 }),
    );
    strand1Node.position.set(Math.cos(strand1Angle) * DNA_HELIX_RADIUS, verticalPosition, Math.sin(strand1Angle) * DNA_HELIX_RADIUS);

    const strand2Node = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x0a9fbc, transparent: true, opacity: 0.45 }),
    );
    strand2Node.position.set(Math.cos(strand2Angle) * DNA_HELIX_RADIUS, verticalPosition, Math.sin(strand2Angle) * DNA_HELIX_RADIUS);

    dnaGroup.add(strand1Node, strand2Node);

    if (i % 3 === 0) {
      const rungePoints = [strand1Node.position.clone(), strand2Node.position.clone()];
      const rungeLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(rungePoints),
        new THREE.LineBasicMaterial({ color: 0x113322, transparent: true, opacity: 0.3 }),
      );
      dnaGroup.add(rungeLine);
    }
  }
  dnaGroup.position.set(-28, 0, -18);
  scene.add(dnaGroup);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(300 * 3);
  for (let i = 0; i < 300 * 3; i += 3) {
    starPositions[i] = (Math.random() - 0.5) * 200;
    starPositions[i + 1] = (Math.random() - 0.5) * 150;
    starPositions[i + 2] = -50 - Math.random() * 50;
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  scene.add(
    new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ size: 0.08, color: 0xffffff, transparent: true, opacity: 0.3 }),
    ),
  );

  let elapsedTime = 0;
  let animationSpeed = 1;
  window._setSpeed = (factor) => (animationSpeed = factor);

  function animationTick() {
    requestAnimationFrame(animationTick);
    elapsedTime += 0.0009 * animationSpeed;
    const time = elapsedTime;
    const isPlaying = !!window._musicPlaying;
    const averageAmplitude = getAverageAmplitude();
    const bassLevel = getBassLevel();
    const frequencyArray = getFrequencyData();
    const morphAmplitude = isPlaying ? 0.24 + averageAmplitude * 0.3 : 0.1;
    const rippleAmplitude = isPlaying ? 1.0 + averageAmplitude * 1.5 : 0.22;
    const targetGlowIntensity = isPlaying ? 1.5 + averageAmplitude * 0.8 : 0.85;
    const isBeat = isPlaying && detectBeat();

    beatFlash *= 0.88;
    shaderUniforms.uBeat.value = beatFlash;
    shaderUniforms.uTime.value = time;
    shaderUniforms.uIntensity.value += (targetGlowIntensity - shaderUniforms.uIntensity.value) * 0.025;

    if (isBeat) {
      cameraShake.x = (Math.random() - 0.5) * 0.6;
      cameraShake.y = (Math.random() - 0.5) * 0.4;
    }
    cameraShake.x *= 0.8;
    cameraShake.y *= 0.8;

    morphIcosahedron(icosahedronGeometry1, originalPositions1, time * 360, morphAmplitude, 0);
    morphIcosahedron(icosahedronGeometry2, originalPositions2, time * 290, morphAmplitude * 0.7, 2.4);
    morphIcosahedron(icosahedronGeometry3, originalPositions3, time * 420, morphAmplitude * 0.9, 4.8);

    icosahedronMesh1.rotation.y = time * 36 * 0.1;
    icosahedronMesh1.rotation.x = Math.sin(time * 24 * 0.1) * 0.18;
    icosahedronMesh2.rotation.y = -time * 28 * 0.1;
    icosahedronMesh2.rotation.z = time * 20 * 0.1;
    icosahedronMesh3.rotation.x = time * 32 * 0.1;
    icosahedronMesh3.rotation.y = -time * 25 * 0.1;

    const torusSpeedMultiplier = isPlaying ? 1 + averageAmplitude * 3 : 1;
    torusMeshes.forEach((torusMesh) => {
      torusMesh.rotation.x += torusMesh._spinSpeed[0] * torusSpeedMultiplier;
      torusMesh.rotation.y += torusMesh._spinSpeed[1] * torusSpeedMultiplier;
      torusMesh.rotation.z += torusMesh._spinSpeed[2] * torusSpeedMultiplier;
    });

    torusKnot1.rotation.x += 0.004;
    torusKnot1.rotation.y += 0.006 * (isPlaying ? 1 + averageAmplitude : 1);
    torusKnot1.rotation.z += 0.002;
    torusKnot2.rotation.x -= 0.003;
    torusKnot2.rotation.y += 0.005 * (isPlaying ? 1 + averageAmplitude : 1);
    torusKnot2.rotation.z -= 0.003;

    gridPlane.position.z = -15 + Math.sin(time * 10 * 0.1) * 1.5;

    updateRippleLines(time * 400, rippleAmplitude);

    const mouseWorldX = mousePosition.x * 38;
    const mouseWorldY = mousePosition.y * 28;
    const particlePositionArray = particleGeometry.attributes.position.array;
    const particleColorArray = particleGeometry.attributes.color.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const index3 = i * 3;
      particlePositionArray[index3] += particleVelocities[index3] * animationSpeed;
      particlePositionArray[index3 + 1] += particleVelocities[index3 + 1] * animationSpeed;
      particlePositionArray[index3 + 2] += particleVelocities[index3 + 2] * animationSpeed * 0.3;

      if (particlePositionArray[index3] > 45) particlePositionArray[index3] = -45;
      if (particlePositionArray[index3] < -45) particlePositionArray[index3] = 45;
      if (particlePositionArray[index3 + 1] > 33) particlePositionArray[index3 + 1] = -33;
      if (particlePositionArray[index3 + 1] < -33) particlePositionArray[index3 + 1] = 33;

      const deltaX = particlePositionArray[index3] - mouseWorldX;
      const deltaY = particlePositionArray[index3 + 1] - mouseWorldY;
      const squaredDistance = deltaX * deltaX + deltaY * deltaY;

      if (squaredDistance < 100 && squaredDistance > 0.01) {
        const distance = Math.sqrt(squaredDistance);
        const repelForce = ((10 - distance) / 10) * 0.06;
        particlePositionArray[index3] += (deltaX / distance) * repelForce;
        particlePositionArray[index3 + 1] += (deltaY / distance) * repelForce;
      }

      if (isBeat && i % 3 === 0) {
        particleColorArray[index3 + 1] = Math.min(1, particleColorArray[index3 + 1] + 0.3);
      } else {
        particleColorArray[index3 + 1] *= 0.995;
      }
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
    particlesMesh.rotation.y = Math.sin(time * 3 * 0.1) * 0.12;

    const OUTER_RING_RADIUS = 14;
    const OUTER_RING_DEPTH = -14;
    const INNER_RING_RADIUS = 8;
    const INNER_RING_DEPTH = -9;

    for (let i = 0; i < OUTER_BAR_COUNT; i++) {
      const angle = (i / OUTER_BAR_COUNT) * Math.PI * 2;
      let frequencyAmplitude = 0.04;
      if (frequencyArray) {
        const freqIndex = Math.floor(i * (frequencyArray.length / OUTER_BAR_COUNT));
        frequencyAmplitude = frequencyArray[freqIndex] / 255;
      } else {
        frequencyAmplitude = 0.03 + Math.abs(Math.sin(i * 0.4 + time * 200)) * 0.12 * (isPlaying ? 1 : 0.3);
      }
      const barHeight = isPlaying
        ? 0.05 + frequencyAmplitude * 9
        : 0.05 + Math.abs(Math.sin(i * 0.35 + time * 60)) * 0.5;
      barTransformHelper.position.set(Math.cos(angle) * OUTER_RING_RADIUS, barHeight / 2, Math.sin(angle) * OUTER_RING_RADIUS + OUTER_RING_DEPTH);
      barTransformHelper.rotation.y = -angle;
      barTransformHelper.scale.set(1, barHeight, 1);
      barTransformHelper.updateMatrix();
      outerBarInstancedMesh.setMatrixAt(i, barTransformHelper.matrix);
      const hue = 0.35 + frequencyAmplitude * 0.2;
      barColor.setHSL(hue, 1, 0.35 + frequencyAmplitude * 0.4);
      outerBarInstancedMesh.setColorAt(i, barColor);
    }
    outerBarInstancedMesh.instanceMatrix.needsUpdate = true;
    if (outerBarInstancedMesh.instanceColor) outerBarInstancedMesh.instanceColor.needsUpdate = true;

    for (let i = 0; i < INNER_BAR_COUNT; i++) {
      const angle = (i / INNER_BAR_COUNT) * Math.PI * 2;
      let frequencyAmplitude = 0.03;
      if (frequencyArray) {
        const freqIndex = Math.floor(i * (8 / INNER_BAR_COUNT));
        frequencyAmplitude = frequencyArray[freqIndex] / 255;
      } else {
        frequencyAmplitude = 0.02 + Math.abs(Math.sin(i * 0.7 + time * 150)) * 0.08 * (isPlaying ? 1 : 0.2);
      }
      const barHeight = isPlaying
        ? 0.03 + frequencyAmplitude * 5
        : 0.03 + Math.abs(Math.sin(i * 0.7 + time * 80)) * 0.3;
      barTransformHelper.position.set(Math.cos(angle) * INNER_RING_RADIUS, barHeight / 2, Math.sin(angle) * INNER_RING_RADIUS + INNER_RING_DEPTH);
      barTransformHelper.rotation.y = -angle;
      barTransformHelper.scale.set(1, barHeight, 1);
      barTransformHelper.updateMatrix();
      innerBarInstancedMesh.setMatrixAt(i, barTransformHelper.matrix);
      const hue2 = 0.28 + frequencyAmplitude * 0.25;
      barColor.setHSL(hue2, 1, 0.4 + frequencyAmplitude * 0.35);
      innerBarInstancedMesh.setColorAt(i, barColor);
    }
    innerBarInstancedMesh.instanceMatrix.needsUpdate = true;
    if (innerBarInstancedMesh.instanceColor) innerBarInstancedMesh.instanceColor.needsUpdate = true;

    const pulseScale = 1 + bassLevel * (isPlaying ? 2 : 0.3);
    pulseSphere.scale.setScalar(pulseScale);
    pulseMaterial.opacity = 0.08 + bassLevel * (isPlaying ? 0.28 : 0.06);
    pulseSphere.rotation.y = time * 30 * 0.1;
    pulseSphere.rotation.x = time * 22 * 0.1;

    dnaGroup.rotation.y += 0.004 + (isPlaying ? averageAmplitude * 0.02 : 0);

    cameraLag.x += (mousePosition.x * 2.5 - cameraLag.x) * 0.03;
    cameraLag.y += (mousePosition.y * 1.8 - cameraLag.y) * 0.03;
    camera.position.x = cameraLag.x + cameraShake.x;
    camera.position.y = cameraLag.y + cameraShake.y;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  animationTick();

  window.addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
})();

(function () {
  const cursorDot = document.getElementById("cursor-dot");
  const cursorRing = document.getElementById("cursor-ring");
  let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

  document.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  document.addEventListener("mousedown", () => cursorDot.classList.add("click"));
  document.addEventListener("mouseup", () => cursorDot.classList.remove("click"));

  const interactableSelector =
    "button,.nav-item,.pl-item,.card,.play-btn,.add-btn,.vol-track,.prog-track,.m-item,.q-item,.ctx-item,.hero-play-btn,.hero-queue-btn,.s-chip,.disc-wrap,.ep-disc-wrap";

  document.addEventListener("mouseover", (event) => {
    if (event.target.closest(interactableSelector)) cursorRing.classList.add("hover");
  });
  document.addEventListener("mouseout", (event) => {
    if (event.target.closest(interactableSelector)) cursorRing.classList.remove("hover");
  });

  function animateCursor() {
    cursorDot.style.left = mouseX + "px";
    cursorDot.style.top = mouseY + "px";
    ringX += (mouseX - ringX) * 0.13;
    ringY += (mouseY - ringY) * 0.13;
    cursorRing.style.left = ringX + "px";
    cursorRing.style.top = ringY + "px";
    requestAnimationFrame(animateCursor);
  }
  animateCursor();
})();

const tracks = [
  { id: 1,  title: "Shape Of You",       artist: "Ed Sheeran",                    image: "./Images/SOY.jpg",        url: "./trk/SOY.mp3" },
  { id: 2,  title: "Eraser",             artist: "Ed Sheeran",                    image: "./Images/Eraser.jpg",     url: "./trk/Eraser.mp3" },
  { id: 3,  title: "Perfect",            artist: "Ed Sheeran",                    image: "./Images/Perfect.jpg",    url: "./trk/Perfect.mp3" },
  { id: 4,  title: "Dive",               artist: "Ed Sheeran",                    image: "./Images/dive.jpg",       url: "./trk/Dive.mp3" },
  { id: 5,  title: "Castle on the Hill", artist: "Ed Sheeran",                    image: "./Images/CH.jpg",         url: "./trk/COTH.mp3" },
  { id: 6,  title: "Senorita",           artist: "Shawn Mendes",                  image: "./Images/senorita.jpg",   url: "./trk/senorita.mp3" },
  { id: 7,  title: "Beggin'",            artist: "Maneskin",                      image: "./Images/beggin.jpg",     url: "./trk/beggin.mp3" },
  { id: 8,  title: "In Da Club",         artist: "50 Cent",                       image: "./Images/idc.jpg",        url: "./trk/IDC.mp3" },
  { id: 9,  title: "Mockingbird",        artist: "Eminem",                        image: "./Images/mokingbird.webp",url: "./trk/mokingbird.mp3" },
  { id: 10, title: "Without Me",         artist: "Eminem",                        image: "./Images/wm.jpg",         url: "./trk/WM.mp3" },
  { id: 11, title: "Chuttamalle",        artist: "Shilpa Rao",                    image: "https://c.saavncdn.com/411/Chuttamalle-From-Devara-Part-1-Telugu-2024-20240805181008-500x500.jpg", url: "./trk/cuttamalle.mp3" },
  { id: 12, title: "Fa9la",             artist: "Dhurandhar",                    image: "https://f4.bcbits.com/img/a0293569019_10.jpg", url: "./trk/Fa9la.mp3" },
  { id: 13, title: "Shararat",          artist: "Madhubanti Bagchi",             image: "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcQNBWCoOPC4_xoIliH98qxgtU_6KeWfOJ7cBalt5TC2wb4iZ-Wl", url: "./trk/shararat.mp3" },
  { id: 14, title: "Kajra Re",          artist: "Alisha, Shankar Mahadeevan",    image: "https://e.snmc.io/i/300/w/ef7b33b93f3fd483ec81e58b6d368988/3696465", url: "./trk/kajra.mp3" },
  { id: 15, title: "Kala Chasma",       artist: "Badshah",                       image: "https://www.koimoi.com/wp-content/new-galleries/2016/07/kala-chashma-song-teaser-ft-katrina-kaif-sidharth-malhotra-2.jpg", url: "./trk/kala.mp3" },
  { id: 16, title: "Kali Kali Zulfon",  artist: "Ustad Rahat Fateh Ali Khan",    image: "https://c.saavncdn.com/798/Kali-Kali-Zulfon-Urdu-2025-20250912171624-500x500.jpg", url: "./trk/kkz.mp3" },
  { id: 17, title: "Mere Rashke Qamar", artist: "Ustad Nusrat Fateh Ali Khan",   image: "https://i.scdn.co/image/ab67616d00001e020d76db2dd35753ff5e24f84f", url: "./trk/mrq.mp3" },
  { id: 18, title: "Sanson ki Mala",    artist: "Ustad Nusrat Fateh Ali Khan",   image: "https://i.scdn.co/image/ab67616d00001e02d1a78643014371ca49d7cb22", url: "./trk/skm.mp3" },
  { id: 19, title: "Sochta Houn",       artist: "Ustad Nusrat Fateh Ali Khan",   image: "https://i.scdn.co/image/ab67616d00001e023a9bb6cf6865fd47824e8726", url: "./trk/shkwkmt.mp3" },
  { id: 20, title: "Ye Tune Kya Kiya",  artist: "Javed Bhasir",                  image: "https://i.ytimg.com/vi/BguYbxZKGOE/hqdefault.jpg?v=61eef018", url: "./trk/ytkk.mp3" },
];

let playlists = [
  { id: 1, name: "Chill Vibes",  songs: [] },
  { id: 2, name: "Workout Mix", songs: [] },
  { id: 3, name: "Focus Flow",  songs: [] },
  { id: 4, name: "Party Hits",  songs: [] },
  { id: 5, name: "Road Trip",   songs: [] },
];
let playlistCounter = 6;
const likedSongs = new Set();
const audioElement = new Audio();

const playerState = {
  current: null,
  playing: false,
  shuffle: false,
  repeat: "off",
  volume: 0.7,
  previousVolume: 0.7,
  currentPlaylist: null,
};

let manualQueue = [];
let recentlyPlayed = [];
let contextMenuSong = null;
let heroIndex = 0;
let heroInterval = null;

const miniVisualizerCanvas = document.getElementById("viz");
const miniVisualizerContext = miniVisualizerCanvas.getContext("2d");

function drawMiniVisualizer() {
  requestAnimationFrame(drawMiniVisualizer);
  const canvasWidth = miniVisualizerCanvas.offsetWidth;
  const canvasHeight = 36;
  miniVisualizerCanvas.width = canvasWidth;
  miniVisualizerCanvas.height = canvasHeight;
  miniVisualizerContext.clearRect(0, 0, canvasWidth, canvasHeight);
  if (!playerState.playing) return;

  const BAR_COUNT = 52;
  const barWidth = Math.floor(canvasWidth / BAR_COUNT) - 1;
  const timeNow = Date.now() / 700;
  let fftData = null;

  if (audioAnalyser && frequencyData) {
    audioAnalyser.getByteFrequencyData(frequencyData);
    fftData = frequencyData;
  }

  for (let i = 0; i < BAR_COUNT; i++) {
    let rawValue;
    if (fftData) {
      rawValue = fftData[Math.floor((i * fftData.length) / BAR_COUNT)] / 255;
    } else {
      const phase = (i / BAR_COUNT) * Math.PI * 4;
      rawValue =
        Math.abs(Math.sin(phase + timeNow * 1.4)) * 0.5 +
        Math.abs(Math.sin(phase * 1.7 + timeNow * 0.95)) * 0.3 +
        Math.abs(Math.sin(phase * 0.5 + timeNow * 2.2)) * 0.2;
    }
    const barHeight = Math.max(2, rawValue * canvasHeight * 0.92);
    const barX = i * (barWidth + 1);
    const barY = canvasHeight - barHeight;
    const alpha = 0.3 + (barHeight / canvasHeight) * 0.7;
    const gradient = miniVisualizerContext.createLinearGradient(0, barY, 0, canvasHeight);
    gradient.addColorStop(0, `rgba(29,185,84,${alpha})`);
    gradient.addColorStop(1, `rgba(29,185,84,${alpha * 0.3})`);
    miniVisualizerContext.fillStyle = gradient;
    if (miniVisualizerContext.roundRect) {
      miniVisualizerContext.beginPath();
      miniVisualizerContext.roundRect(barX, barY, barWidth, barHeight, 2);
      miniVisualizerContext.fill();
    } else {
      miniVisualizerContext.fillRect(barX, barY, barWidth, barHeight);
    }
  }
}
drawMiniVisualizer();

const formatTime = (seconds) =>
  isNaN(seconds)
    ? "0:00"
    : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

audioElement.addEventListener("timeupdate", () => {
  if (!isNaN(audioElement.duration)) {
    const progressPercent = (audioElement.currentTime / audioElement.duration) * 100;
    document.getElementById("prog-fill").style.width = progressPercent + "%";
    document.getElementById("t-cur").textContent = formatTime(audioElement.currentTime);
    document.getElementById("t-dur").textContent = formatTime(audioElement.duration);
    if (document.getElementById("ep-prog-fill"))
      document.getElementById("ep-prog-fill").style.width = progressPercent + "%";
    if (document.getElementById("ep-t-cur"))
      document.getElementById("ep-t-cur").textContent = formatTime(audioElement.currentTime);
  }
});

audioElement.addEventListener("ended", () => {
  if (playerState.repeat === "one") {
    audioElement.currentTime = 0;
    audioElement.play();
  } else {
    playNext();
  }
});

audioElement.addEventListener("loadedmetadata", () => {
  document.getElementById("t-dur").textContent = formatTime(audioElement.duration);
  if (document.getElementById("ep-t-dur"))
    document.getElementById("ep-t-dur").textContent = formatTime(audioElement.duration);
});

audioElement.addEventListener("error", () => showToast("Could not load this track"));

function playSong(song) {
  if (playerState.current?.id === song.id) {
    togglePlayPause();
    return;
  }
  playerState.current = song;
  audioElement.src = song.url;
  audioElement.load();
  audioElement.volume = playerState.volume;
  initAudioContext(audioElement);
  if (audioContext && audioContext.state === "suspended") audioContext.resume();
  recentlyPlayed = recentlyPlayed.filter((s) => s.id !== song.id);
  recentlyPlayed.unshift(song);
  if (recentlyPlayed.length > 10) recentlyPlayed.pop();
  const onCanPlay = () => {
    audioElement.removeEventListener("canplay", onCanPlay);
    audioElement
      .play()
      .then(() => {
        playerState.playing = true;
        window._musicPlaying = true;
        updatePlayerUI();
        updateCardHighlight();
        window._setSpeed?.(3);
      })
      .catch(() => showToast("Tap play to start ▶"));
  };
  audioElement.addEventListener("canplay", onCanPlay);
  updatePlayerUI();
  updateCardHighlight();
  renderQueuePanel();
}

function togglePlayPause() {
  if (!playerState.current) {
    playSong(tracks[0]);
    return;
  }
  initAudioContext(audioElement);
  if (audioContext && audioContext.state === "suspended") audioContext.resume();
  if (audioElement.paused) {
    audioElement.play().then(() => {
      playerState.playing = true;
      window._musicPlaying = true;
      updatePlayerUI();
      window._setSpeed?.(3);
    });
  } else {
    audioElement.pause();
    playerState.playing = false;
    window._musicPlaying = false;
    updatePlayerUI();
    window._setSpeed?.(1);
  }
}

function playNext() {
  if (!playerState.current) {
    playSong(tracks[0]);
    return;
  }
  if (manualQueue.length > 0) {
    const nextSong = manualQueue.shift();
    renderQueuePanel();
    playSong(nextSong);
    return;
  }
  const trackList = playerState.currentPlaylist ? playerState.currentPlaylist.songs : tracks;
  if (!trackList.length) return;
  if (playerState.shuffle) {
    playSong(trackList[Math.floor(Math.random() * trackList.length)]);
  } else {
    const currentIndex = trackList.findIndex((s) => s.id === playerState.current.id);
    if (currentIndex === -1 || currentIndex === trackList.length - 1) {
      if (playerState.repeat !== "off") playSong(trackList[0]);
      else {
        playerState.playing = false;
        window._musicPlaying = false;
        updatePlayerUI();
      }
    } else {
      playSong(trackList[currentIndex + 1]);
    }
  }
}

function playPrevious() {
  if (!playerState.current) {
    playSong(tracks[0]);
    return;
  }
  if (audioElement.currentTime > 3) {
    audioElement.currentTime = 0;
    return;
  }
  const trackList = playerState.currentPlaylist ? playerState.currentPlaylist.songs : tracks;
  if (!trackList.length) return;
  const currentIndex = trackList.findIndex((s) => s.id === playerState.current.id);
  playSong(trackList[(currentIndex - 1 + trackList.length) % trackList.length]);
}

function addToQueue(song) {
  manualQueue.push(song);
  showToast(`"${song.title}" added to queue ✓`);
  renderQueuePanel();
}

function updatePlayerUI() {
  const song = playerState.current;
  const playerBar = document.getElementById("player-bar");
  if (song) {
    document.getElementById("np-img").src = song.image;
    document.getElementById("np-title").textContent = song.title;
    document.getElementById("np-artist").textContent = song.artist;
    const likeButton = document.getElementById("like-btn");
    if (likedSongs.has(song.id)) {
      likeButton.textContent = "♥";
      likeButton.classList.add("liked");
    } else {
      likeButton.textContent = "♡";
      likeButton.classList.remove("liked");
    }
    updateExpandedPlayer(song);
  }
  const discElement = document.getElementById("disc");
  const playButton = document.getElementById("btn-play");
  const expandedDisc = document.getElementById("ep-disc");
  const expandedPlayButton = document.getElementById("ep-btn-play");
  if (playerState.playing) {
    discElement.classList.add("spinning", "playing-glow");
    playButton.textContent = "⏸";
    playerBar.classList.add("is-playing");
    if (expandedDisc) expandedDisc.classList.add("spin");
    if (expandedPlayButton) expandedPlayButton.textContent = "⏸";
  } else {
    discElement.classList.remove("spinning", "playing-glow");
    playButton.textContent = "▶";
    playerBar.classList.remove("is-playing");
    if (expandedDisc) expandedDisc.classList.remove("spin");
    if (expandedPlayButton) expandedPlayButton.textContent = "▶";
  }
}

function updateExpandedPlayer(song) {
  if (!song) return;
  const expandedImage = document.getElementById("ep-img");
  const expandedBackground = document.getElementById("ep-bg");
  const expandedTitle = document.getElementById("ep-song-title");
  const expandedArtist = document.getElementById("ep-song-artist");
  const expandedLikeButton = document.getElementById("ep-like-btn");
  const expandedLikeLabel = document.getElementById("ep-like-label");
  if (expandedImage) expandedImage.src = song.image;
  if (expandedBackground) expandedBackground.style.backgroundImage = `url(${song.image})`;
  if (expandedTitle) expandedTitle.textContent = song.title;
  if (expandedArtist) expandedArtist.textContent = song.artist;
  if (expandedLikeButton) {
    if (likedSongs.has(song.id)) {
      expandedLikeButton.textContent = "♥";
      expandedLikeButton.classList.add("liked");
      if (expandedLikeLabel) expandedLikeLabel.textContent = "Saved to Liked Songs";
    } else {
      expandedLikeButton.textContent = "♡";
      expandedLikeButton.classList.remove("liked");
      if (expandedLikeLabel) expandedLikeLabel.textContent = "Add to Liked Songs";
    }
  }
}

function updateCardHighlight() {
  document.querySelectorAll(".card").forEach((card) => card.classList.remove("playing"));
  if (playerState.current)
    document.querySelectorAll(`.card[data-id="${playerState.current.id}"]`).forEach((card) => card.classList.add("playing"));
}

function makeCard(song) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = song.id;
  if (playerState.current?.id === song.id) card.classList.add("playing");
  card.innerHTML = `
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
  card.onclick = () => playSong(song);
  card.querySelector(".play-btn").onclick = (event) => {
    event.stopPropagation();
    playSong(song);
  };
  card.querySelector(".add-btn").onclick = (event) => {
    event.stopPropagation();
    openPlaylistModal(song);
  };
  card.querySelector(".c-sub").onclick = (event) => {
    event.stopPropagation();
    renderArtistPage(song.artist);
  };
  card.addEventListener("mousemove", (event) => {
    const rect = card.getBoundingClientRect();
    const tiltX = (event.clientX - rect.left) / rect.width - 0.5;
    const tiltY = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `translateY(-6px) scale(1.015) perspective(500px) rotateX(${-tiltY * 12}deg) rotateY(${tiltX * 12}deg)`;
    card.style.transition = "border-color .38s ease,background .38s ease,box-shadow .38s ease";
  });
  card.addEventListener("mouseleave", () => {
    card.style.transform = "";
    card.style.transition = "";
  });
  card.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showContextMenu(event, song);
  });
  return card;
}

function fillGrid(elementId, songList) {
  const gridElement = document.getElementById(elementId);
  if (!gridElement) return;
  gridElement.innerHTML = "";
  songList.forEach((song) => gridElement.appendChild(makeCard(song)));
}

const mainScrollArea = document.getElementById("main-scroll");

function getGreeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning ☀️" : hour < 17 ? "Good afternoon 🌤" : "Good evening 🌙";
}

const heroFeatures = tracks.slice(0, 5);

function renderHome() {
  clearInterval(heroInterval);
  const recentTracks = recentlyPlayed.length ? recentlyPlayed : tracks.slice(0, 5);
  mainScrollArea.innerHTML = `
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
    <h1 class="greeting">${getGreeting()}</h1>
    <p class="greeting-sub">Here's what's trending for you today</p>
    ${recentlyPlayed.length ? '<h2 class="sec">Recently Played</h2><div class="grid" id="g-recent"></div>' : ""}
    <h2 class="sec">Recommended</h2><div class="grid" id="g-rec"></div>
    <h2 class="sec">Indian Songs</h2><div class="grid" id="g-indian"></div>
    <h2 class="sec">Qawali</h2><div class="grid" id="g-qawali"></div>
  `;
  if (recentlyPlayed.length) fillGrid("g-recent", recentTracks.slice(0, 5));
  fillGrid("g-rec", tracks.slice(5, 10));
  fillGrid("g-indian", tracks.slice(10, 15));
  fillGrid("g-qawali", tracks.slice(15, 20));

  const heroDotsContainer = document.getElementById("hero-dots");
  heroFeatures.forEach((_, index) => {
    const dot = document.createElement("div");
    dot.className = "hero-dot" + (index === 0 ? " active" : "");
    dot.onclick = () => {
      heroIndex = index;
      updateHeroSlide(true);
    };
    heroDotsContainer.appendChild(dot);
  });
  heroIndex = 0;
  updateHeroSlide(false);

  heroInterval = setInterval(() => {
    const heroSection = document.getElementById("hero-section");
    if (!heroSection) {
      clearInterval(heroInterval);
      return;
    }
    heroSection.style.opacity = "0";
    setTimeout(() => {
      heroIndex = (heroIndex + 1) % heroFeatures.length;
      updateHeroSlide(false);
      heroSection.style.opacity = "1";
    }, 300);
  }, 5000);
}

function updateHeroSlide(isUserClick) {
  const song = heroFeatures[heroIndex];
  const heroBackground = document.getElementById("hero-bg");
  const heroImage = document.getElementById("hero-img");
  const heroTitle = document.getElementById("hero-title");
  const heroArtist = document.getElementById("hero-artist");
  const heroPlayButton = document.getElementById("hero-play");
  const heroQueueButton = document.getElementById("hero-queue");
  if (!heroBackground) return;
  heroBackground.style.backgroundImage = `url(${song.image})`;
  heroImage.src = song.image;
  heroImage.onerror = () => (heroImage.src = `https://picsum.photos/seed/${song.id}/200`);
  heroTitle.textContent = song.title;
  heroArtist.textContent = song.artist;
  heroPlayButton.onclick = () => playSong(song);
  heroQueueButton.onclick = () => addToQueue(song);
  document.querySelectorAll(".hero-dot").forEach((dot, index) => dot.classList.toggle("active", index === heroIndex));
}

const genreFilters = [
  { label: "🎵 All",          filter: null },
  { label: "🇬🇧 Ed Sheeran",  filter: "Ed Sheeran" },
  { label: "🎤 Hip-Hop",      filter: "Eminem,50 Cent" },
  { label: "🌶️ Indian",       filter: "Shilpa Rao,Badshah,Madhubanti Bagchi,Alisha, Shankar Mahadeevan" },
  { label: "🎶 Qawali",       filter: "Ustad Nusrat Fateh Ali Khan,Ustad Rahat Fateh Ali Khan,Javed Bhasir" },
  { label: "🌍 Pop",          filter: "Shawn Mendes,Maneskin" },
];

function renderSearch() {
  clearInterval(heroInterval);
  mainScrollArea.innerHTML = `
    <h1 class="greeting" style="margin-bottom:16px">Search</h1>
    <div class="s-wrap">
      <span class="s-ico">⌕</span>
      <input class="s-inp" id="s-inp" placeholder="Search tracks, artists…" autofocus>
    </div>
    <div class="s-chips" id="s-chips"></div>
    <h2 class="sec">Results</h2>
    <div class="grid" id="g-search"></div>
  `;
  const searchInput = document.getElementById("s-inp");
  const chipsContainer = document.getElementById("s-chips");
  let activeGenre = null;

  genreFilters.forEach((genre) => {
    const chip = document.createElement("div");
    chip.className = "s-chip" + (genre.filter === null ? " active" : "");
    chip.textContent = genre.label;
    chip.onclick = () => {
      activeGenre = genre.filter;
      document.querySelectorAll(".s-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      runSearch();
    };
    chipsContainer.appendChild(chip);
  });

  const runSearch = () => {
    const searchQuery = searchInput.value.toLowerCase().trim();
    let filteredTracks = tracks;
    if (activeGenre) {
      const artistNames = activeGenre.split(",").map((a) => a.toLowerCase().trim());
      filteredTracks = filteredTracks.filter((song) =>
        artistNames.some((artist) => song.artist.toLowerCase().includes(artist)),
      );
    }
    if (searchQuery)
      filteredTracks = filteredTracks.filter(
        (song) =>
          song.title.toLowerCase().includes(searchQuery) ||
          song.artist.toLowerCase().includes(searchQuery),
      );
    fillGrid("g-search", filteredTracks);
  };
  searchInput.addEventListener("input", runSearch);
  runSearch();
}

function renderLibrary() {
  clearInterval(heroInterval);
  mainScrollArea.innerHTML = `
    <h1 class="greeting">Your Library</h1>
    <button class="new-btn" id="btn-new">＋ New Playlist</button>
    <div class="grid" id="g-lib"></div>
  `;
  document.getElementById("btn-new").onclick = createPlaylist;
  const libraryGrid = document.getElementById("g-lib");
  playlists.forEach((playlist) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="c-art" style="background:linear-gradient(135deg,#071d0e 0%,#150730 100%);
        display:flex;align-items:center;justify-content:center;font-size:42px">🎵</div>
      <div class="c-title">${playlist.name}</div>
      <div class="c-sub">${playlist.songs.length} song${playlist.songs.length !== 1 ? "s" : ""}</div>
      <div class="play-btn"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
    `;
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      const tiltX = (event.clientX - rect.left) / rect.width - 0.5;
      const tiltY = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `translateY(-6px) scale(1.015) perspective(500px) rotateX(${-tiltY * 12}deg) rotateY(${tiltX * 12}deg)`;
      card.style.transition = "border-color .38s ease,background .38s ease,box-shadow .38s ease";
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
      card.style.transition = "";
    });
    card.onclick = () => renderPlaylistPage(playlist);
    card.querySelector(".play-btn").onclick = (event) => {
      event.stopPropagation();
      if (playlist.songs.length) {
        playerState.currentPlaylist = playlist;
        playSong(playlist.songs[0]);
      } else {
        showToast("This playlist is empty");
      }
    };
    libraryGrid.appendChild(card);
  });
}

function renderPlaylistPage(playlist) {
  clearInterval(heroInterval);
  mainScrollArea.innerHTML = `
    <button class="back-btn" id="back-btn">← Back to Library</button>
    <h1 class="greeting">${playlist.name}</h1>
    <p class="greeting-sub" style="margin-bottom:24px">${playlist.songs.length} song${playlist.songs.length !== 1 ? "s" : ""}</p>
    ${playlist.songs.length ? '<div class="grid" id="g-pl"></div>' : '<p style="color:var(--muted);margin-top:16px">Empty playlist — add tracks from Home or Search.</p>'}
  `;
  document.getElementById("back-btn").onclick = renderLibrary;
  if (playlist.songs.length) {
    const playlistGrid = document.getElementById("g-pl");
    playlist.songs.forEach((song) => {
      const songCard = makeCard(song);
      const removeButton = document.createElement("div");
      removeButton.className = "add-btn";
      removeButton.style = "right:62px;font-size:20px";
      removeButton.textContent = "×";
      removeButton.title = "Remove";
      removeButton.onclick = (event) => {
        event.stopPropagation();
        playlist.songs = playlist.songs.filter((s) => s.id !== song.id);
        renderPlaylistPage(playlist);
      };
      songCard.appendChild(removeButton);
      playlistGrid.appendChild(songCard);
    });
  }
}

function renderLikedSongs() {
  clearInterval(heroInterval);
  const likedTrackList = tracks.filter((song) => likedSongs.has(song.id));
  mainScrollArea.innerHTML = `
    <button class="back-btn" id="back-btn">← Back</button>
    <h1 class="greeting">Liked Songs ♥</h1>
    <p class="greeting-sub" style="margin-bottom:24px">${likedTrackList.length} song${likedTrackList.length !== 1 ? "s" : ""}</p>
    ${likedTrackList.length ? '<div class="grid" id="g-liked"></div>' : '<p style="color:var(--muted);margin-top:16px">Like tracks using the ♡ button in the player.</p>'}
  `;
  document.getElementById("back-btn").onclick = renderLibrary;
  if (likedTrackList.length) fillGrid("g-liked", likedTrackList);
}

function renderArtistPage(artistName) {
  clearInterval(heroInterval);
  const artistSongs = tracks.filter((song) => song.artist === artistName);
  const coverImage = artistSongs[0]?.image || "https://picsum.photos/seed/artist/400";
  mainScrollArea.innerHTML = `
    <button class="back-btn" id="back-btn">← Back</button>
    <div class="artist-hero">
      <img class="artist-hero-img" src="${coverImage}" onerror="this.src='https://picsum.photos/seed/art/400'" alt="">
      <div class="artist-hero-info">
        <div class="artist-hero-name">${artistName}</div>
        <div class="artist-hero-count">${artistSongs.length} song${artistSongs.length !== 1 ? "s" : ""}</div>
      </div>
    </div>
    <div class="grid" id="g-artist"></div>
  `;
  document.getElementById("back-btn").onclick = () => window.history.go(-1) || renderHome();
  fillGrid("g-artist", artistSongs);
}

function renderQueuePanel() {
  const queueBody = document.getElementById("qp-body");
  if (!queueBody) return;
  queueBody.innerHTML = "";

  if (playerState.current) {
    const nowPlayingLabel = document.createElement("div");
    nowPlayingLabel.className = "qp-section-label";
    nowPlayingLabel.textContent = "Now Playing";
    queueBody.appendChild(nowPlayingLabel);
    queueBody.appendChild(makeQueueItem(playerState.current, false, true));
  }

  if (manualQueue.length) {
    const nextInQueueLabel = document.createElement("div");
    nextInQueueLabel.className = "qp-section-label";
    nextInQueueLabel.textContent = "Next in Queue";
    queueBody.appendChild(nextInQueueLabel);
    manualQueue.forEach((song, index) => {
      const queueItem = makeQueueItem(song, true, false);
      const removeButton = queueItem.querySelector(".q-rem");
      if (removeButton)
        removeButton.onclick = (event) => {
          event.stopPropagation();
          manualQueue.splice(index, 1);
          renderQueuePanel();
          showToast("Removed from queue");
        };
      queueBody.appendChild(queueItem);
    });
  }

  const currentTrackList = playerState.currentPlaylist ? playerState.currentPlaylist.songs : tracks;
  const currentIndex = playerState.current
    ? currentTrackList.findIndex((song) => song.id === playerState.current.id)
    : -1;
  const upcomingTracks = currentTrackList.slice(currentIndex + 1, currentIndex + 8);

  if (upcomingTracks.length) {
    const upNextLabel = document.createElement("div");
    upNextLabel.className = "qp-section-label";
    upNextLabel.textContent = "Up Next";
    queueBody.appendChild(upNextLabel);
    upcomingTracks.forEach((song) => queueBody.appendChild(makeQueueItem(song, false, false)));
  }

  if (!playerState.current && !manualQueue.length) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "q-empty";
    emptyMessage.innerHTML = "Nothing playing yet.<br>Pick a song to get started 🎵";
    queueBody.appendChild(emptyMessage);
  }
}

function makeQueueItem(song, isRemovable, isCurrent) {
  const queueItem = document.createElement("div");
  queueItem.className = "q-item" + (isCurrent ? " current" : "");
  queueItem.innerHTML = `
    <img class="q-art" src="${song.image}" onerror="this.src='https://picsum.photos/seed/${song.id}/80'" alt="">
    <div class="q-info">
      <div class="q-title">${song.title}</div>
      <div class="q-artist">${song.artist}</div>
    </div>
    ${isRemovable ? '<button class="q-rem" title="Remove">×</button>' : ""}
  `;
  if (!isCurrent) queueItem.onclick = () => playSong(song);
  return queueItem;
}

document.getElementById("btn-queue").onclick = () => {
  const queuePanel = document.getElementById("queue-panel");
  queuePanel.classList.toggle("open");
  document.getElementById("btn-queue").classList.toggle("active-q", queuePanel.classList.contains("open"));
  if (queuePanel.classList.contains("open")) renderQueuePanel();
};
document.getElementById("qp-close").onclick = () => {
  document.getElementById("queue-panel").classList.remove("open");
  document.getElementById("btn-queue").classList.remove("active-q");
};

function openExpandedPlayer() {
  const expandedPlayer = document.getElementById("expanded-player");
  expandedPlayer.classList.add("open");
  updatePlayerUI();
}
function closeExpandedPlayer() {
  document.getElementById("expanded-player").classList.remove("open");
}

document.getElementById("btn-expand").onclick = openExpandedPlayer;
document.getElementById("disc-wrap-btn").onclick = () => { if (playerState.current) openExpandedPlayer(); };
document.getElementById("ep-close-btn").onclick = closeExpandedPlayer;
document.getElementById("ep-btn-play").onclick = togglePlayPause;
document.getElementById("ep-btn-next").onclick = playNext;
document.getElementById("ep-btn-prev").onclick = playPrevious;

document.getElementById("ep-btn-shuffle").onclick = () => {
  playerState.shuffle = !playerState.shuffle;
  document.getElementById("ep-btn-shuffle").classList.toggle("on", playerState.shuffle);
  document.getElementById("btn-shuffle").classList.toggle("on", playerState.shuffle);
  showToast(playerState.shuffle ? "Shuffle on" : "Shuffle off");
};

document.getElementById("ep-btn-repeat").onclick = () => {
  const modes = ["off", "all", "one"];
  const currentIndex = modes.indexOf(playerState.repeat);
  playerState.repeat = modes[(currentIndex + 1) % 3];
  const isOn = playerState.repeat !== "off";
  document.getElementById("ep-btn-repeat").classList.toggle("on", isOn);
  document.getElementById("btn-repeat").classList.toggle("on", isOn);
  document.getElementById("ep-btn-repeat").textContent = playerState.repeat === "one" ? "↺" : "↻";
  showToast(`Repeat: ${playerState.repeat}`);
};

document.getElementById("ep-like-btn").onclick = () => {
  if (!playerState.current) return;
  const songId = playerState.current.id;
  if (likedSongs.has(songId)) {
    likedSongs.delete(songId);
    showToast("Removed from Liked Songs");
  } else {
    likedSongs.add(songId);
    showToast("Added to Liked Songs ♥");
    showHeartBurst();
  }
  updatePlayerUI();
};

document.getElementById("ep-song-artist").onclick = () => {
  if (playerState.current) {
    closeExpandedPlayer();
    renderArtistPage(playerState.current.artist);
  }
};

const expandedProgressTrack = document.getElementById("ep-prog-track");
let isDraggingExpandedProgress = false;
const seekExpandedTo = (event) => {
  if (!playerState.current || isNaN(audioElement.duration)) return;
  const rect = expandedProgressTrack.getBoundingClientRect();
  audioElement.currentTime =
    Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * audioElement.duration;
};
expandedProgressTrack.addEventListener("mousedown", (event) => { isDraggingExpandedProgress = true; seekExpandedTo(event); });
document.addEventListener("mousemove", (event) => { if (isDraggingExpandedProgress) seekExpandedTo(event); });
document.addEventListener("mouseup", () => { isDraggingExpandedProgress = false; });

const expandedVolumeTrack = document.getElementById("ep-vol-track");
let isDraggingExpandedVolume = false;
const setExpandedVolume = (event) => {
  const rect = expandedVolumeTrack.getBoundingClientRect();
  const newVolume = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  playerState.volume = newVolume;
  audioElement.volume = newVolume;
  document.getElementById("ep-vol-fill").style.width = newVolume * 100 + "%";
  document.getElementById("vol-fill").style.width = newVolume * 100 + "%";
  updateVolumeIcon();
};
expandedVolumeTrack.addEventListener("mousedown", (event) => { isDraggingExpandedVolume = true; setExpandedVolume(event); });
document.addEventListener("mousemove", (event) => { if (isDraggingExpandedVolume) setExpandedVolume(event); });
document.addEventListener("mouseup", () => { isDraggingExpandedVolume = false; });

function showContextMenu(event, song) {
  contextMenuSong = song;
  const contextMenu = document.getElementById("ctx-menu");
  contextMenu.classList.add("show");
  let menuX = event.clientX;
  let menuY = event.clientY;
  const menuWidth = 190;
  const menuHeight = 180;
  if (menuX + menuWidth > window.innerWidth) menuX = window.innerWidth - menuWidth - 10;
  if (menuY + menuHeight > window.innerHeight) menuY = window.innerHeight - menuHeight - 10;
  contextMenu.style.left = menuX + "px";
  contextMenu.style.top = menuY + "px";
  document.getElementById("ctx-like").textContent = likedSongs.has(song.id) ? "♥  Liked" : "♡  Like Song";
}

function hideContextMenu() {
  document.getElementById("ctx-menu").classList.remove("show");
  contextMenuSong = null;
}

document.addEventListener("click", hideContextMenu);
document.addEventListener("contextmenu", (event) => {
  if (!event.target.closest(".card")) hideContextMenu();
});
document.getElementById("ctx-play").onclick = () => { if (contextMenuSong) playSong(contextMenuSong); };
document.getElementById("ctx-queue").onclick = () => { if (contextMenuSong) addToQueue(contextMenuSong); };
document.getElementById("ctx-like").onclick = () => {
  if (!contextMenuSong) return;
  const songId = contextMenuSong.id;
  if (likedSongs.has(songId)) {
    likedSongs.delete(songId);
    showToast("Removed from Liked Songs");
  } else {
    likedSongs.add(songId);
    showToast("Added to Liked Songs ♥");
    showHeartBurst();
  }
  updatePlayerUI();
};
document.getElementById("ctx-playlist").onclick = () => { if (contextMenuSong) openPlaylistModal(contextMenuSong); };
document.getElementById("ctx-artist").onclick = () => { if (contextMenuSong) renderArtistPage(contextMenuSong.artist); };

function showHeartBurst() {
  const likeButton = document.getElementById("like-btn");
  const buttonRect = likeButton.getBoundingClientRect();
  for (let i = 0; i < 5; i++) {
    const heart = document.createElement("div");
    heart.className = "heart-burst";
    heart.textContent = "♥";
    heart.style.left = buttonRect.left + buttonRect.width / 2 + (Math.random() - 0.5) * 30 + "px";
    heart.style.top = buttonRect.top + buttonRect.height / 2 + (Math.random() - 0.5) * 20 + "px";
    heart.style.animationDelay = i * 0.08 + "s";
    heart.style.fontSize = 14 + Math.random() * 10 + "px";
    heart.style.color = `hsl(${130 + Math.random() * 40},100%,60%)`;
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 700);
  }
}

document.getElementById("btn-play").onclick = togglePlayPause;
document.getElementById("btn-next").onclick = playNext;
document.getElementById("btn-prev").onclick = playPrevious;

document.getElementById("btn-shuffle").onclick = function () {
  playerState.shuffle = !playerState.shuffle;
  this.classList.toggle("on", playerState.shuffle);
  document.getElementById("ep-btn-shuffle").classList.toggle("on", playerState.shuffle);
  showToast(playerState.shuffle ? "Shuffle on" : "Shuffle off");
};

document.getElementById("btn-repeat").onclick = function () {
  const modes = ["off", "all", "one"];
  const currentIndex = modes.indexOf(playerState.repeat);
  playerState.repeat = modes[(currentIndex + 1) % 3];
  this.classList.toggle("on", playerState.repeat !== "off");
  this.textContent = playerState.repeat === "one" ? "↺" : "↻";
  document.getElementById("ep-btn-repeat").textContent = playerState.repeat === "one" ? "↺" : "↻";
  document.getElementById("ep-btn-repeat").classList.toggle("on", playerState.repeat !== "off");
  showToast(`Repeat: ${playerState.repeat}`);
};

const progressTrack = document.getElementById("prog-track");
let isDraggingProgress = false;
const seekTo = (event) => {
  if (!playerState.current || isNaN(audioElement.duration)) return;
  const rect = progressTrack.getBoundingClientRect();
  audioElement.currentTime =
    Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * audioElement.duration;
};
progressTrack.addEventListener("mousedown", (event) => { isDraggingProgress = true; seekTo(event); });
document.addEventListener("mousemove", (event) => { if (isDraggingProgress) seekTo(event); });
document.addEventListener("mouseup", () => { isDraggingProgress = false; });
progressTrack.addEventListener("touchstart", (event) => seekTo(event.touches[0]), { passive: true });
progressTrack.addEventListener("touchmove", (event) => seekTo(event.touches[0]), { passive: true });

const volumeTrack = document.getElementById("vol-track");
let isDraggingVolume = false;
const setVolume = (event) => {
  const rect = volumeTrack.getBoundingClientRect();
  const newVolume = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  playerState.volume = newVolume;
  audioElement.volume = newVolume;
  document.getElementById("vol-fill").style.width = newVolume * 100 + "%";
  if (document.getElementById("ep-vol-fill"))
    document.getElementById("ep-vol-fill").style.width = newVolume * 100 + "%";
  updateVolumeIcon();
};
volumeTrack.addEventListener("mousedown", (event) => { isDraggingVolume = true; setVolume(event); });
document.addEventListener("mousemove", (event) => { if (isDraggingVolume) setVolume(event); });
document.addEventListener("mouseup", () => { isDraggingVolume = false; });

document.getElementById("vol-btn").onclick = () => {
  if (audioElement.volume > 0) {
    playerState.previousVolume = audioElement.volume;
    audioElement.volume = 0;
    playerState.volume = 0;
  } else {
    audioElement.volume = playerState.previousVolume || 0.7;
    playerState.volume = audioElement.volume;
  }
  document.getElementById("vol-fill").style.width = playerState.volume * 100 + "%";
  updateVolumeIcon();
};

function updateVolumeIcon() {
  const icon = playerState.volume === 0 ? "🔇" : playerState.volume < 0.5 ? "🔉" : "🔊";
  document.getElementById("vol-btn").textContent = icon;
  const expandedVolumeButton = document.getElementById("ep-vol-btn");
  if (expandedVolumeButton) expandedVolumeButton.textContent = icon;
}

document.getElementById("like-btn").onclick = (event) => {
  if (!playerState.current) return;
  const songId = playerState.current.id;
  if (likedSongs.has(songId)) {
    likedSongs.delete(songId);
    showToast("Removed from Liked Songs");
  } else {
    likedSongs.add(songId);
    showToast("Added to Liked Songs ♥");
    showHeartBurst();
  }
  updatePlayerUI();
};

document.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement.tagName;
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
  if (event.code === "Space") {
    event.preventDefault();
    togglePlayPause();
  } else if (event.code === "ArrowRight") {
    playNext();
  } else if (event.code === "ArrowLeft") {
    playPrevious();
  } else if (event.code === "KeyM") {
    document.getElementById("vol-btn").click();
  } else if (event.code === "KeyQ") {
    document.getElementById("btn-queue").click();
  } else if (event.code === "KeyF") {
    const expandedPlayer = document.getElementById("expanded-player");
    if (expandedPlayer.classList.contains("open")) closeExpandedPlayer();
    else if (playerState.current) openExpandedPlayer();
  } else if (event.code === "KeyL") {
    if (playerState.current) document.getElementById("like-btn").click();
  } else if (event.code === "ArrowUp") {
    event.preventDefault();
    const newVolume = Math.min(1, playerState.volume + 0.05);
    playerState.volume = newVolume;
    audioElement.volume = newVolume;
    document.getElementById("vol-fill").style.width = newVolume * 100 + "%";
    updateVolumeIcon();
  } else if (event.code === "ArrowDown") {
    event.preventDefault();
    const newVolume = Math.max(0, playerState.volume - 0.05);
    playerState.volume = newVolume;
    audioElement.volume = newVolume;
    document.getElementById("vol-fill").style.width = newVolume * 100 + "%";
    updateVolumeIcon();
  } else if (event.code === "Escape") {
    closeExpandedPlayer();
    hideContextMenu();
  }
});

document.querySelectorAll(".nav-item").forEach((navItem) => {
  navItem.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    navItem.classList.add("active");
    const viewName = navItem.dataset.view;
    if (viewName === "home") renderHome();
    else if (viewName === "search") renderSearch();
    else if (viewName === "library") renderLibrary();
  });
});

document.getElementById("sb-create").onclick = createPlaylist;
document.getElementById("sb-liked").onclick = () => {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  document.querySelector('[data-view="library"]').classList.add("active");
  renderLikedSongs();
};
document.getElementById("sb-episodes").onclick = () => showToast("Episodes coming soon 🎙");

function createPlaylist() {
  const playlistName = prompt("Playlist name:");
  if (!playlistName?.trim()) return;
  playlists.push({ id: playlistCounter++, name: playlistName.trim(), songs: [] });
  updateSidebarPlaylists();
  renderLibrary();
  showToast(`Created "${playlistName.trim()}" ✓`);
}

function openPlaylistModal(song) {
  const modalList = document.getElementById("m-list");
  modalList.innerHTML = "";
  playlists.forEach((playlist) => {
    const playlistItem = document.createElement("div");
    playlistItem.className = "m-item";
    playlistItem.textContent = playlist.name;
    playlistItem.onclick = () => {
      if (playlist.songs.find((s) => s.id === song.id)) {
        showToast(`Already in "${playlist.name}"`);
      } else {
        playlist.songs.push(song);
        showToast(`Added to "${playlist.name}" ✓`);
      }
      closePlaylistModal();
    };
    modalList.appendChild(playlistItem);
  });
  document.getElementById("modal").classList.add("open");
}

function closePlaylistModal() {
  document.getElementById("modal").classList.remove("open");
}
document.getElementById("m-close").onclick = closePlaylistModal;
document.getElementById("modal").onclick = (event) => {
  if (event.target.id === "modal") closePlaylistModal();
};

function updateSidebarPlaylists() {
  const sidebarContainer = document.getElementById("sb-playlists");
  sidebarContainer.innerHTML = "";
  playlists.forEach((playlist) => {
    const playlistItem = document.createElement("div");
    playlistItem.className = "pl-item";
    playlistItem.textContent = playlist.name;
    playlistItem.onclick = () => {
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
      document.querySelector('[data-view="library"]').classList.add("active");
      renderPlaylistPage(playlist);
    };
    sidebarContainer.appendChild(playlistItem);
  });
}

let toastTimer;
function showToast(message) {
  const toastElement = document.getElementById("toast");
  toastElement.textContent = message;
  toastElement.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove("show"), 2600);
}

audioElement.volume = playerState.volume;
window._musicPlaying = false;
renderHome();
updateSidebarPlaylists();
updatePlayerUI();
renderQueuePanel();

setTimeout(() => showToast("Shortcuts: Space=Play  Q=Queue  F=Fullscreen  L=Like"), 1200);