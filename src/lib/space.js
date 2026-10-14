import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();
const SUN_DIR = new THREE.Vector3(0.65, 0.35, -0.68).normalize();

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

// ---------------------------------------------------------------- helpers

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function randomDir(rng, out = new THREE.Vector3()) {
  const z = rng() * 2 - 1;
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a));
}

function glowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Lumpy, cratered unit-ish asteroid with baked vertex colours. */
function makeRockGeometry(seed, { detail = 4, bumps = 0.22, craterCount = 10, color = '#6d6862' } = {}) {
  const rng = mulberry32(seed);
  const simplex = new SimplexNoise({ random: rng });
  let geo = new THREE.IcosahedronGeometry(1, detail);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);

  const stretch = new THREE.Vector3(1, 0.72 + rng() * 0.25, 0.8 + rng() * 0.25);
  const craters = Array.from({ length: craterCount }, () => ({
    dir: randomDir(rng),
    size: 0.18 + rng() * 0.32,
    depth: 0.04 + rng() * 0.08,
  }));
  const off = rng() * 100;
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(color);
  const c = new THREE.Color();
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let n = 0;
    let amp = 1;
    let freq = 1.1;
    let norm = 0;
    for (let o = 0; o < 5; o++) {
      n += amp * simplex.noise3d(v.x * freq + off, v.y * freq + off, v.z * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.05;
    }
    n /= norm;

    let r = 1 + n * bumps;
    let shade = 0;
    for (const cr of craters) {
      const t = v.distanceTo(cr.dir) / cr.size;
      if (t < 1.5) {
        if (t < 1) {
          r -= cr.depth * (1 - t * t);
          shade -= 0.25 * (1 - t);
        }
        r += cr.depth * 0.45 * Math.exp(-(((t - 1) / 0.18) ** 2));
      }
    }
    v.multiply(stretch).multiplyScalar(r);
    pos.setXYZ(i, v.x, v.y, v.z);

    const k = Math.max(0.15, 0.62 + n * 0.9 + shade + (rng() - 0.5) * 0.12);
    c.copy(base).multiplyScalar(k);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function surfaceRadius(geo, dir) {
  const pos = geo.attributes.position;
  let best = -Infinity;
  let len = 1;
  for (let i = 0; i < pos.count; i++) {
    _v1.fromBufferAttribute(pos, i);
    const l = _v1.length();
    const d = _v1.dot(dir) / l;
    if (d > best) {
      best = d;
      len = l;
    }
  }
  return len;
}

// ---------------------------------------------------------------- shaders

const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return v;
  }
