import tailwindcss from '@tailwindcss/postcss';
import { createServer } from 'vite';
import vinext from 'vinext';

const server = await createServer({
  root: process.cwd(),
  configFile: false,
  logLevel: 'error',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext()],
  server: { host: '127.0.0.1', port: 4177, strictPort: true },
});

let closing = false;

async function closeServer() {
  if (closing) return;
  closing = true;
  await server.close();
  process.exit(0);
}

process.once('SIGINT', closeServer);
process.once('SIGTERM', closeServer);

await server.listen();
process.stdout.write('CZA_PHASE2_E2E_READY\n');
await new Promise(() => {});
