import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

/**
 * Verifies a first delivery compiles once when the compiler reports the case
 * policy its own rule predicted.
 *
 * The walk before a project's first compile is primed with the answer the
 * compiler will give, which ttsc computes by TypeScript-Go's rule
 * (`compilerUsesCaseSensitiveFileNames`, samchon/ttsc#1563). A walk primed with
 * the platform's ordinary answer instead was taken again whenever the
 * compiler's volume behaved otherwise (samchon/ttsc#1545).
 *
 * 1. Transform with a plugin whose graph reports the policy the rule answers.
 * 2. Assert the first delivery compiled once.
 */
export async function test_transformttsc_compiles_once_when_the_compiler_reports_what_its_rule_predicted(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-case-rule-"),
    "compiles.bin",
  );
  const options = resolveOptions({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "graph",
        operation: "emit-graph",
        echoTsconfig: true,
        useCaseSensitiveFileNames: compilerUsesCaseSensitiveFileNames({
          projectRoot: root,
        }),
      },
      {
        transform: "./plugin.cjs",
        name: "runs",
        operation: "count-runs",
        runLog,
      },
    ],
  });
  const main = TestUnpluginProject.mainFile(root);
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      createTtscTransformCache(),
    ),
  );
  assert.equal(
    fs.existsSync(runLog) ? fs.statSync(runLog).size : 0,
    1,
    "the first walk was taken again",
  );
}
