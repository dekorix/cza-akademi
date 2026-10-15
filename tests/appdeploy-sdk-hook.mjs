const mock = new URL('./appdeploy-sdk-mock.mjs', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@appdeploy/sdk') {
    return { url: mock.href, shortCircuit: true };
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch {
      // The bundler resolves extensionless TypeScript. Node only does that inside this test hook.
    }
  }
  return nextResolve(specifier, context);
}
