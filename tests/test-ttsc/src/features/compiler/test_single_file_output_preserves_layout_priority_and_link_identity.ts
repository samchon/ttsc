import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveSingleFileOutput } from "../../../../../packages/ttsc/src/launcher/internal/resolveSingleFileOutput";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies positional output layout follows option priority and physical roots.
 *
 * Project output mirrors rootDir, CLI output mirrors cwd, and absent output
 * configuration leaves the product adjacent to its source. A junction must
 * preserve the project's physical source layout rather than flatten it.
 *
 * 1. Resolve nested sources and native module suffixes in one project.
 * 2. Contrast configured output, CLI override, absent rootDir and adjacent output.
 * 3. Resolve the same source through a junction and outside the configured layout.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual resolveSingleFileOutput against authored config/source files and a real directory junction. Literal paths distinguish project-rootDir mirroring from CLI-cwd mirroring, absent-rootDir layout, adjacent fallback, native module suffixes and basename placement outside the selected layout.
 * @evidence contracts/testing.md#independent-expectations Expected path components encode the supported output contract directly: project dist/nested differs from CLI single/src/nested, a missing rootDir uses the project root, absent outDir leaves source-adjacent output, mts/cts use mjs/cjs, and an outside-layout source uses its basename. Physical project output and lexical CLI cwd output have independently authored expected roots.
 * @evidence contracts/testing.md#distinguishing-cases Covers configured and CLI output priority, nested sources, mts/cts suffixes, absent rootDir, absent outDir, malformed config fallback, a junction alias, an external file with explicit config and a src-prefix near miss outside rootDir. It checks path selection only; the native compiler's project membership refusal and actual copy/runtime remain E2E responsibilities.
 * @evidence contracts/testing.md#execution-ownership This discoverable source unit invokes the output resolver directly with one temporary workspace and a real filesystem alias. It starts no native producer or consumer process and removes its owned workspace in finally after collecting independent case failures.
 */
export function test_single_file_output_preserves_layout_priority_and_link_identity(): void {
  const baseline = {
    compilerOptions: { module: "commonjs", outDir: "dist", rootDir: "src" },
    include: ["src"],
  };
  const workspace = TestProject.physicalPath(
    TestProject.createProject({
      "project/tsconfig.json": JSON.stringify(baseline),
      "project/src/nested/main.ts": "export const value = 1;\n",
      "project/src/nested/module.mts": "export const value = 1;\n",
      "project/src/nested/module.cts": "export const value = 1;\n",
      "project/src-extra.ts": "export const value = 1;\n",
      "external/other.ts": "export const value = 1;\n",
    }),
  );
  const root = path.join(workspace, "project");
  const alias = path.join(workspace, "alias");
  const configPath = path.join(root, "tsconfig.json");
  const file = path.join(root, "src/nested/main.ts");
  const failures: Error[] = [];
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  try {
    fs.symlinkSync(root, alias, "junction");
    for (const [name, options, expected] of [
      [
        "configured rootDir",
        { cwd: root, file },
        path.join(root, "dist/nested/main.js"),
      ],
      [
        "CLI outDir priority",
        { cwd: root, file, cliOutDir: "single" },
        path.join(root, "single/src/nested/main.js"),
      ],
      [
        "physical junction layout",
        { cwd: alias, file: path.join(alias, "src/nested/main.ts") },
        path.join(root, "dist/nested/main.js"),
      ],
      [
        "lexical CLI cwd",
        {
          cwd: alias,
          file: path.join(alias, "src/nested/main.ts"),
          cliOutDir: "single",
        },
        path.join(alias, "single/src/nested/main.js"),
      ],
      [
        "MTS output",
        { cwd: root, file: path.join(root, "src/nested/module.mts") },
        path.join(root, "dist/nested/module.mjs"),
      ],
      [
        "CTS output",
        { cwd: root, file: path.join(root, "src/nested/module.cts") },
        path.join(root, "dist/nested/module.cjs"),
      ],
      [
        "outside layout",
        {
          cwd: root,
          file: path.join(workspace, "external/other.ts"),
          tsconfig: "tsconfig.json",
        },
        path.join(root, "dist/other.js"),
      ],
      [
        "rootDir prefix near miss",
        {
          cwd: root,
          file: path.join(root, "src-extra.ts"),
          tsconfig: "tsconfig.json",
        },
        path.join(root, "dist/src-extra.js"),
      ],
    ] as const)
      check(name, () =>
        assert.equal(resolveSingleFileOutput(options), expected),
      );
    for (const [name, config, expected] of [
      [
        "absent rootDir",
        {
          compilerOptions: { module: "commonjs", outDir: "dist" },
          include: ["src"],
        },
        path.join(root, "dist/src/nested/main.js"),
      ],
      [
        "adjacent output",
        { compilerOptions: { module: "commonjs" }, include: ["src"] },
        path.join(root, "src/nested/main.js"),
      ],
    ] as const)
      check(name, () => {
        fs.writeFileSync(configPath, JSON.stringify(config));
        assert.equal(resolveSingleFileOutput({ cwd: root, file }), expected);
      });
    check("malformed config fallback", () => {
      fs.writeFileSync(configPath, "{ broken config");
      assert.equal(
        resolveSingleFileOutput({ cwd: root, file }),
        path.join(root, "src/nested/main.js"),
      );
    });
    if (failures.length !== 0)
      throw new AggregateError(failures, "positional output layout failures");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}
