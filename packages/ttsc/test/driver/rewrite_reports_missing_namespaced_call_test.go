package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteReportsMissingNamespacedCall Verifies that EmitAll reports plugin.ns.missing when that namespaced call is absent.
//
// plugin.make exists but the requested namespace and method do not; either error or diagnostic may carry the identity.
//
// 1. Load a project with one plugin call.
// 2. Register a rewrite for a different namespaced method.
// 3. Assert an error or emit diagnostic carries the requested namespaced call identity.
//
// @evidence contracts/testing.md#behavioral-verification EmitAll reports plugin.ns.missing when that namespaced call is absent.
// @evidence contracts/testing.md#independent-expectations The authored absent target independently specifies the required debugging identity.
// @evidence contracts/testing.md#distinguishing-cases plugin.make exists but the requested namespace and method do not; either error or diagnostic may carry the identity.
// @evidence contracts/testing.md#execution-ownership A direct Go Program and rewrite set execute without a CLI or external runtime. Go discovers TestDriverRewriteReportsMissingNamespacedCall under ./test/driver.
func TestDriverRewriteReportsMissingNamespacedCall(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: the source compiles, but the requested rewrite target is
  // deliberately absent from emitted JavaScript.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `declare const plugin: { make(): string };
export const value = plugin.make();
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  source := prog.SourceFile(filepath.Join(root, "index.ts"))
  if source == nil {
    t.Fatal("SourceFile did not find index.ts")
  }
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:        source,
    RootName:    "plugin",
    Namespaces:  []string{"ns"},
    Method:      "missing",
    Replacement: `"never"`,
  })

  // Error assertion: the message is part of the debugging contract for native
  // transformer authors when a collected call cannot be found after emit.
  _, emitDiags, err := prog.EmitAll(rewrites, nil)
  if err != nil && strings.Contains(err.Error(), "plugin.ns.missing") {
    return
  }
  for _, diag := range emitDiags {
    if strings.Contains(diag.String(), "plugin.ns.missing") {
      return
    }
  }
  if err == nil {
    t.Fatalf("missing namespaced rewrite did not surface an error: diagnostics=%#v", emitDiags)
  }
  t.Fatalf("missing namespaced rewrite error mismatch: err=%v diagnostics=%#v", err, emitDiags)
}
