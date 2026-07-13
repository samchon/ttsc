package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestAwaitThenableProtocolMembersMustBeCallable verifies resolved
// well-known-symbol properties do not satisfy async iteration or disposal when
// their value types have no call signature.
//
//  1. Seed non-callable asyncIterator and asyncDispose properties with the
//     standard disposable library enabled.
//  2. Suppress the matching compiler errors and run await-thenable.
//  3. Assert both lint findings anchor on the offending expressions.
func TestAwaitThenableProtocolMembersMustBeCallable(t *testing.T) {
  root := seedLintProject(t, `export {};
declare const source: { [Symbol.asyncIterator]: number };
declare const resource: { [Symbol.asyncDispose]: Promise<void> };
async function main(): Promise<void> {
  // @ts-expect-error: intentionally malformed async-iterator protocol
  for await (const value of source) {
    JSON.stringify(value);
  }
  // @ts-expect-error: intentionally malformed async-dispose protocol
  await using acquired = resource;
  JSON.stringify(acquired);
}
void main();
`)
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist",
    "lib": ["ES2022", "DOM", "ESNext.Disposable"]
  },
  "files": ["src/main.ts"]
}
`)
  seedLintRules(t, root, map[string]string{"typescript/await-thenable": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("non-callable async protocol run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 2 {
    t.Fatalf("expected 2 await-thenable findings, got %d:\n%s", got, stderr)
  }
  for _, anchor := range []string{"main.ts:6:", "main.ts:10:"} {
    if !diagnosticOutputContains(stderr, anchor) {
      t.Fatalf("missing non-callable protocol finding at %s:\n%s", anchor, stderr)
    }
  }
}
