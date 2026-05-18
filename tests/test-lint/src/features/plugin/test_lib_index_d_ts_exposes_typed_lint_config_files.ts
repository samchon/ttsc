import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestLintPlugin } from "../../internal/TestLintPlugin";

/**
 * Verifies lib/index.d.ts exposes typed lint config files.
 *
 * This lint plugin descriptor scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
  // The legacy `config?: string | TtscLintRuleMap` field narrows to the
  // rule-map shape (the new `rules` / `extends` fields cover the wider
  // forms), so `ITtscLintPluginConfig` imports the map type.
  assert.match(pluginConfigDts, /import type { TtscLintRuleMap }/);
  assert.doesNotMatch(pluginConfigDts, /from "ttsc"/);
  assert.match(pluginConfigDts, /export interface ITtscLintPluginConfig/);
  assert.doesNotMatch(dts, /configFile/);
  assert.doesNotMatch(dts, /configPath/);
  assert.match(configDts, /export interface ITtscLintConfig/);
  assert.doesNotMatch(configDts, /ITtscLintConfig</);
  assert.match(configDts, /extends\?: string/);
  assert.match(configDts, /plugins\?: Record<string, ITtscLintPlugin>/);
  assert.match(
    structuresIndexDts,
    /export \* from "\.\/ITtscLintPluginConfig"/,
  );
  assert.match(structuresIndexDts, /export \* from "\.\/ITtscLintConfig"/);
  assert.doesNotMatch(structuresIndexDts, /TtscLintRuleEntry/);
  assert.doesNotMatch(structuresIndexDts, /TtscLintPlugins/);
  assert.doesNotMatch(structuresIndexDts, /PluginRuleNames/);
  assert.match(ruleDts, /export type TtscLintRule/);
  assert.match(severityDts, /export type TtscLintSeverity/);
  assert.doesNotMatch(dts, /defineConfig/);
};
