// Test-only loader. Redirects @appdeploy/sdk to the in-process fake installed by the SEC-A test.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@appdeploy/sdk') return { url: 'cza-appdeploy-sdk:mock', shortCircuit: true };
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
    try {
      return await nextResolve(specifier, context);
    } catch (error) {
      if (error && error.code === 'ERR_MODULE_NOT_FOUND') return nextResolve(specifier + '.ts', context);
      throw error;
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === 'cza-appdeploy-sdk:mock') {
    return {
      format: 'module',
      shortCircuit: true,
      source: `const sdk = globalThis.__CZA_ASSESSMENT_SDK;
export const db = sdk.db;
export const router = sdk.router;
export const json = sdk.json;
export const error = sdk.error;
export const storage = sdk.storage;
`,
    };
  }
  return nextLoad(url, context);
}
