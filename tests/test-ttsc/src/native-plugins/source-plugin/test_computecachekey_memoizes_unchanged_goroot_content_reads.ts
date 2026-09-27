import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies computeCacheKey reuses an unchanged GOROOT content identity.
 *
 * A bundled toolchain contributes roughly 140 MiB to every source-plugin key.
 * Re-reading those bytes for every plugin dominates startup, while reusing a
 * stale identity after an in-place SDK patch would select the wrong binary.
 *
 * 1. Compute a key and assert the initial GOROOT contents were read.
 * 2. Recompute unchanged and assert no GOROOT content file was read again.
 * 3. Build twice through the production entry and assert its permission repair
 *    does not invalidate the memoized identity.
 * 4. Edit, add, rename, and delete SDK files; assert each manifest change re-reads
 *    content and changes the key.
 */
export const test_computecachekey_memoizes_unchanged_goroot_content_reads =
  () => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-source-plugin-"),
    );
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
