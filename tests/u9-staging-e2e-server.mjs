import tailwindcss from '@tailwindcss/postcss';
import { createServer } from 'vite';
import vinext from 'vinext';

const server=await createServer({
  root:process.cwd(),
  configFile:false,
  logLevel:'error',
  css:{postcss:{plugins:[tailwindcss()]}},
  plugins:[vinext()],
  server:{host:'127.0.0.1',port:4209,strictPort:true},
});
const close=async()=>{await server.close();process.exit(0);};
process.once('SIGINT',close);
process.once('SIGTERM',close);
await server.listen();
process.stdout.write('CZA_U9_E2E_READY\n');
await new Promise(()=>{});
