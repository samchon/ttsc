import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
  resolveSourceBuildCachePaths,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies buildSourcePlugin: marks an empty default cache boundary.
 *
 * A source-plugin build can be the first writer below an intentionally empty
 * nested `node_modules`. Its cache write must not make the next resolution
 * abandon that install for a populated ancestor.
 *
 * 1. Create a plugin below an empty install and a populated ancestor install.
 * 2. Build it through the fake Go toolchain with the default cache.
 * 3. Assert cache resolution retains the nested root after the cache write.
 *
 * @evidence contracts/testing.md#behavioral-verification buildSourcePlugin publishes at an initially empty nested install and cache resolution keeps that root before and after the write.
 * @evidence contracts/testing.md#independent-expectations The explicit nested node_modules boundary must remain selected instead of the deliberately populated ancestor.
 * @evidence contracts/testing.md#distinguishing-cases Empty-before and populated-by-cache-after states share the same expected root; the ancestor is the negative location.
 * @evidence contracts/testing.md#execution-ownership The exported test_buildsourceplugin_marks_an_empty_default_cache_boundary entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin passes actual executable arguments, cwd, environment and copied workspace inputs through a child process before publication. The fake Go script can fail or record those inputs independently; it proves build orchestration at this process boundary and does not certify native Go compilation.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Calls that change source, cache ownership, environment or tool permissions retain distinct observations because those are the inputs under test. The fake subprocess fixtures avoid unnecessary native compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage buildSourcePlugin publishes at an initially empty nested install and cache resolution keeps that root before and after the write. These assertions stay in test_buildsourceplugin_marks_an_empty_default_cache_boundary with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_buildsourceplugin_marks_an_empty_default_cache_boundary =
  () => {
    const container = TestProject.tmpdir("ttsc-empty-cache-boundary-");
    const root = path.join(container, "project");
    fs.mkdirSync(path.join(container, "node_modules", "dependency"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(root, "main.go"), "package main\n", "utf8");
    for (const file of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      const location = path.join(root, file);
      fs.mkdirSync(path.dirname(location), { recursive: true });
      fs.writeFileSync(location, "package main\n", "utf8");
    }
    const expected = path.join(root, "node_modules", ".cache", "ttsc");
    assert.equal(resolveSourceBuildCachePaths(root).root, expected);

    const binary = buildSourcePlugin({
      baseDir: root,
      env: {
        ...process.env,
        GOCACHE: "",
        TTSC_CACHE_DIR: "",
        TTSC_GO_BINARY: createFakeGoBinary(container),
        TTSC_GO_CACHE_DIR: "",
      },
      overlayDirs: [],
      pluginName: "empty-cache-boundary",
      quiet: true,
      source: root,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.equal(fs.existsSync(binary), true);
    assert.equal(resolveSourceBuildCachePaths(root).root, expected);
  };
