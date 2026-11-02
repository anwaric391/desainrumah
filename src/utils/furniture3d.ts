/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { FurnitureItem } from '../types/house';

// Reusable shared materials to minimize WebGL state changes and memory
const woodMat = new THREE.MeshStandardMaterial({ color: '#7c5a3d', roughness: 0.6, metalness: 0.05 });
const darkWoodMat = new THREE.MeshStandardMaterial({ color: '#38281d', roughness: 0.7, metalness: 0.05 });
const metalChromeMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.15, metalness: 0.9 });
const metalBlackMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.6 });
const porcelainWhiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0.1 });
const glassMat = new THREE.MeshPhysicalMaterial({
  color: '#ffffff',
  roughness: 0.05,
  metalness: 0.1,
  transparent: true,
  opacity: 0.4,
  transmission: 0.6,
  ior: 1.5,
});
const mirrorMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.05, metalness: 0.98 });
const screenMat = new THREE.MeshBasicMaterial({ color: '#090d16' });
const leafGreenMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.65, metalness: 0.0 });
const potMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4, metalness: 0.1 });

/**
 * Creates a composite 3-12 part procedural 3D model (THREE.Group) for any furniture item.
 * Grounded at bottom-center (Y = 0).
 */
export function createFurniture3D(item: FurnitureItem): THREE.Group {
  const group = new THREE.Group();
  group.name = `furniture_${item.id}`;

  const itemColor = item.color || '#475569';
  const fabricMat = new THREE.MeshStandardMaterial({ color: itemColor, roughness: 0.85, metalness: 0.02 });
  const fabricAccentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(itemColor).offsetHSL(0, -0.05, 0.1),
    roughness: 0.9,
    metalness: 0.0,
  });

  const { width: w, depth: d, height: h } = item;

  switch (item.catalogId) {
    case 'sofa-3seat': {
      // 1. Base frame
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), fabricMat);
      base.position.y = 0.15;
      base.castShadow = true;
      group.add(base);

      // 2. Backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.2, 0.22), fabricMat);
      back.position.set(0, h / 2 + 0.05, -d / 2 + 0.11);
      back.castShadow = true;
      group.add(back);

      // 3. Armrests (left & right)
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, d), fabricMat);
      armL.position.set(-w / 2 + 0.09, 0.35, 0);
      const armR = armL.clone();
      armR.position.x = w / 2 - 0.09;
      group.add(armL, armR);

      // 4. Three seat cushions
      const cushionW = (w - 0.36) / 3;
      for (let i = 0; i < 3; i++) {
        const cushion = new THREE.Mesh(new THREE.BoxGeometry(cushionW - 0.02, 0.14, d - 0.24), fabricAccentMat);
        cushion.position.set(-w / 2 + 0.18 + cushionW * (i + 0.5), 0.3, 0.06);
        cushion.castShadow = true;
        group.add(cushion);
      }

      // 5. Four wooden legs
      const legGeo = new THREE.CylinderGeometry(0.025, 0.015, 0.12, 8);
      const legPositions = [
        [-w / 2 + 0.1, 0.06, -d / 2 + 0.1],
        [w / 2 - 0.1, 0.06, -d / 2 + 0.1],
        [-w / 2 + 0.1, 0.06, d / 2 - 0.1],
        [w / 2 - 0.1, 0.06, d / 2 - 0.1],
      ];
      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, darkWoodMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      });
      break;
    }

    case 'sofa-lshape': {
      // Main sofa section
      const mainW = w * 0.65;
      const baseMain = new THREE.Mesh(new THREE.BoxGeometry(mainW, 0.22, d * 0.5), fabricMat);
      baseMain.position.set(-w / 2 + mainW / 2, 0.15, -d / 2 + (d * 0.5) / 2);
      baseMain.castShadow = true;
      group.add(baseMain);

      // Chaise lounge section
      const chaiseW = w - mainW;
      const baseChaise = new THREE.Mesh(new THREE.BoxGeometry(chaiseW, 0.22, d), fabricMat);
      baseChaise.position.set(w / 2 - chaiseW / 2, 0.15, 0);
      baseChaise.castShadow = true;
      group.add(baseChaise);

      // Long backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.2, 0.2), fabricMat);
      back.position.set(0, h / 2 + 0.05, -d / 2 + 0.1);
      group.add(back);

      // Left Armrest
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, d * 0.5), fabricMat);
      arm.position.set(-w / 2 + 0.09, 0.35, -d / 2 + (d * 0.5) / 2);
      group.add(arm);

      // Chaise cushions
      const cushionMain = new THREE.Mesh(new THREE.BoxGeometry(mainW - 0.2, 0.14, d * 0.5 - 0.22), fabricAccentMat);
      cushionMain.position.set(-w / 2 + mainW / 2 + 0.05, 0.31, -d / 2 + (d * 0.5) / 2 + 0.06);
      const cushionChaise = new THREE.Mesh(new THREE.BoxGeometry(chaiseW - 0.05, 0.14, d - 0.24), fabricAccentMat);
      cushionChaise.position.set(w / 2 - chaiseW / 2, 0.31, 0.06);
      group.add(cushionMain, cushionChaise);
      break;
    }

    case 'armchair-single': {
      // Seat cushion
      const seat = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.16, d - 0.1), fabricMat);
      seat.position.y = 0.32;
      group.add(seat);

      // Curved-style backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.2, 0.16), fabricMat);
      back.position.set(0, h / 2 + 0.05, -d / 2 + 0.1);
      group.add(back);

      // Left & right arms
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, d), fabricMat);
      armL.position.set(-w / 2 + 0.06, 0.36, 0);
      const armR = armL.clone();
      armR.position.x = w / 2 - 0.06;
      group.add(armL, armR);

      // Splayed legs
      const legGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.25, 8);
      const legs = [
        [-w / 2 + 0.12, 0.12, -d / 2 + 0.12],
        [w / 2 - 0.12, 0.12, -d / 2 + 0.12],
        [-w / 2 + 0.12, 0.12, d / 2 - 0.12],
        [w / 2 - 0.12, 0.12, d / 2 - 0.12],
      ];
      legs.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, darkWoodMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      });
      break;
    }

    case 'coffee-table': {
      // Table top
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), woodMat);
      top.position.y = h - 0.02;
      top.castShadow = true;
      group.add(top);

      // Lower shelf
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.02, d * 0.8), darkWoodMat);
      shelf.position.y = 0.15;
      group.add(shelf);

      // 4 legs
      const legGeo = new THREE.CylinderGeometry(0.02, 0.02, h, 8);
      const legs = [
        [-w / 2 + 0.06, h / 2, -d / 2 + 0.06],
        [w / 2 - 0.06, h / 2, -d / 2 + 0.06],
        [-w / 2 + 0.06, h / 2, d / 2 - 0.06],
        [w / 2 - 0.06, h / 2, d / 2 - 0.06],
      ];
      legs.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, metalBlackMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      });
      break;
    }

    case 'tv-console': {
      // Low credenza body
      const bodyH = 0.45;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), darkWoodMat);
      body.position.y = bodyH / 2 + 0.1;
      body.castShadow = true;
      group.add(body);

      // Credenza legs
      const legGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8);
      [
        [-w / 2 + 0.08, 0.05, -d / 2 + 0.08],
        [w / 2 - 0.08, 0.05, -d / 2 + 0.08],
        [-w / 2 + 0.08, 0.05, d / 2 - 0.08],
        [w / 2 - 0.08, 0.05, d / 2 - 0.08],
      ].forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, metalBlackMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      });

      // Flat TV Stand
      const tvStand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.2), metalChromeMat);
      tvStand.position.set(0, bodyH + 0.11, 0);
      const tvPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), metalBlackMat);
      tvPole.position.set(0, bodyH + 0.16, 0);
      group.add(tvStand, tvPole);

      // TV Screen Frame & Display
      const tvW = w * 0.75;
      const tvH = 0.7;
      const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(tvW, tvH, 0.03), metalBlackMat);
      tvFrame.position.set(0, bodyH + 0.18 + tvH / 2, 0);
      const tvDisplay = new THREE.Mesh(new THREE.PlaneGeometry(tvW - 0.04, tvH - 0.04), screenMat);
      tvDisplay.position.set(0, bodyH + 0.18 + tvH / 2, 0.016);
      group.add(tvFrame, tvDisplay);
      break;
    }

    case 'bed-king':
    case 'bed-single': {
      // 1. Bed base / frame
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), darkWoodMat);
      frame.position.y = 0.15;
      frame.castShadow = true;
      group.add(frame);

      // 2. Headboard
      const headboard = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h, 0.15), fabricMat);
      headboard.position.set(0, h / 2, -d / 2 + 0.075);
      headboard.castShadow = true;
      group.add(headboard);

      // 3. Mattress
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.22, d - 0.18), porcelainWhiteMat);
      mattress.position.set(0, 0.35, 0.06);
      group.add(mattress);

      // 4. Blanket / Duvet layer
      const duvet = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.04, (d - 0.18) * 0.65), fabricAccentMat);
      duvet.position.set(0, 0.47, 0.28);
      group.add(duvet);

      // 5. Pillows
      const pillowGeo = new THREE.BoxGeometry(w > 1.2 ? 0.65 : 0.6, 0.1, 0.38);
      if (w > 1.2) {
        // Two pillows
        const p1 = new THREE.Mesh(pillowGeo, porcelainWhiteMat);
        p1.position.set(-w * 0.24, 0.5, -d / 2 + 0.38);
        const p2 = p1.clone();
        p2.position.x = w * 0.24;
        group.add(p1, p2);
      } else {
        // One pillow
        const p = new THREE.Mesh(pillowGeo, porcelainWhiteMat);
        p.position.set(0, 0.5, -d / 2 + 0.38);
        group.add(p);
      }
      break;
    }

    case 'nightstand': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.12, d), woodMat);
      body.position.y = (h - 0.12) / 2 + 0.12;
      body.castShadow = true;
      group.add(body);

      // Handle accents
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), metalChromeMat);
      handle.position.set(0, (h - 0.12) / 2 + 0.12, d / 2 + 0.01);
      group.add(handle);

      // 4 legs
      const legGeo = new THREE.CylinderGeometry(0.015, 0.012, 0.12, 8);
      [
        [-w / 2 + 0.05, 0.06, -d / 2 + 0.05],
        [w / 2 - 0.05, 0.06, -d / 2 + 0.05],
        [-w / 2 + 0.05, 0.06, d / 2 - 0.05],
        [w / 2 - 0.05, 0.06, d / 2 - 0.05],
      ].forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, metalBlackMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      });
      break;
    }

    case 'wardrobe-closet': {
      // Main tall wardrobe box
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkWoodMat);
      body.position.y = h / 2;
      body.castShadow = true;
      group.add(body);

      // Center mirror pane
      const mirror = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.35, h * 0.85), mirrorMat);
      mirror.position.set(0, h / 2, d / 2 + 0.002);
      group.add(mirror);

      // Vertical door seams and handles
      const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.02), metalChromeMat);
      handleL.position.set(-w * 0.22, h / 2, d / 2 + 0.01);
      const handleR = handleL.clone();
      handleR.position.x = w * 0.22;
      group.add(handleL, handleR);
      break;
    }

    case 'study-desk': {
      // Desktop
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), woodMat);
      top.position.y = 0.74;
      top.castShadow = true;
      group.add(top);

      // Side drawer cabinet
      const sideCabinet = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.65, d * 0.9), darkWoodMat);
      sideCabinet.position.set(w / 2 - 0.22, 0.35, 0);
      group.add(sideCabinet);

      // Metal leg on left
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, d * 0.8), metalBlackMat);
      legL.position.set(-w / 2 + 0.06, 0.36, 0);
      group.add(legL);

      // Monitor
      const monStand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.15), metalChromeMat);
      monStand.position.set(-0.1, 0.75, -0.1);
      const monPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), metalBlackMat);
      monPole.position.set(-0.1, 0.81, -0.1);
      const monScreen = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.02), metalBlackMat);
      monScreen.position.set(-0.1, 0.94, -0.1);
      group.add(monStand, monPole, monScreen);
      break;
    }

    case 'kitchen-cabinet': {
      // Base cabinet
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.86, d), darkWoodMat);
      base.position.y = 0.43;
      base.castShadow = true;
      group.add(base);

      // Countertop (marble / quartz)
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.04, d + 0.04), porcelainWhiteMat);
      top.position.y = 0.88;
      group.add(top);

      // Stainless Sink
      const sink = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.4), metalChromeMat);
      sink.position.set(-w * 0.25, 0.9, 0);
      // Faucet arch
      const faucet = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), metalChromeMat);
      faucet.position.set(-w * 0.25, 0.96, -0.15);
      faucet.rotation.z = Math.PI / 2;
      group.add(sink, faucet);

      // Stove burners
      const burner1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.01, 16), metalBlackMat);
      burner1.position.set(w * 0.25 - 0.15, 0.905, 0);
      const burner2 = burner1.clone();
      burner2.position.x = w * 0.25 + 0.15;
      group.add(burner1, burner2);
      break;
    }

    case 'kitchen-island': {
      // Island base
      const base = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.88, d * 0.85), darkWoodMat);
      base.position.y = 0.44;
      base.castShadow = true;
      group.add(base);

      // Waterfall quartz top
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), porcelainWhiteMat);
      top.position.y = 0.91;
      group.add(top);

      // 2 Barstools
      for (let i = 0; i < 2; i++) {
        const stoolX = -w * 0.25 + i * (w * 0.5);
        const stoolZ = d / 2 + 0.25;
        const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16), woodMat);
        stoolSeat.position.set(stoolX, 0.65, stoolZ);
        const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.63, 8), metalBlackMat);
        stoolLeg.position.set(stoolX, 0.32, stoolZ);
        const footrest = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.01, 6, 16), metalChromeMat);
        footrest.position.set(stoolX, 0.25, stoolZ);
        footrest.rotation.x = Math.PI / 2;
        group.add(stoolSeat, stoolLeg, footrest);
      }
      break;
    }

    case 'dining-table-6p': {
      // Table top
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), woodMat);
      top.position.y = h - 0.025;
      top.castShadow = true;
      group.add(top);

      // 4 legs
      const legGeo = new THREE.CylinderGeometry(0.03, 0.02, h - 0.05, 8);
      [
        [-w / 2 + 0.08, (h - 0.05) / 2, -d / 2 + 0.08],
        [w / 2 - 0.08, (h - 0.05) / 2, -d / 2 + 0.08],
        [-w / 2 + 0.08, (h - 0.05) / 2, d / 2 - 0.08],
        [w / 2 - 0.08, (h - 0.05) / 2, d / 2 - 0.08],
      ].forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, darkWoodMat);
        leg.position.set(lx, ly, lz);
        group.add(leg);
      });

      // 4 to 6 dining chairs arranged around table
      const chairPositions = [
        [-w * 0.28, -d / 2 - 0.25, 0],
        [w * 0.28, -d / 2 - 0.25, 0],
        [-w * 0.28, d / 2 + 0.25, Math.PI],
        [w * 0.28, d / 2 + 0.25, Math.PI],
      ];
      chairPositions.forEach(([cx, cz, rot]) => {
        const chair = new THREE.Group();
        const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), fabricAccentMat);
        cSeat.position.y = 0.45;
        const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.03), woodMat);
        cBack.position.set(0, 0.65, -0.18);
        const cLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.43, 8), darkWoodMat);
        cLeg.position.set(0.16, 0.22, 0.16);
        const cLeg2 = cLeg.clone(); cLeg2.position.set(-0.16, 0.22, 0.16);
        const cLeg3 = cLeg.clone(); cLeg3.position.set(0.16, 0.22, -0.16);
        const cLeg4 = cLeg.clone(); cLeg4.position.set(-0.16, 0.22, -0.16);
        chair.add(cSeat, cBack, cLeg, cLeg2, cLeg3, cLeg4);
        chair.position.set(cx, 0, cz);
        chair.rotation.y = rot;
        group.add(chair);
      });
      break;
    }

    case 'refrigerator': {
      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metalChromeMat);
      body.position.y = h / 2;
      body.castShadow = true;
      group.add(body);

      // Split doors
      const doorL = new THREE.Mesh(new THREE.BoxGeometry(w * 0.48, h * 0.98, 0.02), metalChromeMat);
      doorL.position.set(-w * 0.24, h / 2, d / 2 + 0.01);
      const doorR = new THREE.Mesh(new THREE.BoxGeometry(w * 0.48, h * 0.98, 0.02), metalChromeMat);
      doorR.position.set(w * 0.24, h / 2, d / 2 + 0.01);
      group.add(doorL, doorR);

      // Handles
      const hL = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 8), metalBlackMat);
      hL.position.set(-0.04, h / 2, d / 2 + 0.03);
      const hR = hL.clone();
      hR.position.x = 0.04;
      group.add(hL, hR);
      break;
    }

    case 'toilet-closet': {
      // Tank
      const tank = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.45, 0.2), porcelainWhiteMat);
      tank.position.set(0, 0.55, -d / 2 + 0.1);
      tank.castShadow = true;
      // Bowl
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.4, 16), porcelainWhiteMat);
      bowl.position.set(0, 0.2, 0.05);
      // Flush button
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 8), metalChromeMat);
      btn.position.set(0, 0.78, -d / 2 + 0.1);
      group.add(tank, bowl, btn);
      break;
    }

    case 'vanity-sink': {
      // Floating vanity base
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, d), darkWoodMat);
      base.position.set(0, 0.6, 0);
      base.castShadow = true;
      // Basin
      const basin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.08, d * 0.7), porcelainWhiteMat);
      basin.position.set(0, 0.85, 0);
      // Faucet
      const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), metalChromeMat);
      faucet.position.set(0, 0.96, -d * 0.2);
      // Large mirror
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.7, 0.02), mirrorMat);
      mirror.position.set(0, 1.35, -d / 2 + 0.02);
      group.add(base, basin, faucet, mirror);
      break;
    }

    case 'bathtub-freestanding': {
      // Oval freestanding bathtub shell
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2 - 0.08, h, 24), porcelainWhiteMat);
      tub.scale.set(w / d, 1, 1);
      tub.position.y = h / 2;
      tub.castShadow = true;
      group.add(tub);

      // Standing chrome faucet
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8), metalChromeMat);
      pipe.position.set(0, 0.4, d / 2 + 0.1);
      group.add(pipe);
      break;
    }

    case 'shower-box': {
      // Shower tray base
      const tray = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), porcelainWhiteMat);
      tray.position.y = 0.03;
      group.add(tray);

      // Glass enclosure walls
      const glass1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.01), glassMat);
      glass1.position.set(0, h / 2, d / 2);
      const glass2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, h, d), glassMat);
      glass2.position.set(w / 2, h / 2, 0);
      group.add(glass1, glass2);

      // Shower head
      const sHead = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), metalChromeMat);
      sHead.position.set(0, h - 0.2, 0);
      group.add(sHead);
      break;
    }

    case 'indoor-plant': {
      // White pot
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 - 0.06, 0.35, 16), potMat);
      pot.position.y = 0.18;
      pot.castShadow = true;
      // Soil
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 - 0.02, w / 2 - 0.02, 0.02, 16), darkWoodMat);
      soil.position.y = 0.34;
      group.add(pot, soil);

      // Foliage leaves
      for (let i = 0; i < 7; i++) {
        const leafAngle = (i / 7) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), leafGreenMat);
        leaf.position.set(Math.cos(leafAngle) * 0.1, 0.55 + (i % 3) * 0.1, Math.sin(leafAngle) * 0.1);
        leaf.rotation.z = Math.sin(leafAngle) * 0.4;
        leaf.rotation.x = Math.cos(leafAngle) * 0.4;
        group.add(leaf);
      }
      break;
    }

    case 'floor-lamp': {
      // Heavy metal disc base
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), metalBlackMat);
      base.position.y = 0.01;
      // Stem
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h - 0.3, 8), metalBlackMat);
      stem.position.y = (h - 0.3) / 2;
      // Shade
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 16, 1, true), fabricAccentMat);
      shade.position.y = h - 0.15;
      group.add(base, stem, shade);
      break;
    }

    case 'car-sedan': {
      // Lower vehicle body
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, d), fabricMat);
      chassis.position.y = 0.38;
      chassis.castShadow = true;
      // Greenhouse cabin
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.45, d * 0.55), metalBlackMat);
      cabin.position.set(0, 0.75, -d * 0.05);
      group.add(chassis, cabin);

      // 4 wheels
      const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 16);
      wheelGeo.rotateZ(Math.PI / 2);
      [
        [-w / 2 - 0.02, 0.24, -d * 0.3],
        [w / 2 + 0.02, 0.24, -d * 0.3],
        [-w / 2 - 0.02, 0.24, d * 0.3],
        [w / 2 + 0.02, 0.24, d * 0.3],
      ].forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(wheelGeo, metalBlackMat);
        wheel.position.set(wx, wy, wz);
        group.add(wheel);
      });
      break;
    }

    case 'pillar-column': {
      const col = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), porcelainWhiteMat);
      col.position.y = h / 2;
      col.castShadow = true;
      group.add(col);
      break;
    }

    default: {
      // Generic architectural bounding box
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fabricMat);
      box.position.y = h / 2;
      box.castShadow = true;
      group.add(box);
      break;
    }
  }

  // Position and rotate the furniture item in 3D world (Three.js coordinates: X = x, Y = height, Z = y)
  group.position.set(item.x, 0, item.y);
  group.rotation.y = -(item.rotation * Math.PI) / 180;

  return group;
}
