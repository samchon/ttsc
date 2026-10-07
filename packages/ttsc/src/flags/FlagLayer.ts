/**
 * Layers a flag can be consumed by. The order reflects the runtime pipeline:
 *
 * Launcher → runBuild → tsgo / native sidecars (host, lint).
 *
 * A flag must declare at least one consumer. `forwardTo` declares where the
 * flag travels when the consuming layer does not absorb it (e.g. ttsc-owned
 * flags that the JS launcher consumes and re-emits as different tsgo flags).
 *
 * @evidence contracts/common.md#principled-implementation These literals identify actual consumers in the launcher, build coordinator, native compiler and plugin hosts; consumedBy and forwardTo can therefore express ownership separately from transport.
 * @evidence contracts/common.md#clear-and-simple-design One shared vocabulary records the pipeline boundaries while FlagSpec owns per-flag routing, avoiding independent layer-specific interpretations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Host and lint identities name supported native boundaries; their fixed spellings are schema discriminants rather than fixture-dependent routing.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains pipeline order and consumption versus forwarding, with inline member context identifying the implementation owners in accordance with the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type FlagLayer =
  | "launcher" // JS layer (`runTtsc.ts` / `runTtsx.ts`)
  | "runBuild" // JS layer (`compiler/internal/build`) — internally adds the flag to tsgo
  | "tsgo" // tsgo binary (TypeScript-Go option parser)
  | "host" // native shared host (`utility/host.go`, `cmd/ttsc/build.go`)
  | "lint";
