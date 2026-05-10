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
		"text": "x",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out, "/**\n * ----------------------------------------------------------------\n * x\n *\n * @packageDocumentation\n */\n") {
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

- [`packages/ttsc/utility/host_test.go`](../packages/ttsc/utility/host_test.go)
- [`packages/banner/test`](../packages/banner/test/)
- [`packages/strip/test`](../packages/strip/test/)
- [`packages/paths/test`](../packages/paths/test/)

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

test("plugin transforms source before emit", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "my-plugin-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/main.ts"), `export const x = 1;\n`);
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        rootDir: "src",
        outDir: "dist",
        plugins: [{ transform: "my-plugin" }],
      },
      include: ["src"],
    }),
  );

  const result = child_process.spawnSync(
    process.execPath,
    [ttscBin, "--cwd", root, "--emit"],
    { encoding: "utf8", windowsHide: true },
  );

  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist/main.js"), "utf8");
  assert.match(js, /expected transform result/);
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
- emitted output contains the expected transform result;
- runtime output still works when relevant;
- stderr contains only expected cache-build logs.

For failures:

- exit status is non-zero;
- stderr contains a specific, user-actionable message.

Avoid whole-file snapshots unless the exact output is the contract. Compiler boilerplate can legitimately change.

## TypeScript-Go Drift Tests

If your plugin imports a shim symbol, add an end-to-end case that exercises that exact code path. When `ttsc` bumps TypeScript-Go, a moved symbol should fail in CI, not in a user's install.

For this repository's full test matrix and release smoke checks, see [Workspace Release](./12-workspace-release.md).

## Go Coverage Gate

Go logic coverage is measured as a hard `100%` gate:

```bash
pnpm run test:go
```

The gate covers behavioral Go packages and fixture sidecars:

- `packages/ttsc/cmd/platform`, `packages/ttsc/cmd/ttsc`, `packages/ttsc/driver`, `packages/ttsc/internal/cwd`, and `packages/ttsc/utility`
- `packages/banner/plugin`, `packages/paths/plugin`, and `packages/strip/plugin`
- `packages/lint/plugin`
- `tests/go-transformer`

Generated shim re-export files under `packages/ttsc/shim` are not counted as logic. When a Go package contains behavior, add tests until `go tool cover -func` reports `100.0%` for that package set.
