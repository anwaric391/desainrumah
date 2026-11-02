/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { HousePlan } from '../../types/house';
import { distance, angleBetween, calculatePolygonArea, calculateCentroid, formatMeters } from '../../utils/geometry';
import { 
  X, 
  Download, 
  FileCode, 
  Upload, 
  Image as ImageIcon, 
  CheckCircle2,
  FileDown,
  Printer,
} from 'lucide-react';
import { createPlanDxf, createPlanPdfBase64, printPlanToPdf } from '../../utils/exportDrawing';
import { exportFile } from '../../utils/fileExport';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: HousePlan;
  onImportPlan: (plan: HousePlan) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  plan,
  onImportPlan,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    if (isOpen) setExportError('');
  }, [isOpen]);

  if (!isOpen) return null;

  // Export 2D Floor Plan as High-Res Blueprint PNG with Titleblock
  const handleExport2D = async () => {
    const floorName = plan.floors?.find((floor) => floor.id === plan.activeFloorId)?.name;
    const canvas = document.createElement('canvas');
    const width = 1920;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setExportError('Tidak dapat menyiapkan gambar denah untuk diekspor.');
      return;
    }

    // Background paper
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Architectural Drawing Border
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    // Titleblock at bottom-right
    const tbW = 420;
    const tbH = 120;
    const tbX = width - 36 - tbW;
    const tbY = height - 36 - tbH;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tbX, tbY, tbW, tbH);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.strokeRect(tbX, tbY, tbW, tbH);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('ARCHISTUDIO DESIGN', tbX + 16, tbY + 30);

    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(`Proyek: ${plan.name}${floorName ? ` | ${floorName}` : ''}`, tbX + 16, tbY + 54);

    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Skala Denah: 1 : 50 (Metrik)`, tbX + 16, tbY + 76);
    ctx.fillText(`Tanggal: ${new Date().toLocaleDateString('id-ID')} | Desain Rumah PRO`, tbX + 16, tbY + 96);

    // Compute plan bounds to center drawing
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    plan.walls.forEach((w) => {
      minX = Math.min(minX, w.start.x, w.end.x);
      maxX = Math.max(maxX, w.start.x, w.end.x);
      minY = Math.min(minY, w.start.y, w.end.y);
      maxY = Math.max(maxY, w.start.y, w.end.y);
    });

    if (minX === Infinity) {
      minX = 0; maxX = 8; minY = 0; maxY = 8;
    }

    const planW = Math.max(1, maxX - minX);
    const planH = Math.max(1, maxY - minY);

    // Scale to fit available drawing space
    const availW = width - 160;
    const availH = height - 200;
    const scale = Math.min(availW / planW, availH / planH, 70); // px per meter

    const offsetX = (width - planW * scale) / 2 - minX * scale;
    const offsetY = (height - planH * scale) / 2 - minY * scale - 20;

    const toScreen = (x: number, y: number) => ({
      x: x * scale + offsetX,
      y: y * scale + offsetY,
    });

    // 1. Draw Rooms
    plan.rooms.forEach((room) => {
      if (room.points.length < 3) return;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;

      ctx.beginPath();
      const p0 = toScreen(room.points[0].x, room.points[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < room.points.length; i++) {
        const pt = toScreen(room.points[i].x, room.points[i].y);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const c = calculateCentroid(room.points);
      const cScr = toScreen(c.x, c.y);
      const area = calculatePolygonArea(room.points);

      ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText(room.name, cScr.x, cScr.y - 8);

      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText(`${area.toFixed(1)} m²`, cScr.x, cScr.y + 12);
    });

    // 2. Draw Walls
    plan.walls.forEach((wall) => {
      const s = toScreen(wall.start.x, wall.start.y);
      const e = toScreen(wall.end.x, wall.end.y);

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(5, wall.thickness * scale);
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();

      // Dimension text
      const wallLen = distance(wall.start, wall.end);
      if (wallLen >= 0.8) {
        const midX = (s.x + e.x) / 2;
        const midY = (s.y + e.y) / 2;
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillStyle = '#0284c7';
        ctx.textAlign = 'center';
        ctx.fillText(formatMeters(wallLen), midX, midY - 10);
      }
    });

    // 3. Draw Openings
    plan.openings.forEach((op) => {
      const wall = plan.walls.find((w) => w.id === op.wallId);
      if (!wall) return;
      const wallLen = distance(wall.start, wall.end);
      const angle = angleBetween(wall.start, wall.end);
      const opX = wall.start.x + Math.cos(angle) * (op.position * wallLen);
      const opY = wall.start.y + Math.sin(angle) * (op.position * wallLen);
      const opScr = toScreen(opX, opY);
      const opW_px = op.width * scale;

      ctx.save();
      ctx.translate(opScr.x, opScr.y);
      ctx.rotate(angle);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-opW_px / 2, -wall.thickness * scale * 0.6, opW_px, wall.thickness * scale * 1.2);

      if (op.type.startsWith('door')) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-opW_px / 2, 0, opW_px, 0, Math.PI / 2);
        ctx.stroke();

        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-opW_px / 2, 0);
        ctx.lineTo(-opW_px / 2, opW_px);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.strokeRect(-opW_px / 2, -(wall.thickness * scale) / 2, opW_px, wall.thickness * scale);
      }
      ctx.restore();
    });

    // 4. Draw Furniture
    plan.furniture.forEach((f) => {
      const pos = toScreen(f.x, f.y);
      const wPx = f.width * scale;
      const dPx = f.depth * scale;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate((f.rotation * Math.PI) / 180);

      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-wPx / 2, -dPx / 2, wPx, dPx, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'center';
      ctx.fillText(f.name, 0, 4);
      ctx.restore();
    });

    try {
      await exportFile({
        fileName: `Denah_${plan.name}_${floorName ?? ''}_Desain_Rumah_PRO.png`,
        mimeType: 'image/png',
        data: canvas.toDataURL('image/png').split(',')[1],
        encoding: 'base64',
      });
      setExportError('');
      onClose();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Gagal mengekspor gambar denah.');
    }
  };

  // Export as JSON
  const handleExportJSON = async () => {
    try {
      await exportFile({
        fileName: `${plan.name}_desain_rumah_pro.json`,
        mimeType: 'application/json',
        data: JSON.stringify(plan, null, 2),
      });
      setExportError('');
      onClose();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Gagal mengekspor file proyek.');
    }
  };

  const handleExportPDF = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await exportFile({
          fileName: `${plan.name}_denah.pdf`,
          mimeType: 'application/pdf',
          data: createPlanPdfBase64(plan),
          encoding: 'base64',
        });
        setExportError('');
        onClose();
      } catch (error) {
        setExportError(error instanceof Error ? error.message : 'Gagal membuat file PDF.');
      }
      return;
    }
    if (!printPlanToPdf(plan)) {
      setExportError('Jendela cetak diblokir browser. Izinkan pop-up untuk menyimpan denah sebagai PDF.');
    }
  };

  const handleExportDxf = async () => {
    try {
      const floorName = plan.floors?.find((floor) => floor.id === plan.activeFloorId)?.name ?? '';
      await exportFile({
        fileName: `${plan.name}_${floorName}_denah.dxf`,
        mimeType: 'application/dxf',
        data: createPlanDxf(plan),
      });
      setExportError('');
      onClose();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Gagal mengekspor file DXF.');
    }
  };

  // Import JSON
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported && Array.isArray(imported.walls)) {
          onImportPlan(imported);
          onClose();
        } else {
          alert('Format file JSON tidak sesuai dengan format Desain Rumah PRO.');
        }
      } catch (err) {
        alert('Gagal membaca file JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Simpan & Ekspor Desain</h2>
            <p className="text-xs text-slate-500 mt-0.5">Ekspor gambar denah resolusi tinggi atau simpan berkas proyek.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 py-4 text-xs">
          {exportError && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
              {exportError}
            </p>
          )}
          {/* 1. Export 2D Blueprint PNG */}
          <div
            onClick={handleExport2D}
            className="p-4 rounded-2xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/40 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-cyan-100/70 text-cyan-800 rounded-xl group-hover:scale-105 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Unduh Denah Arsitektural (PNG HD)</h4>
                <p className="text-slate-500 mt-0.5">Gambar denah 2D resmi dengan kop proyek, skala metrik, dan ukuran ruangan.</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-cyan-700" />
          </div>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left transition-all hover:border-cyan-500 hover:bg-cyan-50/40"
          >
            <span className="flex items-center gap-3.5">
              <span className="rounded-xl bg-rose-100 p-2.5 text-rose-800"><Printer className="h-5 w-5" /></span>
              <span>
                <span className="block text-sm font-bold text-slate-900">Cetak / Simpan Denah (PDF)</span>
                <span className="mt-0.5 block text-slate-500">Buat PDF; di Android pilih aplikasi untuk menyimpan atau membagikan.</span>
              </span>
            </span>
            <FileDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={handleExportDxf}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left transition-all hover:border-cyan-500 hover:bg-cyan-50/40"
          >
            <span className="flex items-center gap-3.5">
              <span className="rounded-xl bg-violet-100 p-2.5 text-violet-800"><FileCode className="h-5 w-5" /></span>
              <span>
                <span className="block text-sm font-bold text-slate-900">Ekspor CAD (DXF)</span>
                <span className="mt-0.5 block text-slate-500">Dinding, ruang, bukaan, perabot, dan ukuran dalam satuan meter.</span>
              </span>
            </span>
            <Download className="h-4 w-4 shrink-0 text-slate-400" />
          </button>

          {/* 2. Export JSON File */}
          <div
            onClick={handleExportJSON}
            className="p-4 rounded-2xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/40 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-slate-100 text-slate-800 rounded-xl group-hover:scale-105 transition-transform">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Simpan Proyek (File JSON)</h4>
                <p className="text-slate-500 mt-0.5">Simpan ke komputer untuk diedit kembali kapan saja.</p>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-cyan-700" />
          </div>

          {/* 3. Import JSON File */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-4 rounded-2xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/40 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-100/70 text-emerald-800 rounded-xl group-hover:scale-105 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Buka / Impor File JSON</h4>
                <p className="text-slate-500 mt-0.5">Muat desain denah yang telah disimpan sebelumnya.</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
