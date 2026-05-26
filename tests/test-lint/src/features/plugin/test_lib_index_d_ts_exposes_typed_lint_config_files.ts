import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies that `lib/index.d.ts` re-exports the public config interfaces and
 * does not leak internal or `ttsc`-private symbols.
 *
 * Pins the public surface of `@ttsc/lint`'s declaration file: consumers need
 * `ITtscLintConfig`, `ITtscLintPluginConfig`, `TtscLintRule`, and
 * `TtscLintSeverity`, and the tsconfig-entry shape must expose `configFile`,
 * but the file must not leak `defineConfig`, `TtscLintRuleEntry`,
 * `TtscLintPlugins`, or `PluginRuleNames`. Without this test, adding or
 * removing an export in `structures/index.d.ts` or in the barrel would silently
 * break or bloat the public API.
 *
 * 1. Read `lib/index.d.ts`, `lib/structures/ITtscLintConfig.d.ts`,
 *    `lib/structures/ITtscLintPluginConfig.d.ts`, and related files.
 * 2. Assert that the barrel re-exports `./structures/index` and does not import
 *    from `"ttsc"`.
 * 3. Assert presence and absence of specific fields/exports in each file.
 */
export const test_lib_index_d_ts_exposes_typed_lint_config_files = () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(TestLintPlugin.PACKAGE_ROOT, "package.json"),
      "utf8",
    ),
  );
  const dts = fs.readFileSync(
    path.join(TestLintPlugin.PACKAGE_ROOT, "lib", "index.d.ts"),
    "utf8",
  );
  const configDts = fs.readFileSync(
    path.join(
      TestLintPlugin.PACKAGE_ROOT,
      "lib",
      "structures",
      "ITtscLintConfig.d.ts",
    ),
    "utf8",
  );
  const pluginConfigDts = fs.readFileSync(
    path.join(
      TestLintPlugin.PACKAGE_ROOT,
      "lib",
      "structures",
      "ITtscLintPluginConfig.d.ts",
    ),
    "utf8",
  );
  const structuresIndexDts = fs.readFileSync(
    path.join(TestLintPlugin.PACKAGE_ROOT, "lib", "structures", "index.d.ts"),
    "utf8",
  );
  const rulesDts = fs.readFileSync(
    path.join(
      TestLintPlugin.PACKAGE_ROOT,
      "lib",
      "structures",
      "ITtscLintRules.d.ts",
    ),
    "utf8",
  );
  const ruleDts = fs.readFileSync(
    path.join(
      TestLintPlugin.PACKAGE_ROOT,
      "lib",
      "structures",
      "TtscLintRule.d.ts",
    ),
    "utf8",
  );
  const severityDts = fs.readFileSync(
    path.join(
      TestLintPlugin.PACKAGE_ROOT,
      "lib",
      "structures",
      "TtscLintSeverity.d.ts",
    ),
    "utf8",
  );
  assert.match(dts, /export \* from "\.\/structures\/index"/);
  assert.doesNotMatch(dts, /from "ttsc"/);
  assert.equal(manifest.exports["./config"], undefined);
  // The tsconfig-entry shape carries only `transform`, `enabled`, and the
  // `configFile` pointer — no rule-map surface — so `ITtscLintPluginConfig`
  // no longer imports `TtscLintRuleMap`.
  assert.doesNotMatch(pluginConfigDts, /import type { TtscLintRuleMap }/);
  assert.doesNotMatch(pluginConfigDts, /from "ttsc"/);
  assert.match(pluginConfigDts, /export interface ITtscLintPluginConfig/);
  assert.match(pluginConfigDts, /configFile\?: string/);
  assert.doesNotMatch(pluginConfigDts, /\brules\?:/);
  assert.match(configDts, /export interface ITtscLintConfig/);
  assert.doesNotMatch(configDts, /ITtscLintConfig</);
  assert.match(configDts, /extends\?: string/);
  assert.match(configDts, /plugins\?: Record<string, ITtscLintPlugin>/);
  assert.match(configDts, /rules\?: ITtscLintRules/);
  assert.match(
    structuresIndexDts,
    /export \* from "\.\/ITtscLintPluginConfig"/,
  );
  assert.match(structuresIndexDts, /export \* from "\.\/ITtscLintConfig"/);
  assert.match(structuresIndexDts, /export \* from "\.\/ITtscLintRules"/);
  assert.match(rulesDts, /export type ITtscLintRules = ITtscLintCoreRules &/);
  assert.match(rulesDts, /export interface ITtscLintReactRules/);
  assert.match(rulesDts, /export interface ITtscLintFormatRules/);
  assert.match(rulesDts, /export interface ITtscLintContributorRules/);
  assert.match(rulesDts, /"no-var"\?: TtscLintRuleSetting/);
  assert.match(rulesDts, /"format\/print-width"\?: TtscLintRuleOptionsSetting/);
  assert.doesNotMatch(structuresIndexDts, /TtscLintRuleEntry/);
  assert.doesNotMatch(structuresIndexDts, /TtscLintRuleMap/);
  assert.doesNotMatch(structuresIndexDts, /TtscLintPlugins/);
  assert.doesNotMatch(structuresIndexDts, /PluginRuleNames/);
  assert.match(ruleDts, /export type TtscLintRule/);
  assert.match(severityDts, /export type TtscLintSeverity/);
  assert.doesNotMatch(dts, /defineConfig/);
};
