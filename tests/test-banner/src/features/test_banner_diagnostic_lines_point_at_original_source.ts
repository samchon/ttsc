import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { TestBanner } from "../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: reported diagnostics point at the real
 * source lines, not the banner-shifted ones.
 *
 * The banner is injected at the SOURCE level (sourcePreambleFS prepends it
 * before TypeScript-Go parses), which shifts every recorded coordinate down by
 * the banner's line count — diagnostics included. The reported line then names
 * a line that does not exist in the file on disk, and because the duplicate
 * filter in `CompilerDiagnostics.ts` compares positions, the shifted report
 * never matched the plugin-free recovery pass and the user was shown one error
 * twice at two contradictory positions. The source-map side of this invariant
 * is already covered here; this is the diagnostic side.
 *
 * 1. Build a project with a three-line banner (an eight-line preamble) whose only
 *    error sits on source line 5.
 * 2. Run `ttsc --emit`.
 * 3. Assert the failure names line 5 once, never names the shifted line 13, and
 *    never quotes the banner text back at the user.
 */
export const test_banner_diagnostic_lines_point_at_original_source = () => {
  const source = [
    "export interface IUser {",
    "  id: string;",
    "}",
    "",
    `export const bad: number = "not a number";`,
    "",
  ].join("\n");
  // "Copyright" + "MIT License" + "third line" renders as
  // `/**`, ` * ---`, three text lines, ` *`, ` * @packageDocumentation`, ` */`.
  const preambleLines = 8;
  const errorLine = 5;

  const root = TestProject.commonJsProject(
    {
      "banner.config.cjs": `module.exports = { text: "Copyright\\nMIT License\\nthird line" };\n`,
      "src/main.ts": source,
    },
    {
      compilerOptions: {
        plugins: [
          { transform: "@ttsc/banner", configFile: "banner.config.cjs" },
        ],
      },
    },
  );
  TestBanner.seedPackage(root);
  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestBanner.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.notEqual(result.status, 0, "the type error must fail the build");

  const stderr = `${result.stderr}\n${result.stdout}`.replace(
    /\u001b\[[0-9;]*m/g,
    "",
  );
  // Both rendered forms are accepted: the native host prints `file:line:col -`
  // and the plugin-free recovery pass prints `file(line,col):`.
  const positions = [
    ...stderr.matchAll(/main\.ts(?::(\d+):\d+|\((\d+),\d+\))/g),
  ].map((match) => Number(match[1] ?? match[2]));
  assert.ok(
    positions.length > 0,
    `stderr reported no position for main.ts:\n${stderr}`,
  );
  for (const line of positions) {
    assert.equal(
      line,
      errorLine,
      `diagnostic reported at main.ts line ${line}, want ${errorLine}` +
        ` (the ${preambleLines}-line banner shift was not corrected)\n${stderr}`,
    );
  }
  assert.equal(
    stderr.split("TS2322").length - 1,
    1,
    `the same error must be reported once, not once per lane:\n${stderr}`,
  );
  assert.doesNotMatch(
    stderr,
    /Copyright|MIT License|@packageDocumentation/,
    `the code frame must quote the authored source, never the banner:\n${stderr}`,
  );
};
