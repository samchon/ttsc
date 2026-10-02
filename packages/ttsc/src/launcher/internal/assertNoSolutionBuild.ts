import { type ParseResult } from "../../flags/ParseResult";

/**
 * Refuse tsgo's solution-build mode (`--build` / `-b`) in the launcher's own
 * voice, for whichever launcher parsed the arguments.
 *
 * Project-dependent builds select one config for plugin discovery, cache keys
 * and resident identity. The direct compiler argv opens with that selection
 * (`-p <tsconfig>` in `createTsgoBuildArgs`); TypeScript-Go still reads its own
 * config and inheritance. Forwarding `--build` on this lane would place it
 * after `-p`, producing "Option '--build' must be the first command line
 * argument" even when the user wrote it first. Rejecting the unsupported mode
 * here preserves the single-project contract instead of blaming user order.
 *
 * Both launchers refuse it, because both reach tsgo through the same pinned
 * project. `ttsx` additionally builds one entry inside that project, so a mode
 * whose whole purpose is compiling many projects has nothing to mean there
 * either.
 *
 * Presence — not the parsed boolean — is what is refused: `--build false` still
 * asks for a mode ttsc does not implement, and silently consuming it would drop
 * the flag with no diagnostic at all.
 *
 * What this deliberately does not reach is a `--build` that belongs to the
 * program `ttsx` is running. `runTtsx` parses with
 * `forwardAfterFirstPositional` and `honorDoubleDashSeparator`, so a token
 * after the entry lands in `result.tail` and never in `result.values`; reading
 * `values` is what keeps `ttsx script.ts --build` the user program's own flag.
 *
 * @evidence contracts/common.md#principled-implementation Presence in the launcher's parsed values identifies a requested unsupported compiler mode; the program's post-entry arguments are outside this map.
 * @evidence contracts/common.md#clear-and-simple-design A shared pre-build guard owns this unsupported-mode diagnostic for both launchers instead of rewriting compiler argument order.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The rejection follows the supported single-project contract, including an explicit false token, without compensating for a tsgo diagnostic through a synthetic solution build.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain pinned-project semantics, presence detection and the boundary with user-program flags, with tags separated from prose.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources One presence check returns or throws without retaining the parsed map or acquiring a native resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One canonical-key membership check makes a fixed mode decision; flag parsing and compiler execution belong to their existing owners.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A mode refusal coordinates no producer computation or cross-call result.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This guard inspects a canonical option key and constructs diagnostic text; native paths, processes and OS capability discovery are outside its operation.
 */
export function assertNoSolutionBuild(
  result: ParseResult,
  errorPrefix: string,
): void {
  if (!result.values.has("--build")) return;
  throw new Error(
    `${errorPrefix} --build (solution mode) is not supported; ttsc resolves and pins one project per run, so compile each referenced project with its own ttsc -p <tsconfig> run`,
  );
}
