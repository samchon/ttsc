import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

/**
 * The options a Turbopack rule hands the loader: the adapter's own options, and
 * what `withTtsc` knows about the project filesystem root Turbopack is created
 * with (samchon/ttsc#1422).
 */
export interface TtscTurbopackLoaderOptions extends TtscUnpluginOptions {
  /**
   * The project filesystem roots the configuration names: its `turbopack.root`
   * and `outputFileTracingRoot`, whichever are set.
   *
   * Turbopack fails a module whose dependency lies outside its root, so the
   * loader registers only the inputs inside the deepest of these, and inside
   * the project directory when there is none (see `resolveTurbopackRoot`).
   * `withTtsc` fills it in from the configuration. A rule wired by hand may
   * list the same root, which lets Turbopack track the inputs between it and
   * the project directory.
   */
  turbopackRoots?: readonly string[];
}
