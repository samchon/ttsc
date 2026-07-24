import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { resolveSingleFileOutput } from "../../../../../packages/ttsc/lib/launcher/internal/singleFileOutput.js";

/**
 * Verifies tsgo remains authoritative for syntax of forwarded compiler flags.
 *
 * Launcher-owned options accept inline `=VALUE`, but pinned tsgo does not.
 * `composite` is also tsconfig-only and can only be disabled or cleared from
 * the command line.
 */
export const test_ttsc_matches_tsgo_only_flag_value_rules = (): void => {
  const root = TestProject.commonJsProject({
    "src/main.ts": "export const value = 1;\n",
    "src/view.tsx": "export const view = 1;\n",
  });

  const inline = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--outFile=dist/bundle.js", "--cwd", root],
    { cwd: root },
  );
  assert.notEqual(inline.status, 0);
  assert.match(
    `${inline.stdout}${inline.stderr}`,
    /Unknown compiler option '--outFile=dist\/bundle\.js'/i,
  );

  const tsx = path.join(root, "src", "view.tsx");
  assert.equal(
    resolveSingleFileOutput({
      cwd: root,
      file: tsx,
      passthrough: ["--jsx=preserve"],
    }),
    path.join(root, "dist", "view.js"),
  );
  assert.equal(
    resolveSingleFileOutput({
      cwd: root,
      file: tsx,
      passthrough: ["--jsx", "preserve"],
    }),
    path.join(root, "dist", "view.jsx"),
  );
  const inlineJsx = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--jsx=preserve", "--cwd", root, "src/view.tsx"],
    { cwd: root },
  );
  assert.notEqual(inlineJsx.status, 0);
  assert.match(
    `${inlineJsx.stdout}${inlineJsx.stderr}`,
    /Unknown compiler option '--jsx=preserve'/i,
  );

  for (const value of ["false", "null"]) {
    const lowercase = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--declaration", value, "--noEmit", "--cwd", root],
      { cwd: root },
    );
    assert.equal(lowercase.status, 0, lowercase.stderr);
  }
  const uppercaseBoolean = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--declaration", "FALSE", "--noEmit", "--cwd", root],
    { cwd: root },
  );
  assert.notEqual(uppercaseBoolean.status, 0);
  assert.match(
    `${uppercaseBoolean.stdout}${uppercaseBoolean.stderr}`,
    /project.*cannot be mixed with source files|TS5042/i,
  );

  const enabled = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--composite", "--cwd", root],
    { cwd: root },
  );
  assert.notEqual(enabled.status, 0);
  assert.match(
    `${enabled.stdout}${enabled.stderr}`,
    /composite.*only be specified in ['"]tsconfig\.json/i,
  );

  const disabled = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--composite", "false", "--noEmit", "--cwd", root],
    { cwd: root },
  );
  assert.equal(disabled.status, 0, disabled.stderr);
};
