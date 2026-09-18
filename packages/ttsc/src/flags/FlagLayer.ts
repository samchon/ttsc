

/**
 * Layers a flag can be consumed by. The order reflects the runtime pipeline:
 *
 * Launcher → runBuild → tsgo / native sidecars (host, lint).
 *
 * A flag must declare at least one consumer. `forwardTo` declares where the
 * flag travels when the consuming layer does not absorb it (e.g. ttsc-owned
 * flags that the JS launcher consumes and re-emits as different tsgo flags).
 */
export type FlagLayer =
  | "launcher" // JS layer (`runTtsc.ts` / `runTtsx.ts`)
  | "runBuild" // JS layer (`compiler/internal/build`) — internally adds the flag to tsgo
  | "tsgo" // tsgo binary (TypeScript-Go option parser)
  | "host" // native shared host (`utility/host.go`, `cmd/ttsc/build.go`)
  | "lint";
