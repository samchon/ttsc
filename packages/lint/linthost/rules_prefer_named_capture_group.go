// preferNamedCaptureGroup: an unnamed capturing group `(…)` in a
// regular-expression literal has to be referenced by ordinal number.
// Named groups `(?<name>…)` document the captured value at the
// definition site and survive pattern edits that would otherwise renumber
// the groups silently.
// https://eslint.org/docs/latest/rules/prefer-named-capture-group
//
// AST-only: scan the pattern of every `RegularExpressionLiteral`,
// stepping past escapes and character classes (where `(` is a literal
// '(' rather than a group opener). Each `(` that is not followed by `?:`,
// `?<name>`, `?<=`, `?<!`, `?=`, or `?!` is an unnamed capture group and
// fires the rule. Character-class contents are skipped because '(' there
// is a literal byte, never a group opener.
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type preferNamedCaptureGroup struct{}

func (preferNamedCaptureGroup) Name() string { return "prefer-named-capture-group" }
func (preferNamedCaptureGroup) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral}
}
func (preferNamedCaptureGroup) Check(ctx *Context, node *shimast.Node) {
  raw := nodeText(ctx.File, node)
  if len(raw) < 2 || raw[0] != '/' {
    return
  }
  closing := lastSlashOutsideClass(raw)
  if closing <= 0 {
    return
  }
  pattern := raw[1:closing]
  if regexpHasUnnamedCapture(pattern) {
    ctx.Report(node, "Capture group should be named.")
  }
}

// regexpHasUnnamedCapture reports whether `pattern` contains at least
// one capturing group that is neither a non-capturing group (`(?:…)`),
// a named group (`(?<name>…)`), nor a lookaround assertion (`(?=…)`,
// `(?!…)`, `(?<=…)`, `(?<!…)`). The scan skips escape sequences and
// character-class contents because `(` is a literal byte in those
// positions and never opens a group.
func regexpHasUnnamedCapture(pattern string) bool {
  inClass := false
  for i := 0; i < len(pattern); i++ {
    ch := pattern[i]
    if ch == '\\' {
      i++
      continue
    }
    if inClass {
      if ch == ']' {
        inClass = false
      }
      continue
    }
    if ch == '[' {
      inClass = true
      continue
    }
    if ch != '(' {
      continue
    }
    // `(` is a group opener; classify what follows.
    if i+1 >= len(pattern) || pattern[i+1] != '?' {
      return true
    }
    if i+2 >= len(pattern) {
      // `(?` with nothing after — treat as malformed but not flagged;
      // the parser would have rejected this regex if it was truly
      // invalid, so leave it alone.
      continue
    }
    switch pattern[i+2] {
    case ':', '=', '!':
      // non-capturing or lookahead
      continue
    case '<':
      if i+3 < len(pattern) && (pattern[i+3] == '=' || pattern[i+3] == '!') {
        // lookbehind `(?<=` / `(?<!`
        continue
      }
      // named capture `(?<name>…)`
      continue
    }
    // `(?` followed by something else (e.g. an inline flag group).
    // Treat as unnamed; ESLint flags these too because they still
    // capture under the standard regex semantics they target.
    return true
  }
  return false
}

// lastSlashOutsideClass returns the index of the closing `/` of a regex
// literal, accounting for `/` characters that appear inside escapes or
// character classes. Returns -1 when no closing slash is found.
func lastSlashOutsideClass(raw string) int {
  if len(raw) < 2 || raw[0] != '/' {
    return -1
  }
  inClass := false
  for i := 1; i < len(raw); i++ {
    ch := raw[i]
    if ch == '\\' {
      i++
      continue
    }
    if inClass {
      if ch == ']' {
        inClass = false
      }
      continue
    }
    if ch == '[' {
      inClass = true
      continue
    }
    if ch == '/' {
      return i
    }
  }
  return -1
}

func init() {
  Register(preferNamedCaptureGroup{})
}
