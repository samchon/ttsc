import { SidecarEnvironment } from "../sharedHost/SidecarEnvironment";

/**
 * Project an environment onto the variables a runtime build's own processes
 * read, as the environment part of its input snapshot.
 *
 * The whole environment is not an input of a compile. A package manager exports
 * the script's own arguments (`npm_lifecycle_script`), a shell its session
 * (`WT_SESSION`, `_`), and CI its run number, so a key over every variable
 * changed with each invocation and no completed emit was found again
 * (samchon/ttsc#1852). Three consumers read variables, and each is keyed by
 * what it reads:
 *
 * - Ttsc and its first-party plugins read their own `TTSC_` and `TTSX_` names,
 *   which select the compiler, the plugin set, their configuration directory
 *   and their helper runtimes. Two kinds of that namespace are left out: the
 *   per-run `TTSX_RUNTIME_` channels, which name this run's directories, and
 *   the reporting switches `TTSC_EXPLAIN_CACHE` and `TTSC_E2E_TRACE`, which
 *   only make a build describe itself, so asking why a run missed does not
 *   itself cause a miss.
 * - A JavaScript helper a plugin starts loads its modules under `NODE_OPTIONS`
 *   and `NODE_PATH`.
 * - The upstream compiler reads variables only to decide how diagnostics are
 *   drawn (`internal/execute/tsc/diagnostics.go`): `NO_COLOR` and `FORCE_COLOR`
 *   select color for an output that is not a terminal, which a captured runtime
 *   build never is, and the terminal's capabilities are consulted only once
 *   color is on. The projection keeps those decisions, not the values, so a new
 *   terminal tab is not a new compile.
 *
 * A linked native plugin declares any other variable at its read site through
 * `PluginContext.Env`; the build records it and admission replays it against
 * the current environment. A project whose plugin has not declared that it
 * reads variables only that way (`capabilities.environmentInputs`) is not given
 * this projection: its caller keys it by the complete environment. A descriptor
 * or an executable configuration file that reads an undeclared variable is
 * outside every proof here, as it is for the plugin configuration caches; `ttsx
 * --no-cache` is its opt-out.
 *
 * @param env Complete merged environment the build spawns its processes under.
 * @returns Name-ordered rows; equal projections spawn equal compiles.
 * @evidence contracts/common.md#principled-implementation Each row belongs to a consumer that reads it: ttsc's control namespace by name, Node's module-loading variables for helper processes, and the upstream compiler's color decision reproduced from its own predicate order. Linked plugins declare further reads at their read site, which admission replays, so no variable enters by being merely present.
 * @evidence contracts/common.md#clear-and-simple-design One function owns which variables a runtime build is keyed by, so the snapshot builder and its test share a single rule.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No package manager, shell or CI variable is named to be skipped: variables are selected by their reader, and every other one is left out by the same rule.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state why the whole environment is not an input, the three readers, the declared-read contract and the opt-out.
 * @evidence contracts/portability.md#os-neutral-implementation The merged environment already carries one uppercase identity per Windows variable and exact POSIX names; lookups go through SidecarEnvironment.read, and the control namespace is matched case-insensitively only on Windows, where names are.
 * @evidence contracts/performance.md#efficient-algorithms One pass over E variable names selects the namespace rows and a fixed number of lookups reads the rest; the rows are sorted once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure projection of its argument coordinates no shared work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned rows belong to the caller; nothing is retained.
 */
export function runtimeBuildEnvironment(
  env: NodeJS.ProcessEnv,
): [string, string | boolean][] {
  const rows: [string, string | boolean][] = [];
  const control = process.platform === "win32" ? /^TTS[CX]_/i : /^TTS[CX]_/;
  for (const [name, value] of Object.entries(env))
    if (
      value !== undefined &&
      control.test(name) &&
      !runtimeBuildEnvironment.unkeyed(name)
    )
      rows.push([name, value]);
  for (const name of ["NODE_OPTIONS", "NODE_PATH"]) {
    const value = SidecarEnvironment.read(env, name);
    if (value !== undefined) rows.push([name, value]);
  }
  const read = (name: string): string =>
    SidecarEnvironment.read(env, name) ?? "";
  // Upstream `defaultIsPretty` and `createColors`, for an output that is not a
  // terminal: no color unless forced, and capabilities only under color.
  if (read("NO_COLOR") === "" && read("FORCE_COLOR") !== "") {
    rows.push(["<color>", true]);
    rows.push([
      "<color:windows>",
      read("OS").toLowerCase().includes("windows"),
    ]);
    rows.push(["<color:windows-terminal>", read("WT_SESSION") !== ""]);
    rows.push(["<color:vscode>", read("TERM_PROGRAM") === "vscode"]);
    rows.push([
      "<color:rich>",
      read("COLORTERM") === "truecolor" || read("TERM") === "xterm-256color",
    ]);
  }
  return rows.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Members of the runtime build environment projection that other recorded
 * readings share.
 *
 * @evidence contracts/common.md#principled-implementation Each name `unkeyed` excludes belongs to ttsc's own protocol and selects no compile, Go reading or descriptor answer.
 * @evidence contracts/common.md#clear-and-simple-design The projection and its exclusion live in one module.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No variable outside ttsc's own namespace is named.
 * @evidence contracts/common.md#meaningful-documentation The member states which variables it names and why none is read.
 * @evidence contracts/portability.md#os-neutral-implementation Windows variable names compare case-insensitively, POSIX names exactly.
 * @evidence contracts/performance.md#efficient-algorithms `unkeyed` is one anchored match over the name.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The declaration coordinates no work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The declaration retains one compiled pattern.
 */
export namespace runtimeBuildEnvironment {
  /**
   * Whether `name` is one of ttsc's own variables that no build reads: a
   * per-run `TTSX_RUNTIME_` channel, which names one run's directories, or a
   * reporting switch, `TTSC_EXPLAIN_CACHE` or `TTSC_E2E_TRACE`, which only
   * makes a build describe itself.
   *
   * @param name Variable name, matched case-insensitively on Windows.
   */
  export function unkeyed(name: string): boolean {
    return UNKEYED.test(name);
  }

  const UNKEYED =
    process.platform === "win32"
      ? /^(?:TTSX_RUNTIME_.*|TTSC_EXPLAIN_CACHE|TTSC_E2E_TRACE)$/i
      : /^(?:TTSX_RUNTIME_.*|TTSC_EXPLAIN_CACHE|TTSC_E2E_TRACE)$/;
}
