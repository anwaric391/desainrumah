/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number; // in meters
  y: number; // in meters (corresponds to Z in 3D)
}

export type WallMaterial = 'plaster-white' | 'warm-beige' | 'modern-gray' | 'brick' | 'wood-slats';
export type FloorMaterial = 'parquet-oak' | 'tile-ceramic' | 'marble-white' | 'concrete' | 'carpet-grey' | 'grass' | 'custom-tile';

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number; // meters, default 0.15 (15cm)
  height: number;    // meters, default 2.8 (2.8m, can be set manually!)
  material: WallMaterial;
  color?: string;
}

export type OpeningType = 
  // Doors
  | 'door-single' 
  | 'door-double' 
  | 'door-sliding' 
  | 'door-glass'
  | 'door-bifold'
  | 'door-garage'
  // Windows
  | 'window-single' 
  | 'window-double' 
  | 'window-large'
  | 'window-sliding'
  | 'window-louver'
  | 'window-panorama';

export interface Opening {
  id: string;
  wallId: string;
  type: OpeningType;
  position: number;       // 0.0 to 1.0 along the wall from start to end
  width: number;          // meters (e.g. 0.9 for door, 1.2 for window)
  height: number;         // meters (e.g. 2.1 for door, 1.2 for window)
  elevation: number;      // meters from floor (0 for doors, 0.9 for windows)
  flipped?: boolean;      // legacy boolean swing flip
  hingeSide?: 'left' | 'right';         // Engsel Kiri atau Kanan
  swingDirection?: 'inward' | 'outward'; // Bukaan ke Dalam atau ke Luar
}

export type TilePattern = 'grid' | 'running-bond' | 'stagger-third' | 'herringbone' | 'diagonal' | 'checkerboard';

export interface TileConfig {
  pattern: TilePattern;
  tileWidthCm: number;   // e.g. 60
  tileLengthCm: number;  // e.g. 60
  groutWidthMm: number;  // e.g. 2
  groutColor: string;    // e.g. '#cbd5e1'
  primaryColor: string;  // e.g. '#f8fafc'
  secondaryColor?: string; // e.g. '#1e293b' for checkerboard
  originMode: 'center' | 'top-left' | 'bottom-left' | 'custom';
  offsetXcm: number;
  offsetYcm: number;
  rotationDeg: number;   // 0, 45, 90
  wastePct: number;      // 5, 10, 15%
  piecesPerBox: number;  // e.g. 4 pieces for 60x60 (1.44 m2)
  pricePerBox?: number;  // e.g. Rp 185.000
}

export interface Room {
  id: string;
  name: string;
  points: Point[]; // Polygon corners in meters
  floorMaterial: FloorMaterial;
  floorColor?: string;
  tileConfig?: TileConfig;
}

export type FurnitureCategory = 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'outdoor' | 'decor';

export interface FurnitureItem {
  id: string;
  catalogId: string;
  name: string;
  category: FurnitureCategory;
  x: number;      // meters
  y: number;      // meters (Z in 3D)
  rotation: number; // in degrees (0-360)
  width: number;  // meters
  depth: number;  // meters
  height: number; // meters
  color?: string;
  materialFinish?: string;
}

export interface PlanReferenceImage {
  dataUrl: string;
  widthMeters: number;
  opacity: number;
  center: Point;
}

export type RoofType = 'none' | 'flat' | 'gable';

export interface HousePlan {
  id: string;
  name: string;
  version: number;
  walls: Wall[];
  openings: Opening[];
  rooms: Room[];
  furniture: FurnitureItem[];
  defaultWallHeight: number; // in meters (can be manually edited!)
  roofType: RoofType;
  referenceImage?: PlanReferenceImage;
  floors?: PlanFloor[];
  activeFloorId?: string;
}

export interface PlanFloor {
  id: string;
  name: string;
  walls: Wall[];
  openings: Opening[];
  rooms: Room[];
  furniture: FurnitureItem[];
  referenceImage?: PlanReferenceImage;
}

export type ViewMode = '2d' | 'split' | '3d';
export type CameraMode = 'orbit' | 'fpv' | 'top';
export type LightingTime = 'day' | 'sunset' | 'night';
export type WallCutMode = 'full' | 'half' | 'transparent';

export type ActiveTool = 
  | 'select' 
  | 'wall' 
  | 'room-rect' 
  | 'door' 
  | 'window' 
  | 'furniture' 
  | 'measure' 
  | 'pan';
