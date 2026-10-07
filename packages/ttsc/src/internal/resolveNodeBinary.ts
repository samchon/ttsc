import { SidecarEnvironment } from "../compiler/internal/sharedHost/SidecarEnvironment";
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
 * @evidence contracts/portability.md#os-neutral-implementation Executable discovery reads injected Windows environment names case-insensitively, measures candidates through native spawning and returns the child's absolute executable.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Candidate references and seen spellings are invocation-local and become reclaimable after return. The delegated synchronous probe owns child/capture cleanup and its persistent capability map; the four-candidate list does not bound that historical map, which has no eviction policy.
 * @evidence contracts/performance.md#efficient-algorithms At most four candidate slots are inspected with first-usable short-circuiting and exact-spelling deduplication. Environment-key/spelling work and delegated executable-byte identity, environment merge, native probing/parsing or descriptor-exhaustion retry costs dominate; four slots do not bound executable bytes, output text or native work.
 * @evidence contracts/performance.md#reuse-equivalent-work Exact duplicate spellings share one candidate probe within this call. The probe owner additionally reuses stable absolute same-executable capabilities only while byte/link/target identity and no-preload authority hold; relative, wrapper, changed and unproven failed candidates need fresh observation.
 */
export function resolveNodeBinary(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string | undefined {
  const candidates = [
    SidecarEnvironment.read(env, "TTSC_NODE_BINARY"),
    SidecarEnvironment.read(process.env, "TTSC_NODE_BINARY"),
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
