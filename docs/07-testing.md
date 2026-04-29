# Testing Plugins

Use two layers:

- Go unit tests for pure transform logic.
- End-to-end tests that run `ttsc` against a fixture project.

## Go Unit Tests

Keep the core logic callable without CLI flags:

```go
func applyBanner(fileName, text string, config map[string]any) (string, error) {
	// pure transform logic
}
```

Test it directly:

```go
func TestApplyBanner(t *testing.T) {
	out, err := applyBanner("dist/main.js", "console.log(1);\n", map[string]any{
		"banner": "/*! x */",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out, "/*! x */\n") {
		t.Fatalf("missing banner:\n%s", out)
	}
}
```

Unit tests should cover:

- happy path;
- invalid config;
- no-op file kinds;
- idempotence;
- AST matching helpers;
- text edit edge cases.

References:

- [`tests/utility-plugins/banner/plugin/banner_test.go`](../tests/utility-plugins/banner/plugin/banner_test.go)
- [`tests/utility-plugins/strip/plugin/strip_test.go`](../tests/utility-plugins/strip/plugin/strip_test.go)
- [`tests/utility-plugins/paths/plugin/paths_test.go`](../tests/utility-plugins/paths/plugin/paths_test.go)

## End-to-End Tests

An end-to-end test should:

1. copy or create a temporary fixture project;
2. link/install the plugin under `node_modules`;
3. run the real `ttsc` launcher;
4. assert on emitted files, diagnostics, and exit code.

Minimal Node test skeleton:

```js
const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ttscBin = require.resolve("ttsc/lib/launcher/ttsc.js");

test("plugin rewrites output", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "my-plugin-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/main.ts"), `export const x = 1;\n`);
  fs.writeFileSync(path.join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      rootDir: "src",
      outDir: "dist",
      plugins: [{ transform: "my-plugin" }]
    },
    include: ["src"]
  }));

  const result = child_process.spawnSync(
    process.execPath,
    [ttscBin, "--cwd", root, "--emit"],
    { encoding: "utf8", windowsHide: true }
  );

  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist/main.js"), "utf8");
  assert.match(js, /expected output/);
});
```

## Cache in Tests

Use a shared cache directory per test run:

```js
const cache = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-plugin-cache-"));

env: {
  ...process.env,
  TTSC_CACHE_DIR: cache
}
```

This cold-builds once and keeps the suite fast.

Use a fresh cache when the test asserts first-build behavior.

## What to Assert

For successful builds:

- exit status is `0`;
- emitted output contains the expected change;
- runtime output still works when relevant;
- stderr contains only expected cache-build logs.

For failures:

- exit status is non-zero;
- stderr contains a specific, user-actionable message.

Avoid whole-file snapshots unless the exact output is the contract. Compiler boilerplate can legitimately change.

## TypeScript-Go Drift Tests

If your plugin imports a shim symbol, add an end-to-end case that exercises that exact code path. When `ttsc` bumps TypeScript-Go, a moved symbol should fail in CI, not in a user's install.
