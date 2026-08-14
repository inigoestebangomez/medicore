'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildHeadNeckModel } from './mesh-builder';
import type { AnatomyZoneKey } from '@/lib/orl-anatomy-map';

type Severity = 'critical' | 'warning' | 'info';

interface AnatomyViewer3DProps {
  activeZones: AnatomyZoneKey[];
  severity: Record<string, Severity>;
  onZoneClick?: (zone: string) => void;
  rotating?: boolean;
  className?: string;
}

const SEVERITY_COLORS: Record<Severity, { color: number; emissive: number; intensity: number }> = {
  critical: { color: 0xF43F5E, emissive: 0xF43F5E, intensity: 0.6 },
  warning:  { color: 0xF59E0B, emissive: 0xF59E0B, intensity: 0.4 },
  info:     { color: 0x0EA5C0, emissive: 0x0EA5C0, intensity: 0.3 },
};

const INACTIVE_COLOR = 0x3F3F46;
const INACTIVE_OPACITY = 0.3;

function AnatomyViewer3DInner({
  activeZones,
  severity,
  onZoneClick,
  rotating = true,
  className = '',
}: AnatomyViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const animFrameRef = useRef<number>(0);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 5);
    camera.lookAt(0, -0.5, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 8;
    controls.target.set(0, -0.5, 0);
    controls.autoRotate = rotating;
    controls.autoRotateSpeed = 0.5;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404060, 1.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xaaccff, 1.2);
    keyLight.position.set(3, 2, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x446688, 0.5);
    fillLight.position.set(-2, 0, -1);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x0EA5C0, 0.8);
    rimLight.position.set(0, 3, -2);
    scene.add(rimLight);

    // Build model
    const meshGroups = buildHeadNeckModel();
    const meshMap = new Map<string, THREE.Mesh>();

    meshGroups.forEach(({ group, zones }) => {
      scene.add(group);
      group.position.y = 0;
      
      // Register all meshes by name
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name) {
          meshMap.set(child.name, child);
          // All zones within a group share the group's zones
          zones.forEach(zone => {
            if (!meshMap.has(zone)) {
              meshMap.set(zone, child);
            }
          });
        }
      });
    });

    meshesRef.current = meshMap;

    // Click handler
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      if (!renderer || !camera || !onZoneClick) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(
        Array.from(meshMap.values()),
        true
      );

      if (intersects.length > 0) {
        // Walk up to find named mesh
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !obj.name) {
          obj = obj.parent;
        }
        if (obj && obj.name) {
          onZoneClick(obj.name);
        }
      }
    };

    renderer.domElement.addEventListener('click', handleClick);

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update rotating
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = rotating;
    }
  }, [rotating]);

  // Update zone materials based on activeZones + severity
  useEffect(() => {
    const meshMap = meshesRef.current;
    if (meshMap.size === 0) return;

    // Reset all to inactive
    meshMap.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(INACTIVE_COLOR);
      mat.emissive?.set(0x000000);
      mat.emissiveIntensity = 0;
      mat.opacity = INACTIVE_OPACITY;
      mat.transparent = true;
    });

    // Highlight active zones
    const activeSet = new Set(activeZones);
    activeSet.forEach((zone) => {
      const mesh = meshMap.get(zone);
      if (!mesh) return;

      const sev = severity[zone] || 'info';
      const colors = SEVERITY_COLORS[sev];
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.set(colors.color);
      mat.emissive?.set(colors.emissive);
      mat.emissiveIntensity = colors.intensity;
      mat.opacity = 1.0;
    });
  }, [activeZones, severity]);

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full min-h-[300px] rounded-lg overflow-hidden ${className}`}
    />
  );
}

// Lazy-loaded wrapper with SSR disabled
import dynamic from 'next/dynamic';

export const AnatomyViewer3D = dynamic(
  () => Promise.resolve(AnatomyViewer3DInner),
  { ssr: false }
);