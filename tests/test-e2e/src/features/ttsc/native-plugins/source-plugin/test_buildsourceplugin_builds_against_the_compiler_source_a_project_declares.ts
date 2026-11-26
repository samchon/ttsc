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
 * with `TTSC_TSGO_SOURCE`, and keys its binary on that source.
 *
 * A project whose `tsc` is built from its own revision of the compiler gets a
 * plugin host with another checker unless the host is built from the same
 * source (samchon/ttsc#1877). The declared directory is an overlay module of
 * the build, so it is keyed, copied and proven like ttsc's own modules, and the
 * generated workspace replaces the compiler module with the copy. The built
 * binary's output is the observation: only the declared source holds the value
 * it prints.
 *
 * 1. Build a plugin that imports a package only the declared source has; it prints
 *    that source's value, and an unchanged source reuses the binary.
 * 2. Edit the declared source: the build is keyed anew and prints the edit, while
 *    the first binary still prints the first value.
 * 3. A directory declaring another module is refused, naming the variable, the
 *    declared directory and both modules.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs buildSourcePlugin with the real Go toolchain and executes each built binary; a build that ignored the declared source cannot resolve the imported package, one that keyed without it would return the first binary after the edit, and one that read the source in place instead of its copy is not distinguished here.
 * @evidence contracts/testing.md#independent-expectations The printed values are the constants this test writes into the declared source, and the refusal text is the documented one; neither comes from the builder's output.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged source (same binary), edited source (new binary, new output, old binary unchanged) and a foreign module (refusal). The undeclared, relative-path and other-line cases belong to the unit test test_compiler_source_joins_the_overlays_only_when_declared.
 * @evidence contracts/testing.md#execution-ownership An E2E entry that owns a temporary root holding the plugin, the declared source and a private cache; each Go process is joined by the synchronous build before the next assertion.
 * @evidence contracts/e2e.md#necessary-boundary Only Go resolving the workspace replacement proves the declared directory is what a host compiles; unit calls can assert the generated text but not that Go honours it over the required version.
 * @evidence contracts/e2e.md#shared-execution Four calls of the builder over one two-file plugin module and one two-file declared compiler module with no external dependency: the cold build, the unchanged source answered from the cache without compiling, the edited source that the key change requires, and the refused foreign module, which stops before compiling.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The plugin cache is private to this test's root, so no other case's binary can answer; the second build's input is the edited constant, and the harness removes the tracked root.
 * @evidence contracts/e2e.md#preserved-coverage A new case; no existing source-plugin case is moved or merged.
 */
export function test_buildsourceplugin_builds_against_the_compiler_source_a_project_declares(): void {
  const root = TestProject.tmpdir("ttsc-compiler-source-");
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

  fs.writeFileSync(
    revision,
    `package revision\n\nconst Name = "declared-two"\n`,
  );
  const second = build(compiler);
  assert.notEqual(second, first, "an edited compiler source is keyed anew");
  assert.equal(run(second), "declared-two");
  assert.equal(run(first), "declared-one");

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
