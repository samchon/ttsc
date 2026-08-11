import { type ParseResult } from "../../flags/parser";

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
