/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  HousePlan, 
  ActiveTool, 
  ViewMode, 
  CameraMode, 
  LightingTime, 
  WallCutMode 
} from './types/house';
import { HOUSE_TEMPLATES } from './constants/templates';
import { CatalogItem } from './constants/catalog';
import { TopNav } from './components/ui/TopNav';
import { Toolbar } from './components/ui/Toolbar';
import { FloorPlanEditor } from './components/2d/FloorPlanEditor';
import { ThreeViewport } from './components/3d/ThreeViewport';
import { InspectorPanel } from './components/ui/InspectorPanel';
import { TemplatePickerModal } from './components/modals/TemplatePickerModal';
import { ProjectSummaryModal } from './components/modals/ProjectSummaryModal';
import { ExportModal } from './components/modals/ExportModal';
import { TilePlannerModal } from './components/modals/TilePlannerModal';
import { FloorManager } from './components/ui/FloorManager';
import {
  addPlanFloor,
  deletePlanFloor,
  duplicatePlanFloor,
  normalizePlanFloors,
  renamePlanFloor,
  switchPlanFloor,
  syncActiveFloor,
} from './utils/floors';

export default function App() {
  // House Plan State (starts with Type 36 preloaded)
  const [plan, setPlan] = useState<HousePlan>(() => {
    const saved = localStorage.getItem('archistudio_current_plan');
    if (saved) {
      try {
        return normalizePlanFloors(JSON.parse(saved) as HousePlan);
      } catch (e) {
        // Fallback to default template
      }
    }
    return normalizePlanFloors(HOUSE_TEMPLATES[0].plan);
  });

  // History Stack for Undo/Redo
  const [history, setHistory] = useState<HousePlan[]>([plan]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Active Tool & Selection
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogItem | null>(null);
  const [selectedElement, setSelectedElement] = useState<{
    type: 'wall' | 'opening' | 'furniture' | 'room';
    id: string;
  } | null>(null);

  // View & 3D Settings
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    window.matchMedia('(max-width: 767px)').matches ? '2d' : 'split'
  );
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [lightingTime, setLightingTime] = useState<LightingTime>('day');
  const [wallCutMode, setWallCutMode] = useState<WallCutMode>('half'); // 1.2m half-cut by default so interior furniture is clearly visible!
  const [showRoof, setShowRoof] = useState(false);

  // Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTileModalOpen, setIsTileModalOpen] = useState(false);

  // Plan Update Handler with History tracking
  const handleUpdatePlan = useCallback((newPlan: HousePlan, recordHistory = true) => {
    const updatedPlan = syncActiveFloor(newPlan);
    setPlan(updatedPlan);
    localStorage.setItem('archistudio_current_plan', JSON.stringify(updatedPlan));

    if (recordHistory) {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        return [...next, updatedPlan];
      });
      setHistoryIndex((prev) => prev + 1);
    }
  }, [historyIndex]);

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPlan(history[newIndex]);
      localStorage.setItem('archistudio_current_plan', JSON.stringify(history[newIndex]));
    }
  }, [history, historyIndex]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPlan(history[newIndex]);
      localStorage.setItem('archistudio_current_plan', JSON.stringify(history[newIndex]));
    }
  }, [history, historyIndex]);

  // Template Selection
  const handleSelectTemplate = (templatePlan: HousePlan) => {
    handleUpdatePlan(normalizePlanFloors(templatePlan), true);
    setSelectedElement(null);
  };

  const handleSelectFloor = (floorId: string) => {
    handleUpdatePlan(switchPlanFloor(plan, floorId));
    setSelectedElement(null);
    setWallCutMode('half');
  };

  const handleDuplicateFloor = (floorId: string) => {
    handleUpdatePlan(duplicatePlanFloor(plan, floorId));
    setSelectedElement(null);
  };

  // Keyboard shortcut for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className="app-shell flex flex-col w-screen h-screen overflow-hidden bg-slate-900 text-slate-800 antialiased font-sans select-none">
      {/* Top Navigation Bar */}
      <TopNav
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenTemplates={() => setIsTemplateModalOpen(true)}
        onOpenSummary={() => setIsSummaryModalOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenTilePlanner={() => setIsTileModalOpen(true)}
        projectName={plan.name}
      />

      {/* Main Workspace Body */}
      <FloorManager
        floors={plan.floors ?? []}
        activeFloorId={plan.activeFloorId ?? ''}
        onSelectFloor={handleSelectFloor}
        onAddFloor={() => {
          handleUpdatePlan(addPlanFloor(plan));
          setSelectedElement(null);
        }}
        onRenameFloor={(floorId, name) => handleUpdatePlan(renamePlanFloor(plan, floorId, name))}
        onDeleteFloor={(floorId) => {
          if (plan.floors?.length === 1) return;
          if (!window.confirm('Hapus lantai ini beserta semua dinding, ruangan, pintu, jendela, dan perabotnya?')) return;
          handleUpdatePlan(deletePlanFloor(plan, floorId));
          setSelectedElement(null);
        }}
        onDuplicateFloor={handleDuplicateFloor}
      />
      <div className="workspace-shell flex flex-1 w-full min-h-0 overflow-hidden relative">
        {/* Left Vertical Architectural Toolbar */}
        <Toolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          selectedCatalogItem={selectedCatalogItem}
          onSelectCatalogItem={setSelectedCatalogItem}
        />

        {/* Central Work Area (2D, 3D, or Split) */}
        <main className="workspace-main flex-1 min-w-0 min-h-0 h-full flex overflow-hidden relative">
          {/* 2D Floor Plan Canvas Editor */}
          {(viewMode === '2d' || viewMode === 'split') && (
            <div className={`workspace-pane h-full relative ${viewMode === 'split' ? 'w-1/2 border-r border-slate-300' : 'w-full'}`}>
              <FloorPlanEditor
                plan={plan}
                activeTool={activeTool}
                selectedCatalogItem={selectedCatalogItem}
                onUpdatePlan={handleUpdatePlan}
                selectedElement={selectedElement}
                onSelectElement={setSelectedElement}
              />
            </div>
          )}

          {/* 3D Real-Time Viewport */}
          {(viewMode === '3d' || viewMode === 'split') && (
            <div className={`workspace-pane h-full relative ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
              <ThreeViewport
                plan={plan}
                cameraMode={cameraMode}
                onCameraModeChange={setCameraMode}
                lightingTime={lightingTime}
                onLightingTimeChange={setLightingTime}
                wallCutMode={wallCutMode}
                onWallCutModeChange={setWallCutMode}
                showRoof={showRoof}
                onToggleRoof={setShowRoof}
              />
            </div>
          )}

          {/* Properties Inspector Panel for Selected Item */}
          <InspectorPanel
            selectedElement={selectedElement}
            plan={plan}
            onUpdatePlan={handleUpdatePlan}
            onClose={() => setSelectedElement(null)}
            onOpenTilePlanner={() => setIsTileModalOpen(true)}
          />
        </main>
      </div>

      {/* Modal Dialogs */}
      <TemplatePickerModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      <ProjectSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        plan={plan}
        onUpdatePlan={handleUpdatePlan}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        plan={plan}
        onImportPlan={handleSelectTemplate}
      />

      {/* Dedicated Tile Studio & Flooring Planner Modal */}
      <TilePlannerModal
        isOpen={isTileModalOpen}
        onClose={() => setIsTileModalOpen(false)}
        plan={plan}
        onUpdatePlan={handleUpdatePlan}
      />
    </div>
  );
}
