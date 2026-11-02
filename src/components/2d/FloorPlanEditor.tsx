/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  HousePlan, 
  Point, 
  Wall, 
  Opening, 
  FurnitureItem, 
  Room, 
  ActiveTool,
  OpeningType,
  PlanReferenceImage,
} from '../../types/house';
import { 
  distance, 
  angleBetween, 
  snapPointToGrid, 
  snapAngle, 
  closestPointOnSegment,
  formatMeters,
  calculatePolygonArea,
  calculateCentroid,
  calculatePolygonCentroid,
  findEnclosedWallFaces,
  splitWallsAtIntersections,
} from '../../utils/geometry';
import { CatalogItem } from '../../constants/catalog';
import { 
  RotateCw, 
  Trash2, 
  Copy, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Grid,
  Magnet,
  ImagePlus,
  Camera,
  ScanLine,
  X,
} from 'lucide-react';

interface FloorPlanEditorProps {
  plan: HousePlan;
  activeTool: ActiveTool;
  selectedCatalogItem: CatalogItem | null;
  onUpdatePlan: (updatedPlan: HousePlan) => void;
  selectedElement: { type: 'wall' | 'opening' | 'furniture' | 'room'; id: string } | null;
  onSelectElement: (elem: { type: 'wall' | 'opening' | 'furniture' | 'room'; id: string } | null) => void;
  className?: string;
}

