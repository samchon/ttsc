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
