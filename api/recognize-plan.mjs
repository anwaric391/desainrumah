import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.5-flash';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestsByAddress = new Map();

const isNormalizedPoint = (point) =>
  point
  && Number.isFinite(point.x)
  && Number.isFinite(point.y)
  && point.x >= 0
  && point.x <= 1
  && point.y >= 0
  && point.y <= 1;

const validatePlan = (value) => {
  if (!value || !Array.isArray(value.walls) || value.walls.length === 0 || value.walls.length > 300) {
    throw new Error('Model tidak menemukan garis dinding yang dapat digunakan.');
  }

  const walls = value.walls.filter((wall) =>
    isNormalizedPoint(wall.start)
    && isNormalizedPoint(wall.end)
    && Math.hypot(wall.start.x - wall.end.x, wall.start.y - wall.end.y) > 0.01
  );
  const rooms = Array.isArray(value.rooms)
    ? value.rooms
      .filter((room) => Array.isArray(room.points) && room.points.length >= 3 && room.points.length <= 30)
      .map((room) => ({
        name: typeof room.name === 'string' ? room.name.slice(0, 60) : 'Ruangan hasil scan',
        points: room.points.filter(isNormalizedPoint),
      }))
      .filter((room) => room.points.length >= 3)
    : [];

  if (!walls.length) throw new Error('Hasil pengenalan tidak memiliki garis dinding yang valid.');
  return { walls, rooms };
};

export async function recognizePlan(req, res) {
  const now = Date.now();
  const address = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const previous = requestsByAddress.get(address);
  if (previous && now - previous.startedAt < RATE_LIMIT_WINDOW_MS && previous.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Batas scan sementara tercapai. Coba lagi sebentar.' });
  }
  if (!previous || now - previous.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestsByAddress.set(address, { startedAt: now, count: 1 });
  } else {
    previous.count += 1;
  }
  if (requestsByAddress.size > 2000) {
    for (const [key, value] of requestsByAddress) {
      if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) requestsByAddress.delete(key);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'Fitur scan otomatis belum dikonfigurasi. Isi GEMINI_API_KEY pada server.',
    });
  }

  const image = req.body?.image;
  const match = typeof image === 'string'
    ? image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
    : null;
  if (!match || match[2].length > 8_000_000) {
    return res.status(400).json({ error: 'Gambar tidak valid atau ukurannya terlalu besar.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: 'user',
        parts: [
          {
            text: [
              'Analyze this floor-plan image and return only JSON with shape:',
              '{"walls":[{"start":{"x":0.1,"y":0.2},"end":{"x":0.8,"y":0.2}}],"rooms":[{"name":"Ruang Tamu","points":[{"x":0.1,"y":0.2},{"x":0.8,"y":0.2},{"x":0.8,"y":0.8}]}]}.',
              'Coordinates must be normalized to the full image bounds from 0 to 1, with x increasing right and y increasing down.',
              'Trace wall center-lines as straight segments, split walls at corners and junctions, and omit furniture, dimensions, text, symbols, and page borders.',
              'Return room polygons only when their boundaries are clearly closed and identifiable. Do not invent missing walls.',
              'Do not estimate real-world dimensions; the user will set scale separately.',
            ].join(' '),
          },
          { inlineData: { mimeType: match[1], data: match[2] } },
        ],
      }],
      config: { responseMimeType: 'application/json' },
    });

    const text = response.text?.trim();
    if (!text) throw new Error('Layanan AI mengembalikan hasil kosong.');
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Layanan AI mengembalikan format yang tidak dapat dibaca.');
    }

    return res.json(validatePlan(parsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kesalahan layanan AI.';
    console.error('Plan image recognition failed:', message);
    return res.status(502).json({ error: message });
  }
}
