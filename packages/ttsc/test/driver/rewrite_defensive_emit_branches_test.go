package driver_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestRewriteDefensiveEmitBranches verifies rewrite emit defensive branches.
//
// Rewrites may run with nil inputs, already-patched output, or the default disk
// writer. These cases keep command hosts from needing their own guard logic.
//
// 1. Assert nil Program raw emit fails cleanly.
// 2. Emit already-sentinel output through the default writer.
// 3. Emit a rewrite through the default writer.
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
  writeProjectFile(t, root, "index.ts", `// `+strings.TrimPrefix(driver.RewriteSentinel, "// ")+`
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
  if _, emitDiags, err := prog.EmitAll(driver.NewRewriteSet(), nil); err != nil || len(emitDiags) != 0 {
    t.Fatalf("sentinel emit mismatch: diags=%#v err=%v", emitDiags, err)
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
