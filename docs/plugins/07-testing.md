# Testing Your Plugin

A plugin has two layers, and both need tests:

- **Unit tests** in Go for your transformer logic — fast, deterministic, no `ttsc` involvement.
- **Integration tests** that actually run `ttsc` against a sample consumer project with your plugin wired in — slower but catches manifest, protocol, and end-to-end issues.

This page is opinionated about layouts that work; copy and adapt.

## Unit tests (Go side)

Pull your transform logic into a function the test can call directly:

```go
// go-plugin/main.go (excerpt)
package main

func transform(source string, plugins []Plugin) (string, error) {
    // …
}
```

```go
// go-plugin/main_test.go
package main

import (
    "strings"
    "testing"
)

func TestTransformUppercase(t *testing.T) {
    out, err := transform(`export const value: string = goUpper("hello"); console.log(value);`, nil)
    if err != nil {
        t.Fatal(err)
    }
    if !strings.Contains(out, `"HELLO"`) {
        t.Fatalf("expected uppercase value, got:\n%s", out)
    }
}

func TestTransformOrderedPipeline(t *testing.T) {
    plugins := []Plugin{
        {Mode: "prefix", Config: map[string]any{"prefix": "A:"}},
        {Mode: "uppercase"},
        {Mode: "suffix", Config: map[string]any{"suffix": ":Z"}},
    }
    out, err := transform(`export const v: string = goUpper("plugin"); console.log(v);`, plugins)
    if err != nil {
        t.Fatal(err)
    }
    if !strings.Contains(out, `"A:PLUGIN:Z"`) {
        t.Fatalf("expected ordered pipeline output, got:\n%s", out)
    }
}
```

Run with `go test ./go-plugin/...`. With the local `go.work` from [04-local-dev.md](./04-local-dev.md) set up, you can also use `gopls`-aware `go test -run TestX` selection from your editor.

### What to put in unit tests

- **Transform correctness** — happy path for each `mode` you support, including ordered pipelines.
- **Config edge cases** — missing config, wrong types, empty strings.
- **Errors** — when source doesn't match the pattern your plugin expects, the error message is what the consumer sees.
- **Determinism** — same input → same output. If you generate code, sort keys and stable-format your output so test diffs are clean.

### What *not* to put in unit tests

- Anything that requires a real `Program` or `Checker`. That's integration territory — bootstrapping a tsgo `Program` in a unit test means parsing a real tsconfig, which means a real on-disk fixture, which means you're already writing integration code. Keep that in the integration suite.
- Network calls. If your plugin reaches out (e.g., to fetch schemas), inject the client and test against a fake.

## Integration tests

Integration tests run `ttsc` against a fixture project that uses your plugin and assert on the resulting `dist/` output.

### Recommended layout

```
your-plugin/
├── package.json
├── plugin.cjs
├── go-plugin/
│   ├── go.mod
│   ├── main.go
│   └── main_test.go
└── tests/
    ├── package.json                   # workspace member, depends on ../
    ├── helpers.cjs                    # shared spawn() / project setup
    └── fixtures/
        ├── basic/
        │   ├── tsconfig.json
        │   └── src/main.ts
        └── ordered/
            ├── tsconfig.json
            └── src/main.ts
```

A minimal `tests/package.json`:

```json
{
  "private": true,
  "scripts": {
    "test": "node --test --test-reporter=spec test/*.test.cjs"
  },
  "devDependencies": {
    "ttsc": "^0.4.0",
    "@typescript/native-preview": "*"
  }
}
```

A minimal `tests/test/basic.test.cjs`:

```js
const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const ttscBin = require.resolve("ttsc/lib/launcher/ttsc.js");
const fixtures = path.resolve(__dirname, "..", "fixtures");

function copyFixture(name) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `your-plugin-${name}-`));
  fs.cpSync(path.join(fixtures, name), tmp, { recursive: true });
  return tmp;
}

test("basic: goUpper rewrites string literals", () => {
  const root = copyFixture("basic");
  const result = child_process.spawnSync(
    process.execPath,
    [ttscBin, "--cwd", root, "--emit"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /"HELLO"/);
});
```

Each test copies a fixture to a tmp dir (so the build artifacts don't pollute your repo), runs `ttsc`, asserts on the output. Use `node:test` (built into Node 18+) — no extra dep.

### Cache isolation in tests

Each test run hits the cache. To force a cold build, set `TTSC_CACHE_DIR` to a fresh tmp directory in your test's spawn env. To keep tests fast across the suite, share one cache dir across all tests in the run:

```js
const sharedCache = fs.mkdtempSync(path.join(os.tmpdir(), "your-plugin-cache-"));
// pass to every spawn:
env: { ...process.env, TTSC_CACHE_DIR: sharedCache },
```

The first integration test cold-builds (one `go build`), the rest hit cache. Set this once per run, not per test.

### Common assertions

- **Output content** — `assert.match(jsContent, /<pattern>/)`. Don't snapshot the entire file; the build pipeline emits boilerplate that's allowed to change.
- **Stderr clean** — when status is 0, stderr should typically be empty (or contain only the one-line "building source plugin" log on cache miss). Trailing diagnostics often indicate problems even when the exit code is success.
- **Specific error messages** — for failure-path tests, `assert.match(result.stderr, /your specific error string/)`.

## Cross-platform CI

Test on at least Linux + macOS. Windows is the trickiest:

- File paths use backslashes. Most of your plugin code touches paths via `path.Join`/`filepath.Join` so this is handled, but watch for any place you compare path strings directly.
- Process spawn quoting differs subtly. Use `windowsHide: true` and avoid shell-string commands.
- The plugin's compiled binary on Windows is `plugin.exe`, not `plugin`. `ttsc` handles this automatically; just don't hard-code the binary name in your own integration tests.

A reasonable CI matrix:

```yaml
os: [ubuntu-latest, macos-latest, windows-latest]
node-version: [18, 20, 22]
go-version: ["1.26"]
```

Three platforms × three Node versions × one Go version = 9 jobs. Skip the Windows × Node-18 cell if you want to trim.

## Ongoing: regression test for the symbol *you import*

If your plugin imports `shim/checker.GetTypeAtLocation` (hypothetical), add a test that exercises that exact path. When `ttsc` bumps `tsgo` and the symbol moves or changes, the cached binary recompiles, and *that* is when you find out. Catching it in your integration suite, not in production, is the entire point of the source-distribution model.

A bare-minimum smoke test for tsgo imports:

```js
test("tsgo shim imports still resolve after ttsc upgrade", () => {
  // run a fixture that exercises every shim package your plugin imports
  // assert the build succeeds and produces the expected output
});
```

Run this in CI on every `ttsc` minor bump (or pin a specific `ttsc` and only update intentionally).