`;

const nebulaMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float n1 = fbm(d * 2.2 + vec3(0.0, 0.0, uTime * 0.004));
        float n2 = fbm(d * 4.1 + vec3(5.2, 1.3, 2.1));
        float n3 = fbm(d * 1.4 - vec3(2.0, 0.4, uTime * 0.002));
        float band = exp(-pow(d.y * 2.4 + d.x * 0.6 + (n3 - 0.5) * 1.6, 2.0));

        vec3 col = vec3(0.004, 0.005, 0.014);
        col += vec3(0.24, 0.06, 0.40) * pow(smoothstep(0.38, 0.85, n1), 2.0) * 0.55;
        col += vec3(0.02, 0.20, 0.30) * pow(smoothstep(0.45, 0.88, n2), 2.0) * 0.45;
        col += vec3(0.50, 0.14, 0.07) * pow(smoothstep(0.30, 0.62, n1 * n3 * 1.3), 3.0) * 0.35;
        col += vec3(0.07, 0.06, 0.11) * band * (0.4 + n2);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });

const starMaterial = (pixelRatio) =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = aColor;
        vTwinkle = 0.7 + 0.3 * sin(uTime * (0.8 + aPhase * 0.6) + aPhase * 40.0);
        gl_PointSize = aSize * uPixelRatio * (0.8 + 0.2 * vTwinkle);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = 1.0 - smoothstep(0.0, 0.5, d);
        a = a * a;
        gl_FragColor = vec4(vColor * a * vTwinkle, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

const exhaustMaterial = (pixelRatio) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uHot: { value: new THREE.Color(1.1, 1.4, 2.0) },
      uCool: { value: new THREE.Color(0.1, 0.16, 0.75) },
    },
    vertexShader: /* glsl */ `
      attribute float aLife;
      attribute float aSize;
      uniform float uPixelRatio;
      varying float vLife;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float depth = -mv.z;
        // Particles skimming past the camera would otherwise explode in size.
        float nearFade = smoothstep(0.6, 3.0, depth);
        vLife = aLife * nearFade;
        float size = aSize * (0.25 + 0.75 * aLife) * uPixelRatio * (220.0 / max(depth, 0.1));
        gl_PointSize = clamp(size, 1.0, 48.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
        // Park dead / too-close particles outside the clip volume.
        if (aLife <= 0.0 || nearFade <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHot;
      uniform vec3 uCool;
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vLife <= 0.0) discard;
        float a = (1.0 - smoothstep(0.0, 0.5, d)) * vLife * vLife * 0.55;
        vec3 col = mix(uCool, uHot, smoothstep(0.45, 1.0, vLife));
        gl_FragColor = vec4(col * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

// ---------------------------------------------------------------- scene

export class SpaceScene {
  /**
   * @param {HTMLElement} container
   * @param {{ destinations: any[], labels?: Record<string, HTMLElement>, telemetry?: HTMLElement,
   *           onArrive?: (id: string) => void, onHover?: (id: string|null) => void,
   *           onSelect?: (id: string) => void, reducedMotion?: boolean, initial?: string }} opts
   */
  constructor(container, opts) {
    this.container = container;
    this.opts = opts;
    this.reducedMotion = !!opts.reducedMotion;
    this.labels = opts.labels ?? {};
    this.hovered = null;
    this.pointer = new THREE.Vector2(9, 9);
    this.parallax = new THREE.Vector2();
    this.parallaxTarget = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.time = 0;
    this.telemetryTimer = 0;

    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(this.pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'space-canvas';
    container.appendChild(renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
    this.glowTex = glowTexture();

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmrem.dispose();

    this.buildSky();
    this.buildLights();
    this.buildDust();
    this.buildBelt();
    this.buildDestinations(opts.destinations);
    this.buildShip();
    this.buildExhaust();

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.5, 0.88);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // Ship starts circling the launch point.
    const start = this.dest(opts.initial ?? 'home') ?? this.dests[0];
    this.travel = null;
    this.orbit = { dest: start, theta: 0, since: 10 };
    this.shipSpeed = 0;
    this.bank = 0;
    this.prevFwd = this.orbitTangent(start, 0, new THREE.Vector3());
    this.ship.position.copy(this.orbitPoint(start, 0, new THREE.Vector3()));
    this.ship.quaternion.copy(this.headingQuat(this.prevFwd, 0));
    this.lastNozzle = this.nozzles.map((n) => this.ship.localToWorld(n.clone()));

    const frame = this.framing(start);
    this.camPos = frame.pos.clone().add(new THREE.Vector3(0, 25, 40));
    this.camTarget = frame.target.clone();

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerLeave = () => this.setHovered(null);
    const el = renderer.domElement;
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerLeave);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    renderer.setAnimationLoop(() => this.tick());
  }

  dest(id) {
    return this.dests.find((d) => d.id === id);
  }

  // -------------------------------------------------------------- builders

  buildSky() {
    const sky = (this.sky = new THREE.Group());
    this.scene.add(sky);

    this.nebula = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 32), nebulaMaterial());
    this.nebula.renderOrder = -10;
    this.nebula.frustumCulled = false;
    sky.add(this.nebula);

    const rng = mulberry32(7);
    const count = 7000;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const palette = [new THREE.Color('#ffffff'), new THREE.Color('#bcd2ff'), new THREE.Color('#ffe2b8'), new THREE.Color('#ffc7d9')];
    const d = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      randomDir(rng, d);
      // Bias some stars towards the galactic band.
      if (rng() < 0.35) d.y *= 0.25;
      d.normalize().multiplyScalar(1200);
      pos.set([d.x, d.y, d.z], i * 3);
      const big = rng() < 0.04;
      const c = palette[Math.floor(rng() * palette.length)];
      const b = big ? 1.6 + rng() : 0.25 + rng() * 0.7;
      col.set([c.r * b, c.g * b, c.b * b], i * 3);
      size[i] = big ? 3 + rng() * 2.5 : 1 + rng() * 1.8;
      phase[i] = rng();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    this.stars = new THREE.Points(geo, starMaterial(this.pixelRatio));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    sky.add(this.stars);

    // Distant sun
    const sunPos = SUN_DIR.clone().multiplyScalar(1000);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(1.6, 0.9, 0.55), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    halo.scale.setScalar(520);
    halo.position.copy(sunPos);
    const core = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(6, 5, 4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    core.scale.setScalar(70);
    core.position.copy(sunPos);
    sky.add(halo, core);
  }

  buildLights() {
    const sun = new THREE.DirectionalLight('#ffe6cc', 3.2);
    sun.position.copy(SUN_DIR).multiplyScalar(100);
    const fill = new THREE.DirectionalLight('#6a4cff', 0.6);
    fill.position.set(-60, -20, 50);
    const hemi = new THREE.HemisphereLight('#3b4a7a', '#120a1c', 0.45);
    this.scene.add(sun, fill, hemi);
  }

  buildDust() {
    const rng = mulberry32(99);
    const count = 1800;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * 260;
      pos[i * 3 + 1] = (rng() - 0.5) * 120;
      pos[i * 3 + 2] = (rng() - 0.5) * 260;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.35,
        map: this.glowTex,
        color: '#8fa3d6',
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(this.dust);
  }

  buildBelt() {
    const rng = mulberry32(1234);
    const belt = (this.belt = new THREE.Group());
    belt.rotation.x = 0.08;
    belt.position.y = -6;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.05, flatShading: true, envMapIntensity: 0.15 });
    const dummy = new THREE.Object3D();
    for (let g = 0; g < 4; g++) {
      const geo = makeRockGeometry(500 + g * 17, { detail: 1, bumps: 0.35, craterCount: 3, color: g % 2 ? '#5d5852' : '#4f4c55' });
      const count = 260;
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const r = 105 + Math.pow(rng(), 0.7) * 55;
        const y = (rng() + rng() + rng() - 1.5) * 8;
        dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        dummy.rotation.set(rng() * 6, rng() * 6, rng() * 6);
        dummy.scale.setScalar(0.3 + Math.pow(rng(), 3) * 3.2);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      belt.add(mesh);
    }
    this.scene.add(belt);
  }

  buildDestinations(list) {
    this.dests = [];
    this.pickables = [];
    const crystalGeo = new THREE.LatheGeometry(
      [new THREE.Vector2(0, -1), new THREE.Vector2(0.38, -0.75), new THREE.Vector2(0.38, 0.45), new THREE.Vector2(0, 1)],
      6,
    );
    crystalGeo.translate(0, 0.8, 0);
    const moonGeos = [11, 12, 13].map((s) => makeRockGeometry(s * 31, { detail: 1, bumps: 0.3, craterCount: 2 }));
    const moonMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, envMapIntensity: 0.15 });

    for (const def of list) {
      const s = def.scene ?? {};
      const rng = mulberry32((s.seed ?? 1) * 977);
      const center = new THREE.Vector3(...(s.position ?? [0, 0, 0]));
      const rockRadius = s.radius ?? 0;
      const orbitRadius = s.orbitRadius ?? rockRadius * 2.3 + 2;
      const tilt = s.tilt ?? 0.15;
      const normal = new THREE.Vector3(Math.sin(tilt), Math.cos(tilt), 0).applyAxisAngle(UP, rng() * Math.PI * 2).normalize();
      const u = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 0, 1)).normalize();
      const w = new THREE.Vector3().crossVectors(u, normal).normalize();
      const color = new THREE.Color(def.color ?? '#ffffff');

      const d = {
        id: def.id,
        center,
        rockRadius,
        orbitRadius,
        normal,
        u,
        w,
        color,
        camera: s.camera ? new THREE.Vector3(...s.camera) : null,
        group: new THREE.Group(),
        hover: 0,
      };
      d.group.position.copy(center);
      this.scene.add(d.group);

      if (rockRadius > 0) {
        const tint = new THREE.Color('#6d6862').lerp(color, 0.08);
        const geo = makeRockGeometry(s.seed ?? 1, { detail: 4, bumps: 0.2, craterCount: 12, color: '#' + tint.getHexString() });
        const rock = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.08, flatShading: true, envMapIntensity: 0.25 }),
        );
        rock.scale.setScalar(rockRadius);
        rock.rotation.set(rng() * 6, rng() * 6, rng() * 6);
        d.rock = rock;
        d.spin = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
        d.spinSpeed = 0.04 + rng() * 0.05;
        d.group.add(rock);

        // Glowing crystal clusters in the destination's accent colour.
        const crystalMat = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 2.4,
          roughness: 0.25,
          metalness: 0.1,
          flatShading: true,
        });
        const clusterDirs = [];
        for (let c = 0; c < 3; c++) {
          const cdir = randomDir(rng);
          clusterDirs.push(cdir);
          const n = 3 + Math.floor(rng() * 3);
          for (let k = 0; k < n; k++) {
            const dir = cdir.clone().add(randomDir(rng).multiplyScalar(0.18)).normalize();
            const h = 0.1 + rng() * 0.17;
            const crystal = new THREE.Mesh(crystalGeo, crystalMat);
            crystal.position.copy(dir).multiplyScalar(surfaceRadius(geo, dir) * 0.93);
            const axis = dir.clone().add(randomDir(rng).multiplyScalar(0.45)).normalize();
            crystal.quaternion.setFromUnitVectors(UP, axis);
            crystal.scale.set(h * 0.45, h, h * 0.45);
            rock.add(crystal);
          }
        }
        const light = new THREE.PointLight(color, rockRadius * rockRadius * 0.9, rockRadius * 4, 2);
        light.position.copy(clusterDirs[0]).multiplyScalar(1.5);
        rock.add(light);

        // Beacon ring in the orbit plane, with a sweeping brighter arc.
        const ringGroup = new THREE.Group();
        ringGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        const ringMat = new THREE.MeshBasicMaterial({
          color: color.clone().multiplyScalar(1.6),
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(rockRadius * 1.75, rockRadius * 1.79, 160), ringMat);
        const arcMat = ringMat.clone();
        arcMat.color = color.clone().multiplyScalar(3);
        arcMat.opacity = 0.85;
        const arc = new THREE.Mesh(new THREE.RingGeometry(rockRadius * 1.72, rockRadius * 1.83, 64, 1, 0, Math.PI * 0.35), arcMat);
        ringGroup.add(ring, arc);
        d.group.add(ringGroup);
        d.ringMat = ringMat;
        d.arc = arc;

        // Tiny moonlets.
        d.moons = [];
        const mcount = 3 + Math.floor(rng() * 3);
        for (let i = 0; i < mcount; i++) {
          const pivot = new THREE.Group();
          pivot.quaternion.setFromUnitVectors(UP, randomDir(rng).add(new THREE.Vector3(0, 3, 0)).normalize());
          const moon = new THREE.Mesh(moonGeos[i % moonGeos.length], moonMat);
          const r = rockRadius * (2.2 + rng() * 1.6);
          moon.position.set(r, 0, 0);
          moon.scale.setScalar(rockRadius * (0.05 + rng() * 0.07));
          pivot.rotation.y = rng() * Math.PI * 2;
          pivot.add(moon);
          d.group.add(pivot);
          d.moons.push({ pivot, moon, speed: (0.08 + rng() * 0.12) * (rng() < 0.5 ? -1 : 1) });
        }

        // Generous invisible hit target for picking.
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(rockRadius * 1.6, 16, 12),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
        );
        hit.userData.id = def.id;
        d.group.add(hit);
        this.pickables.push(hit);
      }

      this.dests.push(d);
    }
  }

  buildShip() {
    const ship = (this.ship = new THREE.Group());
    const hullMat = new THREE.MeshStandardMaterial({ color: '#a9b2c1', metalness: 0.6, roughness: 0.38, envMapIntensity: 0.45 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#262c3a', metalness: 0.7, roughness: 0.4, envMapIntensity: 0.5 });
    const accentMat = new THREE.MeshStandardMaterial({ color: '#ff6a3d', emissive: '#ff5a2c', emissiveIntensity: 1.4, roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#0d2840', metalness: 0.9, roughness: 0.06, emissive: '#0b4d78', emissiveIntensity: 0.7 });

    const profile = [
      [0, -1.5],
      [0.3, -1.5],
      [0.42, -1.2],
      [0.46, -0.4],
      [0.38, 0.4],
      [0.24, 1.1],
      [0.1, 1.6],
      [0, 1.78],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const hullGeo = new THREE.LatheGeometry(profile, 24);
    hullGeo.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.scale.set(1, 0.72, 1);
    ship.add(hull);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glassMat);
    cockpit.scale.set(0.24, 0.2, 0.58);
    cockpit.position.set(0, 0.22, 0.45);
    ship.add(cockpit);

    const ws = new THREE.Shape();
    ws.moveTo(0, 0.5);
    ws.lineTo(1.9, -0.75);
    ws.lineTo(1.95, -1.05);
    ws.lineTo(0, -0.95);
    ws.lineTo(-1.95, -1.05);
    ws.lineTo(-1.9, -0.75);
    ws.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(ws, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    wingGeo.translate(0, 0, -0.035);
    wingGeo.rotateX(Math.PI / 2);
    const wings = new THREE.Mesh(wingGeo, hullMat);
    wings.position.y = -0.06;
    ship.add(wings);

    for (const side of [1, -1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.03, 0.07), accentMat);
      stripe.position.set(side * 1.0, 0.0, -0.2);
      stripe.rotation.y = side * 0.58;
      ship.add(stripe);

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.9, 10).rotateX(Math.PI / 2), darkMat);
      pod.position.set(side * 1.93, -0.04, -0.75);
      ship.add(pod);
    }

    const fs = new THREE.Shape();
    fs.moveTo(-1.35, 0);
    fs.lineTo(-0.35, 0);
    fs.lineTo(-1.05, 0.72);
    fs.lineTo(-1.42, 0.72);
    fs.closePath();
    const finGeo = new THREE.ExtrudeGeometry(fs, { depth: 0.05, bevelEnabled: false });
    finGeo.translate(0, 0, -0.025);
    finGeo.rotateY(-Math.PI / 2);
    const fin = new THREE.Mesh(finGeo, hullMat);
    fin.position.y = 0.22;
    ship.add(fin);
    const finTip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.38), accentMat);
    finTip.position.set(0, 0.94, -1.23);
    ship.add(finTip);

    // Engines + glowing nozzles + flame cones.
    this.nozzles = [];
    this.flames = [];
    const nozzleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 1.7, 2.8) });
    this.nozzleMat = nozzleMat;
    for (const side of [1, -1]) {
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.9, 16).rotateX(Math.PI / 2), darkMat);
      engine.position.set(side * 0.42, -0.02, -1.25);
      ship.add(engine);

      const nozzle = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20).rotateY(Math.PI), nozzleMat);
      nozzle.position.set(side * 0.42, -0.02, -1.71);
      ship.add(nozzle);

      const flameGeo = new THREE.ConeGeometry(0.17, 1, 16, 1, true);
      flameGeo.translate(0, -0.5, 0);
      flameGeo.rotateX(Math.PI / 2);
      // Base at origin, apex at -Z after rotation.
      const flame = new THREE.Mesh(
        flameGeo,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.35, 0.7, 1.8),
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      flame.position.set(side * 0.42, -0.02, -1.72);
      ship.add(flame);
      this.flames.push(flame);
      this.nozzles.push(new THREE.Vector3(side * 0.42, -0.02, -1.8));
    }

    // Wingtip navigation lights.
    this.navLights = [];
    for (const [side, hex] of [
      [1, new THREE.Color(4, 0.3, 0.3)],
      [-1, new THREE.Color(0.3, 4, 0.6)],
    ]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: hex }));
      bulb.position.set(side * 1.95, -0.02, -0.3);
      ship.add(bulb);
      this.navLights.push(bulb);
    }

    this.engineLight = new THREE.PointLight('#5fb4ff', 4, 8, 2);
    this.engineLight.position.set(0, 0, -2.3);
    ship.add(this.engineLight);

    ship.scale.setScalar(0.75);
    this.scene.add(ship);
  }

  buildExhaust() {
    const N = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const life = new Float32Array(N);
    const size = new Float32Array(N);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const points = new THREE.Points(geo, exhaustMaterial(this.pixelRatio));
    points.frustumCulled = false;
    this.scene.add(points);
    this.exhaust = { N, geo, pos, life, size, vel: new Float32Array(N * 3), cursor: 0, acc: 0, points, rng: mulberry32(5) };
  }

  // -------------------------------------------------------------- flight

  orbitPoint(d, theta, out) {
    return out
      .copy(d.center)
      .addScaledVector(d.u, Math.cos(theta) * d.orbitRadius)
      .addScaledVector(d.w, Math.sin(theta) * d.orbitRadius);
  }

  orbitTangent(d, theta, out) {
    return out
      .set(0, 0, 0)
      .addScaledVector(d.u, -Math.sin(theta))
      .addScaledVector(d.w, Math.cos(theta))
      .normalize();
  }

  headingQuat(fwd, bank) {
    const up = _v2.copy(UP).applyAxisAngle(fwd, bank);
    _m.lookAt(fwd, ZERO, up);
    return _q.setFromRotationMatrix(_m);
  }

  /** Fly the ship to a destination. Returns false if already there. */
  flyTo(id) {
    const target = this.dest(id);
    if (!target) return false;
    if (!this.travel && this.orbit?.dest === target) return false;
    if (this.travel?.dest === target) return false;

    const p0 = this.ship.position.clone();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.ship.quaternion).normalize();

    // Join the target's orbit at the point nearest to where we're coming from.
    const rel = p0.clone().sub(target.center);
    const theta0 = Math.atan2(rel.dot(target.w), rel.dot(target.u));
    const p3 = this.orbitPoint(target, theta0, new THREE.Vector3());
    const t3 = this.orbitTangent(target, theta0, new THREE.Vector3());

    const dist = p0.distanceTo(p3);
    const p1 = p0.clone().addScaledVector(fwd, Math.min(dist * 0.4, 18));
    const p2 = p3.clone().addScaledVector(t3, -Math.min(dist * 0.35, target.orbitRadius * 1.4));
    const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
    curve.arcLengthDivisions = 300;
    const length = curve.getLength();
    const duration = this.reducedMotion ? 1.4 : clamp(length / 20, 2.6, 5.5);

    this.travel = { dest: target, curve, length, duration, elapsed: 0, e: 0, theta0 };
    this.orbit = null;
    return true;
  }

  updateShip(dt) {
    const pos = _v1;
    const fwd = new THREE.Vector3();

    if (this.travel) {
      const tr = this.travel;
      tr.elapsed += dt;
      const p = Math.min(1, tr.elapsed / tr.duration);
      const e = easeInOut(p);
      this.shipSpeed = dt > 0 ? ((e - tr.e) * tr.length) / dt : 0;
      tr.e = e;
      tr.p = p;
      tr.curve.getPointAt(e, pos);
      tr.curve.getTangentAt(e, fwd);
      if (p >= 1) {
        this.travel = null;
        this.orbit = { dest: tr.dest, theta: tr.theta0, since: 0 };
        this.opts.onArrive?.(tr.dest.id);
      }
    } else {
      const o = this.orbit;
      o.since += dt;
      const maxOmega = 4 / o.dest.orbitRadius;
      const omega = maxOmega * smoothstep(0, 3, o.since);
      o.theta += omega * dt;
      this.shipSpeed = omega * o.dest.orbitRadius;
      this.orbitPoint(o.dest, o.theta, pos);
      this.orbitTangent(o.dest, o.theta, fwd);
    }

    // Bank into turns.
    const turn = this.prevFwd.angleTo(fwd);
    const sign = Math.sign(_v2.crossVectors(this.prevFwd, fwd).dot(UP));
    const rate = dt > 0 ? (sign * turn) / dt : 0;
    this.prevFwd.copy(fwd);
    const targetBank = clamp(-rate * 1.1, -0.85, 0.85);
    this.bank += (targetBank - this.bank) * damp(3, dt);

    // Gentle hover bob.
    pos.y += Math.sin(this.time * 1.3) * 0.08;
    this.ship.position.copy(pos);
    this.ship.quaternion.slerp(this.headingQuat(fwd, this.bank), damp(8, dt));

    // Engine glow follows throttle.
    const throttle = clamp(this.shipSpeed / 30, 0, 1);
    for (const f of this.flames) {
      f.scale.set(1, 1, 0.6 + throttle * 2.2 + Math.random() * 0.2);
      f.material.opacity = 0.25 + throttle * 0.3;
    }
    this.engineLight.intensity = 2 + throttle * 5;
    const blink = (this.time % 1.4) < 0.12;
    for (const b of this.navLights) b.visible = blink;

    return fwd;
  }

  updateExhaust(dt, fwd) {
    const ex = this.exhaust;
    const { N, pos, life, vel, rng } = ex;
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt / 0.85;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
    }

    const rate = 30 + this.shipSpeed * 4;
    ex.acc += rate * dt;
    const n = Math.floor(ex.acc);
    ex.acc -= n;
    const scale = this.ship.scale.x;
    this.nozzles.forEach((local, ni) => {
      const now = this.ship.localToWorld(_v1.copy(local));
      const prev = this.lastNozzle[ni];
      for (let k = 0; k < n; k++) {
        const i = ex.cursor;
        ex.cursor = (ex.cursor + 1) % N;
        const t = (k + 1) / n;
        pos[i * 3] = prev.x + (now.x - prev.x) * t + (rng() - 0.5) * 0.06;
        pos[i * 3 + 1] = prev.y + (now.y - prev.y) * t + (rng() - 0.5) * 0.06;
        pos[i * 3 + 2] = prev.z + (now.z - prev.z) * t + (rng() - 0.5) * 0.06;
        const sp = 2.5 + rng() * 1.5;
        vel[i * 3] = -fwd.x * sp + (rng() - 0.5) * 0.5;
        vel[i * 3 + 1] = -fwd.y * sp + (rng() - 0.5) * 0.5;
        vel[i * 3 + 2] = -fwd.z * sp + (rng() - 0.5) * 0.5;
        life[i] = 1 - (1 - t) * dt;
        ex.size[i] = (0.28 + rng() * 0.22) * scale * (1 + clamp(this.shipSpeed / 30, 0, 1) * 0.6);
      }
      prev.copy(now);
    });

    ex.geo.attributes.position.needsUpdate = true;
    ex.geo.attributes.aLife.needsUpdate = true;
    ex.geo.attributes.aSize.needsUpdate = true;
  }

  /** Where the camera wants to sit when parked at a destination. */
  framing(d) {
    const aspect = this.camera.aspect || 1;
    const portrait = aspect < 1;
    const pos = new THREE.Vector3();
    const target = d.center.clone();

    if (d.camera) {
      pos.copy(d.camera);
      if (portrait) pos.sub(d.center).multiplyScalar(Math.min(2.2, 1.15 / aspect)).add(d.center);
    } else {
      const out = _v1.copy(d.center).setY(0).normalize();
      const dist = (d.orbitRadius * 1.9 + 6) * (portrait ? Math.min(2, Math.pow(1.2 / aspect, 0.8)) : 1);
      pos.copy(d.center).addScaledVector(out, dist).addScaledVector(UP, dist * 0.35);
    }

    // Shift the look target so the subject sits beside (or above) the UI panel.
    const camFwd = _v2.copy(target).sub(pos).normalize();
    const right = new THREE.Vector3().crossVectors(camFwd, UP).normalize();
    if (d.camera) {
      if (!portrait) target.addScaledVector(right, -24);
    } else if (portrait) {
      target.addScaledVector(UP, -d.orbitRadius * 1.15);
    } else {
      target.addScaledVector(right, d.rockRadius * 1.5 + 1.5);
    }
    return { pos, target };
  }

  updateCamera(dt, fwd) {
    const ship = this.ship.position;
    let desiredPos;
    let desiredTarget;

    if (this.travel) {
      const tr = this.travel;
      const chasePos = ship.clone().addScaledVector(fwd, -9).addScaledVector(UP, 3.2);
      const chaseTarget = ship.clone().addScaledVector(fwd, 10);
      const end = this.framing(tr.dest);
      const w = smoothstep(0.6, 0.97, tr.p ?? 0);
      desiredPos = chasePos.lerp(end.pos, w);
      desiredTarget = chaseTarget.lerp(end.target, w);
    } else {
      const f = this.framing(this.orbit.dest);
      desiredPos = f.pos;
      desiredTarget = f.target;
    }

    // Subtle mouse parallax.
    this.parallax.lerp(this.parallaxTarget, damp(3, dt));
    const camFwd = _v1.copy(desiredTarget).sub(desiredPos).normalize();
    const right = _v2.crossVectors(camFwd, UP).normalize();
    const parallaxScale = this.reducedMotion ? 0 : 2.2;
    desiredPos.addScaledVector(right, this.parallax.x * parallaxScale).addScaledVector(UP, this.parallax.y * parallaxScale * 0.6);

    const k = this.travel ? 5 : 2.2;
    this.camPos.lerp(desiredPos, damp(k, dt));
    this.camTarget.lerp(desiredTarget, damp(k + 1, dt));

    // Never let the camera clip into an asteroid while blending between views.
    for (const d of this.dests) {
      if (!d.rockRadius) continue;
      const minDist = d.rockRadius * 3;
      const off = _v1.copy(this.camPos).sub(d.center);
      if (off.lengthSq() < minDist * minDist) this.camPos.copy(d.center).addScaledVector(off.normalize(), minDist);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    const fov = 50 + (this.reducedMotion ? 0 : clamp(this.shipSpeed / 35, 0, 1) * 14);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * damp(4, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  updateDestinations(dt) {
    const parked = !this.travel ? this.orbit.dest : null;
    for (const d of this.dests) {
      if (d.rock) {
        d.rock.rotateOnAxis(d.spin, d.spinSpeed * dt);
        for (const m of d.moons) {
          m.pivot.rotation.y += m.speed * dt;
          m.moon.rotation.x += dt * 0.3;
        }
        const want = this.hovered === d.id ? 1 : 0;
        d.hover += (want - d.hover) * damp(8, dt);
        d.ringMat.opacity = 0.22 + d.hover * 0.5 + (parked === d ? 0.12 : 0);
        d.arc.rotation.z += dt * (0.5 + d.hover * 2.5);
      }

      const el = this.labels[d.id];
      if (el) {
        _v1.copy(d.center).addScaledVector(UP, d.rockRadius * 1.25 + 1.4).project(this.camera);
        const visible = _v1.z < 1 && Math.abs(_v1.x) < 1.2 && Math.abs(_v1.y) < 1.2;
        if (visible) {
          const x = (_v1.x * 0.5 + 0.5) * this.width;
          const y = (-_v1.y * 0.5 + 0.5) * this.height;
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        }
        el.style.visibility = visible ? 'visible' : 'hidden';
      }
    }
  }

  updateTelemetry(dt) {
    const el = this.opts.telemetry;
    if (!el) return;
    this.telemetryTimer -= dt;
    if (this.telemetryTimer > 0) return;
    this.telemetryTimer = 0.12;
    const p = this.ship.position;
    const v = (this.shipSpeed * 1.7).toFixed(1).padStart(5, '0');
    el.textContent = `VEL ${v} km/s · X ${p.x.toFixed(1)} Y ${p.y.toFixed(1)} Z ${p.z.toFixed(1)}`;
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    this.time += dt;

    const fwd = this.updateShip(dt);
    this.updateExhaust(dt, fwd);
    this.updateCamera(dt, fwd);
    this.updateDestinations(dt);
    this.updateTelemetry(dt);

    this.belt.rotation.y += dt * 0.006;
    this.sky.position.copy(this.camera.position);
    this.nebula.material.uniforms.uTime.value = this.time;
    this.stars.material.uniforms.uTime.value = this.time;
    this.nozzleMat.color.setRGB(1.0, 1.7, 2.8).multiplyScalar(0.8 + clamp(this.shipSpeed / 30, 0, 1) * 0.6);

    this.composer.render(dt);
  }

  // -------------------------------------------------------------- input

  setHovered(id) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.renderer.domElement.style.cursor = id ? 'pointer' : '';
    this.opts.onHover?.(id);
  }

  pick(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    return hit ? hit.object.userData.id : null;
  }

  /** Called by the UI so labels can drive ring highlights too. */
  highlight(id) {
    this.hovered = id;
  }

  onPointerMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.parallaxTarget.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (e.pointerType === 'mouse') this.setHovered(this.pick(e.clientX, e.clientY));
  }

  onPointerDown(e) {
    this.downAt = { x: e.clientX, y: e.clientY };
  }

  onPointerUp(e) {
    if (!this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (moved > 8) return;
    const id = this.pick(e.clientX, e.clientY);
    if (id) this.opts.onSelect?.(id);
  }

  // -------------------------------------------------------------- lifecycle

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    this.scene.traverse((obj) => {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      mats.forEach((m) => m.dispose());
    });
    this.glowTex.dispose();
    this.envTexture.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    el.remove();
  }
}
