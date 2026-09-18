import { javascriptRuntimeCapabilities } from "./javascriptRuntimeCapabilities";

/**
 * Locate a real Node runtime for ttsx and native JavaScript config loaders.
 *
 * Bun can directly evaluate a descriptor, but it does not implement the
 * synchronous `module.registerHooks` contract used by those loaders.
 */
export function resolveNodeBinary(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string | undefined {
  const candidates = [
    env.TTSC_NODE_BINARY,
    process.env.TTSC_NODE_BINARY,
    process.execPath,
    "node",
  ];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (candidate === undefined || candidate.trim() === "") continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const capabilities = javascriptRuntimeCapabilities(candidate, env, cwd);
    if (
      !capabilities.bun &&
      capabilities.registerHooks &&
      capabilities.executable !== undefined
    ) {
      return capabilities.executable;
    }
  }
  return undefined;
}
