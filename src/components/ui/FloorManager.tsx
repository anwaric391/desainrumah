import React, { useState } from 'react';
import { Copy, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { PlanFloor } from '../../types/house';

interface FloorManagerProps {
  floors: PlanFloor[];
  activeFloorId: string;
  onSelectFloor: (id: string) => void;
  onAddFloor: () => void;
  onRenameFloor: (id: string, name: string) => void;
  onDeleteFloor: (id: string) => void;
  onDuplicateFloor: (id: string) => void;
}

export const FloorManager: React.FC<FloorManagerProps> = ({
  floors,
  activeFloorId,
  onSelectFloor,
  onAddFloor,
  onRenameFloor,
  onDeleteFloor,
  onDuplicateFloor,
}) => {
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const activeFloor = floors.find((floor) => floor.id === activeFloorId);

  const startEditing = (floor: PlanFloor) => {
    setEditingFloorId(floor.id);
    setEditingName(floor.name);
  };

  const finishEditing = () => {
    if (editingFloorId) onRenameFloor(editingFloorId, editingName);
    setEditingFloorId(null);
  };

  return (
    <section className="floor-manager flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5">
      <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Layers className="h-4 w-4 text-cyan-600" />
        <span className="hidden sm:inline">Lantai</span>
      </div>

      <div className="floor-tabs flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {floors.map((floor) => (
          <div
            key={floor.id}
            className={`floor-tab flex shrink-0 items-center rounded-lg border text-xs ${
              floor.id === activeFloorId
                ? 'border-cyan-300 bg-cyan-50 text-cyan-900'
                : 'border-transparent text-slate-600 hover:bg-slate-100'
            }`}
          >
            {editingFloorId === floor.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(event) => setEditingName(event.target.value)}
                onBlur={finishEditing}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') finishEditing();
                  if (event.key === 'Escape') setEditingFloorId(null);
                }}
                aria-label="Nama lantai"
                className="w-24 rounded-md bg-white px-2 py-1.5 text-xs outline-none ring-1 ring-cyan-400"
              />
            ) : (
              <button
                type="button"
                onClick={() => onSelectFloor(floor.id)}
                className="max-w-32 truncate px-2.5 py-1.5 font-semibold"
                aria-pressed={floor.id === activeFloorId}
              >
                {floor.name}
              </button>
            )}
            {floor.id === activeFloorId && editingFloorId !== floor.id && (
              <div className="floor-tab-actions flex items-center pr-1">
                <button type="button" onClick={() => startEditing(floor)} className="rounded p-1 text-slate-500 hover:bg-white hover:text-cyan-700" title="Ubah nama lantai">
                  <Pencil className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => onDuplicateFloor(floor.id)} className="rounded p-1 text-slate-500 hover:bg-white hover:text-cyan-700" title="Duplikat lantai">
                  <Copy className="h-3 w-3" />
                </button>
                {floors.length > 1 && (
                  <button type="button" onClick={() => onDeleteFloor(floor.id)} className="rounded p-1 text-slate-500 hover:bg-white hover:text-rose-700" title="Hapus lantai">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddFloor}
        aria-label="Tambah lantai"
        className="flex shrink-0 items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Tambah lantai</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {activeFloor?.name ?? ''}
      </span>
    </section>
  );
};
