import * as THREE from 'three';

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export interface MaterialLibrary {
  studTexture: THREE.CanvasTexture;
  grassTexture: THREE.CanvasTexture;
  sandTexture: THREE.CanvasTexture;
  roadTexture: THREE.CanvasTexture;
  buildingGlassTexture: THREE.CanvasTexture;
  checkerTexture: THREE.CanvasTexture;
  waterMaterial: THREE.MeshPhysicalMaterial;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

export function createMaterialLibrary(renderer: THREE.WebGLRenderer, isSoftwareGl: boolean): MaterialLibrary {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

  const finishTex = (canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = maxAniso;
    tex.needsUpdate = true;
    return tex;
  };

  // 1. Blocky Stud Texture (Roblox-style subtle plastic studs)
  const [studC, studCtx] = makeCanvas(128, 128);
  studCtx.fillStyle = '#ffffff';
  studCtx.fillRect(0, 0, 128, 128);
  studCtx.strokeStyle = 'rgba(0,0,0,0.08)';
  studCtx.lineWidth = 3;
  studCtx.strokeRect(2, 2, 124, 124);
  for (let gx = 0; gx < 2; gx++) {
    for (let gy = 0; gy < 2; gy++) {
      const cx = gx * 64 + 32;
      const cy = gy * 64 + 32;
      studCtx.fillStyle = 'rgba(0,0,0,0.09)';
      studCtx.beginPath();
      studCtx.arc(cx, cy + 2, 17, 0, Math.PI * 2);
      studCtx.fill();
      studCtx.fillStyle = 'rgba(255,255,255,0.45)';
      studCtx.beginPath();
      studCtx.arc(cx, cy, 16, 0, Math.PI * 2);
      studCtx.fill();
    }
  }
  const studTexture = finishTex(studC, 1, 1);

  // 2. Grass Texture
  const [grassC, grassCtx] = makeCanvas(256, 256);
  grassCtx.fillStyle = '#4cb944';
  grassCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    const x = (i * 73) % 256;
    const y = (i * 139) % 256;
    grassCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(20,83,45,0.12)';
    grassCtx.fillRect(x, y, 8, 8);
  }
  const grassTexture = finishTex(grassC, 28, 28);

  // 3. Sand Texture
  const [sandC, sandCtx] = makeCanvas(256, 256);
  sandCtx.fillStyle = '#f3d283';
  sandCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 320; i++) {
    const x = (i * 97) % 256;
    const y = (i * 179) % 256;
    sandCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(180,120,40,0.12)';
    sandCtx.fillRect(x, y, 6, 6);
  }
  const sandTexture = finishTex(sandC, 8, 8);

  // 4. Road Asphalt Texture
  const [roadC, roadCtx] = makeCanvas(256, 256);
  roadCtx.fillStyle = '#334155';
  roadCtx.fillRect(0, 0, 256, 256);
  roadCtx.fillStyle = '#e2e8f0';
  roadCtx.fillRect(10, 0, 8, 256);
  roadCtx.fillRect(238, 0, 8, 256);
  roadCtx.fillStyle = '#facc15';
  for (let y = 12; y < 256; y += 64) {
    roadCtx.fillRect(123, y, 10, 36);
  }
  const roadTexture = finishTex(roadC, 1, 8);

  // 5. Skyscraper Window Grid Texture
  const [winC, winCtx] = makeCanvas(256, 256);
  winCtx.fillStyle = '#e2e8f0';
  winCtx.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 4; c++) {
      winCtx.fillStyle = (r + c) % 3 === 0 ? '#bae6fd' : '#7dd3fc';
      winCtx.fillRect(c * 64 + 10, r * 32 + 6, 44, 20);
    }
  }
  const buildingGlassTexture = finishTex(winC, 1, 2);

  // 6. Checkered Finish Texture
  const [chkC, chkCtx] = makeCanvas(128, 128);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      chkCtx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#0f172a';
      chkCtx.fillRect(c * 32, r * 32, 32, 32);
    }
  }
  const checkerTexture = finishTex(chkC, 4, 1);

  // 7. Animated PBR Water Material (onBeforeCompile wave displacement)
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    roughness: 0.15,
    metalness: 0.05,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: isSoftwareGl ? 0.78 : 0.84,
  });

  waterMaterial.userData.uTime = { value: 0 };
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterMaterial.userData.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float wave1 = sin(position.x * 0.25 + uTime * 1.8) * 0.14;
        float wave2 = cos(position.y * 0.3 + uTime * 1.4) * 0.12;
        transformed.z += wave1 + wave2;`,
      );
  };

  return {
    studTexture,
    grassTexture,
    sandTexture,
    roadTexture,
    buildingGlassTexture,
    checkerTexture,
    waterMaterial,
    dispose: () => {
      studTexture.dispose();
      grassTexture.dispose();
      sandTexture.dispose();
      roadTexture.dispose();
      buildingGlassTexture.dispose();
      checkerTexture.dispose();
      waterMaterial.dispose();
    },
  };
}
