import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SourcePluginAdmission } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginAdmission";
import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the compiler source a project declares with `TTSC_TSGO_SOURCE` joins
 * a build's overlay modules only when declared, resolves an existing symbolic
 * link to its physical directory while preserving a missing path's lexical
 * spelling, and is admitted only as the compiler module of the line being
 * built.
 *
 * Every key, copy and watch of a source build reads its overlay list, so an
 * undeclared source must leave that list exactly as the caller built it
 * (samchon/ttsc#1877). A declared path that is a symbolic link to a directory
 * must resolve to the target directory before copying, because `materialize`
 * copies into an existing directory and fails with `EEXIST` on a root link. A
 * declared directory that is some other module would replace nothing and
 * silently build against the pinned compiler.
 *
 * 1. Unset and empty values return the caller's list itself.
 * 2. A declared absolute directory joins the list in sorted order; a relative one
 *    is refused by name.
 * 3. A symbolic link to an existing directory resolves to its physical directory
 *    in both `compilerSource` and `withCompilerSource`, while a missing path
 *    keeps its lexical spelling.
 * 4. Admission accepts the line's compiler module and refuses another module, a
 *    directory without a manifest and the other line's compiler module.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls withCompilerSource, compilerSource and requireCompilerSource and asserts the returned list, its identity, physical resolution of a real directory link, lexical fallback for a missing path and the refusals; a source added while undeclared, dropped while declared, left as a symlink, or admitted under another module fails an assertion.
 * @evidence contracts/testing.md#independent-expectations The compiler module paths are the Go module paths of TypeScript 7.0 and 7.1 as their own go.mod files declare them, the sorted order is the order the cache key documents for overlays, and the physical directory is created directly by the test before linking to it; none is read back from the functions under test.
 * @evidence contracts/testing.md#distinguishing-cases Unset, empty, absolute, relative, real symlinked directory, two-link chain, missing mixed-case path and dangling symlink values; a matching module, a foreign module, a missing manifest and the adjacent case of the other line's compiler module. The real build against a declared source belongs to the E2E test test_buildsourceplugin_builds_against_the_compiler_source_a_project_declares.
 * @evidence contracts/testing.md#execution-ownership A unit test that owns one temporary directory with a real directory and symbolic link to test path resolution alongside pure string/env calls; it spawns no process and builds nothing.
 */
export function test_compiler_source_joins_the_overlays_only_when_declared(): void {
  const variable = SourcePluginAdmission.COMPILER_SOURCE_ENV;
  assert.equal(variable, "TTSC_TSGO_SOURCE");
  const root = path.resolve(path.sep, "work");
  const source = path.join(root, "compiler", "tsc");
  const base: readonly string[] = [
    path.join(root, "a-overlay"),
    path.join(root, "z-overlay"),
  ];

  assert.equal(SourcePluginWorkspace.withCompilerSource(base, {}), base);
  assert.equal(
    SourcePluginWorkspace.withCompilerSource(base, { [variable]: "" }),
    base,
  );
  assert.equal(SourcePluginWorkspace.compilerSource({}), undefined);

  assert.equal(
    SourcePluginWorkspace.compilerSource({ [variable]: source }),
    source,
  );
  assert.deepEqual(
    SourcePluginWorkspace.withCompilerSource(base, { [variable]: source }),
    [base[0], source, base[1]],
  );
  assert.deepEqual(
    SourcePluginWorkspace.withCompilerSource([], { [variable]: source }),
    [source],
  );
  assert.throws(
    () =>
      SourcePluginWorkspace.withCompilerSource(base, {
        [variable]: path.join("compiler", "tsc"),
      }),
    /TTSC_TSGO_SOURCE must be an absolute directory path/,
  );

  const tmp = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-compiler-source-link-"),
  );
  const realDir = path.join(tmp, "real", "tsc");
  fs.mkdirSync(realDir, { recursive: true });
  const missing = path.join(tmp, "MissingCase", "Tsc");
  assert.equal(
    SourcePluginWorkspace.compilerSource({ [variable]: missing }),
    missing,
    "a missing path keeps its exact lexical spelling for admission diagnostics",
  );
  const linkKind = process.platform === "win32" ? "junction" : "dir";
  const linkedDir = path.join(tmp, "linked-tsc");
  let linked = false;
  try {
    fs.symlinkSync(realDir, linkedDir, linkKind);
    linked = true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EPERM" && code !== "EACCES") throw error;
  }
  if (linked) {
    assert.equal(
      SourcePluginWorkspace.compilerSource({ [variable]: linkedDir }),
      realDir,
      "a symbolic link to an existing directory resolves to its physical directory",
    );
    assert.deepEqual(
      SourcePluginWorkspace.withCompilerSource(base, {
        [variable]: linkedDir,
      }),
      [...base, realDir].sort(),
      "withCompilerSource inserts the resolved physical directory",
    );
    const chainedDir = path.join(tmp, "chained-tsc");
    fs.symlinkSync(linkedDir, chainedDir, linkKind);
    assert.equal(
      SourcePluginWorkspace.compilerSource({ [variable]: chainedDir }),
      realDir,
      "a chain of two symbolic links resolves to the physical directory",
    );
    assert.deepEqual(
      SourcePluginWorkspace.withCompilerSource(base, {
        [variable]: chainedDir,
      }),
      [...base, realDir].sort(),
      "withCompilerSource resolves a two-link chain to the physical directory",
    );
    const dangling = path.join(tmp, "dangling-tsc");
    fs.symlinkSync(missing, dangling, linkKind);
    assert.equal(
      SourcePluginWorkspace.compilerSource({ [variable]: dangling }),
      dangling,
      "a dangling symbolic link keeps its lexical spelling",
    );
  }

  const line70 = "github.com/microsoft/typescript-go";
  const line71 = "github.com/microsoft/TypeScript/tsc";
  assert.equal(SourcePluginAdmission.COMPILER_MODULE_7_0, line70);
  assert.equal(SourcePluginAdmission.COMPILER_MODULE_7_1, line71);
  SourcePluginAdmission.requireCompilerSource(source, line71, line71, "7.1");
  SourcePluginAdmission.requireCompilerSource(source, line70, line70, "7.0");
  const refusal = (declared: string | null, expected: string): string => {
    try {
      SourcePluginAdmission.requireCompilerSource(
        source,
        declared,
        expected,
        expected === line71 ? "7.1" : "7.0",
      );
    } catch (error) {
      return (error as Error).message;
    }
    return "";
  };
  const foreign = refusal("example.com/other", line71);
  assert.ok(foreign.includes(`TTSC_TSGO_SOURCE names ${source}`), foreign);
  assert.ok(foreign.includes('declares module "example.com/other"'), foreign);
  assert.ok(
    foreign.includes(
      `TypeScript 7.1 compiler target builds against "${line71}"`,
    ),
    foreign,
  );
  assert.ok(refusal(null, line71).includes("has no go.mod"));
  assert.ok(
    refusal(line70, line71).includes(`declares module "${line70}"`),
    "the other line's compiler is not this line's",
  );
  assert.ok(refusal(line71, line70).includes("TypeScript 7.0 compiler target"));
}
