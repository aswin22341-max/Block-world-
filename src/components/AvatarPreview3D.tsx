import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AvatarConfig } from '../types/game';
import { animateAvatarModel, CharacterRig, createAvatarModel } from '../game/models';
import { detectSoftwareWebGL } from '../game/materials';

interface AvatarPreview3DProps {
  avatar: AvatarConfig;
}

export const AvatarPreview3D: React.FC<AvatarPreview3DProps> = ({ avatar }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<CharacterRig | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const yawRef = useRef(0.35);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const isSw = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({ antialias: !isSw, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(isSw ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth || 320, el.clientHeight || 360);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, (el.clientWidth || 320) / (el.clientHeight || 360), 0.1, 50);
    camera.position.set(0, 1.85, 4.6);
    camera.lookAt(0, 1.25, 0);

    const hemi = new THREE.HemisphereLight('#e0f2fe', '#334155', 0.9);
    const key = new THREE.DirectionalLight('#fffbeb', 1.5);
    key.position.set(3, 5, 4);
    scene.add(hemi, key);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.25, 0.24, 24),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.5 }),
    );
    pedestal.position.y = -0.12;
    scene.add(pedestal);

    const rig = createAvatarModel(avatar, false);
    rigRef.current = rig;
    scene.add(rig.group);

    let dragging = false;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yawRef.current += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const tick = () => {
      if (disposed) return;
      const t = clock.getElapsedTime();
      if (!dragging) yawRef.current += 0.006;
      if (rigRef.current) {
        rigRef.current.group.rotation.y = yawRef.current;
        animateAvatarModel(rigRef.current, 'idle', 'none', t);
      }
      renderer.render(scene, camera);
      if (isSw) {
        frameId = window.setTimeout(tick, 90);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    if (rigRef.current) sceneRef.current.remove(rigRef.current.group);
    const nextRig = createAvatarModel(avatar, false);
    nextRig.group.rotation.y = yawRef.current;
    rigRef.current = nextRig;
    sceneRef.current.add(nextRig.group);
  }, [avatar]);

  return (
    <div className="relative w-full h-80 md:h-96 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-3 left-0 right-0 text-center text-xs text-slate-400 pointer-events-none">
        Drag to rotate character
      </div>
    </div>
  );
};
