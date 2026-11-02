/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { exportFile } from '../../utils/fileExport';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HousePlan, CameraMode, LightingTime, WallCutMode } from '../../types/house';
import { createFloorMaterial, createWallMaterial } from '../../utils/textures';
import { createFurniture3D } from '../../utils/furniture3d';
import { distance, angleBetween, computeWallSolidSegments } from '../../utils/geometry';
import { 
  Camera, 
  Sun, 
  Moon, 
  Sunset, 
  Layers, 
  Eye, 
  Compass, 
  Maximize2, 
  Camera as CameraIcon,
  ChevronDown,
  ChevronUp,
  Move
} from 'lucide-react';

interface ThreeViewportProps {
  plan: HousePlan;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  lightingTime: LightingTime;
  onLightingTimeChange: (time: LightingTime) => void;
  wallCutMode: WallCutMode;
  onWallCutModeChange: (mode: WallCutMode) => void;
  showRoof: boolean;
  onToggleRoof: (show: boolean) => void;
  className?: string;
}

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  plan,
  cameraMode,
  onCameraModeChange,
  lightingTime,
  onLightingTimeChange,
  wallCutMode,
  onWallCutModeChange,
  showRoof,
  onToggleRoof,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isHudCollapsed, setIsHudCollapsed] = useState(() =>
    window.matchMedia('(max-width: 767px)').matches
  );
  const [snapshotFeedback, setSnapshotFeedback] = useState(false);

  // References to keep Three.js scene instances stable
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const houseGroupRef = useRef<THREE.Group | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const roomLightsRef = useRef<THREE.PointLight[]>([]);

  // First-person navigation state
  const fpvKeysRef = useRef({ w: false, a: false, s: false, d: false });
  const fpvRotationRef = useRef({ yaw: 0, pitch: 0 });
  const isDraggingFpvRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // 1. Initial Scene Setup (runs once on mount)
  useEffect(() => {
    if (!mountRef.current) return;

    // Detect software WebGL per Three.js guidelines
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 600;

    // Create Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(lightingTime === 'night' ? '#090d16' : '#f1f5f9');
    scene.fog = new THREE.Fog(
      lightingTime === 'night' ? '#090d16' : '#f1f5f9',
      15,
      60
    );
    sceneRef.current = scene;

    // Create Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(10, 12, 14);
    cameraRef.current = camera;

    // Create Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Studio Environment Reflections via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // prevent dipping below ground
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.target.set(4, 0, 4);
    controlsRef.current = controls;

    // Three-point Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#f8fafc', '#64748b', 0.85);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const dirLight = new THREE.DirectionalLight('#fffbeb', 1.8);
    dirLight.position.set(15, 25, 12);
    dirLight.castShadow = !isSoftwareGl;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    const shadowD = 15;
    dirLight.shadow.camera.left = -shadowD;
    dirLight.shadow.camera.right = shadowD;
    dirLight.shadow.camera.top = shadowD;
    dirLight.shadow.camera.bottom = -shadowD;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);
    dirLightRef.current = dirLight;

    // Subtle Ground / Grass Yard
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = !isSoftwareGl;
    scene.add(ground);

    // Architectural Ground Grid
    const grid = new THREE.GridHelper(50, 50, '#94a3b8', '#cbd5e1');
    grid.position.y = 0.005;
    scene.add(grid);

    // House Object Group
    const houseGroup = new THREE.Group();
    scene.add(houseGroup);
    houseGroupRef.current = houseGroup;

    // Resize Observer
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      if (!w || !h) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mountRef.current);
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Handle FPV Keyboard movement
      if (cameraMode === 'fpv' && cameraRef.current) {
        const speed = 4.0 * delta;
        const forward = new THREE.Vector3();
        cameraRef.current.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        if (fpvKeysRef.current.w) cameraRef.current.position.addScaledVector(forward, speed);
        if (fpvKeysRef.current.s) cameraRef.current.position.addScaledVector(forward, -speed);
        if (fpvKeysRef.current.d) cameraRef.current.position.addScaledVector(right, speed);
        if (fpvKeysRef.current.a) cameraRef.current.position.addScaledVector(right, -speed);

        cameraRef.current.position.y = 1.65; // Eye height locked
      } else if (controlsRef.current) {
        controlsRef.current.update();
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, []);

  // 2. Update Lighting & Atmosphere when lightingTime changes
  useEffect(() => {
    if (!sceneRef.current || !dirLightRef.current || !hemiLightRef.current) return;

    const scene = sceneRef.current;
    const dir = dirLightRef.current;
    const hemi = hemiLightRef.current;

    if (lightingTime === 'day') {
      scene.background = new THREE.Color('#f1f5f9');
      scene.fog = new THREE.Fog('#f1f5f9', 15, 60);
      dir.color.set('#fffbeb');
      dir.intensity = 1.8;
      dir.position.set(15, 25, 12);
      hemi.color.set('#f8fafc');
      hemi.groundColor.set('#64748b');
      hemi.intensity = 0.85;

      // Turn off interior pointlights in bright daylight
      roomLightsRef.current.forEach((pl) => (pl.intensity = 0));
    } else if (lightingTime === 'sunset') {
      scene.background = new THREE.Color('#fed7aa');
      scene.fog = new THREE.Fog('#fed7aa', 12, 50);
      dir.color.set('#ea580c');
      dir.intensity = 1.6;
      dir.position.set(25, 8, 15);
      hemi.color.set('#fde047');
      hemi.groundColor.set('#7c2d12');
      hemi.intensity = 0.6;

      // Subtle evening ceiling glow
      roomLightsRef.current.forEach((pl) => (pl.intensity = 1.5));
    } else if (lightingTime === 'night') {
      scene.background = new THREE.Color('#090d16');
      scene.fog = new THREE.Fog('#090d16', 10, 45);
      dir.color.set('#38bdf8');
      dir.intensity = 0.25;
      dir.position.set(-15, 20, -10);
      hemi.color.set('#1e293b');
      hemi.groundColor.set('#020617');
      hemi.intensity = 0.2;

      // Warm glowing interior lighting
      roomLightsRef.current.forEach((pl) => (pl.intensity = 3.5));
    }
  }, [lightingTime]);

  // 3. Update Camera Mode
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;

    if (cameraMode === 'top') {
      controlsRef.current.enabled = true;
      cameraRef.current.position.set(4, 20, 4.01);
      controlsRef.current.target.set(4, 0, 4);
      controlsRef.current.maxPolarAngle = 0.05;
      controlsRef.current.update();
    } else if (cameraMode === 'orbit') {
      controlsRef.current.enabled = true;
      controlsRef.current.maxPolarAngle = Math.PI / 2 - 0.02;
      cameraRef.current.position.set(10, 10, 12);
      controlsRef.current.target.set(4, 1, 4);
      controlsRef.current.update();
    } else if (cameraMode === 'fpv') {
      controlsRef.current.enabled = false; // Disable orbit in FPV
      cameraRef.current.position.set(4.5, 1.65, 5);
      cameraRef.current.lookAt(4.5, 1.65, 0);
    }
  }, [cameraMode]);

  // 4. Reconstruct House Geometry in 3D (Walls, Openings, Rooms, Furniture, Roof)
  useEffect(() => {
    if (!houseGroupRef.current || !sceneRef.current) return;
    const houseGroup = houseGroupRef.current;

    // Clear previous 3D objects
    while (houseGroup.children.length > 0) {
      const obj = houseGroup.children[0];
      houseGroup.remove(obj);
    }

    // Clean up room lights
    roomLightsRef.current = [];

    const effectiveWallH = wallCutMode === 'half' ? 1.2 : plan.defaultWallHeight || 2.8;

    // --- A. ROOM FLOORS & CEILING LIGHTS ---
    plan.rooms.forEach((room) => {
      if (room.points.length < 3) return;

      const shape = new THREE.Shape();
      shape.moveTo(room.points[0].x, room.points[0].y);
      for (let i = 1; i < room.points.length; i++) {
        shape.lineTo(room.points[i].x, room.points[i].y);
      }
      shape.closePath();

      const floorGeo = new THREE.ShapeGeometry(shape);
      const floorMat = createFloorMaterial(room.floorMaterial, room.floorColor, room.tileConfig);
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = Math.PI / 2;
      floorMesh.scale.set(1, -1, 1);
      floorMesh.position.y = 0.02; // Ground elevation offset to avoid Z-fighting
      floorMesh.receiveShadow = true;
      houseGroup.add(floorMesh);

      // Room Center for Ceiling Point Light
      let cx = 0, cy = 0;
      room.points.forEach((p) => { cx += p.x; cy += p.y; });
      cx /= room.points.length;
      cy /= room.points.length;

      // Add Warm Recessed Ceiling Light
      const ceilingLight = new THREE.PointLight(
        '#fef08a',
        lightingTime === 'night' ? 3.5 : lightingTime === 'sunset' ? 1.5 : 0,
        9
      );
      ceilingLight.position.set(cx, effectiveWallH - 0.2, cy);
      ceilingLight.castShadow = false;
      houseGroup.add(ceilingLight);
      roomLightsRef.current.push(ceilingLight);
    });

    // --- B. WALLS & CUTOUT OPENINGS (DOORS & WINDOWS) ---
    plan.walls.forEach((wall) => {
      const wallLen = distance(wall.start, wall.end);
      if (wallLen < 0.1) return;

      const wallH = wallCutMode === 'half' ? 1.2 : (wall.height || plan.defaultWallHeight || 2.8);
      const angle = angleBetween(wall.start, wall.end);
      const solidSegments = computeWallSolidSegments(wall, plan.openings);
      const wallMat = createWallMaterial(wall.material, wallCutMode);

      // Solid wall segments
      solidSegments.forEach((seg) => {
        const segLen = (seg.endT - seg.startT) * wallLen;
        if (segLen < 0.02) return;

        const wallGeo = new THREE.BoxGeometry(segLen, wallH, wall.thickness);
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;

        // Position along the wall
        const midT = (seg.startT + seg.endT) / 2;
        const posX = wall.start.x + Math.cos(angle) * (midT * wallLen);
        const posZ = wall.start.y + Math.sin(angle) * (midT * wallLen);

        wallMesh.position.set(posX, wallH / 2, posZ);
        wallMesh.rotation.y = -angle;
        houseGroup.add(wallMesh);
      });

      // Lintel / Header above openings (if wall is full height)
      if (wallCutMode === 'full') {
        const wallOpenings = plan.openings.filter((o) => o.wallId === wall.id);
        wallOpenings.forEach((op) => {
          const opTop = op.elevation + op.height;
          const headerH = wallH - opTop;
          if (headerH > 0.05) {
            const headerGeo = new THREE.BoxGeometry(op.width, headerH, wall.thickness);
            const headerMesh = new THREE.Mesh(headerGeo, wallMat);
            headerMesh.castShadow = true;
            const opX = wall.start.x + Math.cos(angle) * (op.position * wallLen);
            const opZ = wall.start.y + Math.sin(angle) * (op.position * wallLen);
            headerMesh.position.set(opX, opTop + headerH / 2, opZ);
            headerMesh.rotation.y = -angle;
            houseGroup.add(headerMesh);
          }

          // Sill under windows
          if (op.elevation > 0.05) {
            const sillGeo = new THREE.BoxGeometry(op.width, op.elevation, wall.thickness);
            const sillMesh = new THREE.Mesh(sillGeo, wallMat);
            sillMesh.castShadow = true;
            const opX = wall.start.x + Math.cos(angle) * (op.position * wallLen);
            const opZ = wall.start.y + Math.sin(angle) * (op.position * wallLen);
            sillMesh.position.set(opX, op.elevation / 2, opZ);
            sillMesh.rotation.y = -angle;
            houseGroup.add(sillMesh);
          }
        });
      }
    });

    // --- C. 3D OPENINGS (DOORS & WINDOWS) ---
    plan.openings.forEach((op) => {
      const parentWall = plan.walls.find((w) => w.id === op.wallId);
      if (!parentWall) return;

      const wallH = wallCutMode === 'half' ? 1.2 : (parentWall.height || plan.defaultWallHeight || 2.8);
      const wallLen = distance(parentWall.start, parentWall.end);
      const angle = angleBetween(parentWall.start, parentWall.end);
      const opX = parentWall.start.x + Math.cos(angle) * (op.position * wallLen);
      const opZ = parentWall.start.y + Math.sin(angle) * (op.position * wallLen);

      const opGroup = new THREE.Group();
      opGroup.position.set(opX, op.elevation, opZ);
      opGroup.rotation.y = -angle;

      const isDoor = op.type.startsWith('door');

      if (isDoor) {
        const frameMat = new THREE.MeshStandardMaterial({ color: '#332319', roughness: 0.6 });
        const doorPanelMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.5 });
        const handleMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2, metalness: 0.9 });
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: '#ffffff',
          roughness: 0.1,
          metalness: 0.1,
          transparent: true,
          opacity: 0.45,
          transmission: 0.7,
        });

        const doorH = Math.min(op.height, wallH);
        const hingeRight = op.hingeSide === 'right';
        const swingOut = op.swingDirection === 'outward';
        const panelOffsetZ = swingOut ? -0.04 : 0.04;

        if (op.type === 'door-glass') {
          // Glass door with frame
          const panel = new THREE.Mesh(new THREE.BoxGeometry(op.width - 0.08, doorH - 0.04, 0.03), glassMat);
          panel.position.set(0, doorH / 2, panelOffsetZ);
          const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 8), handleMat);
          handle.position.set(hingeRight ? -op.width * 0.35 : op.width * 0.35, 1.0, panelOffsetZ + 0.02);
          opGroup.add(panel, handle);
        } else if (op.type === 'door-double') {
          // Double French door
          const leafW = (op.width - 0.08) / 2;
          const panelL = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.01, doorH - 0.04, 0.04), doorPanelMat);
          panelL.position.set(-leafW / 2, doorH / 2, panelOffsetZ);
          const panelR = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.01, doorH - 0.04, 0.04), doorPanelMat);
          panelR.position.set(leafW / 2, doorH / 2, panelOffsetZ);
          const handleL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.04), handleMat);
          handleL.position.set(-0.04, 1.0, panelOffsetZ + 0.03);
          const handleR = handleL.clone();
          handleR.position.x = 0.04;
          opGroup.add(panelL, panelR, handleL, handleR);
        } else if (op.type === 'door-sliding') {
          // Sliding pocket door
          const leafW = op.width * 0.55;
          const panel1 = new THREE.Mesh(new THREE.BoxGeometry(leafW, doorH - 0.04, 0.03), doorPanelMat);
          panel1.position.set(-op.width * 0.22, doorH / 2, -0.02);
          const panel2 = new THREE.Mesh(new THREE.BoxGeometry(leafW, doorH - 0.04, 0.03), doorPanelMat);
          panel2.position.set(op.width * 0.22, doorH / 2, 0.02);
          opGroup.add(panel1, panel2);
        } else if (op.type === 'door-garage') {
          // Rolling garage door
          const garageMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5, metalness: 0.3 });
          const panel = new THREE.Mesh(new THREE.BoxGeometry(op.width - 0.04, doorH, 0.05), garageMat);
          panel.position.set(0, doorH / 2, 0);
          opGroup.add(panel);
        } else {
          // Standard Single Door (Panel & Handle placed based on hinge & swing!)
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(op.width - 0.08, doorH - 0.04, 0.04),
            doorPanelMat
          );
          panel.position.set(0, doorH / 2, panelOffsetZ);
          panel.castShadow = true;

          const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.06), handleMat);
          handle.position.set(hingeRight ? -op.width * 0.35 : op.width * 0.35, 1.0, panelOffsetZ + 0.03);
          opGroup.add(panel, handle);
        }
      } else {
        // Windows
        const frameMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.3 });
        const glassMat = new THREE.MeshPhysicalMaterial({
          color: '#ffffff',
          roughness: 0.05,
          metalness: 0.1,
          transparent: true,
          opacity: 0.35,
          transmission: 0.85,
          ior: 1.5,
        });

        const winH = Math.min(op.height, wallH - op.elevation);
        if (winH > 0.1) {
          if (op.type === 'window-louver') {
            // Ventilation Louver Window
            const louverCount = 4;
            for (let li = 0; li < louverCount; li++) {
              const lGlass = new THREE.Mesh(new THREE.BoxGeometry(op.width - 0.06, winH / (louverCount + 1), 0.01), glassMat);
              lGlass.position.set(0, (winH / louverCount) * (li + 0.5), 0);
              lGlass.rotation.x = Math.PI / 6;
              opGroup.add(lGlass);
            }
          } else {
            // Standard / Double / Large / Panorama Glass
            const glass = new THREE.Mesh(
              new THREE.BoxGeometry(op.width - 0.06, winH - 0.06, 0.02),
              glassMat
            );
            glass.position.set(0, winH / 2, 0);
            opGroup.add(glass);

            if (op.type === 'window-double') {
              // Center mullion
              const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.04, winH, parentWall.thickness * 1.1), frameMat);
              mullion.position.set(0, winH / 2, 0);
              opGroup.add(mullion);
            }
          }

          // Frame Border
          const frameTop = new THREE.Mesh(new THREE.BoxGeometry(op.width, 0.04, parentWall.thickness * 1.1), frameMat);
          frameTop.position.set(0, winH, 0);
          const frameBot = frameTop.clone();
          frameBot.position.y = 0;
          const frameSideL = new THREE.Mesh(new THREE.BoxGeometry(0.04, winH, parentWall.thickness * 1.1), frameMat);
          frameSideL.position.set(-op.width / 2, winH / 2, 0);
          const frameSideR = frameSideL.clone();
          frameSideR.position.x = op.width / 2;
          opGroup.add(frameTop, frameBot, frameSideL, frameSideR);
        }
      }

      houseGroup.add(opGroup);
    });

    // --- D. 3D FURNITURE ---
    plan.furniture.forEach((item) => {
      const furnMesh = createFurniture3D(item);
      houseGroup.add(furnMesh);
    });

    // --- E. ROOF (IF ENABLED) ---
    if (showRoof && wallCutMode === 'full' && plan.roofType !== 'none') {
      // Find bounding box of house
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      plan.walls.forEach((w) => {
        minX = Math.min(minX, w.start.x, w.end.x);
        maxX = Math.max(maxX, w.start.x, w.end.x);
        minZ = Math.min(minZ, w.start.y, w.end.y);
        maxZ = Math.max(maxZ, w.start.y, w.end.y);
      });

      if (minX !== Infinity) {
        const roofOverhang = 0.6;
        const rW = (maxX - minX) + roofOverhang * 2;
        const rD = (maxZ - minZ) + roofOverhang * 2;
        const roofMidX = (minX + maxX) / 2;
        const roofMidZ = (minZ + maxZ) / 2;

        const roofMat = new THREE.MeshStandardMaterial({
          color: '#991b1b', // Terracotta roof tiles
          roughness: 0.7,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });

        if (plan.roofType === 'gable') {
          // Gable Roof Shape
          const roofHeight = 1.6;
          const prismGeo = new THREE.ConeGeometry(rW * 0.7, roofHeight, 4);
          prismGeo.rotateY(Math.PI / 4);
          const roof = new THREE.Mesh(prismGeo, roofMat);
          roof.scale.set(1, 1, rD / rW);
          roof.position.set(roofMidX, effectiveWallH + roofHeight / 2, roofMidZ);
          roof.castShadow = true;
          houseGroup.add(roof);
        } else {
          // Flat modern roof deck
          const flatRoof = new THREE.Mesh(new THREE.BoxGeometry(rW, 0.2, rD), roofMat);
          flatRoof.position.set(roofMidX, effectiveWallH + 0.1, roofMidZ);
          flatRoof.castShadow = true;
          houseGroup.add(flatRoof);
        }
      }
    }
  }, [plan, wallCutMode, showRoof, lightingTime]);

  // FPV Mouse Look Handler
  const handleFpvMouseDown = (e: React.PointerEvent) => {
    if (cameraMode !== 'fpv') return;
    isDraggingFpvRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleFpvMouseMove = (e: React.PointerEvent) => {
    if (cameraMode !== 'fpv' || !isDraggingFpvRef.current || !cameraRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    fpvRotationRef.current.yaw -= dx * 0.003;
    fpvRotationRef.current.pitch = Math.max(
      -Math.PI / 3,
      Math.min(Math.PI / 3, fpvRotationRef.current.pitch - dy * 0.003)
    );

    const yaw = fpvRotationRef.current.yaw;
    const pitch = fpvRotationRef.current.pitch;
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );
    const target = new THREE.Vector3().copy(cameraRef.current.position).add(dir);
    cameraRef.current.lookAt(target);
  };

  const handleFpvMouseUp = () => {
    isDraggingFpvRef.current = false;
  };

  // Keyboard controls for FPV
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'arrowup'].includes(key)) fpvKeysRef.current.w = true;
      if (['s', 'arrowdown'].includes(key)) fpvKeysRef.current.s = true;
      if (['a', 'arrowleft'].includes(key)) fpvKeysRef.current.a = true;
      if (['d', 'arrowright'].includes(key)) fpvKeysRef.current.d = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'arrowup'].includes(key)) fpvKeysRef.current.w = false;
      if (['s', 'arrowdown'].includes(key)) fpvKeysRef.current.s = false;
      if (['a', 'arrowleft'].includes(key)) fpvKeysRef.current.a = false;
      if (['d', 'arrowright'].includes(key)) fpvKeysRef.current.d = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Take Snapshot function
  const handleTakeSnapshot = useCallback(async () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    try {
      await exportFile({
        fileName: `Desain_Rumah_PRO_3D_${plan.name}_${Date.now()}.png`,
        mimeType: 'image/png',
        data: rendererRef.current.domElement.toDataURL('image/png').split(',')[1],
        encoding: 'base64',
      });
      setSnapshotFeedback(true);
      setTimeout(() => setSnapshotFeedback(false), 2000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Gagal mengekspor gambar pratinjau 3D.');
    }
  }, [plan.name]);

  return (
    <div 
      className={`relative w-full h-full select-none overflow-hidden bg-slate-900 ${className}`}
      onPointerDown={handleFpvMouseDown}
      onPointerMove={handleFpvMouseMove}
      onPointerUp={handleFpvMouseUp}
      onPointerCancel={handleFpvMouseUp}
      onPointerLeave={handleFpvMouseUp}
    >
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Minimal Top-Left Status Badge */}
      <div className="three-status-badge absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-xs text-slate-300 shadow-lg">
        <div className="w-2 h-2 rounded-full bg-cyan-400" />
        <span className="font-semibold text-white tracking-wide">3D STUDIO</span>
        <span className="three-status-separator text-slate-500">|</span>
        <span className="three-status-mode">
          {cameraMode === 'orbit' ? 'Dollhouse 360°' : cameraMode === 'fpv' ? 'Tur Jalan Virtual (WASD)' : 'Ortografik Atas'}
        </span>
      </div>

      {/* FPV On-Screen Helper Banner when in Walkthrough Mode */}
      {cameraMode === 'fpv' && (
        <div className="three-fpv-helper absolute top-4 right-4 z-10 bg-slate-950/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-800 text-xs text-slate-200 shadow-xl flex items-center gap-3">
          <Move className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <p className="font-medium">Kontrol: Tombol <span className="text-white font-mono bg-slate-800 px-1 py-0.5 rounded">WASD</span> atau Panah</p>
            <p className="text-slate-400 text-[11px]">Klik & seret mouse untuk memutar pandangan</p>
          </div>
        </div>
      )}

      {/* Snapshot Toast Feedback */}
      {snapshotFeedback && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-xl text-xs font-medium animate-bounce">
          Foto 3D Berhasil Diunduh!
        </div>
      )}

      {/* Unified Bottom Control Dock (Following Three.js & Design Skill Guidelines) */}
      <div 
        className="three-controls-dock absolute bottom-4 left-1/2 z-10 w-[94%] max-w-3xl transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-50%) translateY(${isHudCollapsed ? 'calc(100% - 32px)' : '0px'})` }}
      >
        {/* Collapse / Expand Toggle Button */}
        <div className="flex justify-center -mb-px">
          <button
            onClick={() => setIsHudCollapsed(!isHudCollapsed)}
            className="flex items-center gap-1.5 px-4 py-1 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 border-b-0 rounded-t-xl text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer shadow-md"
          >
            {isHudCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Buka Panel Kontrol 3D</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Sembunyikan Panel</span>
              </>
            )}
          </button>
        </div>

        {/* Glassmorphic Dock Container */}
        <div className="three-controls-content bg-slate-950/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Group 1: Camera Modes */}
          <div className="three-control-group flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onCameraModeChange('orbit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                cameraMode === 'orbit' 
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Dollhouse Orbit"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Dollhouse</span>
            </button>
            <button
              onClick={() => onCameraModeChange('fpv')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                cameraMode === 'fpv' 
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="First Person Walkthrough"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Tur Virtual</span>
            </button>
            <button
              onClick={() => onCameraModeChange('top')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                cameraMode === 'top' 
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Top-down Ortho View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Atas</span>
            </button>
          </div>

          {/* Group 2: Wall Height / Slice Cut */}
          <div className="three-control-group flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 px-2 font-mono">Dinding</span>
            <button
              onClick={() => onWallCutModeChange('full')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                wallCutMode === 'full' 
                  ? 'bg-slate-700 text-white font-medium' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              2.8m Penuh
            </button>
            <button
              onClick={() => onWallCutModeChange('half')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                wallCutMode === 'half' 
                  ? 'bg-slate-700 text-white font-medium' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Potong dinding 1.2m untuk melihat interior ruangan jelas"
            >
              1.2m Potong
            </button>
            <button
              onClick={() => onWallCutModeChange('transparent')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                wallCutMode === 'transparent' 
                  ? 'bg-slate-700 text-white font-medium' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Kaca
            </button>
          </div>

          {/* Group 3: Lighting / Time of Day */}
          <div className="three-control-group flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onLightingTimeChange('day')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                lightingTime === 'day' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-white'
              }`}
              title="Siang Terang"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => onLightingTimeChange('sunset')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                lightingTime === 'sunset' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-400 hover:text-white'
              }`}
              title="Senja / Sunset"
            >
              <Sunset className="w-4 h-4" />
            </button>
            <button
              onClick={() => onLightingTimeChange('night')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                lightingTime === 'night' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white'
              }`}
              title="Malam (Lampu Interior Menyala)"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>

          {/* Group 4: Roof Toggle & Snapshot Button */}
          <div className="three-control-group flex items-center gap-2">
            <button
              onClick={() => onToggleRoof(!showRoof)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                showRoof 
                  ? 'bg-slate-800 text-emerald-400 border-emerald-500/40' 
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Tampilkan / Sembunyikan Atap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Atap {showRoof ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={handleTakeSnapshot}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl border border-slate-700 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Ambil Foto Snapshot 3D"
            >
              <CameraIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Foto 3D</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
