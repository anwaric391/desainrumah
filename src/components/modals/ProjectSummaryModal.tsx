/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { HousePlan } from '../../types/house';
import { calculatePolygonArea, distance } from '../../utils/geometry';
import { X, FileSpreadsheet, Building, Layers, DoorClosed, Armchair, Edit3 } from 'lucide-react';

interface ProjectSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: HousePlan;
  onUpdatePlan: (plan: HousePlan) => void;
}

export const ProjectSummaryModal: React.FC<ProjectSummaryModalProps> = ({
  isOpen,
  onClose,
  plan,
  onUpdatePlan,
}) => {
  if (!isOpen) return null;

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(plan.name);

  // Compute Statistics
  let totalFloorArea = 0;
  const roomStats = plan.rooms.map((r) => {
    const area = calculatePolygonArea(r.points);
    totalFloorArea += area;
    return { name: r.name, area, material: r.floorMaterial };
  });

  let totalWallLength = 0;
  plan.walls.forEach((w) => {
    totalWallLength += distance(w.start, w.end);
  });

  const totalDoors = plan.openings.filter((o) => o.type.startsWith('door')).length;
  const totalWindows = plan.openings.filter((o) => o.type.startsWith('window')).length;

  const handleSaveName = () => {
    if (tempName.trim()) {
      onUpdatePlan({ ...plan, name: tempName.trim() });
    }
    setIsEditingName(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-50 rounded-xl text-cyan-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="text-base font-bold text-slate-900 border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    autoFocus
                  />
                  <button onClick={handleSaveName} className="text-xs bg-cyan-600 text-white px-2 py-1 rounded font-medium">
                    Simpan
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                  <button onClick={() => setIsEditingName(true)} className="text-slate-400 hover:text-slate-600">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500">Ringkasan Spesifikasi Arsitektural & Perkiraan Bahan</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto py-4 space-y-5 text-xs">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-medium text-slate-500 block mb-1">Total Luas Ruangan</span>
              <span className="text-xl font-bold font-mono text-cyan-700">{totalFloorArea.toFixed(1)}</span>
              <span className="text-[11px] text-slate-500 ml-1">m²</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-medium text-slate-500 block mb-1">Panjang Dinding</span>
              <span className="text-xl font-bold font-mono text-slate-800">{totalWallLength.toFixed(1)}</span>
              <span className="text-[11px] text-slate-500 ml-1">m'</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-medium text-slate-500 block mb-1">Total Bukaan</span>
              <span className="text-xl font-bold font-mono text-slate-800">{totalDoors + totalWindows}</span>
              <span className="text-[11px] text-slate-500 ml-1">unit</span>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              <span className="text-[11px] font-medium text-slate-500 block mb-1">Item Perabotan</span>
              <span className="text-xl font-bold font-mono text-slate-800">{plan.furniture.length}</span>
              <span className="text-[11px] text-slate-500 ml-1">buah</span>
            </div>
          </div>

          {/* Room Breakdown Table */}
          <div>
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-cyan-600" />
              <span>Daftar Ruangan & Luas</span>
            </h3>
            {roomStats.length === 0 ? (
              <p className="text-slate-400 italic py-2">Belum ada ruangan yang didaftarkan. Gunakan alat "Ruangan Kotak" untuk membuat ruangan otomatis.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px]">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Nama Ruangan</th>
                      <th className="py-2 px-3 font-semibold">Material Lantai</th>
                      <th className="py-2 px-3 font-semibold text-right">Luas (m²)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {roomStats.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-medium text-slate-900">{r.name}</td>
                        <td className="py-2 px-3 capitalize text-slate-500">{r.material.replace('-', ' ')}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-800">{r.area.toFixed(1)} m²</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Material & Construction Estimations */}
          <div>
            <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-600" />
              <span>Perkiraan Kebutuhan Material Dinding (Estimasi Awal)</span>
            </h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 space-y-1.5 leading-relaxed">
              <p>• Luas bidang dinding total: <strong className="text-slate-900 font-mono">{(totalWallLength * (plan.defaultWallHeight || 2.8) * 2).toFixed(1)} m²</strong> (2 sisi luar & dalam).</p>
              <p>• Estimasi bata ringan / hebel 10cm: <strong className="text-slate-900 font-mono">~{Math.round(totalWallLength * 2.8 * 8.3)} keping</strong>.</p>
              <p>• Pintu ({totalDoors} unit) & Jendela ({totalWindows} unit).</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
