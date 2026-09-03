export type AcademyTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
type ToolDocument = Document & { modelContext?: { registerTool: (tool: AcademyTool, options?: { signal?: AbortSignal }) => void | Promise<void> } };
export function registerAcademyTools(tools: AcademyTool[]): () => void {
  const context = (document as ToolDocument).modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  for (const tool of tools) {
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Unsupported registry must not block practice. */ }
  }
  return () => lifecycle.abort();
}
