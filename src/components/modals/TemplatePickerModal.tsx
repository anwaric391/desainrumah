/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HOUSE_TEMPLATES, PlanTemplate } from '../../constants/templates';
import { HousePlan } from '../../types/house';
import { X, Check, BedDouble, Bath, Maximize2 } from 'lucide-react';

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (plan: HousePlan) => void;
}

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm select-none">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Pilih Template Denah Rumah</h2>
            <p className="text-xs text-slate-500 mt-0.5">Mulai dengan denah standar arsitektur siap pakai atau kanvas kosong.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5 max-h-[70vh] overflow-y-auto">
          {HOUSE_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => {
                onSelectTemplate(tmpl.plan);
                onClose();
              }}
              className="p-4 rounded-2xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/30 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-cyan-700 transition-colors">
                    {tmpl.name}
                  </h3>
                  {tmpl.area > 0 && (
                    <span className="font-mono text-xs font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md">
                      {tmpl.area} m²
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 font-medium mt-1">{tmpl.subtitle}</p>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{tmpl.description}</p>
              </div>

              {tmpl.area > 0 && (
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <BedDouble className="w-4 h-4 text-slate-400" />
                    <span>{tmpl.bedrooms} Kamar Tidur</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Bath className="w-4 h-4 text-slate-400" />
                    <span>{tmpl.bathrooms} Kamar Mandi</span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
