import { javascriptRuntimeCapabilities } from "./javascriptRuntimeCapabilities";

/**
 * Locate a real Node runtime for ttsx and native JavaScript config loaders.
 *
 * Bun can directly evaluate a descriptor, but it does not implement the
 * synchronous `module.registerHooks` contract used by those loaders.
 *
 * @evidence contracts/common.md#principled-implementation Ordered candidates are accepted only after an actual runtime probe reports non-Bun registerHooks support and its absolute executable; names alone do not establish the loader capability.
 * @evidence contracts/common.md#clear-and-simple-design Candidate precedence and duplicate suppression remain here, while the shared probe owns launch, capability parsing and freshness policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The node spelling is a supported final discovery candidate, not an assumed successful runtime; incompatible candidates are skipped without patching modules or globals.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the consumer and the required synchronous hook capability, while the selection loop makes precedence apparent without redundant prose.
 * @evidence contracts/portability.md#os-neutral-implementation Executable discovery is measured through native spawning and returns the child's absolute executable rather than hardcoding an installation path or platform-specific shell command.
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
