import dotenv from 'dotenv';
import express from 'express';
import { recognizePlan } from './api/recognize-plan.mjs';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const allowedOrigins = new Set([
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  ...(process.env.ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
]);

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});
app.use(express.json({ limit: '9mb' }));
app.post('/api/recognize-plan', recognizePlan);

if (process.argv.includes('--api-only')) {
  app.listen(port, '127.0.0.1', () => {
    console.log(`Plan recognition API listening on http://127.0.0.1:${port}`);
  });
} else {
  app.use(express.static('dist'));
  app.get('*', (_req, res) => res.sendFile('index.html', { root: 'dist' }));
  app.listen(port, '0.0.0.0', () => {
    console.log(`Desain Rumah PRO server listening on port ${port}`);
  });
}
