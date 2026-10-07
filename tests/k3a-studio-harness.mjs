import { spawn } from 'node:child_process';

export const ALLOWED_ORIGIN = 'http://127.0.0.1:4213';
export const READY_MARKER = 'CZA_K3A_STUDIO_E2E_READY';
const SAFE_ENV_KEYS = ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR'];
const CREDENTIAL_NAME = /(DATABASE|POSTGRES|NEON|PRODUCTION|VERCEL|API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/i;

export function createChildEnvironment(source = process.env) {
  const environment = { NODE_ENV:'test', NO_PROXY:'127.0.0.1,localhost' };
  for (const key of SAFE_ENV_KEYS) if (source[key] !== undefined) environment[key] = source[key];
  assertCredentialFreeEnvironment(environment);
  return environment;
}

export function assertCredentialFreeEnvironment(environment) {
  const forbidden = Object.keys(environment).filter(key => CREDENTIAL_NAME.test(key));
  if (forbidden.length) throw new Error(`K3A_FORBIDDEN_CHILD_ENV:${forbidden.join(',')}`);
  return environment;
}

export function assertLocalTestRequest(rawUrl) {
  const requestUrl = new URL(rawUrl);
  if (requestUrl.origin !== ALLOWED_ORIGIN) throw new Error(`K3A_EXTERNAL_NETWORK_DENIED:${requestUrl.origin}`);
  return requestUrl;
}

export async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolveExit => child.once('exit', resolveExit));
  child.kill('SIGTERM');
  await Promise.race([exited, new Promise(resolveWait => setTimeout(resolveWait, 2_000))]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await exited;
  }
}

export async function startStudioServer({
  command = process.execPath,
  args = ['tests/k3a-studio-e2e-server.mjs'],
  timeoutMs = 20_000,
  onSpawn = () => {},
} = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: createChildEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  onSpawn(child);
  let output = '';
  try {
    await new Promise((ready, reject) => {
      let settled = false;
      const finish = callback => value => { if (settled) return; settled = true; clearTimeout(timeout); callback(value); };
      const timeout = setTimeout(() => finish(reject)(new Error(`K3A_STUDIO_SERVER_TIMEOUT\n${output}`)), timeoutMs);
      const inspect = chunk => { output += chunk.toString(); if (output.includes(READY_MARKER)) finish(ready)(); };
      child.stdout.on('data', inspect);
      child.stderr.on('data', inspect);
      child.once('exit', (code, signal) => finish(reject)(new Error(`K3A_STUDIO_SERVER_EXIT_${code ?? signal}\n${output}`)));
    });
    return child;
  } catch (error) {
    await stopChild(child);
    throw error;
  }
}
