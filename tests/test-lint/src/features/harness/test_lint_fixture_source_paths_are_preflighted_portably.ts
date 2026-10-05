import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestLint } from "../../../../utils/src/lint/TestLint";

/**
 * Verifies lint fixture paths: every source target is preflighted portably.
 *
 * Unchecked companions could escape the temporary project or overwrite the main
 * fixture through separator and case aliases. Validation must happen before any
 * fixture file is written while root-level config files stay legal.
 *
 * 1. Try invalid source, package-link, exact-temp, and junction targets.
 * 2. Assert every rejected plan leaves its pre-existing roots untouched.
 * 3. Materialize normalized spaced sources and a scoped package link request.
 *
 * @evidence contracts/testing.md#behavioral-verification TestLint.createProject is called with each invalid source, generated-config, linkNodeModules and projectRoot plan and must throw the expected message before the disposable root gains any entry, then materializes one legal plan whose written source, root lint.config.json, normalized companion and COM0/LPT0 files are read back.
 * @evidence contracts/testing.md#independent-expectations Authored invalid plans, literal message patterns, sentinel contents and an empty-directory listing independently define refusal and nonmutation; the accepted plan is certified by reading the generated files' bytes, not by checking that repository files exist.
 * @evidence contracts/testing.md#distinguishing-cases Rejected: traversal and absolute paths, trailing dot/space and `::$DATA` aliases, uppercase TypeScript suffixes, device names (CON, COM9, LPT superscript one, CONOUT$), a forbidden `?` character, separator/case collisions with main, companion and generated targets, node_modules ancestors, bad linkNodeModules names, a file or exact system temp directory as projectRoot, and a junction to an empty directory outside the system temp root. An occupied nested junction retains its sentinel. Accepted: a spaced backslash main path, `./lint.config.json`, a `..` segment normalized to src/nested/support.ts, COM0 and LPT0, and a `@ttsc/lint` linkNodeModules entry (accepted without error; the link target itself is not inspected).
 * @evidence contracts/testing.md#execution-ownership Calls the authored materialization helper directly using disposable temporary trees and sentinel observations, cleaning every tree/project in finally; no compiler, installation or native lint host executes.
 */
