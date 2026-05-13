import type { PluginRuleNames } from "./PluginRuleNames";
import type { TtscLintPlugins } from "./TtscLintPlugins";
import type { TtscLintRule } from "./TtscLintRule";
import type { TtscLintRuleEntry } from "./TtscLintRuleEntry";

/**
 * Rule-name → severity or severity-tuple map.
 *
 * Rule names are the union of every built-in name plus every contributor
 * plugin's `${namespace}/${rule}` pair. The `(string & {})` widener is
 * intentionally absent: typos in rule names produce type errors.
 */
export type TtscLintRuleMap<P extends TtscLintPlugins = TtscLintPlugins> = {
  [K in TtscLintRule | PluginRuleNames<P>]?: TtscLintRuleEntry;
};
