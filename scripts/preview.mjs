import { staticServer } from './server.mjs';
const port = Number(process.argv[2] ?? 4173);
const server = staticServer();
server.listen(port, '0.0.0.0', () => console.log(`Squeek Sprouts: http://localhost:${port}/preview/ (Ctrl+C to stop)`));
process.on('SIGINT', () => server.close());
process.on('SIGTERM', () => server.close());