export function test_lint_fixture_source_paths_are_preflighted_portably(): void {
  const invalidRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-lint-source-preflight-"),
  );
  const sentinel = path.join(invalidRoot, "sentinel.txt");
  fs.writeFileSync(sentinel, "untouched", "utf8");

  const invalidPlans: readonly [
    string,
    Pick<
      TestLint.IRunLintOptions,
      "sourcePath" | "extraSources" | "linkNodeModules" | "rules"
    >,
    RegExp,
  ][] = [
    ["empty-main", { sourcePath: "" }, /sourcePath.*non-empty/],
    [
      "absolute-main",
      { sourcePath: "C:\\outside.ts" },
      /sourcePath.*project-root-relative/,
    ],
    [
      "escaping-main",
      { sourcePath: "src/../../outside.ts" },
      /sourcePath.*project-root-relative/,
    ],
    [
      "main-trailing-dot-alias",
      { sourcePath: "src/main.ts." },
      /sourcePath.*portable.*main\.ts\./,
    ],
    [
      "main-uppercase-typescript-suffix",
      { sourcePath: "src/main.TS" },
      /sourcePath.*canonical lowercase.*main\.TS/,
    ],
    ["empty-extra", { extraSources: { "": "" } }, /extraSources.*non-empty/],
    [
      "posix-directory-extra",
      { extraSources: { "src/generated/": "" } },
      /extraSources.*file path/,
    ],
    [
      "windows-directory-extra",
      { extraSources: { "src\\generated\\": "" } },
      /extraSources.*file path/,
    ],
    [
      "absolute-extra",
      { extraSources: { "/outside.ts": "" } },
      /extraSources.*project-root-relative/,
    ],
    [
      "escaping-extra",
      { extraSources: { "../outside.ts": "" } },
      /extraSources.*project-root-relative/,
    ],
    [
      "extra-trailing-dot-alias",
      { extraSources: { "src/main.ts.": "companion" } },
      /extraSources.*portable.*main\.ts\./,
    ],
    [
      "extra-uppercase-tsx-suffix",
      { extraSources: { "src/component.TSX": "companion" } },
      /extraSources.*canonical lowercase.*component\.TSX/,
    ],
    [
      "extra-uppercase-declaration-suffix",
      { extraSources: { "src/types.D.TS": "companion" } },
      /extraSources.*canonical lowercase.*types\.D\.TS/,
    ],
    [
      "generated-tsconfig-trailing-space-alias",
      { extraSources: { "tsconfig.json ": "{}" } },
      /extraSources.*portable.*tsconfig\.json/,
    ],
    [
      "generated-lint-config-trailing-dot-alias",
      {
        rules: {},
        extraSources: { "lint.config.json.": "{}" },
      },
      /extraSources.*portable.*lint\.config\.json\./,
    ],
    [
      "main-alternate-data-stream-alias",
      { extraSources: { "src/main.ts::$DATA": "companion" } },
      /extraSources.*portable.*main\.ts::\$DATA/,
    ],
    [
      "generated-config-alternate-data-stream-alias",
      { extraSources: { "tsconfig.json::$DATA": "{}" } },
      /extraSources.*portable.*tsconfig\.json::\$DATA/,
    ],
    [
      "windows-reserved-device-name",
      { extraSources: { "src/CON.ts": "companion" } },
      /extraSources.*portable.*CON\.ts/,
    ],
    [
      "windows-numbered-device-name",
      { extraSources: { "src/COM9.ts": "companion" } },
      /extraSources.*portable.*COM9\.ts/,
    ],
    [
      "windows-superscript-device-name",
      { extraSources: { "src/LPT¹.ts": "companion" } },
      /extraSources.*portable.*LPT¹\.ts/,
    ],
    [
      "windows-console-device-name",
      { extraSources: { "src/CONOUT$.ts": "companion" } },
      /extraSources.*portable.*CONOUT\$\.ts/,
    ],
    [
      "windows-forbidden-file-character",
      { extraSources: { "src/invalid?.ts": "companion" } },
      /extraSources.*portable.*invalid\?\.ts/,
    ],
    [
      "default-main-separator-alias",
      { extraSources: { "src\\main.ts": "companion" } },
      /paths collide.*src\/main\.ts.*src\\main\.ts/,
    ],
    [
      "explicit-main-case-alias",
      {
        sourcePath: "src/Feature.ts",
        extraSources: { "SRC\\FEATURE.ts": "companion" },
      },
      /source root as src\/.*SRC\\FEATURE\.ts/,
    ],
    [
      "companion-separator-case-alias",
      {
        extraSources: {
          "src/helper.ts": "first",
          "src\\HELPER.ts": "second",
        },
      },
      /paths collide.*src\/helper\.ts.*src\\HELPER\.ts/,
    ],
    [
      "included-source-root-case-alias",
      { extraSources: { "SRC/helper.tsx": "export {};" } },
      /source root as src\/.*SRC\/helper\.tsx/,
    ],
    [
      "main-directory-alias",
      { extraSources: { src: "companion" } },
      /paths collide.*src\/main\.ts.*src/,
    ],
    [
      "main-descendant-alias",
      { extraSources: { "src/main.ts/child.ts": "companion" } },
      /paths collide.*src\/main\.ts.*src\/main\.ts\/child\.ts/,
    ],
    [
      "extra-source-file-directory-alias",
      {
        extraSources: {
          "src/generated": "file",
          "src/generated/child.ts": "child",
        },
      },
      /paths collide.*src\/generated.*src\/generated\/child\.ts/,
    ],
    [
      "generated-tsconfig-descendant",
      { extraSources: { "tsconfig.json/child.ts": "child" } },
      /generated target.*tsconfig\.json\/child\.ts.*tsconfig\.json/,
    ],
    [
      "generated-tsconfig-case-alias",
      { extraSources: { "TSCONFIG.JSON": "{}" } },
      /generated target.*TSCONFIG\.JSON.*tsconfig\.json/,
    ],
    [
      "generated-lint-config-case-alias",
      {
        rules: {},
        extraSources: { "LINT.CONFIG.JSON": "{}" },
      },
      /generated target.*LINT\.CONFIG\.JSON.*lint\.config\.json/,
    ],
    [
      "generated-node-modules-ancestor",
      { extraSources: { node_modules: "file" } },
      /generated target.*node_modules.*node_modules\/@ttsc\/lint/,
    ],
    [
      "link-node-modules-traversal",
      { linkNodeModules: ["../outside"] },
      /linkNodeModules.*npm package name.*\.\.\/outside/,
    ],
    [
      "link-node-modules-backslash",
      { linkNodeModules: ["scope\\package"] },
      /linkNodeModules.*npm package name.*scope\\package/,
    ],
    [
      "link-node-modules-absolute",
      { linkNodeModules: ["/package"] },
      /linkNodeModules.*npm package name.*\/package/,
    ],
    [
      "link-node-modules-nonportable",
      { linkNodeModules: ["con"] },
      /linkNodeModules.*portable npm package name.*con/,
    ],
  ];

  try {
    for (const [name, overrides, pattern] of invalidPlans) {
      assert.throws(
        () =>
          TestLint.createProject({
            name,
            source: "export {};",
            projectRoot: invalidRoot,
            ...overrides,
          }),
        pattern,
      );
      assert.equal(fs.readFileSync(sentinel, "utf8"), "untouched");
      assert.deepEqual(fs.readdirSync(invalidRoot), ["sentinel.txt"]);
    }

    const fileRoot = path.join(invalidRoot, "project-root.txt");
    fs.writeFileSync(fileRoot, "untouched", "utf8");
    assert.throws(
      () =>
        TestLint.createProject({
          name: "existing-file-project-root",
          source: "export {};",
          projectRoot: fileRoot,
        }),
      /projectRoot.*disposable directory strictly under/,
    );
    assert.equal(fs.readFileSync(fileRoot, "utf8"), "untouched");

    assert.throws(
      () =>
        TestLint.createProject({
          name: "exact-system-temp-root",
          source: "export {};",
          projectRoot: os.tmpdir(),
        }),
      /projectRoot.*disposable directory strictly under/,
    );

    const externalRoot = fs.mkdtempSync(
      path.join(os.homedir(), ".ttsc-lint-source-preflight-external-"),
    );
    const externalSentinel = path.join(externalRoot, "sentinel.txt");
    const escapedRoot = path.join(invalidRoot, "escaped-root");
    let nestedRoot: string | undefined;
    let nestedSourceRoot: string | undefined;
    try {
      nestedRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "ttsc-lint-nested-junction-root-"),
      );
      nestedSourceRoot = path.join(nestedRoot, "src");
      fs.symlinkSync(
        externalRoot,
        escapedRoot,
        process.platform === "win32" ? "junction" : "dir",
      );
      assert.throws(
        () =>
          TestLint.createProject({
            name: "junction-root-escape",
            source: "export {};",
            projectRoot: escapedRoot,
          }),
        /projectRoot.*disposable directory strictly under/,
      );
      assert.deepEqual(fs.readdirSync(externalRoot), []);

      fs.writeFileSync(externalSentinel, "untouched", "utf8");

      fs.symlinkSync(
        externalRoot,
        nestedSourceRoot,
        process.platform === "win32" ? "junction" : "dir",
      );
      assert.throws(
        () =>
          TestLint.createProject({
            name: "nested-junction-write-escape",
            source: "export {};",
            projectRoot: nestedRoot,
          }),
        /projectRoot.*empty disposable directory strictly under/,
      );
      assert.deepEqual(fs.readdirSync(externalRoot), ["sentinel.txt"]);
      assert.equal(fs.readFileSync(externalSentinel, "utf8"), "untouched");
    } finally {
      if (fs.existsSync(escapedRoot)) fs.unlinkSync(escapedRoot);
      if (nestedSourceRoot !== undefined && fs.existsSync(nestedSourceRoot))
        fs.unlinkSync(nestedSourceRoot);
      if (nestedRoot !== undefined)
        fs.rmSync(nestedRoot, { recursive: true, force: true });
      fs.rmSync(externalRoot, { recursive: true, force: true });
    }

    const generatedCollisionRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-lint-generated-collision-"),
    );
    try {
      assert.throws(
        () =>
          TestLint.createProject({
            name: "generated-lint-config-exact-collision",
            source: "export {};",
            projectRoot: generatedCollisionRoot,
            rules: {},
            extraSources: { "lint.config.json": "custom fixture" },
          }),
        /generated target.*lint\.config\.json/,
      );
      assert.deepEqual(fs.readdirSync(generatedCollisionRoot), []);
    } finally {
      fs.rmSync(generatedCollisionRoot, { recursive: true, force: true });
    }

    const project = TestLint.createProject({
      name: "legal-portable-source-paths",
      source: "export const value = 1;",
      sourcePath: "src\\nested\\entry fixture.ts",
      extraSources: {
        "./lint.config.json": JSON.stringify({ rules: {} }),
        "src\\nested\\child\\..\\support.ts": "export type Support = string;",
        "src/COM0.ts": "export const com0 = true;",
        "src/LPT0.ts": "export const lpt0 = true;",
      },
      linkNodeModules: ["@ttsc/lint"],
    });
    try {
      assert.equal(
        fs.readFileSync(
          path.join(project.tmpdir, "src", "nested", "entry fixture.ts"),
          "utf8",
        ),
        "export const value = 1;",
      );
      assert.equal(
        fs.readFileSync(path.join(project.tmpdir, "lint.config.json"), "utf8"),
        JSON.stringify({ rules: {} }),
      );
      assert.equal(
        fs.readFileSync(
          path.join(project.tmpdir, "src", "nested", "support.ts"),
          "utf8",
        ),
        "export type Support = string;",
      );
      assert.equal(
        fs.readFileSync(path.join(project.tmpdir, "src", "COM0.ts"), "utf8"),
        "export const com0 = true;",
      );
      assert.equal(
        fs.readFileSync(path.join(project.tmpdir, "src", "LPT0.ts"), "utf8"),
        "export const lpt0 = true;",
      );
    } finally {
      project.cleanup();
    }
  } finally {
    fs.rmSync(invalidRoot, { recursive: true, force: true });
  }
}
