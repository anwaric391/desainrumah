/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ActiveTool, FurnitureCategory } from '../../types/house';
import { FURNITURE_CATALOG, CatalogItem } from '../../constants/catalog';
import { 
  MousePointer, 
  Square, 
  DoorClosed, 
  AppWindow, 
  Armchair, 
  Ruler, 
  Hand,
  ChevronRight,
  Layers,
  X,
  Search
} from 'lucide-react';

// Custom Wall Icon
const WallIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="12" y1="4" x2="12" y2="12" />
    <line x1="8" y1="12" x2="8" y2="20" />
    <line x1="16" y1="12" x2="16" y2="20" />
  </svg>
);

interface ToolbarProps {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
  selectedCatalogItem: CatalogItem | null;
  onSelectCatalogItem: (item: CatalogItem | null) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  selectedCatalogItem,
  onSelectCatalogItem,
}) => {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FurnitureCategory>('living');
  const [searchQuery, setSearchQuery] = useState('');

  const tools: { id: ActiveTool; label: string; icon: React.ReactNode; shortcut?: string }[] = [
    { id: 'select', label: 'Pilih / Geser', icon: <MousePointer className="w-5 h-5" />, shortcut: 'V' },
    { id: 'wall', label: 'Dinding', icon: <WallIcon />, shortcut: 'W' },
    { id: 'room-rect', label: 'Ruangan Kotak', icon: <Square className="w-5 h-5" />, shortcut: 'R' },
    { id: 'door', label: 'Pintu', icon: <DoorClosed className="w-5 h-5" />, shortcut: 'D' },
    { id: 'window', label: 'Jendela', icon: <AppWindow className="w-5 h-5" />, shortcut: 'J' },
    { id: 'furniture', label: 'Perabotan', icon: <Armchair className="w-5 h-5" />, shortcut: 'F' },
    { id: 'measure', label: 'Ukur Jarak', icon: <Ruler className="w-5 h-5" />, shortcut: 'M' },
    { id: 'pan', label: 'Geser Kanvas', icon: <Hand className="w-5 h-5" />, shortcut: 'H' },
  ];

  const handleToolClick = (toolId: ActiveTool) => {
    onSelectTool(toolId);
    if (toolId === 'furniture') {
      setIsCatalogOpen(true);
    } else {
      setIsCatalogOpen(false);
    }
  };

  const categories: { id: FurnitureCategory; label: string }[] = [
    { id: 'living', label: 'Ruang Tamu' },
    { id: 'bedroom', label: 'Kamar Tidur' },
    { id: 'kitchen', label: 'Dapur & Makan' },
    { id: 'bathroom', label: 'Kamar Mandi' },
    { id: 'outdoor', label: 'Eksterior' },
    { id: 'decor', label: 'Dekorasi' },
  ];

  const filteredCatalog = FURNITURE_CATALOG.filter((item) => {
    const matchesCategory = item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="toolbar-shell relative z-20 flex">
      {/* Primary Tool Strip */}
      <aside className="toolbar-tools w-16 bg-white border-r border-slate-200 flex flex-col items-center py-3 select-none shrink-0 shadow-sm">
        <div className="space-y-1.5 w-full px-2">
          {tools.map((t) => {
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleToolClick(t.id)}
                className={`toolbar-tool-button w-full flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title={`${t.label} (${t.shortcut})`}
              >
                {t.icon}
                <span className="text-[10px] font-medium tracking-tight mt-1 truncate max-w-full">
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Expandable Furniture Catalog Drawer */}
      {isCatalogOpen && (
        <div className="toolbar-catalog w-80 bg-white/95 backdrop-blur-md border-r border-slate-200 flex flex-col h-full shadow-2xl z-30 select-none animate-in slide-in-from-left duration-200">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Armchair className="w-4 h-4 text-cyan-600" />
              <h3 className="font-bold text-slate-900 text-sm">Katalog Perabotan</h3>
            </div>
            <button
              onClick={() => setIsCatalogOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari sofa, ranjang, meja..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex px-2 py-2 gap-1 border-b border-slate-100 overflow-x-auto text-xs">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  activeCategory === c.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Catalog Items Grid */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredCatalog.map((item) => {
              const isSelected = selectedCatalogItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectCatalogItem(item);
                    onSelectTool('furniture');
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-50 border-cyan-500 shadow-sm ring-1 ring-cyan-500'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-xs">{item.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.nameEn}</p>
                    </div>
                    <div 
                      className="w-4 h-4 rounded-md border border-slate-300 shrink-0" 
                      style={{ backgroundColor: item.defaultColor }}
                      title="Warna bawaan"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{item.description}</p>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>
                      {item.width}m × {item.depth}m (T: {item.height}m)
                    </span>
                    <span className="text-cyan-700 font-sans font-semibold">
                      {isSelected ? 'Terpilih (Klik Kanvas)' : 'Pilih'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
