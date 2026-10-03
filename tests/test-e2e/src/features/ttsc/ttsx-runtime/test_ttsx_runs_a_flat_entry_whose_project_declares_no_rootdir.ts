import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx still runs a flat project that declares no `rootDir`, with its
 * emit still out of the source tree.
 *
 * This is the layout one property away from the nested case: the entry sits
 * beside the tsconfig, so the source root ttsx publishes and the root tsgo
 * infers were already the same directory, and this project ran before the
 * TS5011 fix. Pinning that root must therefore change nothing here — the case
 * exists to catch a synthesized root that moves an emit the compiler had
 * already been placing correctly (issue #1172).
 *
 * 1. Build a `noEmit` project whose only source sits beside the tsconfig, with no
 *    `rootDir`.
 * 2. Run ttsx against `main.ts`.
 * 3. Assert the program ran and left no `.js` beside its source.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx executes a flat noEmit project without rootDir or outDir; zero status, exact no-rootdir-flat output and absence of both adjacent JavaScript files preserve the previously working layout.
 * @evidence contracts/testing.md#independent-expectations The authored helper literal and independently named source-adjacent main.js/helper.js paths define results; no emitted path is derived from the implementation being tested.
 * @evidence contracts/testing.md#distinguishing-cases Sources beside tsconfig are the adjacent layout to the nested no-rootDir regression; absent rootDir/outDir and noEmit force runtime-only output policy without changing source placement.
 * @evidence contracts/testing.md#execution-ownership The named feature entry invokes one actual native compiler and launcher/Node host, while filesystem absence assertions inspect only its authored fixture source paths.
 * @evidence contracts/e2e.md#necessary-boundary The injected runtime output directory must preserve the compiler root layout and redirect both module emits; a pure path string does not prove actual native emit containment and successful import.
 * @evidence contracts/e2e.md#shared-execution One flat compiler profile and one host share main/helper assertions; the nested profile has a different inferred common source root and remains a separate preparation pending source-owner proof.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An immutable project has no preexisting adjacent JavaScript, synchronous spawn ends before TestProject cleanup, and no cache or changed-source transition is claimed.
 * @evidence contracts/e2e.md#preserved-coverage Original zero status, exact helper output and independent main.js/helper.js absence assertions remain; the nested layout is not silently dropped as an equivalent fixture.
 */
export function test_ttsx_runs_a_flat_entry_whose_project_declares_no_rootdir() {
    const root = TestProject.commonJsProject(
      FixtureFiles.read("ttsc/ttsx_runs_a_flat_entry_whose_project_declares_no_rootdir/inputs-1"),
      {
        compilerOptions: {
          noEmit: true,
          outDir: undefined,
          rootDir: undefined,
        },
        config: { include: ["*.ts"] },
      },
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(result.stdout.trim(), "no-rootdir-flat");
    for (const leaked of [
      path.join(root, "main.js"),
      path.join(root, "helper.js"),
    ]) {
      assert.equal(
        fs.existsSync(leaked),
        false,
        `the runtime emit escaped into the source tree at ${leaked}`,
      );
    }
  }
