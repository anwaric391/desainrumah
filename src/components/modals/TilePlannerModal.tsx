/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Room, HousePlan, TileConfig, TilePattern, Point } from '../../types/house';
import {
  calculatePolygonArea,
  calculatePolygonCentroid,
  distance,
  findEnclosedWallFaces,
  isPointInPolygon,
} from '../../utils/geometry';
import { 
  X, 
  Grid3X3, 
  Check, 
  AlertTriangle, 
  Layers, 
  Move, 
  Info, 
  Maximize2, 
  Plus, 
  Sparkles,
  Package,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface TilePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: HousePlan;
  onUpdatePlan: (plan: HousePlan) => void;
}

const POPULAR_SIZES = [
  { label: '60 × 60 cm (Granit Modern)', w: 60, l: 60, piecesPerBox: 4 }, // 1.44 m2
  { label: '50 × 50 cm (Keramik Ruang Tamu)', w: 50, l: 50, piecesPerBox: 4 }, // 1.0 m2
  { label: '40 × 40 cm (Keramik Standar)', w: 40, l: 40, piecesPerBox: 6 }, // 0.96 m2
  { label: '30 × 30 cm (Keramik Kamar Mandi)', w: 30, l: 30, piecesPerBox: 11 }, // 0.99 m2
  { label: '20 × 20 cm (Teras / Garasi)', w: 20, l: 20, piecesPerBox: 25 }, // 1.0 m2
  { label: '80 × 80 cm (Granit Luxury)', w: 80, l: 80, piecesPerBox: 3 }, // 1.92 m2
  { label: '60 × 120 cm (Granit Slab Besar)', w: 60, l: 120, piecesPerBox: 2 }, // 1.44 m2
  { label: '15 × 60 cm (Motif Kayu Plank)', w: 15, l: 60, piecesPerBox: 11 }, // 0.99 m2
];

const PATTERNS: { id: TilePattern; name: string; desc: string }[] = [
  { id: 'grid', name: 'Grid Sejajar (Stack Bond)', desc: 'Susunan garis lurus simetris dan rapi' },
  { id: 'running-bond', name: 'Susun Bata 1/2 (Stagger 50%)', desc: 'Pola bata selang-seling klasik' },
  { id: 'stagger-third', name: 'Susun Silang 1/3 (Stagger 33%)', desc: 'Sangat ideal untuk keramik panjang / slab' },
  { id: 'diagonal', name: 'Diagonal 45° (Berlian)', desc: 'Kesan ruangan tampak lebih luas dan dinamis' },
  { id: 'checkerboard', name: 'Pola Catur (Checkerboard)', desc: 'Kombinasi dua warna ubin kontras' },
];

interface TileRoomOption {
  id: string;
  name: string;
  points: Point[];
  room?: Room;
}

const pointOnSegment = (point: Point, start: Point, end: Point): boolean => {
  const cross = (point.x - start.x) * (end.y - start.y)
    - (point.y - start.y) * (end.x - start.x);
  if (Math.abs(cross) > 1e-7) return false;
  const dot = (point.x - start.x) * (end.x - start.x)
    + (point.y - start.y) * (end.y - start.y);
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot >= -1e-7 && dot <= lengthSquared + 1e-7;
};

const isPointInPolygonInclusive = (point: Point, polygon: Point[]): boolean =>
  isPointInPolygon(point, polygon)
  || polygon.some((start, index) => pointOnSegment(point, start, polygon[(index + 1) % polygon.length]));

