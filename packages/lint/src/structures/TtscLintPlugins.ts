import type { ITtscLintPlugin } from "./ITtscLintPlugin";

/**
 * Map of contributor plugins, keyed by their namespace prefix.
 *
 * The key (e.g. `"import"`) is what `@ttsc/lint`'s rule-name union joins with
 * each plugin's exported `rules` tuple (`"no-cycle"`) to produce the namespaced
 * rule names a user writes in `rules` (`"import/no-cycle"`).
 */
export type TtscLintPlugins = Record<string, ITtscLintPlugin>;
