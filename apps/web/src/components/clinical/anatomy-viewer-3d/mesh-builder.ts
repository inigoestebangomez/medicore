import * as THREE from 'three';
import type { AnatomyZoneKey } from '@/lib/orl-anatomy-map';

interface MeshGroup {
  group: THREE.Group;
  zones: AnatomyZoneKey[];
}

/**
 * Builds a procedural head and neck model using Three.js primitives.
 * Each anatomical zone is a named mesh within the group, enabling
 * per-zone highlighting via material changes.
 */
export function buildHeadNeckModel(): MeshGroup[] {
  const groups: MeshGroup[] = [];

  // ── HEAD (main sphere) ──
  const headGroup = new THREE.Group();
  headGroup.name = 'head';

  const skullGeo = new THREE.SphereGeometry(1, 32, 32);
  const skullMat = new THREE.MeshStandardMaterial({
    color: 0x3F3F46,
    roughness: 0.6,
    metalness: 0.1,
    transparent: true,
    opacity: 0.4,
  });
  const skull = new THREE.Mesh(skullGeo, skullMat);
  skull.name = 'skull';
  headGroup.add(skull);

  // Ears (external — positioned on sides)
  const earGeo = new THREE.SphereGeometry(0.15, 16, 16);
  
  const earRightMat = new THREE.MeshStandardMaterial({
    color: 0x3F3F46,
    roughness: 0.5,
    transparent: true,
    opacity: 0.4,
  });
  const earRight = new THREE.Mesh(earGeo, earRightMat);
  earRight.position.set(1.0, 0.05, 0);
  earRight.name = 'ear_external_right';
  headGroup.add(earRight);

  const earLeft = new THREE.Mesh(earGeo, earRightMat.clone());
  earLeft.position.set(-1.0, 0.05, 0);
  earLeft.name = 'ear_external_left';
  headGroup.add(earLeft);

  // Nose
  const noseGeo = new THREE.ConeGeometry(0.15, 0.35, 8);
  const noseMat = new THREE.MeshStandardMaterial({
    color: 0x3F3F46,
    roughness: 0.5,
    transparent: true,
    opacity: 0.4,
  });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, -0.1, 0.95);
  nose.rotation.x = Math.PI / 2;
  nose.name = 'nasal_septum';
  headGroup.add(nose);

  // Sinus zones (maxillary — small spheres behind cheeks)
  const sinusGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const sinusRightMat = new THREE.MeshStandardMaterial({
    color: 0x3F3F46,
    roughness: 0.5,
    transparent: true,
    opacity: 0.4,
  });
  const sinusRight = new THREE.Mesh(sinusGeo, sinusRightMat);
  sinusRight.position.set(0.45, -0.05, 0.7);
  sinusRight.name = 'sinus_maxillary';
  headGroup.add(sinusRight);

  const sinusLeft = new THREE.Mesh(sinusGeo, sinusRightMat.clone());
  sinusLeft.position.set(-0.45, -0.05, 0.7);
  sinusLeft.name = 'sinus_maxillary';
  headGroup.add(sinusLeft);

  // Frontal sinuses
  const frontalGeo = new THREE.SphereGeometry(0.1, 12, 12);
  const frontalRight = new THREE.Mesh(frontalGeo, sinusRightMat.clone());
  frontalRight.position.set(0.25, 0.55, 0.6);
  frontalRight.name = 'sinus_frontal';
  headGroup.add(frontalRight);

  const frontalLeft = new THREE.Mesh(frontalGeo, sinusRightMat.clone());
  frontalLeft.position.set(-0.25, 0.55, 0.6);
  frontalLeft.name = 'sinus_frontal';
  headGroup.add(frontalLeft);

  groups.push({ group: headGroup, zones: [
    'ear_external_right', 'ear_external_left',
    'ear_middle_right', 'ear_middle_left',
    'ear_inner_right', 'ear_inner_left',
    'nasal_septum', 'nasal_turbinates',
    'sinus_maxillary', 'sinus_frontal',
    'sinus_ethmoid', 'sinus_sphenoid',
  ]});

  // ── NECK ──
  const neckGroup = new THREE.Group();
  neckGroup.name = 'neck';

  const neckGeo = new THREE.CylinderGeometry(0.5, 0.55, 0.8, 32);
  const neckMat = new THREE.MeshStandardMaterial({
    color: 0x3F3F46,
    roughness: 0.6,
    transparent: true,
    opacity: 0.4,
  });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.y = -1.3;
  neck.name = 'neck';
  neckGroup.add(neck);

  // Thyroid (butterfly shape — two small ellipsoids)
  const thyroidGeo = new THREE.SphereGeometry(0.1, 1.3, 0.08, 16, 16);
  const thyroidRight = new THREE.Mesh(thyroidGeo, neckMat.clone());
  thyroidRight.position.set(0.2, -1.05, 0.35);
  thyroidRight.scale.set(0.8, 0.6, 0.5);
  thyroidRight.name = 'thyroid';
  neckGroup.add(thyroidRight);

  const thyroidLeft = new THREE.Mesh(thyroidGeo, neckMat.clone());
  thyroidLeft.position.set(-0.2, -1.05, 0.35);
  thyroidLeft.scale.set(0.8, 0.6, 0.5);
  thyroidLeft.name = 'thyroid';
  neckGroup.add(thyroidLeft);

  // Larynx
  const larynxGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.25, 12);
  const larynx = new THREE.Mesh(larynxGeo, neckMat.clone());
  larynx.position.set(0, -1.0, 0.45);
  larynx.name = 'larynx';
  neckGroup.add(larynx);

  // Tonsils
  const tonsilGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const tonsilRight = new THREE.Mesh(tonsilGeo, neckMat.clone());
  tonsilRight.position.set(0.3, -0.55, 0.4);
  tonsilRight.name = 'tonsils';
  neckGroup.add(tonsilRight);

  const tonsilLeft = new THREE.Mesh(tonsilGeo, neckMat.clone());
  tonsilLeft.position.set(-0.3, -0.55, 0.4);
  tonsilLeft.name = 'tonsils';
  neckGroup.add(tonsilLeft);

  // Salivary glands
  const salivaryGeo = new THREE.SphereGeometry(0.08, 10, 10);
  const parotidRight = new THREE.Mesh(salivaryGeo, neckMat.clone());
  parotidRight.position.set(0.6, -0.6, 0.1);
  parotidRight.name = 'salivary_parotid';
  neckGroup.add(parotidRight);

  const parotidLeft = new THREE.Mesh(salivaryGeo, neckMat.clone());
  parotidLeft.position.set(-0.6, -0.6, 0.1);
  parotidLeft.name = 'salivary_parotid';
  neckGroup.add(parotidLeft);

  // Lymph nodes
  const lymphGeo = new THREE.SphereGeometry(0.05, 6, 6);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const lymph = new THREE.Mesh(lymphGeo, neckMat.clone());
    lymph.position.set(
      Math.cos(angle) * 0.55,
      -1.1 + Math.sin(i * 0.5) * 0.2,
      0.2
    );
    lymph.name = 'lymph_nodes_cervical';
    neckGroup.add(lymph);
  }

  groups.push({ group: neckGroup, zones: [
    'nasopharynx', 'oropharynx', 'tonsils',
    'larynx', 'vocal_cords',
    'thyroid', 'salivary_parotid', 'salivary_submandibular',
    'lymph_nodes_cervical',
  ]});

  return groups;
}