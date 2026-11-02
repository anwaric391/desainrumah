import { HousePlan, PlanFloor } from '../types/house';

const createFloorSnapshot = (plan: HousePlan, id: string, name: string): PlanFloor => ({
  id,
  name,
  walls: plan.walls,
  openings: plan.openings,
  rooms: plan.rooms,
  furniture: plan.furniture,
  referenceImage: plan.referenceImage,
});

export const normalizePlanFloors = (plan: HousePlan): HousePlan => {
  if (plan.floors?.length) {
    const activeFloor = plan.floors.find((floor) => floor.id === plan.activeFloorId) ?? plan.floors[0];
    const referenceImage = Object.prototype.hasOwnProperty.call(plan, 'referenceImage')
      ? plan.referenceImage
      : activeFloor.referenceImage;
    return {
      ...plan,
      activeFloorId: activeFloor.id,
      floors: plan.floors,
      walls: plan.walls ?? activeFloor.walls ?? [],
      openings: plan.openings ?? activeFloor.openings ?? [],
      rooms: plan.rooms ?? activeFloor.rooms ?? [],
      furniture: plan.furniture ?? activeFloor.furniture ?? [],
      referenceImage,
    };
  }

  const floor = createFloorSnapshot(plan, 'floor-1', 'Lantai 1');
  return { ...plan, activeFloorId: floor.id, floors: [floor] };
};

export const syncActiveFloor = (plan: HousePlan): HousePlan => {
  const normalized = normalizePlanFloors(plan);
  const activeFloorId = normalized.activeFloorId!;
  const floors = normalized.floors!.map((floor) =>
    floor.id === activeFloorId
      ? createFloorSnapshot(normalized, floor.id, floor.name)
      : floor
  );
  return { ...normalized, floors };
};

export const switchPlanFloor = (plan: HousePlan, floorId: string): HousePlan => {
  const normalized = syncActiveFloor(plan);
  const floor = normalized.floors!.find((item) => item.id === floorId);
  if (!floor || floor.id === normalized.activeFloorId) return normalized;

  return {
    ...normalized,
    activeFloorId: floor.id,
    walls: floor.walls,
    openings: floor.openings,
    rooms: floor.rooms,
    furniture: floor.furniture,
    referenceImage: floor.referenceImage,
  };
};

export const addPlanFloor = (plan: HousePlan): HousePlan => {
  const normalized = syncActiveFloor(plan);
  const existingNames = new Set(normalized.floors!.map((floor) => floor.name));
  let number = 1;
  while (existingNames.has(`Lantai ${number}`)) number += 1;
  const floor: PlanFloor = {
    id: `floor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: `Lantai ${number}`,
    walls: [],
    openings: [],
    rooms: [],
    furniture: [],
    referenceImage: undefined,
  };

  return {
    ...normalized,
    floors: [...normalized.floors!, floor],
    activeFloorId: floor.id,
    walls: floor.walls,
    openings: floor.openings,
    rooms: floor.rooms,
    furniture: floor.furniture,
    referenceImage: floor.referenceImage,
  };
};

export const duplicatePlanFloor = (plan: HousePlan, floorId: string): HousePlan => {
  const normalized = syncActiveFloor(plan);
  const source = normalized.floors!.find((floor) => floor.id === floorId);
  if (!source) return normalized;

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const idMap = new Map(source.walls.map((wall) => [wall.id, `${wall.id}_${suffix}`]));
  const floor: PlanFloor = {
    id: `floor-${suffix}`,
    name: `${source.name} (salinan)`,
    walls: source.walls.map((wall) => ({ ...wall, id: idMap.get(wall.id)! })),
    openings: source.openings.map((opening) => ({
      ...opening,
      id: `${opening.id}_${suffix}`,
      wallId: idMap.get(opening.wallId) ?? opening.wallId,
    })),
    rooms: source.rooms.map((room) => ({ ...room, id: `${room.id}_${suffix}` })),
    furniture: source.furniture.map((item) => ({ ...item, id: `${item.id}_${suffix}` })),
    referenceImage: source.referenceImage ? { ...source.referenceImage, center: { ...source.referenceImage.center } } : undefined,
  };

  return {
    ...normalized,
    floors: [...normalized.floors!, floor],
    activeFloorId: floor.id,
    walls: floor.walls,
    openings: floor.openings,
    rooms: floor.rooms,
    furniture: floor.furniture,
    referenceImage: floor.referenceImage,
  };
};

export const renamePlanFloor = (plan: HousePlan, floorId: string, name: string): HousePlan => {
  const normalized = syncActiveFloor(plan);
  const cleanName = name.trim();
  if (!cleanName) return normalized;
  return {
    ...normalized,
    floors: normalized.floors!.map((floor) =>
      floor.id === floorId ? { ...floor, name: cleanName } : floor
    ),
  };
};

export const deletePlanFloor = (plan: HousePlan, floorId: string): HousePlan => {
  const normalized = syncActiveFloor(plan);
  if (normalized.floors!.length <= 1) return normalized;

  const floors = normalized.floors!.filter((floor) => floor.id !== floorId);
  if (floorId !== normalized.activeFloorId) return { ...normalized, floors };

  const activeFloor = floors[0];
  return {
    ...normalized,
    floors,
    activeFloorId: activeFloor.id,
    walls: activeFloor.walls,
    openings: activeFloor.openings,
    rooms: activeFloor.rooms,
    furniture: activeFloor.furniture,
    referenceImage: activeFloor.referenceImage,
  };
};
