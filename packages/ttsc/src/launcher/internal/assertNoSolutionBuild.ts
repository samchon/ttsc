import { type ParseResult } from "../../flags/ParseResult";

/**
 * Refuse tsgo's solution-build mode (`--build` / `-b`) in the launcher's own
 * voice, for whichever launcher parsed the arguments.
 *
 * Every ttsc build lane hands tsgo an argument list that opens with the project
 * ttsc resolved (`-p <tsconfig>` in `createTsgoBuildArgs`), because ttsc — not
 * tsgo — owns the `extends` chain, plugin config discovery, cache keys, and the
 * resident session's identity, and pins that one resolved project instead of
 * forwarding raw argv. A forwarded `--build` therefore always arrives after
 * `-p`, and tsgo replies "Option '--build' must be the first command line
 * argument" even though the user wrote it first. No spelling of the command
 * line can satisfy that diagnostic, so the flag is rejected here rather than
 * forwarded into an error that blames the user's argument order.
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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources assertNoSolutionBuild declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms assertNoSolutionBuild declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work assertNoSolutionBuild declares a signature only; the implementation owns any shared work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation assertNoSolutionBuild is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
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
