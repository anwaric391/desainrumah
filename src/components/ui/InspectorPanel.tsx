/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HousePlan, WallMaterial, FloorMaterial, OpeningType } from '../../types/house';
import { X, Sliders, Palette, Layers, Box, RotateCw, ArrowLeftRight, DoorClosed, AppWindow, Trash2 } from 'lucide-react';

interface InspectorPanelProps {
  selectedElement: { type: 'wall' | 'opening' | 'furniture' | 'room'; id: string } | null;
  plan: HousePlan;
  onUpdatePlan: (plan: HousePlan) => void;
  onClose: () => void;
  onOpenTilePlanner?: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedElement,
  plan,
  onUpdatePlan,
  onClose,
  onOpenTilePlanner,
}) => {
  if (!selectedElement) return null;

  const { type, id } = selectedElement;
  const handleDeleteSelected = () => {
    let updatedPlan = plan;
    if (type === 'furniture') {
      updatedPlan = { ...plan, furniture: plan.furniture.filter((item) => item.id !== id) };
    } else if (type === 'wall') {
      updatedPlan = {
        ...plan,
        walls: plan.walls.filter((wall) => wall.id !== id),
        openings: plan.openings.filter((opening) => opening.wallId !== id),
      };
    } else if (type === 'opening') {
      updatedPlan = { ...plan, openings: plan.openings.filter((opening) => opening.id !== id) };
    } else if (type === 'room') {
      updatedPlan = { ...plan, rooms: plan.rooms.filter((room) => room.id !== id) };
    }

    onUpdatePlan(updatedPlan);
    onClose();
  };

  const renderDeleteButton = (label: string) => (
    <div className="border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={handleDeleteSelected}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 font-semibold text-rose-700 transition-colors hover:bg-rose-100"
      >
        <Trash2 className="h-4 w-4" />
        Hapus {label}
      </button>
    </div>
  );

  // Selected Furniture
  if (type === 'furniture') {
    const item = plan.furniture.find((f) => f.id === id);
    if (!item) return null;

    const handleUpdate = (updates: Partial<typeof item>) => {
      const updated = plan.furniture.map((f) => (f.id === id ? { ...f, ...updates } : f));
      onUpdatePlan({ ...plan, furniture: updated });
    };

    return (
      <div className="inspector-panel absolute top-16 right-4 z-20 w-80 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl p-4 text-xs select-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-cyan-600" />
            <span className="font-bold text-slate-900 text-sm truncate max-w-[200px]">{item.name}</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 pt-3">
          {/* Dimensions */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Dimensi (m)</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-400">Lebar (W)</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.2"
                  max="10"
                  value={item.width}
                  onChange={(e) => handleUpdate({ width: parseFloat(e.target.value) || item.width })}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Panjang (D)</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.2"
                  max="10"
                  value={item.depth}
                  onChange={(e) => handleUpdate({ depth: parseFloat(e.target.value) || item.depth })}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Tinggi (H)</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.2"
                  max="5"
                  value={item.height}
                  onChange={(e) => handleUpdate({ height: parseFloat(e.target.value) || item.height })}
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rotasi</span>
              <span className="font-mono text-slate-700">{Math.round(item.rotation)}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="15"
              value={item.rotation}
              onChange={(e) => handleUpdate({ rotation: parseInt(e.target.value, 10) })}
              className="w-full accent-cyan-600 cursor-pointer"
            />
          </div>

          {/* Color Finish */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Warna Perabot</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={item.color || '#475569'}
                onChange={(e) => handleUpdate({ color: e.target.value })}
                className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5"
              />
              <span className="font-mono text-slate-600 text-[11px]">{item.color || '#475569'}</span>
            </div>
          </div>
        </div>
        {renderDeleteButton('Perabot')}
      </div>
    );
  }

  // Selected Wall
  if (type === 'wall') {
    const wall = plan.walls.find((w) => w.id === id);
    if (!wall) return null;

    const handleUpdate = (updates: Partial<typeof wall>) => {
      const updated = plan.walls.map((w) => (w.id === id ? { ...w, ...updates } : w));
      onUpdatePlan({ ...plan, walls: updated });
    };

    const wallLength = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
    const handleUpdateLength = (value: string) => {
      const length = Number(value);
      if (!Number.isFinite(length) || length < 0.3 || length > 100) return;

      const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
      handleUpdate({
        end: {
          x: wall.start.x + Math.cos(angle) * length,
          y: wall.start.y + Math.sin(angle) * length,
        },
      });
    };

    const handleSetAsDefaultHeight = () => {
      onUpdatePlan({
        ...plan,
        defaultWallHeight: wall.height || 2.8,
        walls: plan.walls.map((w) => ({ ...w, height: wall.height || 2.8 })),
      });
    };

    return (
      <div className="inspector-panel absolute top-16 right-4 z-20 w-80 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl p-4 text-xs select-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-600" />
            <span className="font-bold text-slate-900 text-sm">Properti Dinding</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 pt-3">
          <div>
            <label htmlFor="wall-length" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Panjang Dinding (m)
            </label>
            <input
              id="wall-length"
              type="number"
              inputMode="decimal"
              step="0.05"
              min="0.3"
              max="100"
              value={Number(wallLength.toFixed(2))}
              onChange={(e) => handleUpdateLength(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Manual Wall Height Input (Requested Feature) */}
          <div className="p-3 bg-cyan-50/60 rounded-xl border border-cyan-200/80">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-cyan-950 uppercase tracking-wider">
                Tinggi Dinding (Manual)
              </label>
              <span className="text-[10px] text-cyan-700 font-mono font-semibold">Meter</span>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.05"
                min="0.5"
                max="12.0"
                value={wall.height ?? plan.defaultWallHeight ?? 2.8}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 2.8;
                  handleUpdate({ height: val });
                }}
                className="w-full px-3 py-1.5 bg-white border border-cyan-300 rounded-lg font-mono text-slate-900 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-slate-500 font-medium">m</span>
            </div>

            <button
              onClick={handleSetAsDefaultHeight}
              className="mt-2 text-[10px] font-semibold text-cyan-700 hover:text-cyan-900 hover:underline block"
            >
              Jadikan tinggi standar semua dinding
            </button>
          </div>

          {/* Thickness */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Ketebalan Dinding</label>
            <select
              value={wall.thickness}
              onChange={(e) => handleUpdate({ thickness: parseFloat(e.target.value) })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
            >
              <option value="0.10">10 cm (Partisi Tipis / Gypsum)</option>
              <option value="0.15">15 cm (Standar Bata Merah / Hebel)</option>
              <option value="0.20">20 cm (Dinding Struktural / Kolom)</option>
            </select>
          </div>

          {/* Wall Material */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Finishing Dinding</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'plaster-white', label: 'Plester Putih' },
                { id: 'warm-beige', label: 'Krem Hangat' },
                { id: 'modern-gray', label: 'Abu Modern' },
                { id: 'brick', label: 'Bata Ekspos' },
                { id: 'wood-slats', label: 'Kisi Kayu' },
              ].map((mat) => (
                <button
                  key={mat.id}
                  onClick={() => handleUpdate({ material: mat.id as WallMaterial })}
                  className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    wall.material === mat.id
                      ? 'bg-cyan-50 border-cyan-500 text-cyan-800 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {mat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 font-semibold text-rose-700 transition-colors hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" />
              Hapus Dinding
            </button>
            <p className="mt-1.5 text-center text-[10px] text-slate-500">
              Bukaan pintu atau jendela pada dinding ini juga akan dihapus.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Selected Room
  if (type === 'room') {
    const room = plan.rooms.find((r) => r.id === id);
    if (!room) return null;

    const handleUpdate = (updates: Partial<typeof room>) => {
      const updated = plan.rooms.map((r) => (r.id === id ? { ...r, ...updates } : r));
      onUpdatePlan({ ...plan, rooms: updated });
    };

    return (
      <div className="inspector-panel absolute top-16 right-4 z-20 w-80 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl p-4 text-xs select-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-cyan-600" />
            <span className="font-bold text-slate-900 text-sm">Properti Ruangan</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 pt-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Nama Ruangan</label>
            <input
              type="text"
              value={room.name}
              onChange={(e) => handleUpdate({ name: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Material Lantai Bawaan</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'parquet-oak', label: 'Parquet Kayu' },
                { id: 'tile-ceramic', label: 'Keramik 60×60' },
                { id: 'marble-white', label: 'Marmer Carrara' },
                { id: 'concrete', label: 'Semen Poles' },
                { id: 'carpet-grey', label: 'Karpet Wol' },
                { id: 'grass', label: 'Rumput Taman' },
              ].map((fm) => (
                <button
                  key={fm.id}
                  onClick={() => handleUpdate({ floorMaterial: fm.id as FloorMaterial })}
                  className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    room.floorMaterial === fm.id
                      ? 'bg-cyan-50 border-cyan-500 text-cyan-800 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {fm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick link to tile planner */}
          {onOpenTilePlanner && (
            <div className="pt-2">
              <button
                onClick={onOpenTilePlanner}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Uji Tata Letak & Keramik Ruang Ini</span>
              </button>
            </div>
          )}
        </div>
        {renderDeleteButton('Ruangan')}
      </div>
    );
  }

  // Selected Opening (Door/Window)
  if (type === 'opening') {
    const op = plan.openings.find((o) => o.id === id);
    if (!op) return null;

    const isDoor = op.type.startsWith('door');

    const handleUpdate = (updates: Partial<typeof op>) => {
      const updated = plan.openings.map((o) => (o.id === id ? { ...o, ...updates } : o));
      onUpdatePlan({ ...plan, openings: updated });
    };

    const DOOR_TYPES: { id: OpeningType; label: string; defaultW: number; defaultH: number }[] = [
      { id: 'door-single', label: 'Pintu Panel Tunggal', defaultW: 0.9, defaultH: 2.1 },
      { id: 'door-glass', label: 'Pintu Kaca Modern', defaultW: 0.9, defaultH: 2.2 },
      { id: 'door-double', label: 'Pintu Ganda / Kupu Tarung', defaultW: 1.5, defaultH: 2.2 },
      { id: 'door-sliding', label: 'Pintu Geser / Sliding', defaultW: 1.8, defaultH: 2.2 },
      { id: 'door-bifold', label: 'Pintu Lipat / Bifold', defaultW: 2.4, defaultH: 2.2 },
      { id: 'door-garage', label: 'Pintu Garasi / Rolling', defaultW: 2.8, defaultH: 2.4 },
    ];

    const WINDOW_TYPES: { id: OpeningType; label: string; defaultW: number; defaultH: number; defaultElev: number }[] = [
      { id: 'window-single', label: 'Casement 1 Daun', defaultW: 0.8, defaultH: 1.3, defaultElev: 0.9 },
      { id: 'window-double', label: 'Casement 2 Daun', defaultW: 1.4, defaultH: 1.4, defaultElev: 0.8 },
      { id: 'window-sliding', label: 'Geser Horizontal', defaultW: 1.6, defaultH: 1.3, defaultElev: 0.9 },
      { id: 'window-large', label: 'Kaca Panorama Lebar', defaultW: 2.0, defaultH: 1.6, defaultElev: 0.6 },
      { id: 'window-louver', label: 'Boven / Ventilasi Udara', defaultW: 0.6, defaultH: 0.5, defaultElev: 2.0 },
      { id: 'window-panorama', label: 'Kaca Lantai-ke-Plafon', defaultW: 2.4, defaultH: 2.4, defaultElev: 0.1 },
    ];

    return (
      <div className="inspector-panel absolute top-16 right-4 z-20 w-80 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl p-4 text-xs select-none">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {isDoor ? <DoorClosed className="w-4 h-4 text-cyan-600" /> : <AppWindow className="w-4 h-4 text-cyan-600" />}
            <span className="font-bold text-slate-900 text-sm">
              {isDoor ? 'Properti & Bukaan Pintu' : 'Properti Jendela'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 pt-3">
          {/* Multiple Door / Window Type Choices */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Pilihan Model {isDoor ? 'Pintu' : 'Jendela'}
            </label>
            <select
              value={op.type}
              onChange={(e) => {
                const newType = e.target.value as OpeningType;
                if (isDoor) {
                  const found = DOOR_TYPES.find((d) => d.id === newType);
                  if (found) {
                    handleUpdate({ type: newType, width: found.defaultW, height: found.defaultH });
                  }
                } else {
                  const found = WINDOW_TYPES.find((w) => w.id === newType);
                  if (found) {
                    handleUpdate({ type: newType, width: found.defaultW, height: found.defaultH, elevation: found.defaultElev });
                  }
                }
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            >
              {isDoor
                ? DOOR_TYPES.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.label}
                    </option>
                  ))
                : WINDOW_TYPES.map((wt) => (
                    <option key={wt.id} value={wt.id}>
                      {wt.label}
                    </option>
                  ))}
            </select>
          </div>

          {/* Door Swing & Hinge Orientation (Requested Feature) */}
          {isDoor && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">
                Penyesuaian Arah Bukaan Pintu
              </span>

              {/* Swing Direction (Inward / Outward) */}
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Arah Ayunan Pintu:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleUpdate({ swingDirection: 'inward' })}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-colors cursor-pointer ${
                      (op.swingDirection || 'inward') === 'inward'
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Buka ke Dalam
                  </button>
                  <button
                    onClick={() => handleUpdate({ swingDirection: 'outward' })}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-colors cursor-pointer ${
                      op.swingDirection === 'outward'
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Buka ke Luar
                  </button>
                </div>
              </div>

              {/* Hinge Side (Left / Right) */}
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Posisi Engsel Pintu:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleUpdate({ hingeSide: 'left' })}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-colors cursor-pointer ${
                      (op.hingeSide || 'left') === 'left'
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Engsel Kiri
                  </button>
                  <button
                    onClick={() => handleUpdate({ hingeSide: 'right' })}
                    className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-colors cursor-pointer ${
                      op.hingeSide === 'right'
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Engsel Kanan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Width & Height Dimensions */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-400">Lebar Bukaan (m)</span>
              <input
                type="number"
                step="0.05"
                min="0.4"
                max="5"
                value={op.width}
                onChange={(e) => handleUpdate({ width: parseFloat(e.target.value) || op.width })}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-400">Tinggi (m)</span>
              <input
                type="number"
                step="0.05"
                min="0.3"
                max="4"
                value={op.height}
                onChange={(e) => handleUpdate({ height: parseFloat(e.target.value) || op.height })}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
              />
            </div>
          </div>

          {/* Window Elevation from Floor */}
          {!isDoor && (
            <div>
              <span className="text-[10px] text-slate-400">Ketinggian dari Lantai / Sill (m)</span>
              <input
                type="number"
                step="0.05"
                min="0"
                max="2.5"
                value={op.elevation}
                onChange={(e) => handleUpdate({ elevation: parseFloat(e.target.value) || 0 })}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
              />
            </div>
          )}

          {/* Position Along Wall */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Posisi di Dinding</span>
              <span className="font-mono text-slate-700">{Math.round(op.position * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.01"
              value={op.position}
              onChange={(e) => handleUpdate({ position: parseFloat(e.target.value) })}
              className="w-full accent-cyan-600 cursor-pointer"
            />
          </div>
          {renderDeleteButton(isDoor ? 'Pintu' : 'Jendela')}
        </div>
      </div>
    );
  }

  return null;
};
