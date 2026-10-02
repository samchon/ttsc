package lspserver

import "testing"

// TestLSPCompletionScopeClassifiesRegexStatementAndOperatorBoundaries keeps
// JSDoc-shaped bytes inside regexes from escaping into completion scope while
// preserving real comments after expressions and live-buffer recovery.
//
// @evidence contracts/testing.md#behavioral-verification The lexical scanner classifies JSDoc-shaped bytes inside regexes after statement headers, operators and commented returns as code, while real comments after expressions stay doc scope.
// @evidence contracts/testing.md#independent-expectations Each case's expected scope is a literal written next to its source text.
// @evidence contracts/testing.md#distinguishing-cases Statement headers (if, while, for, with), division and unary operators decide whether a slash starts a regex, so each is its own row.
// @evidence contracts/testing.md#execution-ownership TestLSPCompletionScopeClassifiesRegexStatementAndOperatorBoundaries is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestLSPCompletionScopeClassifiesRegexStatementAndOperatorBoundaries(t *testing.T) {
  cases := []struct {
    name string
    text string
    want lexicalScope
  }{
    {"if header", "if (ok) /[/** @tag]/.test(value)", lexicalScopeCode},
    {"commented if header", "if /* c */ (ok) /[/** @tag]/.test(value)", lexicalScopeCode},
    {"while header", "while (ok) /[/** @tag]/.test(value)", lexicalScopeCode},
    {"for header", "for (; ok;) /[/** @tag]/.test(value)", lexicalScopeCode},
    {"with header", "with (scope) /[/** @tag]/.test(value)", lexicalScopeCode},
    {"regex after division", "const value = left / /[/** @tag]/.source", lexicalScopeCode},
    {"regex after spaced unary plus", "const value = left + +/[/** @tag]/.source", lexicalScopeCode},
    {"regex after commented return", "return /* c */ /[/** @tag]/.test(value)", lexicalScopeCode},
    {"function declaration block", "function f() {} /[/** @tag]/.test(value)", lexicalScopeCode},
    {"class declaration block", "class C {} /[/** @tag]/.test(value)", lexicalScopeCode},
    {"class heritage object argument", "class C extends mixin({}) {} /[/** @tag]/.test(value)", lexicalScopeCode},
    {"member named class", "const member = object.class; const value = {} / /[/** @tag]/.source", lexicalScopeCode},
    {"object property named class", "const { class: member } = object; const value = {} / /[/** @tag]/.source", lexicalScopeCode},
    {"member named like a control keyword", "const value = object.if() / 2; /** @tag", lexicalScopeJSDoc},
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
