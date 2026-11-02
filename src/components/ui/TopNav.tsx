/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ViewMode } from '../../types/house';
import { 
  Building2, 
  Download, 
  Undo2, 
  Redo2, 
  LayoutTemplate,
  FileSpreadsheet,
  Grid3X3
} from 'lucide-react';

interface TopNavProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenTemplates: () => void;
  onOpenSummary: () => void;
  onOpenExport: () => void;
  onOpenTilePlanner: () => void;
  projectName: string;
}

export const TopNav: React.FC<TopNavProps> = ({
  viewMode,
  onChangeViewMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenTemplates,
  onOpenSummary,
  onOpenExport,
  onOpenTilePlanner,
  projectName,
}) => {
  return (
    <header className="app-topnav h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8 select-none z-20 shrink-0">
      {/* Zone 1: Brand Wordmark (Single Text Element) */}
      <div className="topnav-actions flex items-center gap-3 shrink-0">
        <a href="/" className="flex items-center gap-2 text-slate-900 font-bold text-base tracking-tight whitespace-nowrap">
          <Building2 className="w-5 h-5 text-cyan-600" />
          <span>Desain Rumah PRO</span>
        </a>
        <span className="topnav-separator text-slate-300">/</span>
        <span className="topnav-project-name text-xs font-medium text-slate-600 truncate max-w-[160px] hidden md:inline">
          {projectName}
        </span>
      </div>

      {/* Zone 2: Navigation Links & View Modes */}
      <nav className="app-topnav-links flex items-center gap-3 text-xs font-medium text-slate-600">
        {/* View Mode Segmented Controls */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => onChangeViewMode('2d')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              viewMode === '2d'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Denah 2D
          </button>
          <button
            onClick={() => onChangeViewMode('split')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              viewMode === 'split'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Split View
          </button>
          <button
            onClick={() => onChangeViewMode('3d')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              viewMode === '3d'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pratinjau 3D
          </button>
        </div>

        {/* Undo & Redo */}
        <div className="topnav-history flex items-center gap-1 border-l border-slate-200 pl-3">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg transition-colors ${
              canUndo ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg transition-colors ${
              canRedo ? 'text-slate-700 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Dedicated Tile & Flooring Studio Link */}
        <button
          onClick={onOpenTilePlanner}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 font-semibold rounded-lg border border-cyan-200 transition-colors whitespace-nowrap cursor-pointer shadow-xs"
          title="Uji Pola Keramik, Tata Letak & Visualisasi Potongan Ubin Skala Nyata"
        >
          <Grid3X3 className="w-4 h-4 text-cyan-600" />
          <span>Pola Keramik & Lantai</span>
        </button>

        {/* Templates link */}
        <button
          onClick={onOpenTemplates}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
        >
          <LayoutTemplate className="w-4 h-4 text-slate-500" />
          <span>Pilih Template</span>
        </button>

        {/* Project Summary / BoQ link */}
        <button
          onClick={onOpenSummary}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer hidden lg:flex"
        >
          <FileSpreadsheet className="w-4 h-4 text-slate-500" />
          <span>Spesifikasi & BoQ</span>
        </button>
      </nav>

      {/* Zone 3: 1 Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenExport}
          aria-label="Simpan dan ekspor proyek"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span className="topnav-export-label">Simpan & Ekspor</span>
        </button>
      </div>
    </header>
  );
};
