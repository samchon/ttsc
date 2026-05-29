// unicorn/no-abusive-eslint-disable: a bare `// eslint-disable*` directive
// with no rule list suppresses every lint rule for the affected scope.
// That blanket-disable hides unrelated diagnostics the next reviewer would
// have caught, so the rule requires every `eslint-disable*` directive to
// name the rules it silences.
//
// File-level dispatch: visit `KindSourceFile` once per file, scan the
// raw source with the tsgo scanner so embedded `/* */` and `//` tokens
// inside template substitutions and string literals are not mistaken for
// real comments, and match each comment's stripped body — already trimmed
// by the shared `stripCommentDelimiters` helper — against
// `^eslint-disable(?:-next-line|-line)?$`. A match means the directive
// carries no rule list and is reported on the comment range.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-abusive-eslint-disable.md
package linthost

import (
  "regexp"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

var unicornNoAbusiveEslintDisablePattern = regexp.MustCompile(`^eslint-disable(?:-next-line|-line)?$`)

type unicornNoAbusiveEslintDisable struct{}

func (unicornNoAbusiveEslintDisable) Name() string { return "unicorn/no-abusive-eslint-disable" }
func (unicornNoAbusiveEslintDisable) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (unicornNoAbusiveEslintDisable) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil {
    return
  }
  src := ctx.File.Text()
  scanner := shimscanner.NewScanner()
  scanner.SetText(src)
  scanner.SetSkipTrivia(false)
  for {
    kind := scanner.Scan()
    if kind == shimast.KindEndOfFile {
      break
    }
    if kind != shimast.KindSingleLineCommentTrivia && kind != shimast.KindMultiLineCommentTrivia {
      continue
    }
    start := scanner.TokenStart()
    end := scanner.TokenEnd()
    if start < 0 || end > len(src) || end <= start {
      continue
    }
    body := stripCommentDelimiters(src[start:end])
    if !unicornNoAbusiveEslintDisablePattern.MatchString(body) {
      continue
    }
    ctx.ReportRange(start, end, "Specify the rules to disable in each `eslint-disable*` directive.")
  }
}

func init() {
  Register(unicornNoAbusiveEslintDisable{})
}
