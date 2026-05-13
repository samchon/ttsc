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
      "TtscLintConfig.d.ts",
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
  // forms), so `ITtscLintPluginConfig` imports the map type — not the
  // union `TtscLintConfig` — from `./TtscLintRuleMap`.
  assert.match(pluginConfigDts, /import type { TtscLintRuleMap }/);
  assert.doesNotMatch(pluginConfigDts, /from "ttsc"/);
  assert.match(pluginConfigDts, /export interface ITtscLintPluginConfig/);
  assert.doesNotMatch(dts, /configFile/);
  assert.doesNotMatch(dts, /configPath/);
  assert.doesNotMatch(dts, /rules\?:/);
  assert.match(configDts, /export type TtscLintConfig/);
  assert.match(
    structuresIndexDts,
    /export \* from "\.\/ITtscLintPluginConfig"/,
  );
  assert.match(structuresIndexDts, /export \* from "\.\/TtscLintConfig"/);
  assert.match(ruleDts, /export type TtscLintRule/);
  assert.match(severityDts, /export type TtscLintSeverity/);
  // defineConfig is the const-narrowing helper exported from
  // `@ttsc/lint`'s public surface so user `lint.config.ts` files can
  // capture plugin objects' literal `rules` tuples for cross-namespace
  // rule-name autocomplete.
  assert.match(dts, /defineConfig/);
};
