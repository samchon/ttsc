/** Projects already warned about, so each is named once per process. */
const WARNED = new Set<string>();

/**
 * Tell the user, once per project, that Turbopack cannot track some compiler
 * inputs because the configuration names no root (samchon/ttsc#1422).
 *
 * The loader keeps every dependency inside the deepest root the configuration
 * names, and inside the project directory when it names none, since Turbopack
 * fails a module whose dependency leaves its root and the root it detects on
 * its own is Next's to know. An input beyond that directory still re-runs its
 * module, through the development bridge and the per-process marker, but a
 * module that read one is re-run in every new process instead of reusing
 * Turbopack's cache. In a monorepo that is usually every module importing a
 * workspace package, so the cost is made visible, with the setting that
 * removes it, rather than left to be noticed as slowness. It is a Node process
 * warning, code `TTSC_TURBOPACK_UNTRACKED_INPUTS`.
 *
 * @param projectRoot The Next project directory.
 * @param configured The roots the configuration names.
 */
export function warnUntrackedTurbopackInputs(
  projectRoot: string,
  configured: readonly string[] | undefined,
): void {
  if ((configured?.length ?? 0) !== 0 || WARNED.has(projectRoot)) return;
  WARNED.add(projectRoot);
  process.emitWarning(
    `@ttsc/unplugin: modules of ${projectRoot} read compiler inputs outside ` +
      "the project directory, and the configuration names no `turbopack.root`, " +
      "so Turbopack cannot track those inputs and re-runs such modules in " +
      "every new process instead of reusing its cache. If they lie in your " +
      "workspace, set `turbopack.root` to the workspace root (a hand-wired " +
      "loader rule lists it in its `turbopackRoots` option).",
    { code: "TTSC_TURBOPACK_UNTRACKED_INPUTS" },
  );
}
