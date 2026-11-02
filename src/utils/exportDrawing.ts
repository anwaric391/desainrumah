import { HousePlan, Point } from '../types/house';
import { angleBetween, distance } from './geometry';
import { jsPDF } from 'jspdf';

interface DrawingBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const getDrawingBounds = (plan: HousePlan): DrawingBounds => {
  const points: Point[] = [
    ...plan.walls.flatMap((wall) => [wall.start, wall.end]),
    ...plan.rooms.flatMap((room) => room.points),
    ...plan.furniture.flatMap((item) => {
      const angle = (item.rotation * Math.PI) / 180;
      return [
        { x: -item.width / 2, y: -item.depth / 2 },
        { x: item.width / 2, y: -item.depth / 2 },
        { x: item.width / 2, y: item.depth / 2 },
        { x: -item.width / 2, y: item.depth / 2 },
      ].map((point) => ({
        x: item.x + point.x * Math.cos(angle) - point.y * Math.sin(angle),
        y: item.y + point.x * Math.sin(angle) + point.y * Math.cos(angle),
      }));
    }),
  ];

  if (!points.length) return { minX: 0, minY: 0, maxX: 8, maxY: 8 };

  return {
    minX: Math.min(...points.map((point) => point.x)) - 1,
    minY: Math.min(...points.map((point) => point.y)) - 1,
    maxX: Math.max(...points.map((point) => point.x)) + 1,
    maxY: Math.max(...points.map((point) => point.y)) + 1,
  };
};

const escapeXml = (value: string): string =>
  value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]!);

