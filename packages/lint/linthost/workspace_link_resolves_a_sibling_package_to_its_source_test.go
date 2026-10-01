package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestWorkspaceLinkResolvesASiblingPackageToItsSource verifies the read scope
// reaches a sibling package through the link a workspace installer creates.
//
// The reported shape is not a relative import: a pnpm workspace materializes
// `node_modules/@fixture/api` as a link to the sibling directory, and the
// package's own `main` and `types` name `./src/index.ts`, so module resolution
// lands on first-party TypeScript through a path that runs inside
// `node_modules` (samchon/ttsc#1065). The file's spelling therefore differs
// from its location, which is the property this case pins: admission follows
// what the Program read, not where the path appears to sit.
//
//  1. Write a sibling package whose entry points at its own TypeScript source.
//  2. Link it under the consumer's node_modules and import it by package name.
//  3. Assert the sibling's violation reports and its file is never rewritten.
// @evidence contracts/testing.md#behavioral-verification The Go loader resolves an imported linked sibling to its TypeScript source, reports its configured violation and never rewrites that sibling file.
// @evidence contracts/testing.md#independent-expectations The authored sibling package entry, literal violation and original source bytes establish resolver and non-mutation expectations independently of resolved Program paths.
// @evidence contracts/testing.md#distinguishing-cases The sibling is reachable only through a node_modules symlink and a package.json main/types pointing at src/index.ts, not through a relative import. The fix command must exit two with the no-var diagnostic for it, and the sibling bytes must be unchanged because fix writes only inside the project selection. The test skips where symlinks cannot be created.
// @evidence contracts/testing.md#execution-ownership Creates a real symlink under node_modules and runs run fix in process with captured streams; the test is skipped where symlinks cannot be created, and no installed workspace or built host is used.
func TestWorkspaceLinkResolvesASiblingPackageToItsSource(t *testing.T) {
  workspace := t.TempDir()
  consumer := filepath.Join(workspace, "consumer")
  api := filepath.Join(workspace, "api")
  const siblingSource = "export var legacy = 1;\nexport const value = legacy;\n"

  writeFile(t, filepath.Join(api, "package.json"), `{
  "name": "@fixture/api",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
`)
  writeFile(t, filepath.Join(api, "src", "index.ts"), siblingSource)
  writeFile(t, filepath.Join(consumer, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "noEmit": true
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(
    t,
    filepath.Join(consumer, "src", "main.ts"),
    "import { value } from \"@fixture/api\";\nJSON.stringify(value);\n",
  )
  scope := filepath.Join(consumer, "node_modules", "@fixture")
  if err := os.MkdirAll(scope, 0o755); err != nil {
    t.Fatalf("MkdirAll: %v", err)
  }
  if err := os.Symlink(api, filepath.Join(scope, "api")); err != nil {
    t.Skipf("workspace link unavailable: %v", err)
  }
  seedLintRules(t, consumer, map[string]string{"no-var": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "fix",
      "--cwd", consumer,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("fix mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if !diagnosticOutputContains(stderr, "[no-var]") {
    t.Fatalf("linked sibling package did not report: %q", stderr)
  }
  got, err := os.ReadFile(filepath.Join(api, "src", "index.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != siblingSource {
    t.Fatalf("linked sibling source was rewritten:\nwant %q\ngot  %q", siblingSource, string(got))
  }
}
