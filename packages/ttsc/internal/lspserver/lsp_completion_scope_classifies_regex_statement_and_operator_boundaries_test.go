package lspserver

import "testing"

// TestLSPCompletionScopeClassifiesRegexStatementAndOperatorBoundaries keeps
// JSDoc-shaped bytes inside regexes from escaping into completion scope while
// preserving the expected end-of-string scope for authored expression,
// declaration, template and CR-recovery examples. It does not observe scope
// at an interior regex cursor or execute completion requests.
//
// @evidence contracts/testing.md#behavioral-verification Actual lexicalScopeAt at len(text) returns literal code or JSDoc scopes for eighteen authored statement-header, operator, declaration/member, template and CR-recovery strings. Closed-regex rows observe the final code scope, not the interior lexicalScopeRegex state; positive unfinished comments distinguish an always-code result.
// @evidence contracts/testing.md#independent-expectations Each case's expected scope is a literal written next to its source text.
// @evidence contracts/testing.md#distinguishing-cases Statement headers (if, while, for, with), division and unary operators decide whether a slash starts a regex, so each is its own row.
// @evidence contracts/testing.md#execution-ownership This Go unit calls the actual package-local lexical scanner on supplied strings and compares the returned enum to each literal expectation. It substitutes no operation and creates no directory or sidecar; no compiler, native process, product host or LSP transport runs, and request matching/publication is outside this table.
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
