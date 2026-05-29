// maxClassesPerFile: a file that declares many classes is almost
// always carrying several unrelated responsibilities. Splitting them
// into their own modules keeps imports honest and reduces the surface
// each reader has to scan. ESLint's default ceiling is one class per
// file, which @ttsc/lint mirrors as the only built-in threshold
// (option-decoding is deferred).
// https://eslint.org/docs/latest/rules/max-classes-per-file
//
// The rule counts both ClassDeclaration and ClassExpression nodes
// anywhere in the file so a helper class hidden inside an IIFE still
// contributes to the total. The finding is anchored at the first
// class that pushed the count past the limit — the second class
// under the default — so the diagnostic header points at the
// offending declaration rather than the file's opening line.
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// maxClassesPerFileLimit is the class-count ceiling. Above this value
// the rule fires once for the file. Mirrors the ESLint default.
const maxClassesPerFileLimit = 1

type maxClassesPerFile struct{}

func (maxClassesPerFile) Name() string { return "max-classes-per-file" }
func (maxClassesPerFile) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (maxClassesPerFile) Check(ctx *Context, node *shimast.Node) {
  if node == nil {
    return
  }
  var classes []*shimast.Node
  walkDescendants(node, func(n *shimast.Node) {
    if n == nil {
      return
    }
    switch n.Kind {
    case shimast.KindClassDeclaration, shimast.KindClassExpression:
      classes = append(classes, n)
    }
  })
  if len(classes) <= maxClassesPerFileLimit {
    return
  }
  // Report at the first class that pushed the count over the limit,
  // so the diagnostic anchors on the offending declaration rather
  // than the file's opening byte.
  ctx.Report(classes[maxClassesPerFileLimit], fmt.Sprintf("File has too many classes (%d). Maximum allowed is %d.", len(classes), maxClassesPerFileLimit))
}

func init() {
  Register(maxClassesPerFile{})
}
