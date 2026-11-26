import { TestProject } from "@ttsc/testing";

import { SourcePluginAdmission } from "../../../../../../../packages/ttsc/lib/plugin/internal/source/SourcePluginAdmission.js";
import { SourcePluginWorkspace } from "../../../../../../../packages/ttsc/lib/plugin/internal/source/SourcePluginWorkspace.js";
import {
  assert,
  buildSourcePlugin,
  child_process,
  fs,
  path,
} from "../../../../internal/ttsc/internal/source-build";

/**
 * Verifies a source build compiles the compiler source the project declares
 * with `TTSC_TSGO_SOURCE`, including through a symbolic link to the directory,
 * and keys its binary on that source.
 *
 * A project whose `tsc` is built from its own revision of the compiler gets a
 * plugin host with another checker unless the host is built from the same
 * source (samchon/ttsc#1877). The declared directory is an overlay module of
 * the build, so it is keyed, copied and proven like ttsc's own modules, and the
 * generated workspace replaces the compiler module with the copy. A declared
 * path that is a symbolic link to the directory resolves to the physical
 * directory so copying into the scratch tree succeeds and shares the real
 * path's cache key. The built binary's output is the observation: only the
 * declared source holds the value it prints.
 *
 * 1. Build a plugin that imports a package only the declared source has; it prints
 *    that source's value, and an unchanged source reuses the binary through
 *    both the real path and a two-link symbolic chain to it.
 * 2. Edit the declared source and build through the two-link chain: the cold copy
 *    succeeds, the build is keyed anew and prints the edit, the real path
 *    reuses that binary, and the first binary still prints the first value.
 * 3. Build cold against a read-only (`0555`/`0444`) declared compiler source tree
 *    (skipped on Windows or root): copying, building and scratch cleanup all
 *    succeed and the binary prints that source's value.
 * 4. A directory declaring another module is refused, naming the variable, the
 *    declared directory and both modules.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs buildSourcePlugin with the real Go toolchain and executes each built binary, including a cold build declared through a two-link directory symlink chain and a cold build against a read-only declared source tree; a build that ignored the declared source cannot resolve the imported package, one that left a root symlink unresolved or preserved read-only modes fails when copying or removing scratch, one that keyed without the source would return the first binary after the edit, and one that read the source in place instead of its copy is not distinguished here.
 * @evidence contracts/testing.md#independent-expectations The printed values are the constants this test writes into the declared source, and the refusal text is the documented one; neither comes from the builder's output.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged source via real path and via a two-link symbolic chain (same binary), edited source built cold via the two-link chain and reused via real path (new binary, new output, old binary unchanged), a read-only declared source tree (cold build and scratch removal succeed), and a foreign module (refusal). The undeclared, relative-path, path-resolution and other-line cases belong to the unit test test_compiler_source_joins_the_overlays_only_when_declared.
 * @evidence contracts/testing.md#execution-ownership An E2E entry that owns a temporary root holding the plugin, the declared source, a two-link symbolic chain to it, a read-only source copy and a private cache; each Go process is joined by the synchronous build before the next assertion, and read-only modes are restored in finally.
 * @evidence contracts/e2e.md#necessary-boundary Only Go resolving the workspace replacement proves the declared directory is what a host compiles, and only real cold builds through a two-link directory symlink chain and a read-only tree exercise full scratch materialization and cleanup through buildSourcePlugin; unit calls can assert path resolution and copy modes but not that Go honours the replacement or that end-to-end build and cleanup succeed.
 * @evidence contracts/e2e.md#shared-execution Seven calls of the builder (fewer when the host cannot create links or enforce POSIX chmod) over one two-file plugin module and one two-file declared compiler module with no external dependency: the cold build via the real path, two cache hits (real path and two-link chain), the edited cold build through the two-link chain that the key change requires, its cache hit via the real path, the cold build against a read-only tree, and the refused foreign module, which stops before compiling.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The plugin cache is private to this test's root, so no other case's binary can answer; the second build's input is the edited constant, and the harness removes the tracked root.
 * @evidence contracts/e2e.md#preserved-coverage A new case; no existing source-plugin case is moved or merged.
 */
