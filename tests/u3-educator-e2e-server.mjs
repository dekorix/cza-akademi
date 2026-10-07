import tailwindcss from '@tailwindcss/postcss';
import { createServer } from 'vite';
import vinext from 'vinext';

const server = await createServer({
  root: process.cwd(),
  configFile: false,
  logLevel: 'error',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext()],
  server: { host: '127.0.0.1', port: 4183, strictPort: true },
});

async function closeServer() {
  await server.close();
  process.exit(0);
}
process.once('SIGINT', closeServer);
process.once('SIGTERM', closeServer);
await server.listen();
process.stdout.write('CZA_U3_E2E_READY\n');
await new Promise(() => {});
