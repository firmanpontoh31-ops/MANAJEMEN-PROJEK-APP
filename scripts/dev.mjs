/**
 * Menjalankan backend (:3001) dan frontend (:5173) bersamaan dari root:
 *   npm run dev
 * Output tiap proses diberi label [server] / [client].
 * Ctrl+C menghentikan keduanya.
 */
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of children) {
    if (p.exitCode === null && !p.killed) {
      try {
        p.kill('SIGTERM');
      } catch {
        /* proses mungkin sudah mati */
      }
    }
  }
  setTimeout(() => process.exit(code), 300);
}

const children = [];

const targets = [
  { name: 'server', color: '\x1b[36m', args: ['run', 'dev', '-w', 'server'] },
  { name: 'client', color: '\x1b[35m', args: ['run', 'dev', '-w', 'client'] },
];

for (const t of targets) {
  const child = spawn(npm, t.args, {
    shell: isWin,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  const tag = `${t.color}[${t.name}]\x1b[0m `;

  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      for (const line of lines) out.write(tag + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    process.stdout.write(`${tag}berhenti (kode ${code ?? 0})\n`);
    if (!shuttingDown) shutdown(code ?? 0);
  });

  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Menjalankan ProjectMS — backend http://localhost:3001 · frontend http://localhost:5173');
console.log('Tekan Ctrl+C untuk berhenti.');
