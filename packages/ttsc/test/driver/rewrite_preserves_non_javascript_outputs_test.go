package driver_test

import (
  "testing"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewritePreservesNonJavaScriptOutputs Verifies output admission
// leaves native metadata and declarations outside executable-call rewriting.
//
// A configured build-information filename can share a registered source stem.
// Its JSON payload must not be parsed as JavaScript or consume that source's
// call registration. JavaScript extensions all retain their executable path.
//
// 1. Register one source rewrite and pass call-shaped metadata through the owner.
// 2. Require byte-identical metadata and an untouched registration cursor.
// 3. Contrast the four JavaScript output extensions and require literal replacement.
//
// @evidence contracts/testing.md#behavioral-verification applyRewrites preserves authored map, declaration, build-information, JSON and text output bytes and consumes no cursor; js, jsx, mjs and cjs outputs each receive the registered replacement and actual marker.
// @evidence contracts/testing.md#independent-expectations Rewrites operate on executable JavaScript call expressions. Literal metadata bytes are independently inert even when containing call-shaped text or a matching source stem; the supplied 42 replacement grounds each JavaScript expectation.
// @evidence contracts/testing.md#distinguishing-cases Maps and declarations contrast with same-stem build information and other non-JavaScript outputs; all four native JavaScript extensions share the positive call path and use fresh cursors.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes the actual output owner with a parsed source filename and authored emitted bytes, without a native build or installed consumer; the public runtime case separately owns real compiler and module-loader connections.
func TestDriverRewritePreservesNonJavaScriptOutputs(t *testing.T) {
  file := shimparser.ParseSourceFile(ast.SourceFileParseOptions{FileName: "/rewrite.ts"}, "", shimcore.ScriptKindTS)
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{File: file, RootName: "plugin", Method: "make", Replacement: "42", ConsumeParens: true})
  payload := `{"call":"plugin.make()","marker":"/* @ttsc-rewritten */"}`
  for _, extension := range []string{".js.map", ".d.ts", ".tsbuildinfo", ".json", ".txt"} {
    t.Run(extension, func(t *testing.T) {
      cursors := map[string]int{}
      got, err := driverApplyRewrites("/rewrite"+extension, payload, rewrites, cursors)
      if err != nil || got != payload || len(cursors) != 0 {
        t.Fatalf("metadata changed: got=%q cursors=%#v err=%v", got, cursors, err)
      }
    })
  }
  for _, extension := range []string{".js", ".jsx", ".mjs", ".cjs"} {
    t.Run(extension, func(t *testing.T) {
      got, err := driverApplyRewrites("/rewrite"+extension, "const value = plugin.make();", rewrites, map[string]int{})
      if err != nil || got != driver.RewriteSentinel+"\nconst value = 42;" {
        t.Fatalf("JavaScript rewrite = %q err=%v", got, err)
      }
    })
  }
}