export const createPlanSvg = (plan: HousePlan): string => {
  const bounds = getDrawingBounds(plan);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const strokeWidth = Math.max(width, height) / 400;
  const fontSize = Math.max(width, height) / 65;
  const toSvg = (point: Point) => ({
    x: point.x - bounds.minX,
    y: bounds.maxY - point.y,
  });
  const rooms = plan.rooms.map((room) => {
    if (!room.points.length) return '';
    const points = room.points.map(toSvg).map(({ x, y }) => `${x},${y}`).join(' ');
    const center = toSvg({
      x: room.points.reduce((sum, point) => sum + point.x, 0) / room.points.length,
      y: room.points.reduce((sum, point) => sum + point.y, 0) / room.points.length,
    });
    return `<polygon points="${points}" fill="#f1f5f9" stroke="#94a3b8" stroke-width="${strokeWidth}"/><text x="${center.x}" y="${center.y}" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" fill="#334155">${escapeXml(room.name)}</text>`;
  }).join('');
  const walls = plan.walls.map((wall) => {
    const start = toSvg(wall.start);
    const end = toSvg(wall.end);
    return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#0f172a" stroke-width="${Math.max(wall.thickness, strokeWidth * 3)}" stroke-linecap="square"/><text x="${(start.x + end.x) / 2}" y="${(start.y + end.y) / 2 - fontSize / 2}" text-anchor="middle" font-family="monospace" font-size="${fontSize * 0.75}" fill="#0369a1">${distance(wall.start, wall.end).toFixed(2)} m</text>`;
  }).join('');
  const openings = plan.openings.flatMap((opening) => {
    const wall = plan.walls.find((item) => item.id === opening.wallId);
    if (!wall) return [];
    const angle = angleBetween(wall.start, wall.end);
    const center = {
      x: wall.start.x + Math.cos(angle) * opening.position * distance(wall.start, wall.end),
      y: wall.start.y + Math.sin(angle) * opening.position * distance(wall.start, wall.end),
    };
    const halfWidth = opening.width / 2;
    const start = toSvg({
      x: center.x - Math.sin(angle) * halfWidth,
      y: center.y + Math.cos(angle) * halfWidth,
    });
    const end = toSvg({
      x: center.x + Math.sin(angle) * halfWidth,
      y: center.y - Math.cos(angle) * halfWidth,
    });
    return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${opening.type.startsWith('door') ? '#b45309' : '#0284c7'}" stroke-width="${strokeWidth * 2}" stroke-linecap="round"/>`;
  }).join('');
  const furniture = plan.furniture.map((item) => {
    const center = toSvg({ x: item.x, y: item.y });
    const rotation = -item.rotation;
    return `<rect x="${center.x - item.width / 2}" y="${center.y - item.depth / 2}" width="${item.width}" height="${item.depth}" rx="${strokeWidth}" fill="#dbeafe" stroke="#475569" stroke-width="${strokeWidth}" transform="rotate(${rotation} ${center.x} ${center.y})"/><text x="${center.x}" y="${center.y + fontSize / 3}" text-anchor="middle" font-family="sans-serif" font-size="${fontSize * 0.55}" fill="#334155">${escapeXml(item.name)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(plan.name)}">${rooms}${openings}${walls}${furniture}</svg>`;
};

export const createPlanDxf = (plan: HousePlan): string => {
  const entities: string[] = [];
  const addLine = (start: Point, end: Point, layer: string) => {
    entities.push([
      '0', 'LINE', '8', layer,
      '10', start.x.toFixed(4), '20', (-start.y).toFixed(4), '30', '0',
      '11', end.x.toFixed(4), '21', (-end.y).toFixed(4), '31', '0',
    ].join('\n'));
  };
  const addText = (point: Point, text: string, height: number, layer: string) => {
    entities.push([
      '0', 'TEXT', '8', layer,
      '10', point.x.toFixed(4), '20', (-point.y).toFixed(4), '30', '0',
      '40', height.toFixed(3), '1', text.slice(0, 120),
    ].join('\n'));
  };

  for (const wall of plan.walls) {
    addLine(wall.start, wall.end, 'WALLS');
    const mid = {
      x: (wall.start.x + wall.end.x) / 2,
      y: (wall.start.y + wall.end.y) / 2,
    };
    addText(mid, `${distance(wall.start, wall.end).toFixed(2)} m`, 0.12, 'DIMENSIONS');
  }

  const floorName = plan.floors?.find((floor) => floor.id === plan.activeFloorId)?.name;
  if (floorName) {
    const bounds = getDrawingBounds(plan);
    addText({ x: bounds.minX + 0.2, y: bounds.maxY - 0.2 }, floorName, 0.18, 'ROOMS');
  }

  for (const room of plan.rooms) {
    room.points.forEach((point, index) => {
      addLine(point, room.points[(index + 1) % room.points.length], 'ROOMS');
    });
    if (room.points.length) {
      addText({
        x: room.points.reduce((sum, point) => sum + point.x, 0) / room.points.length,
        y: room.points.reduce((sum, point) => sum + point.y, 0) / room.points.length,
      }, room.name, 0.18, 'ROOMS');
    }
  }

  for (const opening of plan.openings) {
    const wall = plan.walls.find((item) => item.id === opening.wallId);
    if (!wall) continue;
    const angle = angleBetween(wall.start, wall.end);
    const center = {
      x: wall.start.x + Math.cos(angle) * opening.position * distance(wall.start, wall.end),
      y: wall.start.y + Math.sin(angle) * opening.position * distance(wall.start, wall.end),
    };
    const halfWidth = opening.width / 2;
    addLine(
      { x: center.x - Math.sin(angle) * halfWidth, y: center.y + Math.cos(angle) * halfWidth },
      { x: center.x + Math.sin(angle) * halfWidth, y: center.y - Math.cos(angle) * halfWidth },
      opening.type.startsWith('door') ? 'DOORS' : 'WINDOWS'
    );
  }

  for (const item of plan.furniture) {
    const angle = (item.rotation * Math.PI) / 180;
    const corners = [
      { x: -item.width / 2, y: -item.depth / 2 },
      { x: item.width / 2, y: -item.depth / 2 },
      { x: item.width / 2, y: item.depth / 2 },
      { x: -item.width / 2, y: item.depth / 2 },
    ].map((point) => ({
      x: item.x + point.x * Math.cos(angle) - point.y * Math.sin(angle),
      y: item.y + point.x * Math.sin(angle) + point.y * Math.cos(angle),
    }));
    corners.forEach((point, index) => addLine(point, corners[(index + 1) % corners.length], 'FURNITURE'));
    addText({ x: item.x, y: item.y }, item.name, 0.12, 'FURNITURE');
  }

  return [
    '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', '6',
    ...[
      ['WALLS', '7'], ['ROOMS', '3'], ['DOORS', '1'], ['WINDOWS', '5'], ['FURNITURE', '4'], ['DIMENSIONS', '2'],
    ].flatMap(([name, color]) => ['0', 'LAYER', '2', name, '70', '0', '62', color, '6', 'CONTINUOUS']),
    '0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES',
    ...entities.flatMap((entity) => entity.split('\n')),
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
};

export const createPlanPdfBase64 = (plan: HousePlan): string => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bounds = getDrawingBounds(plan);
  const drawingWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const drawingHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const drawingArea = { x: 14, y: 38, width: pageWidth - 28, height: pageHeight - 52 };
  const scale = Math.min(drawingArea.width / drawingWidth, drawingArea.height / drawingHeight);
  const offsetX = drawingArea.x + (drawingArea.width - drawingWidth * scale) / 2;
  const offsetY = drawingArea.y + (drawingArea.height - drawingHeight * scale) / 2;
  const toPdf = (point: Point) => ({
    x: offsetX + (point.x - bounds.minX) * scale,
    y: offsetY + (bounds.maxY - point.y) * scale,
  });
  const floorName = plan.floors?.find((floor) => floor.id === plan.activeFloorId)?.name ?? 'Denah rumah';

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(plan.name, 14, 17);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`${floorName} | ${new Date().toLocaleDateString('id-ID')} | Desain Rumah PRO`, 14, 24);

  for (const room of plan.rooms) {
    if (room.points.length < 3) continue;
    const points = room.points.map(toPdf);
    const first = points[0];
    const relativePoints = points.slice(1).map((point): [number, number] => [
      point.x - first.x,
      point.y - first.y,
    ]);
    pdf.setFillColor(241, 245, 249);
    pdf.setDrawColor(148, 163, 184);
    pdf.setLineWidth(0.25);
    pdf.lines(relativePoints, first.x, first.y, [1, 1], 'FD', true);
    const center = toPdf({
      x: room.points.reduce((sum, point) => sum + point.x, 0) / room.points.length,
      y: room.points.reduce((sum, point) => sum + point.y, 0) / room.points.length,
    });
    pdf.setFontSize(7);
    pdf.setTextColor(51, 65, 85);
    pdf.text(room.name, center.x, center.y, { align: 'center' });
  }

  for (const wall of plan.walls) {
    const start = toPdf(wall.start);
    const end = toPdf(wall.end);
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(Math.max(0.6, wall.thickness * scale));
    pdf.line(start.x, start.y, end.x, end.y);
    if (distance(wall.start, wall.end) >= 0.8) {
      pdf.setFontSize(6);
      pdf.setTextColor(3, 105, 161);
      pdf.text(`${distance(wall.start, wall.end).toFixed(2)} m`, (start.x + end.x) / 2, (start.y + end.y) / 2 - 1);
    }
  }

  for (const opening of plan.openings) {
    const wall = plan.walls.find((item) => item.id === opening.wallId);
    if (!wall) continue;
    const angle = angleBetween(wall.start, wall.end);
    const wallLength = distance(wall.start, wall.end);
    const center = {
      x: wall.start.x + Math.cos(angle) * opening.position * wallLength,
      y: wall.start.y + Math.sin(angle) * opening.position * wallLength,
    };
    const halfWidth = opening.width / 2;
    const start = toPdf({
      x: center.x - Math.sin(angle) * halfWidth,
      y: center.y + Math.cos(angle) * halfWidth,
    });
    const end = toPdf({
      x: center.x + Math.sin(angle) * halfWidth,
      y: center.y - Math.cos(angle) * halfWidth,
    });
    const openingColor: [number, number, number] = opening.type.startsWith('door')
      ? [180, 83, 9]
      : [2, 132, 199];
    pdf.setDrawColor(...openingColor);
    pdf.setLineWidth(0.8);
    pdf.line(start.x, start.y, end.x, end.y);
  }

  for (const item of plan.furniture) {
    const angle = (item.rotation * Math.PI) / 180;
    const corners = [
      { x: -item.width / 2, y: -item.depth / 2 },
      { x: item.width / 2, y: -item.depth / 2 },
      { x: item.width / 2, y: item.depth / 2 },
      { x: -item.width / 2, y: item.depth / 2 },
    ].map((point) => toPdf({
      x: item.x + point.x * Math.cos(angle) - point.y * Math.sin(angle),
      y: item.y + point.x * Math.sin(angle) + point.y * Math.cos(angle),
    }));
    const first = corners[0];
    pdf.setFillColor(219, 234, 254);
    pdf.setDrawColor(71, 85, 105);
    pdf.setLineWidth(0.25);
    pdf.lines(corners.slice(1).map((point): [number, number] => [
      point.x - first.x,
      point.y - first.y,
    ]), first.x, first.y, [1, 1], 'FD', true);
  }

  return pdf.output('datauristring').split(',')[1];
};

export const printPlanToPdf = (plan: HousePlan): boolean => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeXml(plan.name)}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#0f172a;margin:0}header{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid #cbd5e1;padding-bottom:8px;margin-bottom:12px}h1{font-size:18px;margin:0}p{font-size:11px;color:#64748b;margin:4px 0 0}.drawing{height:175mm;width:100%}.drawing svg{width:100%;height:100%;object-fit:contain}</style></head><body><header><div><h1>${escapeXml(plan.name)}</h1><p>${escapeXml(plan.floors?.find((floor) => floor.id === plan.activeFloorId)?.name ?? 'Denah rumah')} · ${new Date().toLocaleDateString('id-ID')}</p></div><strong>Desain Rumah PRO</strong></header><main class="drawing">${createPlanSvg(plan)}</main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script></body></html>`);
  printWindow.document.close();
  return true;
};

export const downloadPlanDxf = (plan: HousePlan): void => {
  const blob = new Blob([createPlanDxf(plan)], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const floorName = plan.floors?.find((floor) => floor.id === plan.activeFloorId)?.name ?? '';
  const fileName = `${plan.name}_${floorName}_denah.dxf`
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
