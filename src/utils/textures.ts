/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { FloorMaterial, WallMaterial, TileConfig } from '../types/house';

// Texture cache to prevent repeated canvas re-creation
const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Procedural Oak Parquet Flooring Canvas Texture
 */
function generateParquetCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#bfa588';
  ctx.fillRect(0, 0, 512, 512);

  const plankW = 128;
  const plankH = 32;

  for (let y = 0; y < 512; y += plankH) {
    const rowIdx = Math.floor(y / plankH);
    const offsetX = (rowIdx % 2) * (plankW / 2);

    for (let x = -plankW; x < 512 + plankW; x += plankW) {
      const px = x + offsetX;

      const lightnessVariation = ((Math.sin(px * 13 + y * 7) + 1) / 2) * 24 - 12;
      const r = Math.min(255, Math.max(0, 185 + lightnessVariation));
      const g = Math.min(255, Math.max(0, 150 + lightnessVariation * 0.9));
      const b = Math.min(255, Math.max(0, 115 + lightnessVariation * 0.7));

      ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
      ctx.fillRect(px, y, plankW, plankH);

      ctx.strokeStyle = `rgba(100, 70, 45, 0.12)`;
      ctx.lineWidth = 1;
      for (let gIdx = 4; gIdx < plankH; gIdx += 6) {
        ctx.beginPath();
        ctx.moveTo(px, y + gIdx);
        ctx.bezierCurveTo(
          px + plankW * 0.3, y + gIdx + (Math.sin(px) * 2),
          px + plankW * 0.7, y + gIdx - (Math.cos(px) * 2),
          px + plankW, y + gIdx
        );
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(70, 50, 30, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 0.5, y + 0.5, plankW, plankH);
    }
  }

  return canvas;
}

/**
 * Procedural Ceramic Tile Floor Canvas Texture
 */
function generateTileCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 512, 512);

  const tileSize = 128;
  const grout = 3;

  for (let y = 0; y < 512; y += tileSize) {
    for (let x = 0; x < 512; x += tileSize) {
      const shade = 245 + Math.floor(Math.random() * 8);
      ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade - 2})`;
      ctx.fillRect(x + grout, y + grout, tileSize - grout * 2, tileSize - grout * 2);

      const grad = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      grad.addColorStop(1, 'rgba(230, 235, 240, 0.1)');
      ctx.fillStyle = grad;
      ctx.fillRect(x + grout, y + grout, tileSize - grout * 2, tileSize - grout * 2);
    }
  }

  return canvas;
}

/**
 * Procedural Custom Tile Texture Generator based on TileConfig
 */
export function generateCustomTileTexture(cfg: TileConfig): THREE.CanvasTexture {
  const key = `custom_tile_${JSON.stringify(cfg)}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Fill with grout color
  ctx.fillStyle = cfg.groutColor || '#cbd5e1';
  ctx.fillRect(0, 0, size, size);

  const tileW = Math.max(16, (cfg.tileWidthCm / 100) * 256);
  const tileH = Math.max(16, (cfg.tileLengthCm / 100) * 256);
  const groutPx = Math.max(1, (cfg.groutWidthMm / 10) * 4);

  const primaryCol = cfg.primaryColor || '#f8fafc';
  const secondaryCol = cfg.secondaryColor || '#1e293b';

  if (cfg.pattern === 'checkerboard') {
    let row = 0;
    for (let y = 0; y < size; y += tileH) {
      let col = 0;
      for (let x = 0; x < size; x += tileW) {
        ctx.fillStyle = (row + col) % 2 === 0 ? primaryCol : secondaryCol;
        ctx.fillRect(x + groutPx, y + groutPx, tileW - groutPx * 2, tileH - groutPx * 2);
        col++;
      }
      row++;
    }
  } else if (cfg.pattern === 'running-bond') {
    let row = 0;
    for (let y = 0; y < size; y += tileH) {
      const offsetX = (row % 2) * (tileW / 2);
      for (let x = -tileW; x < size + tileW; x += tileW) {
        ctx.fillStyle = primaryCol;
        ctx.fillRect(x + offsetX + groutPx, y + groutPx, tileW - groutPx * 2, tileH - groutPx * 2);
      }
      row++;
    }
  } else if (cfg.pattern === 'stagger-third') {
    let row = 0;
    for (let y = 0; y < size; y += tileH) {
      const offsetX = (row % 3) * (tileW / 3);
      for (let x = -tileW; x < size + tileW; x += tileW) {
        ctx.fillStyle = primaryCol;
        ctx.fillRect(x + offsetX + groutPx, y + groutPx, tileW - groutPx * 2, tileH - groutPx * 2);
      }
      row++;
    }
  } else if (cfg.pattern === 'diagonal') {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.PI / 4);
    for (let y = -size; y < size * 2; y += tileH) {
      for (let x = -size; x < size * 2; x += tileW) {
        ctx.fillStyle = primaryCol;
        ctx.fillRect(x + groutPx, y + groutPx, tileW - groutPx * 2, tileH - groutPx * 2);
      }
    }
    ctx.restore();
  } else {
    // Standard Grid
    for (let y = 0; y < size; y += tileH) {
      for (let x = 0; x < size; x += tileW) {
        ctx.fillStyle = primaryCol;
        ctx.fillRect(x + groutPx, y + groutPx, tileW - groutPx * 2, tileH - groutPx * 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;

  textureCache.set(key, texture);
  return texture;
}

/**
 * Procedural Carrara Marble Canvas Texture
 */
function generateMarbleCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 512);

  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = `rgba(148, 163, 184, ${0.15 + (i % 3) * 0.08})`;
    ctx.beginPath();
    let cx = Math.random() * 512;
    let cy = 0;
    ctx.moveTo(cx, cy);

    while (cy < 512) {
      cy += 40 + Math.random() * 40;
      cx += (Math.random() - 0.48) * 80;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  return canvas;
}

/**
 * Procedural Brick Texture
 */
function generateBrickCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 512, 512);

  const bW = 64;
  const bH = 32;
  const mortar = 3;

  for (let y = 0; y < 512; y += bH) {
    const row = Math.floor(y / bH);
    const offsetX = (row % 2) * (bW / 2);

    for (let x = -bW; x < 512 + bW; x += bW) {
      const px = x + offsetX;
      const variation = Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${160 + variation}, ${65 + variation * 0.4}, ${45 + variation * 0.3})`;
      ctx.fillRect(px + mortar, y + mortar, bW - mortar * 2, bH - mortar * 2);
    }
  }

  return canvas;
}

/**
 * Procedural Wood Slats Texture
 */
function generateWoodSlatsCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e1b18';
  ctx.fillRect(0, 0, 512, 512);

  const slatW = 24;
  const gap = 8;

  for (let x = 0; x < 512; x += slatW + gap) {
    ctx.fillStyle = '#9a7b56';
    ctx.fillRect(x, 0, slatW, 512);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x + 2, 0, slatW / 2, 512);
  }

  return canvas;
}

/**
 * Procedural Grass Canvas Texture
 */
function generateGrassCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3f7e34';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? '#4e9741' : '#316327';
    ctx.fillRect(x, y, 2, 4);
  }

  return canvas;
}

/**
 * Procedural Concrete Canvas Texture
 */
function generateConcreteCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, 2, 2);
  }

  return canvas;
}

/**
 * Returns a cached procedural THREE.CanvasTexture configured with SRGBColorSpace
 */
export function getProceduralTexture(type: string, repeatX = 2, repeatY = 2): THREE.CanvasTexture {
  const key = `${type}_${repeatX}_${repeatY}`;
  if (textureCache.has(key)) {
    return textureCache.get(key)!;
  }

  let canvas: HTMLCanvasElement;
  switch (type) {
    case 'parquet-oak':
      canvas = generateParquetCanvas();
      break;
    case 'tile-ceramic':
      canvas = generateTileCanvas();
      break;
    case 'marble-white':
      canvas = generateMarbleCanvas();
      break;
    case 'brick':
      canvas = generateBrickCanvas();
      break;
    case 'wood-slats':
      canvas = generateWoodSlatsCanvas();
      break;
    case 'grass':
      canvas = generateGrassCanvas();
      break;
    case 'concrete':
    default:
      canvas = generateConcreteCanvas();
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;

  textureCache.set(key, texture);
  return texture;
}

/**
 * Helper to build materials for rooms & walls
 */
export function createFloorMaterial(
  materialType: FloorMaterial, 
  colorHex?: string, 
  tileConfig?: TileConfig
): THREE.Material {
  if (tileConfig) {
    const customTexture = generateCustomTileTexture(tileConfig);
    return new THREE.MeshStandardMaterial({
      map: customTexture,
      roughness: 0.25,
      metalness: 0.1,
    });
  }

  if (colorHex) {
    return new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.6,
      metalness: 0.1,
    });
  }

  const texture = getProceduralTexture(materialType, 4, 4);

  switch (materialType) {
    case 'parquet-oak':
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.35,
        metalness: 0.05,
      });
    case 'tile-ceramic':
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.2,
        metalness: 0.1,
      });
    case 'marble-white':
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.15,
        metalness: 0.2,
      });
    case 'grass':
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.9,
        metalness: 0.0,
      });
    case 'carpet-grey':
      return new THREE.MeshStandardMaterial({
        color: '#64748b',
        roughness: 0.95,
        metalness: 0.0,
      });
    case 'concrete':
    default:
      return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.7,
        metalness: 0.1,
      });
  }
}

export function createWallMaterial(wallType: WallMaterial, cutMode: 'full' | 'half' | 'transparent'): THREE.Material {
  const isTransparent = cutMode === 'transparent';

  let baseColor = '#f8fafc';
  let roughness = 0.8;
  let map: THREE.Texture | undefined;

  switch (wallType) {
    case 'warm-beige':
      baseColor = '#f5f0eb';
      roughness = 0.85;
      break;
    case 'modern-gray':
      baseColor = '#94a3b8';
      roughness = 0.75;
      break;
    case 'brick':
      map = getProceduralTexture('brick', 3, 2);
      roughness = 0.9;
      break;
    case 'wood-slats':
      map = getProceduralTexture('wood-slats', 4, 1);
      roughness = 0.6;
      break;
    case 'plaster-white':
    default:
      baseColor = '#f1f5f9';
      roughness = 0.85;
      break;
  }

  return new THREE.MeshStandardMaterial({
    color: baseColor,
    map,
    roughness,
    metalness: 0.05,
    transparent: isTransparent,
    opacity: isTransparent ? 0.35 : 1.0,
    depthWrite: !isTransparent,
    side: THREE.DoubleSide,
  });
}
