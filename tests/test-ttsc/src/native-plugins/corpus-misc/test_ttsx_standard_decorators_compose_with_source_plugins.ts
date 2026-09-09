import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies standard decorators execute alongside native source transforms.
 *
 * The native host receives compiler overrides through TTSC_TSGO_ARGS rather
 * than its command-line parser. Both transforms must reach the executed emit.
 *
 * 1. Configure the source-backed strip plugin at ESNext.
 * 2. Add a console.warn for the plugin to remove beside the decorator example.
 * 3. Assert class and method effects, with the warning removed.
 */
export const test_ttsx_standard_decorators_compose_with_source_plugins = () => {
  const root = TestProject.commonJsProject(
    {
      "strip.config.json": JSON.stringify({ calls: ["console.warn"] }),
      "src/main.ts":
        'console.warn("must-be-stripped");\n' + STANDARD_DECORATOR_SOURCE,
    },
    {
      compilerOptions: {
        target: "ESNext",
        plugins: [{ transform: "@ttsc/strip" }],
      },
    },
  );
  TestUtilityPlugins.seedPackages(root, ["strip"]);
  const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
    cwd: root,
    env: { PATH: TestUtilityPlugins.goPath() },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT);
  assert.doesNotMatch(result.stderr, /must-be-stripped/);
};