export function test_buildsourceplugin_builds_against_the_compiler_source_a_project_declares(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-compiler-source-"),
  );
  const plugin = path.join(root, "plugin");
  const compiler = path.join(root, "compiler");
  const write = (file: string, text: string): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const module = SourcePluginAdmission.COMPILER_MODULE_7_0;
  write(
    path.join(plugin, "go.mod"),
    `module example.com/plugin\n\ngo 1.24\n\nrequire ${module} v0.0.0\n`,
  );
  write(
    path.join(plugin, "main.go"),
    `package main\n\nimport (\n\t"fmt"\n\n\t"${module}/revision"\n)\n\n` +
      `func main() { fmt.Print(revision.Name) }\n`,
  );
  write(path.join(compiler, "go.mod"), `module ${module}\n\ngo 1.24\n`);
  const revision = path.join(compiler, "revision", "revision.go");
  write(revision, `package revision\n\nconst Name = "declared-one"\n`);

  const build = (source: string): string => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      [SourcePluginAdmission.COMPILER_SOURCE_ENV]: source,
    };
    return buildSourcePlugin({
      source: plugin,
      baseDir: root,
      cacheDir: path.join(root, "cache"),
      pluginName: "compiler-source",
      overlayDirs: SourcePluginWorkspace.withCompilerSource([], env),
      quiet: true,
      env,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
  };
  const run = (binary: string): string =>
    child_process.execFileSync(binary, { encoding: "utf8" });

  const first = build(compiler);
  assert.equal(run(first), "declared-one");
  assert.equal(build(compiler), first, "an unchanged source reuses its binary");

  const midLink = path.join(root, "compiler-link-mid");
  const linkedCompiler = path.join(root, "compiler-link");
  const linkKind = process.platform === "win32" ? "junction" : "dir";
  let linked = false;
  try {
    fs.symlinkSync(compiler, midLink, linkKind);
    fs.symlinkSync(midLink, linkedCompiler, linkKind);
    linked = true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EPERM" && code !== "EACCES") throw error;
  }
  if (linked) {
    assert.equal(
      build(linkedCompiler),
      first,
      "a symbolic link to the declared source reuses the binary built through the real path",
    );
  }

  fs.writeFileSync(
    revision,
    `package revision\n\nconst Name = "declared-two"\n`,
  );
  const second = build(linked ? linkedCompiler : compiler);
  assert.notEqual(second, first, "an edited compiler source is keyed anew");
  assert.equal(run(second), "declared-two");
  assert.equal(run(first), "declared-one");
  if (linked) {
    assert.equal(
      build(compiler),
      second,
      "the real path reuses the binary built cold through a symbolic link",
    );
  }

  if (process.platform !== "win32" && process.getuid?.() !== 0) {
    const readOnlyCompiler = path.join(root, "readonly-compiler");
    const readOnlyRevisionDir = path.join(readOnlyCompiler, "revision");
    const readOnlyGoMod = path.join(readOnlyCompiler, "go.mod");
    const readOnlyRevision = path.join(readOnlyRevisionDir, "revision.go");
    write(readOnlyGoMod, `module ${module}\n\ngo 1.24\n`);
    write(
      readOnlyRevision,
      `package revision\n\nconst Name = "declared-readonly"\n`,
    );
    fs.chmodSync(readOnlyGoMod, 0o444);
    fs.chmodSync(readOnlyRevision, 0o444);
    fs.chmodSync(readOnlyRevisionDir, 0o555);
    fs.chmodSync(readOnlyCompiler, 0o555);
    try {
      const readOnlyBuilt = build(readOnlyCompiler);
      assert.equal(run(readOnlyBuilt), "declared-readonly");
    } finally {
      fs.chmodSync(readOnlyCompiler, 0o755);
      fs.chmodSync(readOnlyRevisionDir, 0o755);
      fs.chmodSync(readOnlyGoMod, 0o644);
      fs.chmodSync(readOnlyRevision, 0o644);
    }
  }

  const other = path.join(root, "other");
  write(path.join(other, "go.mod"), "module example.com/other\n\ngo 1.24\n");
  assert.throws(
    () => build(other),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes(`TTSC_TSGO_SOURCE names ${other}`) &&
      error.message.includes('declares module "example.com/other"') &&
      error.message.includes(`builds against "${module}"`),
  );
}
