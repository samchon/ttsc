package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverEmitSkipsAlreadyRewrittenOutput Verifies actual rewritten output
// remains byte-identical when the shared rewrite owner sees it again.
//
// An authored marker comment in the statement body is inert. The initial public
// emit must replace its live call and add the actual header marker; repeating
// that resulting output must preserve it despite a fresh registration cursor.
//
// 1. Emit an unmarked source containing a body marker comment and a live call.
// 2. Require the registered replacement and canonical strict/header prefix.
// 3. Pass those actual output bytes through the shared owner with fresh cursors.
//
// @evidence contracts/testing.md#behavioral-verification Public EmitAll transforms the registered call despite a body marker comment; applyRewrites then preserves the complete actual marked output byte-for-byte with a fresh cursor.
// @evidence contracts/testing.md#independent-expectations The literal replacement and strict/header prefix follow the registered call and documented marker placement; unchanged actual output is the idempotency oracle after independently establishing initial correctness.
// @evidence contracts/testing.md#distinguishing-cases An inert body marker contrasts with the genuine emitted header; fresh cursors prevent an exhausted registration list from making the idempotence assertion vacuous. Marker strings and other lexical contexts have separate public runtime coverage.
// @evidence contracts/testing.md#execution-ownership This direct Go unit loads a Program, invokes EmitAll and the shared private rewrite owner in process; it builds no host or installed consumer.
func TestDriverEmitSkipsAlreadyRewrittenOutput(t *testing.T) {
  root := t.TempDir()
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
/* @ttsc-rewritten */
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
    File:          source,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"rewritten-value"`,
    ConsumeParens: true,
  })
  emitted := map[string]string{}
  _, emitDiags, err := prog.EmitAll(rewrites, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  js := emitted["index.js"]
  if !strings.HasPrefix(js, "\"use strict\";\n"+driver.RewriteSentinel+"\n") || strings.Contains(js, "plugin.make") || !strings.Contains(js, "rewritten-value") {
    t.Fatalf("unmarked output must rewrite the live call despite a body marker:\n%s", js)
  }
  repeated, err := driverApplyRewrites(filepath.Join(root, "bin", "index.js"), js, rewrites, map[string]int{})
  if err != nil || repeated != js {
    t.Fatalf("genuine already-rewritten output changed: err=%v\n%s", err, repeated)
  }
}
