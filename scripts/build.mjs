import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Deployment is an exact copy. Source index.html also works on any static HTTP server.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('assets', 'dist/assets', { recursive: true });
await mkdir('dist/src', { recursive: true });
for (const name of await readdir('src')) if (/\.(js|css)$/.test(name)) await cp(join('src', name), join('dist/src', name));
const html = await readFile('dist/index.html', 'utf8');
for (const match of html.matchAll(/(?:src|href|content)="(\.\/[^"#]+)"/g)) {
  if (!(await stat(join('dist', match[1]))).isFile()) throw new Error(`Missing asset: ${match[1]}`);
}
let bytes = 0, count = 0;
async function measure(path) { for (const file of await readdir(path, { withFileTypes: true })) { const child = join(path, file.name); if (file.isDirectory()) await measure(child); else { bytes += (await stat(child)).size; count++; } } }
await measure('dist');
console.log(`Static export ready: ${count} files, ${bytes.toLocaleString()} bytes. No bundler or runtime dependencies.`);
