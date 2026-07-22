package lspserver

import "testing"

// TestLSPCompletionScopeClassifiesRegexStatementAndOperatorBoundaries keeps
// JSDoc-shaped bytes inside regexes from escaping into completion scope while
// preserving real comments after expressions and live-buffer recovery.
func TestLSPCompletionScopeClassifiesRegexStatementAndOperatorBoundaries(t *testing.T) {
  cases := []struct {
    name string
    text string
    want lexicalScope
  }{
    {"if header", "if (ok) /[/** @tag]/.test(value)", lexicalScopeCode},
    {"while header", "while (ok) /[/** @tag]/.test(value)", lexicalScopeCode},
    {"for header", "for (; ok;) /[/** @tag]/.test(value)", lexicalScopeCode},
    {"with header", "with (scope) /[/** @tag]/.test(value)", lexicalScopeCode},
    {"regex after division", "const value = left / /[/** @tag]/.source", lexicalScopeCode},
    {"division after regex", "const value = /ok/ / 2; /** @tag", lexicalScopeJSDoc},
    {"comment after expression", "const value = 1; /** @tag", lexicalScopeJSDoc},
    {"template interpolation", "const value = `${(() => { if (ok) /[/** @tag]/.test(value); return value; })()}`; /** @tag", lexicalScopeJSDoc},
    {"cr recovery", "const bad = \"oops\r/** @tag", lexicalScopeJSDoc},
  }

  for _, entry := range cases {
    if got := lexicalScopeAt(entry.text, len(entry.text)); got != entry.want {
      t.Errorf("%s: scope = %s, want %s", entry.name, got, entry.want)
    }
  }
}