const simplifyPolygonBoundary = (points: Point[]): Point[] => {
  const simplified = [...points];
  let changed = true;

  while (changed && simplified.length > 3) {
    changed = false;
    for (let index = 0; index < simplified.length; index++) {
      const previous = simplified[(index - 1 + simplified.length) % simplified.length];
      const current = simplified[index];
      const next = simplified[(index + 1) % simplified.length];
      const firstX = current.x - previous.x;
      const firstY = current.y - previous.y;
      const secondX = next.x - current.x;
      const secondY = next.y - current.y;
      const cross = firstX * secondY - firstY * secondX;
      const scale = Math.hypot(firstX, firstY) * Math.hypot(secondX, secondY);
      if (Math.abs(cross) <= Math.max(1, scale) * 1e-8
        && firstX * secondX + firstY * secondY >= -1e-8) {
        simplified.splice(index, 1);
        changed = true;
        break;
      }
    }
  }

  return simplified;
};

const samePolygonBoundary = (first: Point[], second: Point[]): boolean => {
  const a = simplifyPolygonBoundary(first);
  const b = simplifyPolygonBoundary(second);
  if (a.length !== b.length) return false;

  for (let startIndex = 0; startIndex < b.length; startIndex++) {
    if (distance(a[0], b[startIndex]) > 0.001) continue;
    const forwardMatch = a.every((point, index) =>
      distance(point, b[(startIndex + index) % b.length]) <= 0.001
    );
    const reverseMatch = a.every((point, index) =>
      distance(point, b[(startIndex - index + b.length) % b.length]) <= 0.001
    );
    if (forwardMatch || reverseMatch) return true;
  }

  return false;
};

