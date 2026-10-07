package driver_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestRewriteDefensiveEmitBranches Verifies rewrite emit defensive branches.
//
// Rewrites may run with nil inputs, already-patched output, or the default disk
// writer. These cases keep command hosts from needing their own guard logic.
//
// 1. Reject raw emit on a nil Program.
// 2. Preserve a marked call despite its registered rewrite and allow a nil rewrite set.
// 3. Emit an unmarked call through the default writer and check its replacement.
// 4. Give the private helper an absent call and check the long error preview.
//
// @evidence contracts/testing.md#behavioral-verification EmitAllRaw rejects nil Program; EmitAll preserves marked calls, permits nil rewrites, writes normal replacement and reports missing-call preview.
// @evidence contracts/testing.md#independent-expectations Authored marked and unmarked calls establish preservation versus replacement; a long literal grounds error preview content.
// @evidence contracts/testing.md#distinguishing-cases Nil receiver, marker, nil set, default writer and absent call differ; nil-set output bytes are not checked.
// @evidence contracts/testing.md#execution-ownership Go unit TestRewriteDefensiveEmitBranches is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestRewriteDefensiveEmitBranches(t *testing.T) {
  var nilProgram *driver.Program
  if _, _, err := nilProgram.EmitAllRaw(nil); err == nil {
    t.Fatal("nil raw emit should fail")
  }

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  // The sentinel is a string literal because a leading comment on an erased
  // `declare` statement would not survive emit and so would never reach the
  // already-patched check.
  writeProjectFile(t, root, "index.ts", `export const marker = "`+driver.RewriteSentinel+`";
declare const plugin: { make(input: string): string };
export const value = plugin.make("input");
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  // A rewrite is registered for the call, so an emit that ignored the sentinel
  // would replace it; an output that keeps the call proves the already-patched
  // pass-through branch ran.
  sentinelRewrites := driver.NewRewriteSet()
  sentinelRewrites.Add(driver.Rewrite{
    File:          prog.SourceFile(filepath.Join(root, "index.ts")),
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"must-not-apply"`,
    ConsumeParens: true,
  })
  if _, emitDiags, err := prog.EmitAll(sentinelRewrites, nil); err != nil || len(emitDiags) != 0 {
    t.Fatalf("sentinel emit mismatch: diags=%#v err=%v", emitDiags, err)
  }
  sentinelJS, err := os.ReadFile(filepath.Join(root, "bin", "index.js"))
  if err != nil {
    t.Fatal(err)
  }
  if strings.Contains(string(sentinelJS), "must-not-apply") || !strings.Contains(string(sentinelJS), `plugin.make("input")`) {
    t.Fatalf("an already-patched output must pass through unchanged:\n%s", sentinelJS)
  }

  root = t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const marker = "`+driver.RewriteSentinel+`";
`)
  prog, diags, err = driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  if _, emitDiags, err := prog.EmitAll(nil, nil); err != nil || len(emitDiags) != 0 {
    t.Fatalf("nil rewrite emit mismatch: diags=%#v err=%v", emitDiags, err)
  }

  root = t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `declare const plugin: { make(input: string): string };
export const value = plugin.make("input");
`)
  prog, diags, err = driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  source := prog.SourceFile(filepath.Join(root, "index.ts"))
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          source,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"rewritten"`,
    ConsumeParens: true,
  })
  if _, emitDiags, err := prog.EmitAll(rewrites, nil); err != nil || len(emitDiags) != 0 {
    t.Fatalf("rewrite emit mismatch: diags=%#v err=%v", emitDiags, err)
  }
  js, err := os.ReadFile(filepath.Join(root, "bin", "index.js"))
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(string(js), `"rewritten"`) {
    t.Fatalf("rewrite was not written:\n%s", js)
  }

  long := strings.Repeat("x", 450)
  _, err = driverApplyRewrites(filepath.Join(root, "bin", "index.js"), long, rewrites, map[string]int{})
  if err == nil || !strings.Contains(err.Error(), long[:400]) {
    t.Fatalf("missing-call preview mismatch: %v", err)
  }
}
