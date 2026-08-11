import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx builds a raw `.ts` dependency whose own tsconfig declares no
 * `rootDir`, instead of falling back to type-stripping it.
 *
 * The dependency lane injects a generation directory as its `outDir` exactly as
 * the entry lane injects a temp directory, so a dependency that declares no
 * output of its own drew the same TS5011 refusal. The failure is silent from
 * the outside — a refused build falls back to stripping types from the single
 * file — so the probe is an `enum`, whose runtime object only exists if the
 * dependency was really compiled (issue #1172).
 *
 * 1. Install an ESM `enum-dep` shipping its own tsconfig with neither `outDir` nor
 *    `rootDir`, re-exporting a numeric `enum`.
 * 2. Run ttsx against an entry that reads an enum member and its reverse mapping.
 * 3. Assert the dependency executed and produced both enum runtime values.
 */
export const test_ttsx_builds_a_dependency_whose_project_declares_no_rootdir =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ type: "module", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "node_modules/enum-dep/package.json": JSON.stringify({
        name: "enum-dep",
        version: "1.0.0",
        type: "module",
        exports: { ".": "./src/index.ts" },
      }),
      // Neither `outDir` nor `rootDir`: this package declares no output layout
      // at all, which is legal for a source-shipping dependency.
      "node_modules/enum-dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
        },
        include: ["src"],
      }),
      "node_modules/enum-dep/src/level.ts": [
        `export enum Level {`,
        `  Low = 1,`,
        `  High = 2,`,
        `}`,
        ``,
      ].join("\n"),
      "node_modules/enum-dep/src/index.ts": [
        `import { Level } from "./level";`,
        `export const report = (): string => {`,
        `  const forward: number = Level.High;`,
        `  const reverse: string = Level[Level.Low];`,
        `  return reverse + "-" + forward;`,
        `};`,
        ``,
      ].join("\n"),
      "src/main.ts": [
        `import { report } from "enum-dep";`,
        ``,
        `console.log(report());`,
        ``,
      ].join("\n"),
    });

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(result.stdout.trim(), "Low-2");
  };
