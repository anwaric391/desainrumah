/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HousePlan } from '../types/house';

export interface PlanTemplate {
  id: string;
  name: string;
  subtitle: string;
  area: number; // m²
  bedrooms: number;
  bathrooms: number;
  description: string;
  plan: HousePlan;
}

export const HOUSE_TEMPLATES: PlanTemplate[] = [
  {
    id: 'type-36',
    name: 'Rumah Minimalis Tipe 36',
    subtitle: 'Denah Populer Indonesia (6 × 6 m)',
    area: 36,
    bedrooms: 2,
    bathrooms: 1,
    description: 'Desain kompak efisien dengan 2 kamar tidur, ruang keluarga lega, kamar mandi, dapur, dan teras depan.',
    plan: {
      id: 'plan-type-36',
      name: 'Rumah Minimalis Tipe 36',
      version: 1,
      defaultWallHeight: 2.8,
      roofType: 'gable',
      walls: [
        // Perimeter exterior walls (6m x 6m)
        { id: 'w-ext-1', start: { x: 0, y: 0 }, end: { x: 6, y: 0 }, thickness: 0.15, height: 2.8, material: 'plaster-white' },
        { id: 'w-ext-2', start: { x: 6, y: 0 }, end: { x: 6, y: 6 }, thickness: 0.15, height: 2.8, material: 'plaster-white' },
        { id: 'w-ext-3', start: { x: 6, y: 6 }, end: { x: 0, y: 6 }, thickness: 0.15, height: 2.8, material: 'plaster-white' },
        { id: 'w-ext-4', start: { x: 0, y: 6 }, end: { x: 0, y: 0 }, thickness: 0.15, height: 2.8, material: 'plaster-white' },

        // Internal dividing walls
        // Vertical divider separating bedrooms (left side) from living/dining (right side) at x = 3.0
        { id: 'w-int-1', start: { x: 3.0, y: 0 }, end: { x: 3.0, y: 6 }, thickness: 0.12, height: 2.8, material: 'warm-beige' },
        // Horizontal divider between Master Bedroom (top left) and Bed 2 / Bath (bottom left) at y = 3.2
        { id: 'w-int-2', start: { x: 0, y: 3.2 }, end: { x: 3.0, y: 3.2 }, thickness: 0.12, height: 2.8, material: 'warm-beige' },
        // Bathroom enclosure (x: 1.5 to 3.0, y: 4.5 to 6.0)
        { id: 'w-int-3', start: { x: 1.5, y: 4.5 }, end: { x: 3.0, y: 4.5 }, thickness: 0.12, height: 2.8, material: 'plaster-white' },
        { id: 'w-int-4', start: { x: 1.5, y: 4.5 }, end: { x: 1.5, y: 6.0 }, thickness: 0.12, height: 2.8, material: 'plaster-white' },
      ],
      openings: [
        // Main entrance door on bottom front wall (x: 4.5, y: 6.0)
        { id: 'op-1', wallId: 'w-ext-3', type: 'door-single', position: 0.25, width: 0.9, height: 2.1, elevation: 0 },
        // Living room front window
        { id: 'op-2', wallId: 'w-ext-3', type: 'window-double', position: 0.75, width: 1.5, height: 1.4, elevation: 0.8 },
        // Master Bedroom back window (w-ext-1)
        { id: 'op-3', wallId: 'w-ext-1', type: 'window-double', position: 0.25, width: 1.4, height: 1.4, elevation: 0.8 },
        // Kitchen back window (w-ext-1)
        { id: 'op-4', wallId: 'w-ext-1', type: 'window-single', position: 0.75, width: 1.0, height: 1.0, elevation: 1.1 },
        // Bedroom 2 front window (w-ext-3)
        { id: 'op-5', wallId: 'w-ext-3', type: 'window-single', position: 0.9, width: 1.0, height: 1.4, elevation: 0.8 },
        // Master Bedroom interior door (on w-int-1)
        { id: 'op-6', wallId: 'w-int-1', type: 'door-single', position: 0.25, width: 0.85, height: 2.1, elevation: 0 },
        // Bedroom 2 interior door (on w-int-2)
        { id: 'op-7', wallId: 'w-int-2', type: 'door-single', position: 0.75, width: 0.85, height: 2.1, elevation: 0 },
        // Bathroom door (on w-int-3)
        { id: 'op-8', wallId: 'w-int-3', type: 'door-single', position: 0.5, width: 0.75, height: 2.0, elevation: 0 },
      ],
      rooms: [
        {
          id: 'room-1',
          name: 'Ruang Tamu & Keluarga',
          floorMaterial: 'tile-ceramic',
          points: [
            { x: 3.0, y: 0 },
            { x: 6.0, y: 0 },
            { x: 6.0, y: 6.0 },
            { x: 3.0, y: 6.0 },
          ],
        },
        {
          id: 'room-2',
          name: 'Kamar Tidur Utama',
          floorMaterial: 'parquet-oak',
          points: [
            { x: 0, y: 0 },
            { x: 3.0, y: 0 },
            { x: 3.0, y: 3.2 },
            { x: 0, y: 3.2 },
          ],
        },
        {
          id: 'room-3',
          name: 'Kamar Tidur Anak',
          floorMaterial: 'parquet-oak',
          points: [
            { x: 0, y: 3.2 },
            { x: 1.5, y: 3.2 },
            { x: 1.5, y: 4.5 },
            { x: 0, y: 4.5 },
          ],
        },
        {
          id: 'room-4',
          name: 'Kamar Mandi',
          floorMaterial: 'marble-white',
          points: [
            { x: 1.5, y: 4.5 },
            { x: 3.0, y: 4.5 },
            { x: 3.0, y: 6.0 },
            { x: 1.5, y: 6.0 },
          ],
        },
      ],
      furniture: [
        // Living room furniture
        {
          id: 'f-1',
          catalogId: 'sofa-3seat',
          name: 'Sofa 3 Dudukan',
          category: 'living',
          x: 4.5,
          y: 4.5,
          rotation: 0,
          width: 2.1,
          depth: 0.9,
          height: 0.85,
          color: '#334155',
        },
        {
          id: 'f-2',
          catalogId: 'coffee-table',
          name: 'Meja Kopi Minimalis',
          category: 'living',
          x: 4.5,
          y: 3.3,
          rotation: 0,
          width: 1.1,
          depth: 0.55,
          height: 0.45,
          color: '#8c6d58',
        },
        {
          id: 'f-3',
          catalogId: 'tv-console',
          name: 'Kredensa TV & Smart TV',
          category: 'living',
          x: 4.5,
          y: 2.2,
          rotation: 180,
          width: 1.8,
          depth: 0.4,
          height: 1.3,
          color: '#1e293b',
        },
        {
          id: 'f-4',
          catalogId: 'kitchen-cabinet',
          name: 'Kitchen Set Wastafel & Kompor',
          category: 'kitchen',
          x: 4.7,
          y: 0.4,
          rotation: 0,
          width: 2.2,
          depth: 0.6,
          height: 0.9,
          color: '#475569',
        },
        {
          id: 'f-5',
          catalogId: 'indoor-plant',
          name: 'Tanaman Hias Monstera',
          category: 'living',
          x: 5.6,
          y: 5.4,
          rotation: 0,
          width: 0.5,
          depth: 0.5,
          height: 1.1,
          color: '#16a34a',
        },
        // Master Bedroom
        {
          id: 'f-6',
          catalogId: 'bed-king',
          name: 'Tempat Tidur King Size',
          category: 'bedroom',
          x: 1.5,
          y: 1.3,
          rotation: 0,
          width: 1.8,
          depth: 2.0,
          height: 0.9,
          color: '#cbd5e1',
        },
        {
          id: 'f-7',
          catalogId: 'nightstand',
          name: 'Meja Samping Ranjang',
          category: 'bedroom',
          x: 0.4,
          y: 0.4,
          rotation: 0,
          width: 0.45,
          depth: 0.4,
          height: 0.5,
          color: '#a18262',
        },
        {
          id: 'f-8',
          catalogId: 'wardrobe-closet',
          name: 'Lemari Pakaian',
          category: 'bedroom',
          x: 0.4,
          y: 2.5,
          rotation: 90,
          width: 1.4,
          depth: 0.6,
          height: 2.1,
          color: '#f8fafc',
        },
        // Bedroom 2
        {
          id: 'f-9',
          catalogId: 'bed-single',
          name: 'Tempat Tidur Single',
          category: 'bedroom',
          x: 0.6,
          y: 4.3,
          rotation: 90,
          width: 1.0,
          depth: 1.9,
          height: 0.85,
          color: '#93c5fd',
        },
        // Bathroom
        {
          id: 'f-10',
          catalogId: 'toilet-closet',
          name: 'Toilet Duduk',
          category: 'bathroom',
          x: 2.5,
          y: 5.5,
          rotation: 180,
          width: 0.45,
          depth: 0.65,
          height: 0.8,
          color: '#ffffff',
        },
        {
          id: 'f-11',
          catalogId: 'vanity-sink',
          name: 'Wastafel Kabinet',
          category: 'bathroom',
          x: 1.8,
          y: 5.5,
          rotation: 180,
          width: 0.6,
          depth: 0.45,
          height: 1.6,
          color: '#f8fafc',
        },
      ],
    },
  },

  {
    id: 'type-60',
    name: 'Rumah Modern Tipe 60',
    subtitle: 'Hunian Keluarga Nyaman (8 × 7.5 m)',
    area: 60,
    bedrooms: 2,
    bathrooms: 2,
    description: 'Rumah keluarga modern dengan ruang tamu luas, master suite dengan kamar mandi dalam, kamar anak, dan dining lounge.',
    plan: {
      id: 'plan-type-60',
      name: 'Rumah Modern Tipe 60',
      version: 1,
      defaultWallHeight: 2.8,
      roofType: 'gable',
      walls: [
        // Perimeter
        { id: 'w-p1', start: { x: 0, y: 0 }, end: { x: 8, y: 0 }, thickness: 0.15, height: 2.8, material: 'plaster-white' },
        { id: 'w-p2', start: { x: 8, y: 0 }, end: { x: 8, y: 7.5 }, thickness: 0.15, height: 2.8, material: 'plaster-white' },
        { id: 'w-p3', start: { x: 8, y: 7.5 }, end: { x: 0, y: 7.5 }, thickness: 0.15, height: 2.8, material: 'plaster-white' },
        { id: 'w-p4', start: { x: 0, y: 7.5 }, end: { x: 0, y: 0 }, thickness: 0.15, height: 2.8, material: 'plaster-white' },

        // Main spine divider
        { id: 'w-sp1', start: { x: 4.2, y: 0 }, end: { x: 4.2, y: 7.5 }, thickness: 0.12, height: 2.8, material: 'warm-beige' },
        // Master bedroom horizontal split
        { id: 'w-sp2', start: { x: 0, y: 4.0 }, end: { x: 4.2, y: 4.0 }, thickness: 0.12, height: 2.8, material: 'warm-beige' },
        // Ensuite bathroom for master
        { id: 'w-sp3', start: { x: 0, y: 2.0 }, end: { x: 2.0, y: 2.0 }, thickness: 0.12, height: 2.8, material: 'plaster-white' },
        { id: 'w-sp4', start: { x: 2.0, y: 0 }, end: { x: 2.0, y: 2.0 }, thickness: 0.12, height: 2.8, material: 'plaster-white' },
        // Living & dining area division on right side
        { id: 'w-sp5', start: { x: 6.2, y: 4.5 }, end: { x: 8.0, y: 4.5 }, thickness: 0.12, height: 2.8, material: 'warm-beige' },
      ],
      openings: [
        // Front door
        { id: 'd-1', wallId: 'w-p3', type: 'door-double', position: 0.35, width: 1.4, height: 2.2, elevation: 0 },
        // Living room large bay window
        { id: 'd-2', wallId: 'w-p3', type: 'window-large', position: 0.8, width: 2.2, height: 1.6, elevation: 0.6 },
        // Master bedroom garden window
        { id: 'd-3', wallId: 'w-p1', type: 'window-large', position: 0.4, width: 1.8, height: 1.6, elevation: 0.6 },
        // Dining side sliding glass door
        { id: 'd-4', wallId: 'w-p2', type: 'door-sliding', position: 0.3, width: 1.8, height: 2.2, elevation: 0 },
        // Bedroom doors
        { id: 'd-5', wallId: 'w-sp2', type: 'door-single', position: 0.8, width: 0.9, height: 2.1, elevation: 0 },
        { id: 'd-6', wallId: 'w-sp1', type: 'door-single', position: 0.6, width: 0.9, height: 2.1, elevation: 0 },
        // Ensuite bath door
        { id: 'd-7', wallId: 'w-sp3', type: 'door-single', position: 0.5, width: 0.8, height: 2.0, elevation: 0 },
      ],
      rooms: [
        {
          id: 'r-1',
          name: 'Ruang Tamu & Foyer',
          floorMaterial: 'marble-white',
          points: [{ x: 4.2, y: 3.5 }, { x: 8.0, y: 3.5 }, { x: 8.0, y: 7.5 }, { x: 4.2, y: 7.5 }],
        },
        {
          id: 'r-2',
          name: 'Ruang Makan & Dapur Bersih',
          floorMaterial: 'tile-ceramic',
          points: [{ x: 4.2, y: 0 }, { x: 8.0, y: 0 }, { x: 8.0, y: 3.5 }, { x: 4.2, y: 3.5 }],
        },
        {
          id: 'r-3',
          name: 'Kamar Tidur Utama (Master Suite)',
          floorMaterial: 'parquet-oak',
          points: [{ x: 0, y: 0 }, { x: 4.2, y: 0 }, { x: 4.2, y: 4.0 }, { x: 0, y: 4.0 }],
        },
        {
          id: 'r-4',
          name: 'Kamar Tidur Anak / Tamu',
          floorMaterial: 'parquet-oak',
          points: [{ x: 0, y: 4.0 }, { x: 4.2, y: 4.0 }, { x: 4.2, y: 7.5 }, { x: 0, y: 7.5 }],
        },
      ],
      furniture: [
        // Living room sectional sofa
        {
          id: 'f60-1',
          catalogId: 'sofa-lshape',
          name: 'Sofa Sudut Letter L',
          category: 'living',
          x: 5.8,
          y: 5.8,
          rotation: 0,
          width: 2.6,
          depth: 1.8,
          height: 0.85,
          color: '#1e3a8a',
        },
        {
          id: 'f60-2',
          catalogId: 'coffee-table',
          name: 'Meja Kopi Minimalis',
          category: 'living',
          x: 5.8,
          y: 4.6,
          rotation: 0,
          width: 1.2,
          depth: 0.6,
          height: 0.45,
          color: '#8c6d58',
        },
        {
          id: 'f60-3',
          catalogId: 'tv-console',
          name: 'Kredensa TV & Smart TV',
          category: 'living',
          x: 5.8,
          y: 3.7,
          rotation: 180,
          width: 2.0,
          depth: 0.45,
          height: 1.4,
          color: '#0f172a',
        },
        // Dining Table 6p
        {
          id: 'f60-4',
          catalogId: 'dining-table-6p',
          name: 'Meja Makan 6 Kursi',
          category: 'kitchen',
          x: 6.2,
          y: 2.0,
          rotation: 90,
          width: 1.8,
          depth: 0.95,
          height: 0.78,
          color: '#8a5a36',
        },
        // Kitchen Counter
        {
          id: 'f60-5',
          catalogId: 'kitchen-cabinet',
          name: 'Kitchen Set Wastafel & Kompor',
          category: 'kitchen',
          x: 5.4,
          y: 0.45,
          rotation: 0,
          width: 2.4,
          depth: 0.65,
          height: 0.9,
          color: '#334155',
        },
        {
          id: 'f60-6',
          catalogId: 'refrigerator',
          name: 'Kulkas 2 Pintu',
          category: 'kitchen',
          x: 7.4,
          y: 0.45,
          rotation: 0,
          width: 0.9,
          depth: 0.7,
          height: 1.85,
          color: '#64748b',
        },
        // Master Bed
        {
          id: 'f60-7',
          catalogId: 'bed-king',
          name: 'Tempat Tidur King Size',
          category: 'bedroom',
          x: 3.1,
          y: 1.5,
          rotation: 270,
          width: 1.8,
          depth: 2.0,
          height: 0.9,
          color: '#e2e8f0',
        },
        // Ensuite Bath
        {
          id: 'f60-8',
          catalogId: 'bathtub-freestanding',
          name: 'Bak Mandi / Bathtub',
          category: 'bathroom',
          x: 1.0,
          y: 1.0,
          rotation: 0,
          width: 1.6,
          depth: 0.75,
          height: 0.6,
          color: '#ffffff',
        },
        // Bedroom 2 Bed & Study
        {
          id: 'f60-9',
          catalogId: 'bed-single',
          name: 'Tempat Tidur Single',
          category: 'bedroom',
          x: 1.2,
          y: 6.2,
          rotation: 0,
          width: 1.0,
          depth: 2.0,
          height: 0.85,
          color: '#38bdf8',
        },
        {
          id: 'f60-10',
          catalogId: 'study-desk',
          name: 'Meja Kerja & Kursi',
          category: 'bedroom',
          x: 3.0,
          y: 6.8,
          rotation: 180,
          width: 1.3,
          depth: 0.65,
          height: 0.85,
          color: '#475569',
        },
      ],
    },
  },

  {
    id: 'loft-studio',
    name: 'Villa / Loft Kontemporer',
    subtitle: 'Konsep Terbuka Mewah (7 × 6 m)',
    area: 42,
    bedrooms: 1,
    bathrooms: 1,
    description: 'Desain open-concept mewah dengan kitchen island marmer, sofa santai, area tidur terintegrasi, dan kamar mandi kaca.',
    plan: {
      id: 'plan-loft',
      name: 'Villa / Loft Kontemporer',
      version: 1,
      defaultWallHeight: 3.0,
      roofType: 'flat',
      walls: [
        { id: 'w-l1', start: { x: 0, y: 0 }, end: { x: 7, y: 0 }, thickness: 0.15, height: 3.0, material: 'modern-gray' },
        { id: 'w-l2', start: { x: 7, y: 0 }, end: { x: 7, y: 6 }, thickness: 0.15, height: 3.0, material: 'modern-gray' },
        { id: 'w-l3', start: { x: 7, y: 6 }, end: { x: 0, y: 6 }, thickness: 0.15, height: 3.0, material: 'modern-gray' },
        { id: 'w-l4', start: { x: 0, y: 6 }, end: { x: 0, y: 0 }, thickness: 0.15, height: 3.0, material: 'modern-gray' },

        // Glass bathroom corner
        { id: 'w-l5', start: { x: 0, y: 2.2 }, end: { x: 2.5, y: 2.2 }, thickness: 0.1, height: 3.0, material: 'plaster-white' },
        { id: 'w-l6', start: { x: 2.5, y: 2.2 }, end: { x: 2.5, y: 0 }, thickness: 0.1, height: 3.0, material: 'plaster-white' },
      ],
      openings: [
        { id: 'op-l1', wallId: 'w-l3', type: 'door-sliding', position: 0.3, width: 2.4, height: 2.4, elevation: 0 },
        { id: 'op-l2', wallId: 'w-l3', type: 'window-large', position: 0.8, width: 2.0, height: 1.8, elevation: 0.4 },
        { id: 'op-l3', wallId: 'w-l5', type: 'door-single', position: 0.5, width: 0.85, height: 2.2, elevation: 0 },
      ],
      rooms: [
        {
          id: 'r-loft-main',
          name: 'Open Studio Living & Bedroom',
          floorMaterial: 'parquet-oak',
          points: [{ x: 2.5, y: 0 }, { x: 7.0, y: 0 }, { x: 7.0, y: 6.0 }, { x: 0, y: 6.0 }, { x: 0, y: 2.2 }, { x: 2.5, y: 2.2 }],
        },
        {
          id: 'r-loft-bath',
          name: 'Luxury Glass Bathroom',
          floorMaterial: 'marble-white',
          points: [{ x: 0, y: 0 }, { x: 2.5, y: 0 }, { x: 2.5, y: 2.2 }, { x: 0, y: 2.2 }],
        },
      ],
      furniture: [
        {
          id: 'fl-1',
          catalogId: 'sofa-lshape',
          name: 'Sofa Sudut Letter L',
          category: 'living',
          x: 4.8,
          y: 4.5,
          rotation: 0,
          width: 2.6,
          depth: 1.8,
          height: 0.85,
          color: '#334155',
        },
        {
          id: 'fl-2',
          catalogId: 'kitchen-island',
          name: 'Kitchen Island & Kursi Bar',
          category: 'kitchen',
          x: 4.5,
          y: 2.5,
          rotation: 0,
          width: 1.8,
          depth: 0.9,
          height: 0.95,
          color: '#f8fafc',
        },
        {
          id: 'fl-3',
          catalogId: 'bed-king',
          name: 'Tempat Tidur King Size',
          category: 'bedroom',
          x: 5.5,
          y: 1.2,
          rotation: 0,
          width: 1.8,
          depth: 2.0,
          height: 0.9,
          color: '#64748b',
        },
        {
          id: 'fl-4',
          catalogId: 'bathtub-freestanding',
          name: 'Bathtub Oval Mewah',
          category: 'bathroom',
          x: 1.25,
          y: 1.1,
          rotation: 90,
          width: 1.7,
          depth: 0.8,
          height: 0.6,
          color: '#ffffff',
        },
      ],
    },
  },

  {
    id: 'empty',
    name: 'Kanvas Kosong',
    subtitle: 'Mulai Rancang dari Nol',
    area: 0,
    bedrooms: 0,
    bathrooms: 0,
    description: 'Bebas menggambar dinding, ruangan, pintu, jendela, dan menata perabotan sesuai imajinasi Anda.',
    plan: {
      id: 'plan-empty',
      name: 'Denah Rumah Baru',
      version: 1,
      defaultWallHeight: 2.8,
      roofType: 'gable',
      walls: [],
      openings: [],
      rooms: [],
      furniture: [],
    },
  },
];
