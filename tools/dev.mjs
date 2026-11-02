import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['server.mjs', '--api-only'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port=3000', '--host=0.0.0.0'], { stdio: 'inherit' }),
];

const stopChildren = () => {
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
};

process.on('SIGINT', stopChildren);
process.on('SIGTERM', stopChildren);

for (const child of children) {
  child.on('exit', (code) => {
    if (code !== null && code !== 0) process.exitCode = code;
    stopChildren();
  });
}
