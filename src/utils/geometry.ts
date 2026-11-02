/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Point, Wall, Opening } from '../types/house';

/**
 * Snaps a value to a given grid step (e.g. 0.1m, 0.25m, 0.5m)
 */
export function snapToGrid(val: number, step: number = 0.25): number {
  return Math.round(val / step) * step;
}

export function snapPointToGrid(p: Point, step: number = 0.25): Point {
  return {
    x: Math.round(p.x / step) * step,
    y: Math.round(p.y / step) * step,
  };
}

/**
 * Distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Angle in radians from p1 to p2
 */
export function angleBetween(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Snaps an angle to 45 or 90 degree increments if within threshold
 */
export function snapAngle(start: Point, target: Point, snapAngleStepDeg = 45, thresholdDeg = 6): Point {
  const dist = distance(start, target);
  if (dist < 0.001) return target;

  const currentAngleRad = Math.atan2(target.y - start.y, target.x - start.x);
  const currentAngleDeg = (currentAngleRad * 180) / Math.PI;
  const snappedAngleDeg = Math.round(currentAngleDeg / snapAngleStepDeg) * snapAngleStepDeg;

  if (Math.abs(currentAngleDeg - snappedAngleDeg) <= thresholdDeg) {
    const snappedRad = (snappedAngleDeg * Math.PI) / 180;
    return {
      x: start.x + dist * Math.cos(snappedRad),
      y: start.y + dist * Math.sin(snappedRad),
    };
  }
  return target;
}

/**
 * Finds closest point on a line segment to a target point
 */
export function closestPointOnSegment(p: Point, start: Point, end: Point): { point: Point; t: number; distance: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return { point: { ...start }, t: 0, distance: distance(p, start) };
  }

  let t = ((p.x - start.x) * dx + (p.y - start.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projPoint = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return {
    point: projPoint,
    t,
    distance: distance(p, projPoint),
  };
}

/**
 * Calculates the polygon area using Shoelace formula (result in m²)
 */
export function calculatePolygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

export function calculatePolygonCentroid(points: Point[]): Point {
  if (points.length < 3) return calculateCentroid(points);

  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    twiceArea += cross;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }

  if (Math.abs(twiceArea) < 1e-8) return calculateCentroid(points);
  return { x: x / (3 * twiceArea), y: y / (3 * twiceArea) };
}

export interface EnclosedWallFace {
  points: Point[];
  area: number;
  centroid: Point;
}

export function splitWallsAtIntersections(walls: Wall[], openings: Opening[]): {
  walls: Wall[];
  openings: Opening[];
} {
  const splitParameters = walls.map(() => [0, 1]);
  const addParameter = (index: number, value: number) => {
    if (value >= -1e-7 && value <= 1 + 1e-7) {
      splitParameters[index].push(Math.max(0, Math.min(1, value)));
    }
  };
  const parameterOnWall = (point: Point, wall: Wall): number => {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lengthSquared = dx * dx + dy * dy;
    return lengthSquared < 1e-12
      ? 0
      : ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lengthSquared;
  };
  const pointOnWall = (point: Point, wall: Wall): boolean => {
    const projection = closestPointOnSegment(point, wall.start, wall.end);
    return projection.distance <= 1e-6;
  };

  for (let firstIndex = 0; firstIndex < walls.length; firstIndex++) {
    const first = walls[firstIndex];
    const firstX = first.end.x - first.start.x;
    const firstY = first.end.y - first.start.y;
    for (let secondIndex = firstIndex + 1; secondIndex < walls.length; secondIndex++) {
      const second = walls[secondIndex];
      const secondX = second.end.x - second.start.x;
      const secondY = second.end.y - second.start.y;
      const denominator = firstX * secondY - firstY * secondX;
      const relativeX = second.start.x - first.start.x;
      const relativeY = second.start.y - first.start.y;

      if (Math.abs(denominator) > 1e-10) {
        const firstT = (relativeX * secondY - relativeY * secondX) / denominator;
        const secondT = (relativeX * firstY - relativeY * firstX) / denominator;
        if (firstT >= -1e-7 && firstT <= 1 + 1e-7 && secondT >= -1e-7 && secondT <= 1 + 1e-7) {
          addParameter(firstIndex, firstT);
          addParameter(secondIndex, secondT);
        }
        continue;
      }

      if (Math.abs(relativeX * firstY - relativeY * firstX) > 1e-7) continue;
      for (const point of [second.start, second.end]) {
        if (pointOnWall(point, first)) addParameter(firstIndex, parameterOnWall(point, first));
      }
      for (const point of [first.start, first.end]) {
        if (pointOnWall(point, second)) addParameter(secondIndex, parameterOnWall(point, second));
      }
    }
  }

  const usedIds = new Set(walls.map((wall) => wall.id));
  const segmentsByWallId = new Map<string, { startT: number; endT: number; wall: Wall }[]>();
  const connectedWalls: Wall[] = [];

  walls.forEach((wall, wallIndex) => {
    const sortedParameters = splitParameters[wallIndex].sort((a, b) => a - b);
    const uniqueParameters = sortedParameters.filter((value, index) =>
      index === 0 || value - sortedParameters[index - 1] > 1e-7
    );
    const segments: { startT: number; endT: number; wall: Wall }[] = [];

    for (let index = 0; index < uniqueParameters.length - 1; index++) {
      const startT = uniqueParameters[index];
      const endT = uniqueParameters[index + 1];
      if (endT - startT < 1e-7) continue;
      const pointAt = (t: number): Point => ({
        x: wall.start.x + (wall.end.x - wall.start.x) * t,
        y: wall.start.y + (wall.end.y - wall.start.y) * t,
      });
      let id = wall.id;
      if (index > 0) {
        id = `${wall.id}_joint_${index}`;
        let suffix = index;
        while (usedIds.has(id)) id = `${wall.id}_joint_${++suffix}`;
        usedIds.add(id);
      }
      const segment = { ...wall, id, start: pointAt(startT), end: pointAt(endT) };
      segments.push({ startT, endT, wall: segment });
      connectedWalls.push(segment);
    }
    segmentsByWallId.set(wall.id, segments);
  });

  const connectedOpenings = openings.map((opening) => {
    const segments = segmentsByWallId.get(opening.wallId);
    if (!segments || segments.length <= 1) return opening;
    const segment = segments.find(({ startT, endT }) =>
      opening.position >= startT - 1e-7 && opening.position <= endT + 1e-7
    ) ?? segments[segments.length - 1];
    return {
      ...opening,
      wallId: segment.wall.id,
      position: Math.max(0, Math.min(1,
        (opening.position - segment.startT) / (segment.endT - segment.startT)
      )),
    };
  });

  return { walls: connectedWalls, openings: connectedOpenings };
}

export function findEnclosedWallFaces(walls: Wall[]): EnclosedWallFace[] {
  walls = splitWallsAtIntersections(walls, []).walls;
  const nodes = new Map<string, Point>();
  const adjacency = new Map<string, Set<string>>();
  const edges = new Set<string>();
  const nodeKey = (point: Point) => `${Math.round(point.x * 1000)}:${Math.round(point.y * 1000)}`;

  for (const wall of walls) {
    const startKey = nodeKey(wall.start);
    const endKey = nodeKey(wall.end);
    if (startKey === endKey) continue;

    nodes.set(startKey, nodes.get(startKey) ?? wall.start);
    nodes.set(endKey, nodes.get(endKey) ?? wall.end);
    const edgeKey = startKey < endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
    if (edges.has(edgeKey)) continue;
    edges.add(edgeKey);

    if (!adjacency.has(startKey)) adjacency.set(startKey, new Set());
    if (!adjacency.has(endKey)) adjacency.set(endKey, new Set());
    adjacency.get(startKey)!.add(endKey);
    adjacency.get(endKey)!.add(startKey);
  }

  const orderedNeighbors = new Map<string, string[]>();
  for (const [key, neighbors] of adjacency) {
    const origin = nodes.get(key)!;
    orderedNeighbors.set(key, [...neighbors].sort((a, b) => {
      const pointA = nodes.get(a)!;
      const pointB = nodes.get(b)!;
      return Math.atan2(pointA.y - origin.y, pointA.x - origin.x)
        - Math.atan2(pointB.y - origin.y, pointB.x - origin.x);
    }));
  }

  const visited = new Set<string>();
  const faces: EnclosedWallFace[] = [];
  const directedKey = (from: string, to: string) => `${from}>${to}`;

  for (const edge of edges) {
    const [first, second] = edge.split('|');
    for (const [start, next] of [[first, second], [second, first]]) {
      const initialKey = directedKey(start, next);
      if (visited.has(initialKey)) continue;

      const facePoints: Point[] = [];
      let from = start;
      let to = next;
      let closed = false;
      for (let step = 0; step <= edges.size * 2; step++) {
        const key = directedKey(from, to);
        if (visited.has(key)) {
          closed = from === start && to === next;
          break;
        }
        visited.add(key);
        facePoints.push(nodes.get(from)!);

        const neighbors = orderedNeighbors.get(to);
        const reverseIndex = neighbors?.indexOf(from) ?? -1;
        if (!neighbors || reverseIndex < 0 || neighbors.length < 2) break;
        const following = neighbors[(reverseIndex - 1 + neighbors.length) % neighbors.length];
        from = to;
        to = following;
        if (from === start && to === next) {
          closed = true;
          break;
        }
      }

      if (!closed || facePoints.length < 3) continue;
      let signedArea = 0;
      for (let i = 0; i < facePoints.length; i++) {
        const current = facePoints[i];
        const following = facePoints[(i + 1) % facePoints.length];
        signedArea += current.x * following.y - following.x * current.y;
      }
      if (signedArea <= 0.01) continue;

      faces.push({
        points: facePoints,
        area: signedArea / 2,
        centroid: calculatePolygonCentroid(facePoints),
      });
    }
  }

  return faces;
}

/**
 * Computes polygon centroid
 */
export function calculateCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

/**
 * Checks if a point is inside a polygon (Ray-casting)
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculates wall length
 */
export function getWallLength(wall: Wall): number {
  return distance(wall.start, wall.end);
}

/**
 * Formats meter measurements nicely (e.g. 3.50 m)
 */
export function formatMeters(meters: number, precision = 2): string {
  return `${meters.toFixed(precision)} m`;
}

/**
 * Formats area nicely (e.g. 24.5 m²)
 */
export function formatArea(areaM2: number): string {
  return `${areaM2.toFixed(1)} m²`;
}

/**
 * Given a wall and its openings, splits the wall into solid subsegments and cutout intervals
 */
export interface WallSubsegment {
  startT: number; // 0 to 1
  endT: number;   // 0 to 1
}

export function computeWallSolidSegments(wall: Wall, openings: Opening[]): WallSubsegment[] {
  const wallLen = getWallLength(wall);
  if (wallLen < 0.01) return [];

  // Filter openings on this wall
  const wallOpenings = openings
    .filter((o) => o.wallId === wall.id)
    .map((o) => {
      const halfW = (o.width / 2) / wallLen;
      const startT = Math.max(0, o.position - halfW);
      const endT = Math.min(1, o.position + halfW);
      return { startT, endT, opening: o };
    })
    .sort((a, b) => a.startT - b.startT);

  const solidSegments: WallSubsegment[] = [];
  let currentT = 0;

  for (const op of wallOpenings) {
    if (op.startT > currentT + 0.005) {
      solidSegments.push({ startT: currentT, endT: op.startT });
    }
    currentT = Math.max(currentT, op.endT);
  }

  if (currentT < 0.995) {
    solidSegments.push({ startT: currentT, endT: 1 });
  }

  return solidSegments;
}