export const FloorPlanEditor: React.FC<FloorPlanEditorProps> = ({
  plan,
  activeTool,
  selectedCatalogItem,
  onUpdatePlan,
  selectedElement,
  onSelectElement,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const referenceImageRef = useRef<HTMLImageElement | null>(null);

  // Viewport transforms (pan & zoom)
  const [zoom, setZoom] = useState(55); // pixels per meter
  const [pan, setPan] = useState({ x: 200, y: 150 });
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);
  const [snapAngleEnabled, setSnapAngleEnabled] = useState(true);
  const hasAutoFittedRef = useRef(false);
  const fitViewRef = useRef<() => void>(() => {});
  const lastViewportSizeRef = useRef({ width: 0, height: 0 });

  // Drawing state
  const [wallStartPoint, setWallStartPoint] = useState<Point | null>(null);
  const [drawnWallIds, setDrawnWallIds] = useState<string[]>([]);
  const [mouseWorldPos, setMouseWorldPos] = useState<Point>({ x: 0, y: 0 });
  const [touchWallCursor, setTouchWallCursor] = useState<{ x: number; y: number; fingerY: number } | null>(null);
  const [isReferencePanelOpen, setIsReferencePanelOpen] = useState(false);
  const [isRecognizingPlan, setIsRecognizingPlan] = useState(false);
  const [referenceImageReady, setReferenceImageReady] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  const [recognizedPlan, setRecognizedPlan] = useState<{
    walls: Wall[];
    rooms: Room[];
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const wallTouchStartRef = useRef<{
    point: Point;
    anchor: Point | null;
    screenX: number;
    screenY: number;
  } | null>(null);
  const touchPointersRef = useRef(new Map<number, Point>());
  const pinchStartRef = useRef<{
    distance: number;
    zoom: number;
    worldAnchor: Point;
  } | null>(null);

  // Rect Room stamp state
  const [roomRectStart, setRoomRectStart] = useState<Point | null>(null);

  // Dragging selected element
  const [isDraggingSelected, setIsDraggingSelected] = useState(false);
  const dragStartWorldRef = useRef<Point>({ x: 0, y: 0 });
  const originalPosRef = useRef<
    | { type: 'furniture'; x: number; y: number }
    | { type: 'wall'; start: Point; end: Point; walls: Wall[]; rooms: Room[] }
    | { type: 'vertex'; point: Point; walls: Wall[]; rooms: Room[] }
    | null
  >(null);

  // Measure tool state
  const [measureStart, setMeasureStart] = useState<Point | null>(null);

  // Active Door / Window Type selection
  const [activeDoorType, setActiveDoorType] = useState<OpeningType>('door-single');
  const [activeWindowType, setActiveWindowType] = useState<OpeningType>('window-double');

  useEffect(() => {
    const reference = plan.referenceImage;
    if (!reference) {
      referenceImageRef.current = null;
      setReferenceImageReady(false);
      return;
    }

    referenceImageRef.current = null;
    setReferenceImageReady(false);
    const image = new Image();
    image.onload = () => {
      referenceImageRef.current = image;
      setReferenceImageReady(true);
    };
    image.onerror = () => {
      referenceImageRef.current = null;
      setReferenceImageReady(false);
      setRecognitionError('Gambar alas tidak dapat dibuka. Silakan unggah ulang gambar.');
    };
    image.src = reference.dataUrl;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [plan.referenceImage?.dataUrl]);

  // Screen to World coords
  const screenToWorld = useCallback((screenX: number, screenY: number): Point => {
    return {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // World to Screen coords
  const worldToScreen = useCallback((worldX: number, worldY: number): { x: number; y: number } => {
    return {
      x: worldX * zoom + pan.x,
      y: worldY * zoom + pan.y,
    };
  }, [pan, zoom]);

  // Find nearest wall endpoint for vertex snapping
  const findSnapVertex = useCallback((
    target: Point,
    thresholdDist = 0.35,
    excludedPoint?: Point
  ): Point | null => {
    let closestPt: Point | null = null;
    let minDist = thresholdDist;

    plan.walls.forEach((w) => {
      const d1 = distance(target, w.start);
      if ((!excludedPoint || distance(w.start, excludedPoint) > 0.001) && d1 < minDist) {
        minDist = d1;
        closestPt = { ...w.start };
      }
      const d2 = distance(target, w.end);
      if ((!excludedPoint || distance(w.end, excludedPoint) > 0.001) && d2 < minDist) {
        minDist = d2;
        closestPt = { ...w.end };
      }
    });

    return closestPt;
  }, [plan.walls]);

  const findSnapPoint = useCallback((
    target: Point,
    thresholdDist = 0.35,
    excludedPoint?: Point
  ): Point | null => {
    let closestPoint: Point | null = null;
    let minDist = thresholdDist;
    const consider = (point: Point) => {
      if (excludedPoint && distance(point, excludedPoint) < 0.001) return;
      const currentDistance = distance(target, point);
      if (currentDistance < minDist) {
        minDist = currentDistance;
        closestPoint = { ...point };
      }
    };

    for (const wall of plan.walls) {
      consider(wall.start);
      consider(wall.end);
      const projection = closestPointOnSegment(target, wall.start, wall.end);
      consider(projection.point);
    }

    return closestPoint;
  }, [plan.walls]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
      if (!hasAutoFittedRef.current && canvasRef.current.width > 0 && canvasRef.current.height > 0) {
        hasAutoFittedRef.current = true;
        fitViewRef.current();
      } else {
        const previous = lastViewportSizeRef.current;
        const previousRatio = previous.width / Math.max(previous.height, 1);
        const nextRatio = canvasRef.current.width / Math.max(canvasRef.current.height, 1);
        if (previous.width > 0 && Math.abs(nextRatio - previousRatio) > 0.35) {
          fitViewRef.current();
        }
      }
      lastViewportSizeRef.current = {
        width: canvasRef.current.width,
        height: canvasRef.current.height,
      };
    };
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Main 2D Canvas Draw Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Architectural Grid
    const step = 1; // 1 meter major grid
    const subStep = 0.5; // 0.5 meter minor grid

    const minWorld = screenToWorld(0, 0);
    const maxWorld = screenToWorld(canvas.width, canvas.height);

    const startX = Math.floor(minWorld.x / subStep) * subStep;
    const endX = Math.ceil(maxWorld.x / subStep) * subStep;
    const startY = Math.floor(minWorld.y / subStep) * subStep;
    const endY = Math.ceil(maxWorld.y / subStep) * subStep;

    // Sub-grid
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += subStep) {
      const sx = worldToScreen(x, 0).x;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, canvas.height);
    }
    for (let y = startY; y <= endY; y += subStep) {
      const sy = worldToScreen(0, y).y;
      ctx.moveTo(0, sy);
      ctx.lineTo(canvas.width, sy);
    }
    ctx.stroke();

    // Major grid (1m)
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = Math.floor(minWorld.x); x <= Math.ceil(maxWorld.x); x += step) {
      const sx = worldToScreen(x, 0).x;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, canvas.height);
    }
    for (let y = Math.floor(minWorld.y); y <= Math.ceil(maxWorld.y); y += step) {
      const sy = worldToScreen(0, y).y;
      ctx.moveTo(0, sy);
      ctx.lineTo(canvas.width, sy);
    }
    ctx.stroke();

    // Origin Axes (0,0)
    const origin = worldToScreen(0, 0);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin.x - 10, origin.y);
    ctx.lineTo(origin.x + 10, origin.y);
    ctx.moveTo(origin.x, origin.y - 10);
    ctx.lineTo(origin.x, origin.y + 10);
    ctx.stroke();

    const reference = plan.referenceImage;
    const referenceImage = referenceImageRef.current;
    if (reference && referenceImageReady && referenceImage && reference.widthMeters > 0) {
      const imageWidth = reference.widthMeters * zoom;
      const imageHeight = imageWidth * referenceImage.naturalHeight / referenceImage.naturalWidth;
      const imageCenter = worldToScreen(reference.center.x, reference.center.y);
      ctx.save();
      ctx.globalAlpha = reference.opacity;
      ctx.drawImage(referenceImage, imageCenter.x - imageWidth / 2, imageCenter.y - imageHeight / 2, imageWidth, imageHeight);
      ctx.restore();
    }

    // 2. Draw Rooms (Floor polygons with soft color & labels)
    plan.rooms.forEach((room) => {
      if (room.points.length < 3) return;

      const isSelected = selectedElement?.type === 'room' && selectedElement.id === room.id;
      ctx.fillStyle = isSelected
        ? 'rgba(56, 189, 248, 0.22)'
        : plan.referenceImage ? 'rgba(241, 245, 249, 0.12)' : 'rgba(241, 245, 249, 0.85)';
      ctx.strokeStyle = isSelected ? '#0284c7' : 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = isSelected ? 2 : 1;

      ctx.beginPath();
      const first = worldToScreen(room.points[0].x, room.points[0].y);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < room.points.length; i++) {
        const p = worldToScreen(room.points[i].x, room.points[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Room Name & Area Badge
      const center = calculatePolygonCentroid(room.points);
      const centerScr = worldToScreen(center.x, center.y);
      const areaM2 = calculatePolygonArea(room.points);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText(room.name, centerScr.x, centerScr.y - 8);

      ctx.font = '500 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${areaM2.toFixed(1)} m²`, centerScr.x, centerScr.y + 10);
    });

    // 3. Draw Walls
    plan.walls.forEach((wall) => {
      const isSelected = selectedElement?.type === 'wall' && selectedElement.id === wall.id;
      const s = worldToScreen(wall.start.x, wall.start.y);
      const e = worldToScreen(wall.end.x, wall.end.y);

      const wallThickPx = Math.max(4, wall.thickness * zoom);

      ctx.strokeStyle = isSelected ? '#0284c7' : '#1e293b';
      ctx.lineWidth = wallThickPx;
      ctx.lineCap = 'square';

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();

      // Dimension Text on Wall
      const wallLen = distance(wall.start, wall.end);
      if (wallLen >= 0.5) {
        const midX = (s.x + e.x) / 2;
        const midY = (s.y + e.y) / 2;
        const angle = Math.atan2(e.y - s.y, e.x - s.x);

        ctx.save();
        ctx.translate(midX, midY);
        // Keep text readable right side up
        let textAngle = angle;
        if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
          textAngle += Math.PI;
        }
        ctx.rotate(textAngle);

        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.fillStyle = isSelected ? '#0284c7' : '#475569';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(formatMeters(wallLen), 0, -wallThickPx / 2 - 3);
        ctx.restore();
      }

      // If selected, show endpoints handles
      if (isSelected) {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    if (recognizedPlan) {
      ctx.save();
      ctx.strokeStyle = '#16a34a';
      ctx.fillStyle = '#16a34a';
      ctx.lineWidth = Math.max(3, 0.12 * zoom);
      ctx.setLineDash([8, 5]);
      recognizedPlan.walls.forEach((wall) => {
        const start = worldToScreen(wall.start.x, wall.start.y);
        const end = worldToScreen(wall.end.x, wall.end.y);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
        ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // 4. Draw Openings (Doors & Windows)
    plan.openings.forEach((op) => {
      const wall = plan.walls.find((w) => w.id === op.wallId);
      if (!wall) return;

      const isSelected = selectedElement?.type === 'opening' && selectedElement.id === op.id;
      const wallLen = distance(wall.start, wall.end);
      const angle = angleBetween(wall.start, wall.end);

      const opWorldX = wall.start.x + Math.cos(angle) * (op.position * wallLen);
      const opWorldY = wall.start.y + Math.sin(angle) * (op.position * wallLen);
      const opCenter = worldToScreen(opWorldX, opWorldY);

      const opW_px = op.width * zoom;
      const isDoor = op.type.startsWith('door');

      ctx.save();
      ctx.translate(opCenter.x, opCenter.y);
      ctx.rotate(angle);

      if (isDoor) {
        // Clear wall slot
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-opW_px / 2, -(wall.thickness * zoom) / 2 - 1, opW_px, wall.thickness * zoom + 2);

        const hingeLeft = (op.hingeSide || 'left') === 'left';
        const swingIn = (op.swingDirection || 'inward') === 'inward';
        const signY = swingIn ? 1 : -1;

        if (op.type === 'door-double') {
          // Double French Door (Left and Right swinging leaves)
          const halfW = opW_px / 2;
          ctx.strokeStyle = isSelected ? '#0284c7' : '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(-opW_px / 2, 0, halfW, 0, (signY * Math.PI) / 2, signY < 0);
          ctx.arc(opW_px / 2, 0, halfW, Math.PI, Math.PI - (signY * Math.PI) / 2, signY > 0);
          ctx.stroke();

          ctx.strokeStyle = isSelected ? '#0284c7' : '#78350f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-opW_px / 2, 0); ctx.lineTo(-opW_px / 2, signY * halfW);
          ctx.moveTo(opW_px / 2, 0); ctx.lineTo(opW_px / 2, signY * halfW);
          ctx.stroke();
        } else if (op.type === 'door-sliding') {
          // Sliding Door
          ctx.strokeStyle = isSelected ? '#0284c7' : '#334155';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(-opW_px / 2, -3, opW_px * 0.55, 6);
          ctx.strokeRect(-opW_px * 0.05, 3, opW_px * 0.55, 6);
        } else if (op.type === 'door-garage') {
          // Garage Roll-Up Door
          ctx.strokeStyle = isSelected ? '#0284c7' : '#475569';
          ctx.lineWidth = 2;
          ctx.strokeRect(-opW_px / 2, -4, opW_px, 8);
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(-opW_px / 2, 0); ctx.lineTo(opW_px / 2, 0);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Single Door / Glass Door with Customizable Hinge and Swing Direction!
          const hingeX = hingeLeft ? -opW_px / 2 : opW_px / 2;
          const leafX = hingeX;
          const leafY = signY * opW_px;

          // Swing arc
          ctx.strokeStyle = isSelected ? '#0284c7' : '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (hingeLeft) {
            ctx.arc(hingeX, 0, opW_px, 0, (signY * Math.PI) / 2, signY < 0);
          } else {
            ctx.arc(hingeX, 0, opW_px, Math.PI, Math.PI - (signY * Math.PI) / 2, signY > 0);
          }
          ctx.stroke();

          // Door leaf panel
          ctx.strokeStyle = isSelected ? '#0284c7' : op.type === 'door-glass' ? '#0284c7' : '#78350f';
          ctx.lineWidth = op.type === 'door-glass' ? 2 : 3.5;
          ctx.beginPath();
          ctx.moveTo(hingeX, 0);
          ctx.lineTo(leafX, leafY);
          ctx.stroke();
        }
      } else {
        // Window (White slot with frame and glass lines)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-opW_px / 2, -(wall.thickness * zoom) / 2 - 1, opW_px, wall.thickness * zoom + 2);

        ctx.strokeStyle = isSelected ? '#0284c7' : '#0284c7';
        ctx.lineWidth = 2;
        ctx.strokeRect(-opW_px / 2, -(wall.thickness * zoom) / 2, opW_px, wall.thickness * zoom);

        if (op.type === 'window-louver') {
          // Louver vent lines
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          for (let lx = -opW_px / 2 + 4; lx < opW_px / 2; lx += 8) {
            ctx.beginPath(); ctx.moveTo(lx, -4); ctx.lineTo(lx + 4, 4); ctx.stroke();
          }
        } else if (op.type === 'window-double') {
          // Double window with center mullion
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-opW_px / 2, 0); ctx.lineTo(opW_px / 2, 0);
          ctx.moveTo(0, -(wall.thickness * zoom) / 2); ctx.lineTo(0, (wall.thickness * zoom) / 2);
          ctx.stroke();
        } else {
          // Standard / Large / Panorama center glass line
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-opW_px / 2, 0);
          ctx.lineTo(opW_px / 2, 0);
          ctx.stroke();
        }
      }

      ctx.restore();
    });

    // 5. Draw Furniture Footprints & Symbols
    plan.furniture.forEach((item) => {
      const isSelected = selectedElement?.type === 'furniture' && selectedElement.id === item.id;
      const center = worldToScreen(item.x, item.y);
      const wPx = item.width * zoom;
      const dPx = item.depth * zoom;

      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate((item.rotation * Math.PI) / 180);

      // Body bounding fill
      ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.35)' : item.color || '#e2e8f0';
      ctx.strokeStyle = isSelected ? '#0284c7' : '#475569';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;

      // Rounded rect
      ctx.beginPath();
      ctx.roundRect(-wPx / 2, -dPx / 2, wPx, dPx, 4);
      ctx.fill();
      ctx.stroke();

      // Internal architectural symbols based on category
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.lineWidth = 1;

      if (item.catalogId.startsWith('bed')) {
        // Pillows
        const pilW = wPx * 0.38;
        const pilH = dPx * 0.22;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-wPx / 2 + 4, -dPx / 2 + 4, pilW, pilH);
        ctx.strokeRect(-wPx / 2 + 4, -dPx / 2 + 4, pilW, pilH);
        if (item.width > 1.2) {
          ctx.fillRect(wPx / 2 - pilW - 4, -dPx / 2 + 4, pilW, pilH);
          ctx.strokeRect(wPx / 2 - pilW - 4, -dPx / 2 + 4, pilW, pilH);
        }
      } else if (item.catalogId.startsWith('sofa')) {
        // Cushions
        ctx.strokeRect(-wPx / 2 + 4, -dPx / 2 + 6, wPx - 8, dPx * 0.3);
      } else if (item.catalogId === 'toilet-closet') {
        // Toilet tank and oval bowl
        ctx.strokeRect(-wPx / 2 + 2, -dPx / 2 + 2, wPx - 4, dPx * 0.35);
        ctx.beginPath();
        ctx.ellipse(0, dPx * 0.15, wPx * 0.35, dPx * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (item.catalogId === 'bathtub-freestanding') {
        ctx.beginPath();
        ctx.ellipse(0, 0, wPx * 0.42, dPx * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Name label
      ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.name, 0, 0);

      // If selected: Draw rotation handle
      if (isSelected) {
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, -dPx / 2);
        ctx.lineTo(0, -dPx / 2 - 20);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(0, -dPx / 2 - 20, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    const wallsForAreaPreview = [...plan.walls];
    if (activeTool === 'wall' && wallStartPoint && distance(wallStartPoint, mouseWorldPos) >= 0.1) {
      wallsForAreaPreview.push({
        id: 'preview-wall',
        start: wallStartPoint,
        end: mouseWorldPos,
        thickness: 0.15,
        height: plan.defaultWallHeight || 2.8,
        material: 'plaster-white',
      });
    }

    for (const face of findEnclosedWallFaces(wallsForAreaPreview)) {
      const alreadyLabeled = plan.rooms.some((room) => {
        const center = calculatePolygonCentroid(room.points);
        return Math.abs(calculatePolygonArea(room.points) - face.area) < 0.05
          && distance(center, face.centroid) < 0.25;
      });
      if (alreadyLabeled) continue;

      const center = worldToScreen(face.centroid.x, face.centroid.y);
      const label = `${face.area.toFixed(1)} m²`;
      ctx.font = '600 11px "JetBrains Mono", monospace';
      const labelWidth = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(8, 145, 178, 0.92)';
      ctx.beginPath();
      ctx.roundRect(center.x - labelWidth / 2, center.y - 11, labelWidth, 22, 7);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, center.x, center.y);
    }

    // 6. Draw Active Wall Drawing Preview
    if (activeTool === 'wall' && wallStartPoint) {
      const s = worldToScreen(wallStartPoint.x, wallStartPoint.y);
      const e = worldToScreen(mouseWorldPos.x, mouseWorldPos.y);
      const wallDist = distance(wallStartPoint, mouseWorldPos);

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Start & End points
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Live measurement badge
      const midX = (s.x + e.x) / 2;
      const midY = (s.y + e.y) / 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(midX - 35, midY - 24, 70, 20);
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatMeters(wallDist), midX, midY - 14);
    }

    if (activeTool === 'wall' && touchWallCursor) {
      ctx.save();
      ctx.strokeStyle = '#0369a1';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(touchWallCursor.x, touchWallCursor.y + 10);
      ctx.lineTo(
        touchWallCursor.x,
        Math.max(touchWallCursor.y + 10, Math.min(touchWallCursor.fingerY - 8, touchWallCursor.y + 28))
      );
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(touchWallCursor.x, touchWallCursor.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(touchWallCursor.x - 12, touchWallCursor.y);
      ctx.lineTo(touchWallCursor.x - 5, touchWallCursor.y);
      ctx.moveTo(touchWallCursor.x + 5, touchWallCursor.y);
      ctx.lineTo(touchWallCursor.x + 12, touchWallCursor.y);
      ctx.moveTo(touchWallCursor.x, touchWallCursor.y - 12);
      ctx.lineTo(touchWallCursor.x, touchWallCursor.y - 5);
      ctx.moveTo(touchWallCursor.x, touchWallCursor.y + 5);
      ctx.lineTo(touchWallCursor.x, touchWallCursor.y + 12);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Draw Active Rect Room Preview
    if (activeTool === 'room-rect' && roomRectStart) {
      const s = worldToScreen(roomRectStart.x, roomRectStart.y);
      const e = worldToScreen(mouseWorldPos.x, mouseWorldPos.y);

      const rX = Math.min(s.x, e.x);
      const rY = Math.min(s.y, e.y);
      const rW = Math.abs(e.x - s.x);
      const rH = Math.abs(e.y - s.y);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(rX, rY, rW, rH);

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(rX, rY, rW, rH);
      ctx.setLineDash([]);

      const widthM = Math.abs(mouseWorldPos.x - roomRectStart.x);
      const heightM = Math.abs(mouseWorldPos.y - roomRectStart.y);
      const areaM = widthM * heightM;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(rX + rW / 2 - 45, rY + rH / 2 - 12, 90, 24);
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${formatMeters(widthM)} × ${formatMeters(heightM)} (${areaM.toFixed(1)}m²)`, rX + rW / 2, rY + rH / 2);
    }

    // 8. Draw Active Furniture Placement Ghost Footprint
    if (activeTool === 'furniture' && selectedCatalogItem) {
      const cur = worldToScreen(mouseWorldPos.x, mouseWorldPos.y);
      const wPx = selectedCatalogItem.width * zoom;
      const dPx = selectedCatalogItem.depth * zoom;

      ctx.save();
      ctx.translate(cur.x, cur.y);

      ctx.fillStyle = 'rgba(14, 165, 233, 0.35)';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.roundRect(-wPx / 2, -dPx / 2, wPx, dPx, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#0284c7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(selectedCatalogItem.name, 0, 0);

      ctx.restore();
    }

    // 9. Draw Measure Tool Line
    if (activeTool === 'measure' && measureStart) {
      const s = worldToScreen(measureStart.x, measureStart.y);
      const e = worldToScreen(mouseWorldPos.x, mouseWorldPos.y);
      const mDist = distance(measureStart, mouseWorldPos);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();

      // Tick marks
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Mid badge
      const midX = (s.x + e.x) / 2;
      const midY = (s.y + e.y) / 2;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(midX - 35, midY - 14, 70, 22);
      ctx.font = '600 12px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatMeters(mDist), midX, midY - 3);
    }
  }, [
    plan,
    zoom,
    pan,
    selectedElement,
    activeTool,
    wallStartPoint,
    mouseWorldPos,
    touchWallCursor,
    referenceImageReady,
    plan.referenceImage,
    recognizedPlan,
    roomRectStart,
    selectedCatalogItem,
    measureStart,
    screenToWorld,
    worldToScreen,
  ]);

  const getSnappedWorldPos = (screenX: number, screenY: number): Point => {
    let worldPos = screenToWorld(screenX, screenY);

    if (snapToGridEnabled) {
      worldPos = snapPointToGrid(worldPos, 0.25);
    }

    if (activeTool === 'wall' && wallStartPoint && snapAngleEnabled) {
      worldPos = snapAngle(wallStartPoint, worldPos, 45, 8);
    }

    if (activeTool === 'wall') {
      worldPos = findSnapPoint(worldPos, 0.35) || worldPos;
    }

    return worldPos;
  };

  const getTouchCursorPosition = (screenX: number, screenY: number, pointerType: string) => {
    if (pointerType !== 'touch' || activeTool !== 'wall') {
      return { x: screenX, y: screenY };
    }
    return { x: screenX, y: Math.max(12, screenY - 48) };
  };

  const addWallWithConnections = (wall: Wall) => {
    const connected = splitWallsAtIntersections([...plan.walls, wall], plan.openings);
    onUpdatePlan({
      ...plan,
      walls: connected.walls,
      openings: connected.openings,
    });
    setDrawnWallIds((ids) => [...ids, wall.id]);
  };

  const handleReferenceImageFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setRecognitionError('Pilih berkas gambar seperti JPG, PNG, atau WEBP.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setRecognitionError('Ukuran gambar maksimal 20 MB.');
      return;
    }

    try {
      const sourceUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Berkas gambar tidak dapat dibaca.'));
        reader.onerror = () => reject(new Error('Berkas gambar tidak dapat dibaca.'));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const loadedImage = new Image();
        loadedImage.onload = () => resolve(loadedImage);
        loadedImage.onerror = () => reject(new Error('Format gambar tidak dapat dibuka.'));
        loadedImage.src = sourceUrl;
      });

      const maxDimension = 1800;
      const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const resized = document.createElement('canvas');
      resized.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      resized.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = resized.getContext('2d');
      if (!context) throw new Error('Gambar tidak dapat diproses di perangkat ini.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, resized.width, resized.height);
      context.drawImage(image, 0, 0, resized.width, resized.height);

      const canvas = canvasRef.current;
      const center = canvas
        ? screenToWorld(canvas.width / 2, canvas.height / 2)
        : { x: 0, y: 0 };
      const initialWidthMeters = canvas
        ? Math.max(1, Math.min(20, canvas.width * 0.7 / zoom))
        : 8;
      const referenceImage: PlanReferenceImage = {
        dataUrl: resized.toDataURL('image/jpeg', 0.78),
        widthMeters: initialWidthMeters,
        opacity: 0.45,
        center,
      };
      onUpdatePlan({ ...plan, referenceImage });
      setRecognizedPlan(null);
      setRecognitionError('');
      setIsReferencePanelOpen(true);
    } catch (error) {
      setRecognitionError(error instanceof Error ? error.message : 'Gambar gagal dimuat.');
    }
  };

  const handleRecognizePlan = async () => {
    const reference = plan.referenceImage;
    const image = referenceImageRef.current;
    if (!reference || !image) return;

    setIsRecognizingPlan(true);
    setRecognitionError('');
    setRecognizedPlan(null);
    try {
      const apiBase = import.meta.env.VITE_PLAN_API_URL?.replace(/\/$/, '') ?? '';
      const response = await fetch(`${apiBase}/api/recognize-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: reference.dataUrl }),
      });
      const result = await response.json() as {
        error?: string;
        walls?: { start: Point; end: Point }[];
        rooms?: { name: string; points: Point[] }[];
      };
      if (!response.ok) throw new Error(result.error || 'Gagal mengenali denah dari gambar.');
      if (!result.walls?.length) throw new Error('Tidak ditemukan garis dinding yang valid.');

      const imageHeightMeters = reference.widthMeters * image.naturalHeight / image.naturalWidth;
      const imageLeft = reference.center.x - reference.widthMeters / 2;
      const imageTop = reference.center.y - imageHeightMeters / 2;
      const toWorld = (point: Point): Point => ({
        x: imageLeft + point.x * reference.widthMeters,
        y: imageTop + point.y * imageHeightMeters,
      });
      const walls: Wall[] = result.walls.map((wall, index) => ({
        id: `scan_${Date.now()}_${index}`,
        start: toWorld(wall.start),
        end: toWorld(wall.end),
        thickness: 0.15,
        height: plan.defaultWallHeight || 2.8,
        material: 'plaster-white',
      }));
      const rooms: Room[] = (result.rooms ?? []).map((room, index) => ({
        id: `scan_room_${Date.now()}_${index}`,
        name: room.name || `Ruangan ${index + 1}`,
        points: room.points.map(toWorld),
        floorMaterial: 'tile-ceramic',
      }));
      setRecognizedPlan({ walls, rooms });
    } catch (error) {
      setRecognitionError(error instanceof Error ? error.message : 'Scan denah gagal.');
    } finally {
      setIsRecognizingPlan(false);
    }
  };

  const handleApplyRecognizedPlan = () => {
    if (!recognizedPlan) return;
    const accepted = window.confirm(
      'Ganti semua dinding, pintu/jendela, dan ruangan pada lantai ini dengan hasil scan? Perabot tetap dipertahankan. Anda dapat memakai Undo jika ingin kembali.'
    );
    if (!accepted) return;

    const connected = splitWallsAtIntersections(recognizedPlan.walls, []);
    onUpdatePlan({
      ...plan,
      walls: connected.walls,
      openings: [],
      rooms: recognizedPlan.rooms,
    });
    setRecognizedPlan(null);
  };

  const beginPinch = () => {
    const pointers = [...touchPointersRef.current.values()];
    if (pointers.length < 2) return;

    const [first, second] = pointers;
    const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const pinchDistance = distance(first, second);

    pinchStartRef.current = {
      distance: Math.max(pinchDistance, 1),
      zoom,
      worldAnchor: screenToWorld(midpoint.x, midpoint.y),
    };
    wallTouchStartRef.current = null;
    setIsPanning(false);
    setIsDraggingSelected(false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const cursor = getTouchCursorPosition(screenX, screenY, e.pointerType);

    if (e.pointerType === 'touch' && touchPointersRef.current.has(e.pointerId)) {
      e.preventDefault();
      touchPointersRef.current.set(e.pointerId, { x: screenX, y: screenY });
      if (touchPointersRef.current.size >= 2 && pinchStartRef.current) {
        const [first, second] = [...touchPointersRef.current.values()];
        const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
        const nextZoom = Math.max(
          8,
          Math.min(180, pinchStartRef.current.zoom * distance(first, second) / pinchStartRef.current.distance)
        );
        setZoom(nextZoom);
        setPan({
          x: midpoint.x - pinchStartRef.current.worldAnchor.x * nextZoom,
          y: midpoint.y - pinchStartRef.current.worldAnchor.y * nextZoom,
        });
        return;
      }
    }

    if (isPanning) {
      setPan({
        x: screenX - panStartRef.current.x,
        y: screenY - panStartRef.current.y,
      });
      return;
    }

    const worldPos = screenToWorld(cursor.x, cursor.y);
    setMouseWorldPos(worldPos);
    if (e.pointerType === 'touch' && activeTool === 'wall') {
      setTouchWallCursor({ ...cursor, fingerY: screenY });
    }

    if (e.pointerType === 'touch' && e.buttons > 0 && activeTool === 'wall' && wallTouchStartRef.current) {
      return;
    }

    if (isDraggingSelected && selectedElement) {
      const dragOrigin = originalPosRef.current;
      if (!dragOrigin) return;
      let dx = worldPos.x - dragStartWorldRef.current.x;
      let dy = worldPos.y - dragStartWorldRef.current.y;
      if (dragOrigin.type === 'vertex') {
        let nextVertex = { ...worldPos };
        if (snapToGridEnabled) {
          nextVertex = {
            x: dragOrigin.point.x + Math.round((nextVertex.x - dragOrigin.point.x) / 0.25) * 0.25,
            y: dragOrigin.point.y + Math.round((nextVertex.y - dragOrigin.point.y) / 0.25) * 0.25,
          };
        }
        nextVertex = findSnapVertex(nextVertex, 0.25, dragOrigin.point) || nextVertex;
        dx = nextVertex.x - dragOrigin.point.x;
        dy = nextVertex.y - dragOrigin.point.y;
      } else if (snapToGridEnabled) {
        dx = Math.round(dx / 0.25) * 0.25;
        dy = Math.round(dy / 0.25) * 0.25;
      }

      if (selectedElement.type === 'furniture' && dragOrigin.type === 'furniture') {
        const updated = plan.furniture.map((f) => {
          if (f.id === selectedElement.id) {
            return {
              ...f,
              x: dragOrigin.x + dx,
              y: dragOrigin.y + dy,
            };
          }
          return f;
        });
        onUpdatePlan({ ...plan, furniture: updated });
      } else if (selectedElement.type === 'wall' && dragOrigin.type === 'wall') {
        const movedStart = { x: dragOrigin.start.x + dx, y: dragOrigin.start.y + dy };
        const movedEnd = { x: dragOrigin.end.x + dx, y: dragOrigin.end.y + dy };
        const moveMatchingEndpoint = (point: Point): Point => {
          if (distance(point, dragOrigin.start) < 0.001) return movedStart;
          if (distance(point, dragOrigin.end) < 0.001) return movedEnd;
          return point;
        };
        const walls = dragOrigin.walls.map((wall) => ({
          ...wall,
          start: moveMatchingEndpoint(wall.start),
          end: moveMatchingEndpoint(wall.end),
        }));
        const rooms = dragOrigin.rooms.map((room) => ({
          ...room,
          points: room.points.map(moveMatchingEndpoint),
        }));
        onUpdatePlan({ ...plan, walls, rooms });
      } else if (selectedElement.type === 'wall' && dragOrigin.type === 'vertex') {
        const movedPoint = { x: dragOrigin.point.x + dx, y: dragOrigin.point.y + dy };
        const moveMatchingEndpoint = (point: Point): Point =>
          distance(point, dragOrigin.point) < 0.001 ? movedPoint : point;
        const walls = dragOrigin.walls.map((wall) => ({
          ...wall,
          start: moveMatchingEndpoint(wall.start),
          end: moveMatchingEndpoint(wall.end),
        }));
        const rooms = dragOrigin.rooms.map((room) => ({
          ...room,
          points: room.points.map(moveMatchingEndpoint),
        }));
        onUpdatePlan({ ...plan, walls, rooms });
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const cursor = getTouchCursorPosition(screenX, screenY, e.pointerType);
    const worldPos = activeTool === 'select'
      ? screenToWorld(screenX, screenY)
      : getSnappedWorldPos(cursor.x, cursor.y);

    if (e.pointerType === 'touch') {
      e.preventDefault();
      touchPointersRef.current.set(e.pointerId, { x: screenX, y: screenY });
      if (touchPointersRef.current.size >= 2) {
        beginPinch();
        return;
      }
    }

    setMouseWorldPos(worldPos);

    if (e.pointerType === 'touch' && activeTool === 'wall') {
      setTouchWallCursor({ ...cursor, fingerY: screenY });
      const anchor = wallStartPoint;
      if (!anchor) setWallStartPoint(worldPos);
      wallTouchStartRef.current = { point: worldPos, anchor, screenX, screenY };
      return;
    }

    handleMouseDown(e, worldPos);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasPinching = pinchStartRef.current !== null;
    const wasDraggingVertex = originalPosRef.current?.type === 'vertex';
    if (e.pointerType === 'touch') {
      touchPointersRef.current.delete(e.pointerId);
      if (touchPointersRef.current.size < 2) pinchStartRef.current = null;
      setTouchWallCursor(null);
    }
    if (wasPinching) {
      handleMouseUp();
      return;
    }

    const touchStart = wallTouchStartRef.current;
    if (touchStart && activeTool === 'wall') {
      wallTouchStartRef.current = null;
      const rect = e.currentTarget.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const cursor = getTouchCursorPosition(screenX, screenY, e.pointerType);
      const endPoint = getSnappedWorldPos(cursor.x, cursor.y);
      const dragDistance = Math.hypot(screenX - touchStart.screenX, screenY - touchStart.screenY);
      const startPoint = touchStart.anchor || touchStart.point;

      if (touchStart.anchor || dragDistance >= 8) {
        if (distance(startPoint, endPoint) >= 0.3) {
          const wallId = `wall_${Date.now()}`;
          const newWall: Wall = {
            id: wallId,
            start: startPoint,
            end: endPoint,
            thickness: 0.15,
            height: plan.defaultWallHeight || 2.8,
            material: 'plaster-white',
          };
          addWallWithConnections(newWall);
          setWallStartPoint(endPoint);
          setMouseWorldPos(endPoint);
        }
      }
    }

    if (wasDraggingVertex) {
      const connected = splitWallsAtIntersections(plan.walls, plan.openings);
      if (connected.walls.length !== plan.walls.length) {
        onUpdatePlan({
          ...plan,
          walls: connected.walls,
          openings: connected.openings,
        });
      }
    }

    handleMouseUp();
  };

  // Mouse Down Event Handler
  const handleMouseDown = (e: React.PointerEvent<HTMLCanvasElement>, pointerWorldPos: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Middle click or space+click for Pan
    if (e.button === 1 || activeTool === 'pan' || e.shiftKey) {
      setIsPanning(true);
      panStartRef.current = { x: screenX - pan.x, y: screenY - pan.y };
      return;
    }

    const worldPos = pointerWorldPos;

    // --- TOOL: SELECT ---
    if (activeTool === 'select') {
      let nearestEndpoint: { wall: Wall; point: Point } | null = null;
      let endpointDistance = Math.max(0.2, 12 / zoom);
      for (const wall of plan.walls) {
        for (const point of [wall.start, wall.end]) {
          const currentDistance = distance(worldPos, point);
          if (currentDistance < endpointDistance) {
            nearestEndpoint = { wall, point };
            endpointDistance = currentDistance;
          }
        }
      }
      if (nearestEndpoint) {
        onSelectElement({ type: 'wall', id: nearestEndpoint.wall.id });
        setIsDraggingSelected(true);
        dragStartWorldRef.current = { ...nearestEndpoint.point };
        originalPosRef.current = {
          type: 'vertex',
          point: { ...nearestEndpoint.point },
          walls: plan.walls,
          rooms: plan.rooms,
        };
        return;
      }

      // 1. Check Furniture hit
      let hitFurniture = false;
      for (const item of plan.furniture) {
        const halfW = item.width / 2;
        const halfD = item.depth / 2;
        if (
          worldPos.x >= item.x - halfW &&
          worldPos.x <= item.x + halfW &&
          worldPos.y >= item.y - halfD &&
          worldPos.y <= item.y + halfD
        ) {
          onSelectElement({ type: 'furniture', id: item.id });
          setIsDraggingSelected(true);
          dragStartWorldRef.current = { ...worldPos };
          originalPosRef.current = { type: 'furniture', x: item.x, y: item.y };
          hitFurniture = true;
          break;
        }
      }
      if (hitFurniture) return;

      // 2. Check Opening hit
      let hitOpening = false;
      for (const op of plan.openings) {
        const wall = plan.walls.find((w) => w.id === op.wallId);
        if (!wall) continue;
        const wallLen = distance(wall.start, wall.end);
        const angle = angleBetween(wall.start, wall.end);
        const opX = wall.start.x + Math.cos(angle) * (op.position * wallLen);
        const opY = wall.start.y + Math.sin(angle) * (op.position * wallLen);
        if (distance(worldPos, { x: opX, y: opY }) <= op.width / 2 + 0.2) {
          onSelectElement({ type: 'opening', id: op.id });
          hitOpening = true;
          break;
        }
      }
      if (hitOpening) return;

      // 3. Check Wall hit
      let hitWall = false;
      for (const wall of plan.walls) {
        const proj = closestPointOnSegment(worldPos, wall.start, wall.end);
        if (proj.distance <= wall.thickness / 2 + 0.25) {
          onSelectElement({ type: 'wall', id: wall.id });
          setIsDraggingSelected(true);
          dragStartWorldRef.current = { ...worldPos };
          originalPosRef.current = {
            type: 'wall',
            start: { ...wall.start },
            end: { ...wall.end },
            walls: plan.walls,
            rooms: plan.rooms,
          };
          hitWall = true;
          break;
        }
      }
      if (hitWall) return;

      // 4. Check Room hit
      for (const room of plan.rooms) {
        // Simple bounding check
        const center = calculateCentroid(room.points);
        if (distance(worldPos, center) < 1.5) {
          onSelectElement({ type: 'room', id: room.id });
          return;
        }
      }

      // Deselect if clicked empty canvas
      onSelectElement(null);
    }

    // --- TOOL: WALL ---
    else if (activeTool === 'wall') {
      if (!wallStartPoint) {
        setWallStartPoint(worldPos);
      } else {
        const wallDist = distance(wallStartPoint, worldPos);
        if (wallDist >= 0.3) {
          const wallId = `wall_${Date.now()}`;
          const newWall: Wall = {
            id: wallId,
            start: wallStartPoint,
            end: worldPos,
            thickness: 0.15,
            height: plan.defaultWallHeight || 2.8,
            material: 'plaster-white',
          };
          addWallWithConnections(newWall);
          // Continue wall chain from new end
          setWallStartPoint(worldPos);
        }
      }
    }

    // --- TOOL: ROOM RECT ---
    else if (activeTool === 'room-rect') {
      if (!roomRectStart) {
        setRoomRectStart(worldPos);
      } else {
        const p1 = roomRectStart;
        const p2 = worldPos;
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        if (maxX - minX >= 1.0 && maxY - minY >= 1.0) {
          // Generate 4 perimeter walls
          const w1: Wall = { id: `w_${Date.now()}_1`, start: { x: minX, y: minY }, end: { x: maxX, y: minY }, thickness: 0.15, height: plan.defaultWallHeight, material: 'plaster-white' };
          const w2: Wall = { id: `w_${Date.now()}_2`, start: { x: maxX, y: minY }, end: { x: maxX, y: maxY }, thickness: 0.15, height: plan.defaultWallHeight, material: 'plaster-white' };
          const w3: Wall = { id: `w_${Date.now()}_3`, start: { x: maxX, y: maxY }, end: { x: minX, y: maxY }, thickness: 0.15, height: plan.defaultWallHeight, material: 'plaster-white' };
          const w4: Wall = { id: `w_${Date.now()}_4`, start: { x: minX, y: maxY }, end: { x: minX, y: minY }, thickness: 0.15, height: plan.defaultWallHeight, material: 'plaster-white' };

          // Generate floor room
          const newRoom: Room = {
            id: `room_${Date.now()}`,
            name: `Ruangan ${plan.rooms.length + 1}`,
            floorMaterial: 'parquet-oak',
            points: [
              { x: minX, y: minY },
              { x: maxX, y: minY },
              { x: maxX, y: maxY },
              { x: minX, y: maxY },
            ],
          };

          onUpdatePlan({
            ...plan,
            walls: [...plan.walls, w1, w2, w3, w4],
            rooms: [...plan.rooms, newRoom],
          });
        }
        setRoomRectStart(null);
      }
    }

    // --- TOOL: DOOR / WINDOW ---
    else if (activeTool === 'door' || activeTool === 'window') {
      // Find closest wall to insert opening into
      let nearestWall: Wall | null = null;
      let minProjDist = 0.6; // meter snapping tolerance
      let bestT = 0.5;

      plan.walls.forEach((wall) => {
        const proj = closestPointOnSegment(worldPos, wall.start, wall.end);
        if (proj.distance < minProjDist && proj.t > 0.08 && proj.t < 0.92) {
          minProjDist = proj.distance;
          nearestWall = wall;
          bestT = proj.t;
        }
      });

      if (nearestWall) {
        const isDoor = activeTool === 'door';
        let width = 0.9;
        let height = 2.1;
        let elevation = 0;

        if (isDoor) {
          if (activeDoorType === 'door-double') { width = 1.5; height = 2.2; }
          else if (activeDoorType === 'door-sliding') { width = 1.8; height = 2.2; }
          else if (activeDoorType === 'door-bifold') { width = 2.4; height = 2.2; }
          else if (activeDoorType === 'door-garage') { width = 2.8; height = 2.4; }
          else if (activeDoorType === 'door-glass') { width = 0.9; height = 2.2; }
          else { width = 0.9; height = 2.1; }
        } else {
          if (activeWindowType === 'window-single') { width = 0.8; height = 1.3; elevation = 0.9; }
          else if (activeWindowType === 'window-double') { width = 1.4; height = 1.4; elevation = 0.8; }
          else if (activeWindowType === 'window-sliding') { width = 1.6; height = 1.3; elevation = 0.9; }
          else if (activeWindowType === 'window-large') { width = 2.0; height = 1.6; elevation = 0.6; }
          else if (activeWindowType === 'window-louver') { width = 0.6; height = 0.5; elevation = 2.0; }
          else if (activeWindowType === 'window-panorama') { width = 2.4; height = 2.4; elevation = 0.1; }
        }

        const newOp: Opening = {
          id: `op_${Date.now()}`,
          wallId: (nearestWall as Wall).id,
          type: isDoor ? activeDoorType : activeWindowType,
          position: bestT,
          width,
          height,
          elevation,
          hingeSide: 'left',
          swingDirection: 'inward',
        };

        onUpdatePlan({
          ...plan,
          openings: [...plan.openings, newOp],
        });
        onSelectElement({ type: 'opening', id: newOp.id });
      }
    }

    // --- TOOL: FURNITURE PLACEMENT ---
    else if (activeTool === 'furniture' && selectedCatalogItem) {
      const newItem: FurnitureItem = {
        id: `f_${Date.now()}`,
        catalogId: selectedCatalogItem.id,
        name: selectedCatalogItem.name,
        category: selectedCatalogItem.category,
        x: worldPos.x,
        y: worldPos.y,
        rotation: 0,
        width: selectedCatalogItem.width,
        depth: selectedCatalogItem.depth,
        height: selectedCatalogItem.height,
        color: selectedCatalogItem.defaultColor,
      };

      onUpdatePlan({
        ...plan,
        furniture: [...plan.furniture, newItem],
      });
      onSelectElement({ type: 'furniture', id: newItem.id });
    }

    // --- TOOL: MEASURE ---
    else if (activeTool === 'measure') {
      if (!measureStart) {
        setMeasureStart(worldPos);
      } else {
        setMeasureStart(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingSelected(false);
    originalPosRef.current = null;
  };

  // Zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const nextZoom = Math.max(8, Math.min(180, zoom * zoomFactor));
    setZoom(nextZoom);
    setPan({
      x: e.clientX - rect.left - anchor.x * nextZoom,
      y: e.clientY - rect.top - anchor.y * nextZoom,
    });
  };

  // Double Click to finish wall drawing chain
  const handleDoubleClick = () => {
    if (activeTool === 'wall') {
      setWallStartPoint(null);
    }
  };

  // Rotate selected furniture by 45 degrees
  const handleRotateSelected = () => {
    if (!selectedElement || selectedElement.type !== 'furniture') return;
    const updated = plan.furniture.map((f) => {
      if (f.id === selectedElement.id) {
        return { ...f, rotation: (f.rotation + 45) % 360 };
      }
      return f;
    });
    onUpdatePlan({ ...plan, furniture: updated });
  };

  // Duplicate selected furniture
  const handleDuplicateSelected = () => {
    if (!selectedElement || selectedElement.type !== 'furniture') return;
    const item = plan.furniture.find((f) => f.id === selectedElement.id);
    if (!item) return;

    const dup: FurnitureItem = {
      ...item,
      id: `f_${Date.now()}`,
      x: item.x + 0.5,
      y: item.y + 0.5,
    };
    onUpdatePlan({
      ...plan,
      furniture: [...plan.furniture, dup],
    });
    onSelectElement({ type: 'furniture', id: dup.id });
  };

  // Delete selected element
  const handleDeleteSelected = () => {
    if (!selectedElement) return;

    if (selectedElement.type === 'furniture') {
      onUpdatePlan({
        ...plan,
        furniture: plan.furniture.filter((f) => f.id !== selectedElement.id),
      });
    } else if (selectedElement.type === 'wall') {
      onUpdatePlan({
        ...plan,
        walls: plan.walls.filter((w) => w.id !== selectedElement.id),
        openings: plan.openings.filter((o) => o.wallId !== selectedElement.id),
      });
    } else if (selectedElement.type === 'opening') {
      onUpdatePlan({
        ...plan,
        openings: plan.openings.filter((o) => o.id !== selectedElement.id),
      });
    } else if (selectedElement.type === 'room') {
      onUpdatePlan({
        ...plan,
        rooms: plan.rooms.filter((r) => r.id !== selectedElement.id),
      });
    }

    onSelectElement(null);
  };

  const handleDeleteLastDrawnWall = () => {
    const lastWallId = [...drawnWallIds].reverse().find((id) =>
      plan.walls.some((wall) => wall.id === id)
    );
    if (!lastWallId) {
      setDrawnWallIds([]);
      return;
    }

    const wallToDelete = plan.walls.find((wall) => wall.id === lastWallId);
    if (!wallToDelete) return;

    onUpdatePlan({
      ...plan,
      walls: plan.walls.filter((wall) => wall.id !== lastWallId),
      openings: plan.openings.filter((opening) => opening.wallId !== lastWallId),
    });
    setDrawnWallIds((ids) => ids.filter((id) => id !== lastWallId));
    setWallStartPoint(wallToDelete.start);
    if (selectedElement?.type === 'wall' && selectedElement.id === lastWallId) {
      onSelectElement(null);
    }
  };

  // Reset / Fit to center
  const handleFitView = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const points = [
      ...plan.walls.flatMap((wall) => [wall.start, wall.end]),
      ...plan.rooms.flatMap((room) => room.points),
      ...plan.furniture.flatMap((item) => [
        { x: item.x - item.width / 2, y: item.y - item.depth / 2 },
        { x: item.x + item.width / 2, y: item.y + item.depth / 2 },
      ]),
    ];
    if (!points.length) points.push({ x: -4, y: -4 }, { x: 4, y: 4 });

    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);
    const nextZoom = Math.max(8, Math.min(180, (canvas.width - 64) / width, (canvas.height - 96) / height));

    setZoom(nextZoom);
    setPan({
      x: (canvas.width - width * nextZoom) / 2 - minX * nextZoom,
      y: (canvas.height - height * nextZoom) / 2 - minY * nextZoom,
    });
  };
  fitViewRef.current = handleFitView;

  useEffect(() => {
    if (hasAutoFittedRef.current) handleFitView();
  }, [plan.activeFloorId]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent deleting if typing in input
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
        handleDeleteSelected();
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotateSelected();
      } else if (e.key === 'Escape') {
        setWallStartPoint(null);
        setRoomRectStart(null);
        setMeasureStart(null);
        onSelectElement(null);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  return (
    <div ref={containerRef} className={`relative w-full h-full overflow-hidden bg-slate-100 ${className}`}>
      {/* 2D Canvas */}
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerDown={(e) => {
          if (e.nativeEvent.isTrusted) {
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          handlePointerDown(e);
        }}
        onPointerUp={handlePointerUp}
        onPointerCancel={(e) => {
          touchPointersRef.current.delete(e.pointerId);
          pinchStartRef.current = null;
          wallTouchStartRef.current = null;
          setTouchWallCursor(null);
          handleMouseUp();
        }}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className="floor-plan-canvas w-full h-full cursor-crosshair active:cursor-grabbing block"
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleReferenceImageFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void handleReferenceImageFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      <div className="absolute left-4 top-14 z-20">
        <button
          type="button"
          onClick={() => setIsReferencePanelOpen((open) => !open)}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-md hover:bg-cyan-50"
        >
          <ImagePlus className="h-4 w-4 text-cyan-700" />
          {plan.referenceImage ? 'Atur gambar denah' : 'Dari foto / gambar'}
        </button>

        {isReferencePanelOpen && (
          <div className="mt-2 w-72 max-h-[min(70vh,34rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-md">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900">Foto / gambar denah</span>
              <button
                type="button"
                aria-label="Tutup panel gambar denah"
                onClick={() => setIsReferencePanelOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ImagePlus className="h-4 w-4" /> Unggah gambar
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Camera className="h-4 w-4" /> Foto langsung
              </button>
            </div>

            {plan.referenceImage && (
              <>
                <label className="mt-3 block font-semibold text-slate-700">
                  Lebar gambar pada denah (meter)
                  <input
                    type="number"
                    min="0.5"
                    max="100"
                    step="0.1"
                    value={plan.referenceImage.widthMeters}
                    onChange={(event) => {
                      const widthMeters = Number(event.target.value);
                      if (Number.isFinite(widthMeters) && widthMeters >= 0.5 && widthMeters <= 100) {
                        onUpdatePlan({
                          ...plan,
                          referenceImage: { ...plan.referenceImage!, widthMeters },
                        });
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono"
                  />
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(['x', 'y'] as const).map((axis) => (
                    <label key={axis} className="font-semibold text-slate-700">
                      Posisi tengah {axis.toUpperCase()} (m)
                      <input
                        type="number"
                        step="0.1"
                        value={Number(plan.referenceImage!.center[axis].toFixed(2))}
                        onChange={(event) => {
                          const coordinate = Number(event.target.value);
                          if (Number.isFinite(coordinate)) {
                            onUpdatePlan({
                              ...plan,
                              referenceImage: {
                                ...plan.referenceImage!,
                                center: { ...plan.referenceImage!.center, [axis]: coordinate },
                              },
                            });
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 font-mono"
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-3 block font-semibold text-slate-700">
                  Transparansi gambar: {Math.round(plan.referenceImage.opacity * 100)}%
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={plan.referenceImage.opacity}
                    onChange={(event) => onUpdatePlan({
                      ...plan,
                      referenceImage: { ...plan.referenceImage!, opacity: Number(event.target.value) },
                    })}
                    className="mt-1 w-full accent-cyan-600"
                  />
                </label>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  Atur lebar berdasarkan ukuran nyata yang diketahui. Gambar tersimpan pada lantai ini sebagai alas untuk ditrace.
                </p>
                <button
                  type="button"
                  disabled={isRecognizingPlan || !referenceImageReady}
                  onClick={() => void handleRecognizePlan()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-3 py-2.5 font-semibold text-white hover:bg-cyan-800 disabled:cursor-wait disabled:opacity-60"
                >
                  <ScanLine className="h-4 w-4" />
                  {isRecognizingPlan ? 'Mengenali denah…' : 'Kenali otomatis dengan AI'}
                </button>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                  Gambar akan dikirim ke layanan AI Gemini pada server. Hasilnya ditampilkan untuk ditinjau sebelum diterapkan.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onUpdatePlan({ ...plan, referenceImage: undefined });
                    setRecognizedPlan(null);
                    setRecognitionError('');
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus gambar alas
                </button>
              </>
            )}

            {recognizedPlan && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                <p className="font-semibold text-emerald-900">
                  Pratinjau: {recognizedPlan.walls.length} dinding, {recognizedPlan.rooms.length} ruangan
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleApplyRecognizedPlan}
                    className="rounded-lg bg-emerald-700 px-2 py-2 font-semibold text-white hover:bg-emerald-800"
                  >
                    Terapkan scan
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecognizedPlan(null)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Buang hasil
                  </button>
                </div>
              </div>
            )}

            {recognitionError && (
              <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-rose-700">
                {recognitionError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Top Floating Helper Tool Banner */}
      <div className="canvas-helper-banner absolute top-4 left-4 z-10 flex items-center gap-2">
        <div className="canvas-helper-message bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm flex items-center gap-2 text-slate-700">
          <span className="font-semibold text-slate-900">Alat Aktif:</span>
          <span className="text-cyan-700 font-medium">
            {activeTool === 'select' && 'Pilih objek; tarik ujung dinding untuk mengedit'}
            {activeTool === 'wall' && (wallStartPoint
              ? 'Geser atau ketuk titik berikutnya; kursor sentuh 48 px di atas jari'
              : 'Ketuk titik awal, lalu geser; kursor sentuh 48 px di atas jari')}
            {activeTool === 'room-rect' && (roomRectStart ? 'Tarik & klik sudut seberang ruangan' : 'Klik titik awal sudut ruangan kotak')}
            {activeTool === 'door' && 'Arahkan kursor & klik pada dinding untuk menempatkan Pintu'}
            {activeTool === 'window' && 'Arahkan kursor & klik pada dinding untuk menempatkan Jendela'}
            {activeTool === 'furniture' && `Klik kanvas untuk meletakkan ${selectedCatalogItem?.name || 'Perabotan'}`}
            {activeTool === 'measure' && (measureStart ? 'Klik titik kedua untuk melihat jarak' : 'Klik titik pertama pengukur')}
            {activeTool === 'pan' && 'Klik & geser untuk menggeser denah'}
          </span>
        </div>

        {activeTool === 'wall' && (wallStartPoint || drawnWallIds.length > 0) && (
          <div className="absolute top-14 right-4 z-10 flex items-center gap-1.5">
            {drawnWallIds.some((id) => plan.walls.some((wall) => wall.id === id)) && (
              <button
                onClick={handleDeleteLastDrawnWall}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white/95 px-3 py-2 text-xs font-semibold text-rose-700 shadow-md hover:bg-rose-50"
                title="Hapus garis dinding terakhir yang dibuat"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus garis terakhir
              </button>
            )}
            {wallStartPoint && (
              <button
                onClick={() => {
                  setWallStartPoint(null);
                  wallTouchStartRef.current = null;
                }}
                className="rounded-xl border border-cyan-200 bg-white/95 px-3 py-2 text-xs font-semibold text-cyan-800 shadow-md"
              >
                Selesai menggambar
              </button>
            )}
          </div>
        )}

        {/* Live Coordinate Display */}
        <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-500 shadow-sm hidden sm:block">
          X: {mouseWorldPos.x.toFixed(2)}m | Y: {mouseWorldPos.y.toFixed(2)}m
        </div>
      </div>

      {/* Floating Sub-Toolbar for Door Types */}
      {activeTool === 'door' && (
        <div className="absolute top-14 left-4 z-10 flex flex-wrap items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-md text-[11px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Pilihan Pintu:</span>
          {[
            { id: 'door-single', label: 'Panel Tunggal' },
            { id: 'door-glass', label: 'Kaca Modern' },
            { id: 'door-double', label: 'Ganda / Kupu Tarung' },
            { id: 'door-sliding', label: 'Geser / Sliding' },
            { id: 'door-bifold', label: 'Lipat / Bifold' },
            { id: 'door-garage', label: 'Garasi / Rolling' },
          ].map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveDoorType(d.id as OpeningType)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activeDoorType === d.id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* Floating Sub-Toolbar for Window Types */}
      {activeTool === 'window' && (
        <div className="absolute top-14 left-4 z-10 flex flex-wrap items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-md text-[11px]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Pilihan Jendela:</span>
          {[
            { id: 'window-single', label: 'Casement 1 Daun' },
            { id: 'window-double', label: 'Casement 2 Daun' },
            { id: 'window-sliding', label: 'Geser Horizontal' },
            { id: 'window-large', label: 'Kaca Panorama' },
            { id: 'window-louver', label: 'Boven / Ventilasi' },
            { id: 'window-panorama', label: 'Lantai-ke-Plafon' },
          ].map((w) => (
            <button
              key={w.id}
              onClick={() => setActiveWindowType(w.id as OpeningType)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activeWindowType === w.id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}

      {/* Floating Selected Object Quick Action Toolbar */}
      {selectedElement && (
        <div className="canvas-floating-actions absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-lg text-xs">
          {selectedElement.type === 'furniture' && (
            <>
              <button
                onClick={handleRotateSelected}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition-colors cursor-pointer"
                title="Putar 45° (R)"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Putar 45°</span>
              </button>
              <button
                onClick={handleDuplicateSelected}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition-colors cursor-pointer"
                title="Duplikat"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin</span>
              </button>
            </>
          )}

          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-medium transition-colors cursor-pointer"
            title="Hapus (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus</span>
          </button>
        </div>
      )}

      {/* Bottom Floating Canvas Utilities (Zoom, Snapping, Fit) */}
      <div className="canvas-zoom-controls absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-md text-xs">
        <button
          onClick={() => setSnapToGridEnabled(!snapToGridEnabled)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
            snapToGridEnabled ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Snap ke Grid 0.25m"
        >
          <Magnet className="w-3.5 h-3.5" />
          <span>Snap {snapToGridEnabled ? 'ON' : 'OFF'}</span>
        </button>

        <div className="h-4 w-px bg-slate-200" />

        <button
          onClick={() => setZoom((z) => Math.max(8, z * 0.85))}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Perkecil (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="font-mono text-slate-500 text-[11px] min-w-10 text-center">
          {Math.round((zoom / 55) * 100)}%
        </span>

        <button
          onClick={() => setZoom((z) => Math.min(180, z * 1.15))}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Perbesar (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200" />

        <button
          onClick={handleFitView}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Reset Sudut Pandang"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
