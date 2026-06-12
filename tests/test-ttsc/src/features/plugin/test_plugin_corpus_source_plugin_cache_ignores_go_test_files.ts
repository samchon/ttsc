import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: source plugin cache ignores Go test files.
 *
 * The source-plugin cache key must match `go build` inputs. Go ignores
 * `_test.go`, including test-only subdirectories, so editing those files must
 * not invalidate an already-built plugin binary; editing production `.go`
 * source still must invalidate the cache.
 *
 * 1. Add `_test.go` files beside and below the plugin source, then cold-build.
 * 2. Edit only those test files and assert the warm build reuses the binary.
 * 3. Edit `main.go` and assert ttsc rebuilds and emits the changed output.
 */
export const test_plugin_corpus_source_plugin_cache_ignores_go_test_files =
  () => {
    const root = copyProject("go-source-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-test-files-");
    const env = {
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
    };
    const rootTestFile = path.join(root, "go-plugin", "ignored_test.go");
    const nestedTestDir = path.join(root, "go-plugin", "testonly");
    const nestedTestFile = path.join(nestedTestDir, "only_test.go");
    fs.mkdirSync(nestedTestDir, { recursive: true });
    fs.writeFileSync(rootTestFile, TEST_FILE("cold"));
    fs.writeFileSync(nestedTestFile, TEST_ONLY_FILE("cold"));

    const cold = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
    assert.equal(cold.status, 0, cold.stderr);
    assert.match(cold.stderr, /building source plugin "go-source-plugin"/);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );

    fs.writeFileSync(rootTestFile, TEST_FILE("warm"));
    fs.writeFileSync(nestedTestFile, TEST_ONLY_FILE("warm"));
    const warm = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
    assert.equal(warm.status, 0, warm.stderr);
    assert.doesNotMatch(warm.stderr, /building source plugin/);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );

    const goFile = path.join(root, "go-plugin", "main.go");
    const original = fs.readFileSync(goFile, "utf8");
    const changed = original.replace(
      /(case "go-uppercase":\n)(\s*)value = strings\.ToUpper\(value\)/,
      `$1$2value = "[" + strings.ToUpper(value) + "]"`,
    );
    assert.notEqual(changed, original, "expected to edit go-uppercase branch");
    fs.writeFileSync(goFile, changed);
    const production = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env,
    });
    assert.equal(production.status, 0, production.stderr);
    assert.match(
      production.stderr,
      /building source plugin "go-source-plugin"/,
    );
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"\[PLUGIN\]"/,
    );
  };

function TEST_FILE(label: string): string {
  return `package main

import "testing"

func TestIgnored${label}(t *testing.T) {
  t.Log(${JSON.stringify(label)})
}
`;
}

function TEST_ONLY_FILE(label: string): string {
  return `package testonly

import "testing"

func TestOnly${label}(t *testing.T) {
  t.Log(${JSON.stringify(label)})
}
`;
}
