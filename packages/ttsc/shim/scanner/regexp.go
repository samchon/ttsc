package scanner

import (
  "github.com/microsoft/typescript-go/internal/ast"
  "github.com/microsoft/typescript-go/internal/diagnostics"
)

// IsValidRegularExpressionLiteral reports whether text is one complete,
// grammar-valid ECMAScript regular-expression literal. It deliberately uses
// typescript-go's own scanner and regexp parser so callers share the compiler's
// handling of escapes, flags, Unicode mode, and Unicode Sets syntax.
func IsValidRegularExpressionLiteral(text string) bool {
  scanner := NewScanner()
  valid := true
  scanner.SetOnError(func(_ *diagnostics.Message, _, _ int, _ ...any) {
    valid = false
  })
  scanner.SetText(text)
  token := scanner.Scan()
  if token != ast.KindSlashToken && token != ast.KindSlashEqualsToken {
    return false
  }
  if scanner.ReScanSlashToken(true) != ast.KindRegularExpressionLiteral {
    return false
  }
  return valid && scanner.TokenEnd() == len(text)
}
