import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

/**
 * The options a Turbopack rule hands the loader: the adapter's own options, and
 * what `withTtsc` knows about the project filesystem root Turbopack is created
 * with (samchon/ttsc#1422).
 */
export interface TtscTurbopackLoaderOptions extends TtscUnpluginOptions {
  /**
   * The root the configuration sets, or `null` for one that sets none.
   *
   * Turbopack fails a module whose dependency lies outside this root, so the
   * loader registers only the inputs inside it. `withTtsc` always fills it in:
   * the configuration's `outputFileTracingRoot`, else its `turbopack.root`, the
   * precedence Next applies. With `null`, the loader resolves the root the way
   * Next does when neither is set.
   *
   * Left out, as rules wired by hand leave it, the loader cannot tell whether
   * the configuration narrowed the root. It then takes the project directory,
   * which every Turbopack root contains, so it never hands Turbopack a path it
   * rejects. Rules wired by hand may set it to the same root to let Turbopack
   * track the inputs between the two.
   */
  turbopackRoot?: string | null;
}