const segmentsIntersect = (a: Point, b: Point, c: Point, d: Point): boolean => {
  const orientation = (p: Point, q: Point, r: Point) =>
    (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;
  return (Math.abs(o1) < 1e-7 && pointOnSegment(c, a, b))
    || (Math.abs(o2) < 1e-7 && pointOnSegment(d, a, b))
    || (Math.abs(o3) < 1e-7 && pointOnSegment(a, c, d))
    || (Math.abs(o4) < 1e-7 && pointOnSegment(b, c, d));
};

const tileIntersectsPolygon = (tile: Point[], polygon: Point[]): boolean => {
  if (tile.some((corner) => isPointInPolygonInclusive(corner, polygon))) return true;
  if (polygon.some((point) => isPointInPolygonInclusive(point, tile))) return true;

  const tileEdges = tile.map((corner, index) => [corner, tile[(index + 1) % tile.length]] as const);
  return polygon.some((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return tileEdges.some(([start, end]) => segmentsIntersect(point, next, start, end));
  });
};

export const TilePlannerModal: React.FC<TilePlannerModalProps> = ({
  isOpen,
  onClose,
  plan,
  onUpdatePlan,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 550 });
  const [previewZoom, setPreviewZoom] = useState(1);

  // Selected Room Mode: 'existing' or 'custom'
  const [roomSource, setRoomSource] = useState<'existing' | 'custom'>('existing');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  // Custom Room Dimensions (meters)
  const [customWidth, setCustomWidth] = useState(4.0);
  const [customLength, setCustomLength] = useState(5.0);
  const [customRoomName, setCustomRoomName] = useState('Ruang Baru');

  // Tile Config State
  const [pattern, setPattern] = useState<TilePattern>('grid');
  const [tileWidthCm, setTileWidthCm] = useState(60);
  const [tileLengthCm, setTileLengthCm] = useState(60);
  const [groutWidthMm, setGroutWidthMm] = useState(2);
  const [groutColor, setGroutColor] = useState('#cbd5e1');
  const [primaryColor, setPrimaryColor] = useState('#f8fafc');
  const [secondaryColor, setSecondaryColor] = useState('#1e293b');
  const [originMode, setOriginMode] = useState<'center' | 'top-left' | 'bottom-left' | 'custom'>('center');
  const [offsetXcm, setOffsetXcm] = useState(0);
  const [offsetYcm, setOffsetYcm] = useState(0);
  const [wastePct, setWastePct] = useState(10);
  const [piecesPerBox, setPiecesPerBox] = useState(4);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !canvasHostRef.current || !canvasRef.current) return;
    const host = canvasHostRef.current;
    const canvas = canvasRef.current;
    const resizeCanvas = () => {
      const bounds = host.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      setCanvasSize({ width, height });
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(host);
    return () => observer.disconnect();
  }, [isOpen]);

  const availableRooms = useMemo<TileRoomOption[]>(() => {
    const rooms: TileRoomOption[] = plan.rooms
      .filter((room) => room.points.length >= 3)
      .map((room) => ({ id: room.id, name: room.name, points: room.points, room }));
    const enclosedFaces = findEnclosedWallFaces(plan.walls);

    enclosedFaces.forEach((face, index) => {
      const alreadyRepresented = rooms.some((room) =>
        samePolygonBoundary(room.points, face.points)
      );
      if (!alreadyRepresented) {
        rooms.push({
          id: `wall-face-${index}`,
          name: `Bidang Dinding ${index + 1}`,
          points: face.points,
        });
      }
    });

    return rooms;
  }, [plan.rooms, plan.walls]);

  const selectedRoom = availableRooms.find((room) => room.id === selectedRoomId);

  useEffect(() => {
    if (roomSource !== 'existing') return;
    if (!availableRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(availableRooms[0]?.id ?? '');
    }
  }, [availableRooms, roomSource, selectedRoomId]);

  // Current active room polygon points
  const activeRoomPoints = useMemo<Point[]>(() => {
    if (roomSource === 'existing' && selectedRoom?.points.length) {
      return selectedRoom.points;
    }
    // Custom rectangle room
    return [
      { x: 0, y: 0 },
      { x: customWidth, y: 0 },
      { x: customWidth, y: customLength },
      { x: 0, y: customLength },
    ];
  }, [roomSource, selectedRoom, customWidth, customLength]);

  // Sync state if selected room already has tileConfig
  useEffect(() => {
    if (roomSource === 'existing') {
      const room = selectedRoom?.room;
      if (room?.tileConfig) {
        const c = room.tileConfig;
        setPattern(c.pattern);
        setTileWidthCm(c.tileWidthCm);
        setTileLengthCm(c.tileLengthCm);
        setGroutWidthMm(c.groutWidthMm);
        setGroutColor(c.groutColor);
        setPrimaryColor(c.primaryColor);
        if (c.secondaryColor) setSecondaryColor(c.secondaryColor);
        setOriginMode(c.originMode);
        setOffsetXcm(c.offsetXcm);
        setOffsetYcm(c.offsetYcm);
        setWastePct(c.wastePct);
        setPiecesPerBox(c.piecesPerBox);
      } else {
        setPattern('grid');
        setTileWidthCm(60);
        setTileLengthCm(60);
        setGroutWidthMm(2);
        setGroutColor('#cbd5e1');
        setPrimaryColor('#f8fafc');
        setSecondaryColor('#1e293b');
        setOriginMode('center');
        setOffsetXcm(0);
        setOffsetYcm(0);
        setWastePct(10);
        setPiecesPerBox(4);
      }
    }
  }, [selectedRoomId, roomSource, selectedRoom]);

  // Compute room area in m2
  const roomAreaM2 = useMemo(() => calculatePolygonArea(activeRoomPoints), [activeRoomPoints]);

  // Real-time Tile Grid and Cut Tile Analysis
  const tileAnalysis = useMemo(() => {
    if (activeRoomPoints.length < 3) return { fullTiles: 0, cutTiles: 0, sliverCuts: 0, totalTilesNeeded: 0 };

    const angle = pattern === 'diagonal' ? Math.PI / 4 : 0;
    const gridOrigin = calculatePolygonCentroid(activeRoomPoints);
    const rotatePoint = (point: Point, rotation: number): Point => {
      const x = point.x - gridOrigin.x;
      const y = point.y - gridOrigin.y;
      return {
        x: gridOrigin.x + x * Math.cos(rotation) - y * Math.sin(rotation),
        y: gridOrigin.y + x * Math.sin(rotation) + y * Math.cos(rotation),
      };
    };
    const roomInGrid = activeRoomPoints.map((point) => rotatePoint(point, -angle));

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    roomInGrid.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const roomW_m = maxX - minX;
    const roomL_m = maxY - minY;

    const tileW_m = (tileWidthCm + groutWidthMm / 10) / 100;
    const tileL_m = (tileLengthCm + groutWidthMm / 10) / 100;

    let startX = minX;
    let startY = minY;

    if (originMode === 'center') {
      const cols = roomW_m / tileW_m;
      const rows = roomL_m / tileL_m;
      startX = minX + ((cols % 1) * tileW_m) / 2;
      startY = minY + ((rows % 1) * tileL_m) / 2;
    }

    startX += offsetXcm / 100;
    startY += offsetYcm / 100;

    let fullCount = 0;
    let cutCount = 0;
    let sliverCount = 0;

    const tiles: {
      points: Point[];
      isCut: boolean;
      isSliver: boolean;
      row: number;
      col: number;
    }[] = [];

    // Grid scan
    for (let y = startY - tileL_m * 2; y < maxY + tileL_m; y += tileL_m) {
      const rowIndex = Math.round((y - startY) / tileL_m);
      let rowOffset = 0;
      if (pattern === 'running-bond') {
        rowOffset = (Math.abs(rowIndex) % 2) * (tileW_m / 2);
      } else if (pattern === 'stagger-third') {
        rowOffset = (Math.abs(rowIndex) % 3) * (tileW_m / 3);
      }

      for (let x = startX - tileW_m * 2 + rowOffset; x < maxX + tileW_m; x += tileW_m) {
        const colIndex = Math.round((x - startX) / tileW_m);

        const gridCorners = [
          { x, y },
          { x: x + tileW_m, y },
          { x: x + tileW_m, y: y + tileL_m },
          { x, y: y + tileL_m },
        ];
        const corners = gridCorners.map((point) => rotatePoint(point, angle));

        if (tileIntersectsPolygon(corners, activeRoomPoints)) {
          const isFull = corners.every((corner) => isPointInPolygonInclusive(corner, activeRoomPoints));
          let coveredSamples = 0;
          if (!isFull) {
            for (let sampleY = 0; sampleY < 8; sampleY++) {
              for (let sampleX = 0; sampleX < 8; sampleX++) {
                const samplePoint = rotatePoint({
                  x: x + ((sampleX + 0.5) / 8) * tileW_m,
                  y: y + ((sampleY + 0.5) / 8) * tileL_m,
                }, angle);
                if (isPointInPolygonInclusive(samplePoint, activeRoomPoints)) coveredSamples++;
              }
            }
          }
          const isSliver = !isFull && coveredSamples <= 4;

          if (isFull) {
            fullCount++;
          } else {
            cutCount++;
            if (isSliver) sliverCount++;
          }

          tiles.push({
            points: corners,
            isCut: !isFull,
            isSliver,
            row: rowIndex,
            col: colIndex,
          });
        }
      }
    }

    const singleTileArea = (tileWidthCm / 100) * (tileLengthCm / 100);
    const nominalTiles = roomAreaM2 / singleTileArea;
    const totalTilesWithWaste = Math.ceil(nominalTiles * (1 + wastePct / 100));
    const totalBoxes = Math.ceil(totalTilesWithWaste / piecesPerBox);

    return {
      fullTiles: fullCount,
      cutTiles: cutCount,
      sliverCuts: sliverCount,
      tiles,
      nominalTiles: Math.ceil(nominalTiles),
      totalTilesWithWaste,
      totalBoxes,
      singleTileArea,
      boxM2: (singleTileArea * piecesPerBox).toFixed(2),
    };
  }, [
    activeRoomPoints,
    tileWidthCm,
    tileLengthCm,
    groutWidthMm,
    pattern,
    originMode,
    offsetXcm,
    offsetYcm,
    wastePct,
    piecesPerBox,
    roomAreaM2,
  ]);

  // Draw Visual Tile Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelRatio = window.devicePixelRatio || 1;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    if (activeRoomPoints.length < 3) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    activeRoomPoints.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const roomW = Math.max(maxX - minX, 0.1);
    const roomH = Math.max(maxY - minY, 0.1);

    const pad = 54;
    const availW = Math.max(1, canvasSize.width - pad * 2);
    const availH = Math.max(1, canvasSize.height - pad * 2);
    const fitScale = Math.min(availW / roomW, availH / roomH);
    const scale = fitScale * previewZoom;

    const offsetX = (canvasSize.width - roomW * scale) / 2 - minX * scale;
    const offsetY = (canvasSize.height - roomH * scale) / 2 - minY * scale;

    const toScr = (x: number, y: number) => ({
      x: x * scale + offsetX,
      y: y * scale + offsetY,
    });

    // 1. Draw Background Grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvasSize.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasSize.height); ctx.stroke();
    }
    for (let y = 0; y < canvasSize.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasSize.width, y); ctx.stroke();
    }

    // 2. Draw Tiles
    ctx.save();
    ctx.beginPath();
    const clipStart = toScr(activeRoomPoints[0].x, activeRoomPoints[0].y);
    ctx.moveTo(clipStart.x, clipStart.y);
    for (let index = 1; index < activeRoomPoints.length; index++) {
      const point = toScr(activeRoomPoints[index].x, activeRoomPoints[index].y);
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.clip();

    tileAnalysis.tiles?.forEach((tile, idx) => {
      const points = tile.points.map((point) => toScr(point.x, point.y));

      // Color based on status (Full vs Cut vs Critical Sliver)
      if (tile.isSliver) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)'; // Red sliver warning
        ctx.strokeStyle = '#dc2626';
      } else if (tile.isCut) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)'; // Amber cut
        ctx.strokeStyle = '#d97706';
      } else {
        if (pattern === 'checkerboard' && (tile.row + tile.col) % 2 === 1) {
          ctx.fillStyle = secondaryColor || '#334155';
          ctx.strokeStyle = groutColor || '#cbd5e1';
        } else {
          ctx.fillStyle = primaryColor || '#f8fafc';
          ctx.strokeStyle = groutColor || '#cbd5e1';
        }
      }

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index++) {
        ctx.lineTo(points[index].x, points[index].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = Math.max(1, (groutWidthMm / 10) * scale * 0.1);
      ctx.stroke();

      // Diagonal slash for cut tiles
      if (tile.isCut) {
        ctx.strokeStyle = tile.isSliver ? 'rgba(220, 38, 38, 0.4)' : 'rgba(217, 119, 6, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[2].x, points[2].y);
        ctx.stroke();
      }
    });
    ctx.restore();

    // 3. Draw Room Perimeter Wall Outline
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const first = toScr(activeRoomPoints[0].x, activeRoomPoints[0].y);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < activeRoomPoints.length; i++) {
      const pt = toScr(activeRoomPoints[i].x, activeRoomPoints[i].y);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.stroke();

    // 4. Dimension Labels on Room Borders
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    const topMid = toScr((minX + maxX) / 2, minY);
    ctx.fillText(`${roomW.toFixed(2)} m`, topMid.x, topMid.y - 12);
    const leftMid = toScr(minX, (minY + maxY) / 2);
    ctx.save();
    ctx.translate(leftMid.x - 16, leftMid.y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${roomH.toFixed(2)} m`, 0, 0);
    ctx.restore();

  }, [
    activeRoomPoints,
    tileAnalysis,
    pattern,
    primaryColor,
    secondaryColor,
    groutColor,
    groutWidthMm,
    canvasSize,
    previewZoom,
  ]);

  // Apply to House Plan
  const handleApplyToPlan = () => {
    if (roomSource === 'existing' && !selectedRoom) return;

    const config: TileConfig = {
      pattern,
      tileWidthCm,
      tileLengthCm,
      groutWidthMm,
      groutColor,
      primaryColor,
      secondaryColor,
      originMode,
      offsetXcm,
      offsetYcm,
      rotationDeg: pattern === 'diagonal' ? 45 : 0,
      wastePct,
      piecesPerBox,
    };

    if (roomSource === 'existing' && selectedRoom) {
      if (selectedRoom.room) {
        const updatedRooms = plan.rooms.map((room) => room.id === selectedRoom.id
          ? { ...room, floorMaterial: 'custom-tile' as const, tileConfig: config }
          : room);
        onUpdatePlan({ ...plan, rooms: updatedRooms });
      } else {
        const newRoom: Room = {
          id: `room_${Date.now()}`,
          name: selectedRoom.name,
          points: selectedRoom.points,
          floorMaterial: 'custom-tile',
          tileConfig: config,
        };
        onUpdatePlan({ ...plan, rooms: [...plan.rooms, newRoom] });
        setSelectedRoomId(newRoom.id);
      }
    } else {
      // Add custom room and 4 walls to plan
      const w1 = { id: `w_tile_${Date.now()}_1`, start: { x: 0, y: 0 }, end: { x: customWidth, y: 0 }, thickness: 0.15, height: plan.defaultWallHeight, material: 'plaster-white' as const };
      const w2 = { id: `w_tile_${Date.now()}_2`, start: { x: customWidth, y: 0 }, end: { x: customWidth, y: customLength }, thickness: 0.15, height: plan.defaultWallHeight, material: 'plaster-white' as const };
      const w3 = { id: `w_tile_${Date.now()}_3`, start: { x: customWidth, y: customLength }, end: { x: 0, y: customLength }, thickness: 0.15, height: plan.defaultWallHeight, material: 'plaster-white' as const };
      const w4 = { id: `w_tile_${Date.now()}_4`, start: { x: 0, y: customLength }, end: { x: 0, y: 0 }, thickness: 0.15, height: plan.defaultWallHeight, material: 'plaster-white' as const };

      const newRoom: Room = {
        id: `room_${Date.now()}`,
        name: customRoomName,
        points: activeRoomPoints,
        floorMaterial: 'custom-tile' as const,
        tileConfig: config,
      };

      onUpdatePlan({
        ...plan,
        walls: [...plan.walls, w1, w2, w3, w4],
        rooms: [...plan.rooms, newRoom],
      });
    }

    setAppliedSuccess(true);
    setTimeout(() => {
      setAppliedSuccess(false);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm select-none">
      <div className="tile-planner-modal bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-600 text-white rounded-xl shadow-sm">
              <Grid3X3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Perencana Lantai & Uji Pola Keramik</h2>
              <p className="text-xs text-slate-500">Uji tata letak, pola nat, visualisasi potongan ubin, dan hitung kebutuhan dus keramik skala nyata.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Content: Split 2 Columns */}
        <div className="tile-planner-content flex-1 flex overflow-hidden">
          
          {/* Left Column: Visual Canvas & Legend */}
          <div className="tile-planner-canvas flex-1 flex flex-col bg-slate-100 p-4 border-r border-slate-200 overflow-hidden relative">
            
            {/* Visual Header Stats */}
            <div className="flex items-center justify-between mb-3 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200 text-xs shadow-sm">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-slate-400 text-[11px] block">Luas Ruangan</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">{roomAreaM2.toFixed(1)} m²</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-400 text-[11px] block">Ubin Utuh</span>
                  <span className="font-bold text-emerald-600 font-mono text-sm">{tileAnalysis.fullTiles} pcs</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-400 text-[11px] block">Ubin Terpotong</span>
                  <span className="font-bold text-amber-600 font-mono text-sm">{tileAnalysis.cutTiles} pcs</span>
                </div>
              </div>

              {/* Sliver cut warning indicator */}
              {tileAnalysis.sliverCuts > 0 ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>{tileAnalysis.sliverCuts} Potongan Kritis &lt; 6cm</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Tata Letak Rapi</span>
                </div>
              )}
            </div>

            {/* Interactive Canvas Viewport */}
            <div ref={canvasHostRef} className="tile-simulation-viewport flex-1 bg-white rounded-2xl border border-slate-200 shadow-inner overflow-hidden relative">
              <canvas
                ref={canvasRef}
                className="w-full h-full block"
              />

              <div className="tile-simulation-zoom absolute top-3 right-3 z-10 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-md">
                <button
                  type="button"
                  aria-label="Perkecil simulasi keramik"
                  title="Perkecil simulasi"
                  onClick={() => setPreviewZoom((zoom) => Math.max(0.5, Math.round((zoom - 0.25) * 100) / 100))}
                  className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="min-w-10 text-center font-mono text-[10px] text-slate-600">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  type="button"
                  aria-label="Perbesar simulasi keramik"
                  title="Perbesar simulasi"
                  onClick={() => setPreviewZoom((zoom) => Math.min(3, Math.round((zoom + 0.25) * 100) / 100))}
                  className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Pas-kan simulasi ke layar"
                  title="Pas-kan simulasi ke layar"
                  onClick={() => setPreviewZoom(1)}
                  className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>

              {/* Floating Legend */}
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 text-[11px] text-slate-600 shadow-sm flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border border-slate-300 bg-slate-50" />
                  <span>Ubin Utuh</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border border-amber-400 bg-amber-100/70" />
                  <span>Ubin Terpotong</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded border border-rose-400 bg-rose-100/80" />
                  <span>Potongan Kritis (&lt;6cm)</span>
                </span>
              </div>
            </div>

            {/* Tip Banner */}
            <div className="mt-3 bg-cyan-50 border border-cyan-200/80 px-3.5 py-2 rounded-xl text-[11px] text-cyan-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-600 shrink-0" />
              <span>
                Tip Tukang & Arsitek: Mulai tata letak dari <strong>Tengah Ruangan (Center)</strong> agar potongan ubin di tepi kiri-kanan simetris dan seimbang.
              </span>
            </div>
          </div>

          {/* Right Column: Controls & Material Bill of Quantities */}
          <div className="tile-planner-sidebar w-96 bg-white flex flex-col h-full overflow-y-auto p-5 space-y-5 text-xs select-none">
            
            {/* Section 1: Room Source Selection */}
            <div>
              <label className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block mb-2">
                1. Bentuk & Skala Ruangan
              </label>
              
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-3">
                <button
                  onClick={() => setRoomSource('existing')}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    roomSource === 'existing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dari Denah Rumah
                </button>
                <button
                  onClick={() => setRoomSource('custom')}
                  className={`flex-1 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    roomSource === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ukur Manual (Skala Nyata)
                </button>
              </div>

              {roomSource === 'existing' ? (
                <div>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium cursor-pointer"
                  >
                    {availableRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}{r.room ? '' : ' (dari dinding)'} ({calculatePolygonArea(r.points).toFixed(1)} m²)
                      </option>
                    ))}
                  </select>
                  {availableRooms.length === 0 && (
                    <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                      Belum ada ruangan tertutup. Buat dinding yang saling tersambung hingga membentuk bidang tertutup, atau pilih ukur manual.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium">Nama Ruangan</span>
                    <input
                      type="text"
                      value={customRoomName}
                      onChange={(e) => setCustomRoomName(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium mt-0.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium">Lebar Nyata (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="20"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-mono text-slate-800 mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium">Panjang Nyata (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="20"
                        value={customLength}
                        onChange={(e) => setCustomLength(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-mono text-slate-800 mt-0.5"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Tile Size & Presets */}
            <div>
              <label className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block mb-2">
                2. Ukuran Keramik / Granit
              </label>

              <select
                onChange={(e) => {
                  const sz = POPULAR_SIZES[parseInt(e.target.value, 10)];
                  if (sz) {
                    setTileWidthCm(sz.w);
                    setTileLengthCm(sz.l);
                    setPiecesPerBox(sz.piecesPerBox);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium mb-2 cursor-pointer"
              >
                {POPULAR_SIZES.map((s, idx) => (
                  <option key={idx} value={idx}>
                    {s.label}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500">Lebar (cm)</span>
                  <input
                    type="number"
                    value={tileWidthCm}
                    onChange={(e) => setTileWidthCm(parseInt(e.target.value, 10) || 60)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Panjang (cm)</span>
                  <input
                    type="number"
                    value={tileLengthCm}
                    onChange={(e) => setTileLengthCm(parseInt(e.target.value, 10) || 60)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Layout Pattern */}
            <div>
              <label className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block mb-2">
                3. Pola Tata Letak Ubin
              </label>
              <div className="space-y-1.5">
                {PATTERNS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPattern(p.id)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      pattern === p.id
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-950 font-semibold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs">{p.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Section 4: Nat (Grout) & Starting Origin */}
            <div>
              <label className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block mb-2">
                4. Nat & Titik Awal Pemasangan
              </label>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <span className="text-[10px] text-slate-500">Tebal Nat (mm)</span>
                  <select
                    value={groutWidthMm}
                    onChange={(e) => setGroutWidthMm(parseInt(e.target.value, 10))}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  >
                    <option value="1">1 mm (Granit Rata)</option>
                    <option value="2">2 mm (Standar)</option>
                    <option value="3">3 mm (Lantai Biasa)</option>
                    <option value="5">5 mm (Keramik Kasar)</option>
                  </select>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Titik Awal</span>
                  <select
                    value={originMode}
                    onChange={(e) => setOriginMode(e.target.value as any)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
                  >
                    <option value="center">Tengah Ruangan (Simetris)</option>
                    <option value="bottom-left">Sudut Kiri Bawah</option>
                    <option value="top-left">Sudut Kiri Atas</option>
                  </select>
                </div>
              </div>

              {/* Offset Fine-tune Sliders */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Geser Offset X (cm)</span>
                    <span className="font-mono">{offsetXcm} cm</span>
                  </div>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={offsetXcm}
                    onChange={(e) => setOffsetXcm(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-600 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Geser Offset Y (cm)</span>
                    <span className="font-mono">{offsetYcm} cm</span>
                  </div>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    value={offsetYcm}
                    onChange={(e) => setOffsetYcm(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Material Bill of Quantities (Kebutuhan Belanja) */}
            <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl shadow-lg space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Package className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-xs">RAB & Kebutuhan Pembelian</span>
              </div>

              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Luas Lantai:</span>
                  <span className="text-white font-semibold">{roomAreaM2.toFixed(1)} m²</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Isi Dus:</span>
                  <span className="text-white">{piecesPerBox} keping ({tileAnalysis.boxM2} m²)</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cadangan Buang (Waste):</span>
                  <span className="text-cyan-400 font-semibold">{wastePct}%</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                  <span>Total Keping Dibutuhkan:</span>
                  <span className="text-amber-400 font-bold">{tileAnalysis.totalTilesWithWaste} keping</span>
                </div>
                <div className="flex justify-between items-center pt-1 text-xs">
                  <span className="text-slate-200 font-sans font-bold">Wajib Dibeli:</span>
                  <span className="bg-cyan-500 text-slate-950 font-bold px-2 py-0.5 rounded text-sm">
                    {tileAnalysis.totalBoxes} DUS
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                  <span>Estimasi Semen Perekat:</span>
                  <span className="text-slate-300">~{Math.ceil(roomAreaM2 / 5)} sak (25 kg)</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                onClick={handleApplyToPlan}
                disabled={roomSource === 'existing' && !selectedRoom}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-xs active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {appliedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Berhasil Diterapkan ke Denah!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Terapkan Pola ke Denah & 3D</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
