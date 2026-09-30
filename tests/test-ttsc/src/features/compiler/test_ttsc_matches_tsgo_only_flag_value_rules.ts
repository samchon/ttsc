import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveSingleFileOutput } from "../../../../../packages/ttsc/lib/launcher/internal/resolveSingleFileOutput.js";

/**
 * Verifies tsgo remains authoritative for syntax of forwarded compiler flags.
 *
 * Launcher-owned options accept inline `=VALUE`, but pinned tsgo does not.
 * `composite` is also tsconfig-only and can only be disabled or cleared from
 * the command line.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes inline outFile/jsx rejection, false/null declaration clearing, uppercase FALSE rejection and composite enable/disable; directly checks jsx output extension selection.
 * @evidence contracts/testing.md#independent-expectations The tsgo argv grammar accepts separate values rather than equals spellings for these flags, lower false/null clear booleans and uppercase FALSE becomes a positional token; authored config requires declarations by default.
 * @evidence contracts/testing.md#distinguishing-cases Inline/separate JSX forms, two disabling literals, uppercase nonliteral and enabled/disabled composite distinguish arity and spelling decisions, retaining positive and negative command outcomes.
 * @evidence contracts/testing.md#execution-ownership The named compiler feature runs six actual launcher commands plus two direct resolveSingleFileOutput calls through TestExecutor.
 * @evidence contracts/e2e.md#necessary-boundary Real CLI forwarding must preserve native rejection and declaration publication decisions; direct output-extension semantics are mixed here and remain eligible for unit transfer.
 * @evidence contracts/e2e.md#shared-execution All commands reuse one two-source project and built executables; false/null emit into separate output directories so neither can supply the other result.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh physical registered project owns source/config and distinct dist-false/dist-null results. Synchronous commands complete before filesystem checks; TestProject owns cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Every original rejection text/status, direct extension expectation, declaration absence, JavaScript existence and composite result remains. Portable extension checks remain mixed with boundary commands.
 */
export const test_ttsc_matches_tsgo_only_flag_value_rules = (): void => {
  const root = TestProject.physicalPath(
    TestProject.commonJsProject(
      {
        "src/main.ts": "export const value = 1;\n",
        "src/view.tsx": "export const view = 1;\n",
      },
      {
        compilerOptions: {
          declaration: true,
        },
      },
    ),
  );

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
    const outDir = `dist-${value}`;
    const lowercase = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--declaration", value, "--outDir", outDir, "--cwd", root],
      { cwd: root },
    );
    assert.equal(lowercase.status, 0, lowercase.stderr);
    assert.equal(fs.existsSync(path.join(root, outDir, "main.js")), true);
    assert.equal(
      fs.existsSync(path.join(root, outDir, "main.d.ts")),
      false,
      `--declaration ${value} did not clear configured declaration emit`,
    );
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
