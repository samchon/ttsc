// unicorn/no-empty-file: a source file with no executable contribution
// — every statement is a bare `;` empty-statement (or there are no
// statements at all) — usually exists by accident: a placeholder kept
// around past its purpose, a generator output for a missing input, or
// a copy of a file whose body was deleted. The rule flags these so the
// file is either filled with content or removed.
//
// SourceFile dispatch: the engine fires `KindSourceFile` visits once
// per file at the file root (see engine.runFile). For visibility into
// where the diagnostic lands when reporters render `path:line:col`, the
// rule reports on the first statement node when one exists (so the
// pointer matches the file's source line); when the file truly has no
// statements at all it falls back to `ReportRange(0, 0, …)` so the
// diagnostic still surfaces.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-empty-file.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoEmptyFile struct{}

func (unicornNoEmptyFile) Name() string           { return "unicorn/no-empty-file" }
func (unicornNoEmptyFile) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (unicornNoEmptyFile) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil {
    return
  }
  statements := ctx.File.Statements
  const message = "Empty files are not allowed."
  if statements == nil || len(statements.Nodes) == 0 {
    ctx.ReportRange(0, 0, message)
    return
  }
  for _, stmt := range statements.Nodes {
    if stmt == nil || stmt.Kind != shimast.KindEmptyStatement {
      return
    }
  }
  ctx.Report(statements.Nodes[0], message)
}

func init() {
  Register(unicornNoEmptyFile{})
}
