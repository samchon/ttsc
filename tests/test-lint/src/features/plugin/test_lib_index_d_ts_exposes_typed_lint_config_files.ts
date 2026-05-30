import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies that `lib/index.d.ts` re-exports the public config interfaces and
 * does not leak internal or `ttsc`-private symbols.
 *
 * Pins the public surface of `@ttsc/lint`'s declaration file: consumers need
 * `ITtscLintConfig`, `ITtscLintPluginConfig`, `ITtscLintRules`, and
 * `TtscLintSeverity`, and the tsconfig-entry shape must expose `configFile`,
 * but the file must not leak `defineConfig`, `TtscLintRule`,
 * `TtscLintRuleEntry`, `TtscLintPlugins`, or `PluginRuleNames`. Each rule
 * family lives in its own file under `lib/structures/rules/`; the barrel
 * re-exports `./rules/index` so consumers can import either the intersection
 * (`ITtscLintRules`) or a narrow family interface (e.g. `ITtscLintCoreRules`).
 * Formatter behavior is configured through the top-level `format` block typed
 * as `ITtscLintFormat`, so the rules surface must not expose a `format/*`
 * family. Without this test, adding or removing an export in
 * `structures/index.d.ts` or in the barrel would silently break or bloat the
 * public API.
 *
 * 1. Read `lib/index.d.ts`, `lib/structures/ITtscLintConfig.d.ts`,
 *    `lib/structures/ITtscLintPluginConfig.d.ts`, the rules-family barrel, and
 *    the core-family declaration.
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
      "rules",
      "ITtscLintRules.d.ts",
    ),
    "utf8",
  );
  const coreRulesDts = fs.readFileSync(
    path.join(
      TestLintPlugin.PACKAGE_ROOT,
      "lib",
      "structures",
      "rules",
      "ITtscLintCoreRules.d.ts",
    ),
    "utf8",
  );
  const typescriptRulesDts = fs.readFileSync(
    path.join(
      TestLintPlugin.PACKAGE_ROOT,
      "lib",
      "structures",
      "rules",
      "ITtscLintTypeScriptRules.d.ts",
    ),
    "utf8",
  );
  const rulesIndexDts = fs.readFileSync(
    path.join(
      TestLintPlugin.PACKAGE_ROOT,
      "lib",
      "structures",
      "rules",
      "index.d.ts",
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
  const formatDts = fs.readFileSync(
    path.join(
      TestLintPlugin.PACKAGE_ROOT,
      "lib",
      "structures",
      "format",
      "ITtscLintFormat.d.ts",
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
  assert.match(configDts, /format\?: ITtscLintFormat/);
  assert.match(formatDts, /export interface ITtscLintFormat/);
  assert.match(
    structuresIndexDts,
    /export \* from "\.\/ITtscLintPluginConfig"/,
  );
  assert.match(structuresIndexDts, /export \* from "\.\/ITtscLintConfig"/);
  assert.match(structuresIndexDts, /export \* from "\.\/format"/);
  assert.match(structuresIndexDts, /export \* from "\.\/rules"/);
  assert.match(rulesIndexDts, /export \* from "\.\/ITtscLintCoreRules"/);
  assert.match(rulesIndexDts, /export \* from "\.\/ITtscLintTypeScriptRules"/);
  assert.match(rulesIndexDts, /export \* from "\.\/ITtscLintRules"/);
  // `format/*` is configured exclusively through `ITtscLintFormat`; the
  // public `rules` surface must not advertise a `format/*` family.
  assert.doesNotMatch(rulesIndexDts, /ITtscLintFormatRules/);
  assert.match(rulesDts, /export type ITtscLintRules = ITtscLintCoreRules &/);
  assert.doesNotMatch(rulesDts, /ITtscLintFormatRules/);
  assert.match(coreRulesDts, /export interface ITtscLintCoreRules/);
  assert.match(coreRulesDts, /"no-var"\?: TtscLintRuleSetting/);
  assert.match(typescriptRulesDts, /export interface ITtscLintTypeScriptRules/);
  assert.match(
    typescriptRulesDts,
    /"typescript\/no-explicit-any"\?: TtscLintRuleSetting/,
  );
  assert.doesNotMatch(structuresIndexDts, /TtscLintRuleEntry/);
  assert.doesNotMatch(structuresIndexDts, /TtscLintRuleMap/);
  assert.doesNotMatch(structuresIndexDts, /TtscLintPlugins/);
  assert.doesNotMatch(structuresIndexDts, /PluginRuleNames/);
  // The legacy flat `TtscLintRule` union is gone — consumers narrow to a
  // family interface or use `ITtscLintRules` directly.
  assert.doesNotMatch(structuresIndexDts, /export \* from "\.\/TtscLintRule"/);
  assert.match(severityDts, /export type TtscLintSeverity/);
  assert.doesNotMatch(dts, /defineConfig/);
};
