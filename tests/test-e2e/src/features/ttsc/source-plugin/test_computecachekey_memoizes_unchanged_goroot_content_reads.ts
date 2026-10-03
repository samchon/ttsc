import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  path,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies computeCacheKey reuses an unchanged GOROOT content identity.
 *
 * SDK contents contribute to source-plugin identity. This small fixture checks
 * reuse and invalidation through an injected content reader; it measures
 * neither a bundled SDK's size nor startup time.
 *
 * 1. Compute a key and assert the initial GOROOT contents were read.
 * 2. Recompute unchanged and assert no GOROOT content file was read again.
 * 3. Build twice through the production entry and assert its permission repair
 *    does not invalidate the memoized identity.
 * 4. Edit, add, rename, and delete SDK files; assert each manifest change re-reads
 *    content and changes the key.
 *
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey initially reads SDK bytes, reuses unchanged identity without reads, preserves that reuse through builds, and rereads after edit/add/rename/delete.
 * @evidence contracts/testing.md#independent-expectations The supplied adapter increments only when its readFile operation receives a path under this physical SDK. Literal alpha/bravo and added/renamed/deleted paths provide independent input transitions. Zero counts exclude those adapter reads, not all filesystem or child-process work.
 * @evidence contracts/testing.md#distinguishing-cases Cold/warm computation, production permission repair, content edit and three membership transitions are all retained.
 * @evidence contracts/testing.md#execution-ownership The exported test_computecachekey_memoizes_unchanged_goroot_content_reads entry is discovered from features/ttsc/source-plugin by the E2E TestExecutor. Its reader and local fixture helpers execute beneath that owner; the two builder calls retain a real orchestration connection distinct from the direct fingerprint policy.
 * @evidence contracts/e2e.md#necessary-boundary The cache identity owner resolves actual tool paths and consumes the Go metadata process result when goBinary is supplied. The handwritten fake producer or intentionally unusable compiler files constrain that connection; these assertions establish identity selection, not native binary compatibility by execution.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Repeated keys and builds share the same fake SDK and process cache; edits and membership transitions intentionally trigger new reads rather than a new installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked temporary spelling is retained before resolving its physical path. The prior fake GOROOT response value or absence is restored in finally; builder environments are call-local. The counter resets without deleting memoized identity. Successive edits depend on the preceding manifest and key; two returned builds and zero adapter reads do not independently establish permission changes, total IO, cache-hit counts or descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage computeCacheKey initially reads SDK bytes, reuses unchanged identity without reads, preserves that reuse through builds, and rereads after edit/add/rename/delete. These assertions stay in test_computecachekey_memoizes_unchanged_goroot_content_reads with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_computecachekey_memoizes_unchanged_goroot_content_reads =
  () => {
    const temporary = TestProject.tmpdir("ttsc-source-plugin-");
    TestProject.retainTemporaryDirectory(temporary);
    const root = TestProject.physicalPath(temporary);
    const plugin = path.join(root, "plugin");
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
    const goRoot = path.join(root, "go-root");
    const sourceFile = writeGoRoot(goRoot, "alpha");
    fs.mkdirSync(path.join(goRoot, "bin"), { recursive: true });
    const go = createFakeGoBinary(path.join(goRoot, "bin"));
    const previous = process.env.FAKE_GO_ENV_GOROOT;
    let goRootReads = 0;
    const filesystem = {
      readFile: (location: string): Buffer => {
        const file = path.resolve(location);
        const relative = path.relative(goRoot, file);
        if (
          relative !== "" &&
          relative !== ".." &&
          !relative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relative)
        ) {
          goRootReads += 1;
        }
        return fs.readFileSync(location);
      },
    };
    const key = () =>
      computeCacheKey({
        dir: plugin,
        entry: ".",
        filesystem,
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

    try {
      process.env.FAKE_GO_ENV_GOROOT = goRoot;
      const first = key();
      assert.ok(goRootReads > 0, "the cold identity must read GOROOT content");

      goRootReads = 0;
      const second = key();
      assert.equal(second, first);
      assert.equal(goRootReads, 0);

      for (const file of [
        "vendor/local/value.go",
        "lib/helper.go",
        "dist/generated.go",
        "build/generated.go",
      ]) {
        fs.mkdirSync(path.dirname(path.join(plugin, file)), {
          recursive: true,
        });
        fs.writeFileSync(path.join(plugin, file), "package main\n", "utf8");
      }
      const build = () =>
        buildSourcePlugin({
          baseDir: root,
          cacheDir: path.join(root, "cache"),
          env: {
            ...process.env,
            FAKE_GO_ENV_GOROOT: goRoot,
            TTSC_GO_BINARY: go,
          },
          filesystem,
          overlayDirs: [],
          pluginName: "goroot-memo",
          quiet: true,
          source: plugin,
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
      build();
      goRootReads = 0;
      build();
      assert.equal(
        goRootReads,
        0,
        "production permission repair must preserve an unchanged GOROOT signature",
      );

      fs.writeFileSync(
        sourceFile,
        'package fmt\nconst marker = "bravo"\n',
        "utf8",
      );
      goRootReads = 0;
      const third = key();
      assert.notEqual(third, first);
      assert.ok(goRootReads > 0, "a changed manifest must re-read GOROOT");

      const added = path.join(goRoot, "src", "fmt", "added.go");
      fs.writeFileSync(added, "package fmt\n", "utf8");
      goRootReads = 0;
      const fourth = key();
      assert.notEqual(fourth, third);
      assert.ok(goRootReads > 0, "an added file must re-read GOROOT");

      const renamed = path.join(goRoot, "src", "fmt", "renamed.go");
      fs.renameSync(added, renamed);
      goRootReads = 0;
      const fifth = key();
      assert.notEqual(fifth, fourth);
      assert.ok(goRootReads > 0, "a renamed file must re-read GOROOT");

      fs.rmSync(renamed);
      goRootReads = 0;
      const sixth = key();
      assert.notEqual(sixth, fifth);
      assert.ok(goRootReads > 0, "a deleted file must re-read GOROOT");
    } finally {
      if (previous === undefined) delete process.env.FAKE_GO_ENV_GOROOT;
      else process.env.FAKE_GO_ENV_GOROOT = previous;
    }
  };

function writeGoRoot(root: string, marker: string): string {
  fs.mkdirSync(path.join(root, "src", "fmt"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "runtime"), { recursive: true });
  fs.mkdirSync(path.join(root, "pkg", "tool", "linux_amd64"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, "VERSION"), "go1.26.0\n", "utf8");
  fs.writeFileSync(path.join(root, "go.env"), "GOTOOLCHAIN=auto\n", "utf8");
  const sourceFile = path.join(root, "src", "fmt", "print.go");
  fs.writeFileSync(
    sourceFile,
    `package fmt\nconst marker = ${JSON.stringify(marker)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "src", "runtime", "runtime.go"),
    "package runtime\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "pkg", "tool", "linux_amd64", "compile"),
    "compile\n",
    "utf8",
  );
  return sourceFile;
}
