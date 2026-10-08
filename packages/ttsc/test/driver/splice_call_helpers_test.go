package driver_test

import (
  "strings"
  "testing"
  _ "unsafe"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

//go:linkname insertSentinel github.com/samchon/ttsc/packages/ttsc/driver.insertSentinel
func insertSentinel(text string, file *ast.SourceFile) string

//go:linkname joinRootAndNamespaces github.com/samchon/ttsc/packages/ttsc/driver.joinRootAndNamespaces
func joinRootAndNamespaces(rewrite driver.Rewrite) string

// rewriteTextForTest invokes the actual output-rewrite owner directly. Its
// parsed empty source supplies the filename identity required by registration;
// authored JavaScript and descriptors supply this phase's independent inputs.
// Compiler loading and executable exports are covered by the public runtime case.
func rewriteTextForTest(text string, rewrite driver.Rewrite) (string, error) {
  rewrite.File = shimparser.ParseSourceFile(ast.SourceFileParseOptions{FileName: "/rewrite.ts"}, "", shimcore.ScriptKindTS)
  rewrites := driver.NewRewriteSet()
  rewrites.Add(rewrite)
  return driverApplyRewrites("/rewrite.js", text, rewrites, map[string]int{})
}

// spliceForTest retains existing replacement-only assertions while requiring
// the real output owner to produce its documented header marker first.
func spliceForTest(t *testing.T, text string) string {
  t.Helper()
  got, err := rewriteTextForTest(text, driver.Rewrite{
    RootName: "plugin", Method: "make", Replacement: "replacement", ConsumeParens: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  marker := driver.RewriteSentinel+"\n"
  if !strings.HasPrefix(got, marker) {
    t.Fatalf("rewritten output omitted its header marker: %q", got)
  }
  return strings.TrimPrefix(got, marker)
}
