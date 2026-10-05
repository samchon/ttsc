package linthost

import (
  "fmt"
  "strings"
  "testing"
)

// TestUnicornKnownBoundaryObservations checks four rules against
// literal stack-filter, URL and string boundary expectations.
//
// These observations collect the candidate verification population;
// they do not change rule policy or synthesize a native compiler response.
// Literal diagnostic expectations distinguish supported canonical suggestions
// from the adjacent authored cases expected to remain unreported.
//
// 1. Parse each authored source and run its owning rule in the Go engine.
// 2. Compare exact rule/severity/source-line triples or zero findings.
// 3. Execute every independent row even when another row fails.
//
// @evidence contracts/testing.md#behavioral-verification Each subtest calls the real Engine.Run through the shared snapshot finding helper for captureStackTrace, relative URL, string slice and regexp replacement recommendations; no subprocess producer is used.
// @evidence contracts/testing.md#independent-expectations Authored report booleans and source-line expectations cover stack-filter and URL inputs, UTF16 slice-unit boundaries, and regexp flags. No expected finding or length is computed from the lint implementation; this body does not execute Node or compare rewritten JavaScript results.
// @evidence contracts/testing.md#distinguishing-cases Own-constructor versus external frame filtering, directory versus file URL bases, ASCII/BMP/astral/combining/lone-surrogate lengths, and global plain versus insensitive/sticky regexp flags own adjacent positive and negative boundaries.
// @evidence contracts/testing.md#execution-ownership This single discoverable rules Go entry runs all named rows in one process with the real parser/Engine helpers and the helpers' checker lane when selected; each t.Run preserves independent failure identity without installation, native host or canned frames.
func TestUnicornKnownBoundaryObservations(t *testing.T) {
  check := func(name, rule, prefix, expression string, report bool) {
    t.Run(name, func(t *testing.T) {
      if report {
        source := prefix + "\n" + expression + "\n"
        _, _, findings := runRuleFindingsSnapshot(t, rule, source, nil)
        if len(findings) != 1 || findings[0].Rule != rule || findings[0].Severity != SeverityError ||
          strings.Count(source[:findings[0].Pos], "\n")+1 != 2 {
          t.Fatalf("%s: want one error on line 2 of %q, got %+v", rule, source, findings)
        }
      } else {
        assertRuleSkipsSource(t, rule, prefix+"\n"+expression+"\n")
      }
    })
  }

  capture := "unicorn/no-useless-error-capture-stack-trace"
  declaration := "interface ErrorConstructor { captureStackTrace(target: object, constructorOpt?: Function): void; }"
  for _, row := range []struct {
    name, source string
    report       bool
  }{
    {"own-constructor", "class MyError extends Error { constructor(){ super(); Error.captureStackTrace(this, MyError); } }", true},
    {"new-target", "class MyError extends Error { constructor(){ super(); Error.captureStackTrace(this, new.target); } }", true},
    {"external-frame-filter", "function makeCaptured(){ return new MyError(); } class MyError extends Error { constructor(){ super(); Error.captureStackTrace(this, makeCaptured); } }", false},
    {"nonconstructor-object", "const object={}; Error.captureStackTrace(object);", false},
    {"super-only", "class MyError extends Error { constructor(){ super(); } }", false},
  } {
    check("capture/"+row.name, capture, declaration, row.source, row.report)
  }

  urlRule := "unicorn/relative-url-style"
  for _, row := range []struct {
    name, base, value string
    report            bool
  }{
    {"directory-foo", "https://example.test/dir/", "./foo", true},
    {"directory-fragment", "https://example.test/dir/", "./#x", true},
    {"directory-query", "https://example.test/dir/", "./?x", true},
    {"directory-empty-segment", "https://example.test/dir/", "./", true},
    {"directory-colon", "https://example.test/dir/", "./a:b", false},
    {"directory-scheme-looking", "https://example.test/dir/", "./https:thing", false},
    {"file-foo", "https://example.test/dir/file", "./foo", true},
    {"file-fragment", "https://example.test/dir/file", "./#x", false},
    {"file-query", "https://example.test/dir/file", "./?x", false},
    {"file-empty-segment", "https://example.test/dir/file", "./", false},
    {"file-colon", "https://example.test/dir/file", "./a:b", false},
    {"file-scheme-looking", "https://example.test/dir/file", "./https:thing", false},
    {"absolute-control", "https://example.test/dir/", "https://other.test/foo", false},
    {"root-control", "https://example.test/dir/file", "/root", false},
    {"parent-control", "https://example.test/dir/file", "../foo", false},
  } {
    check("url/"+row.name, urlRule, "", fmt.Sprintf("const value=new URL(%q,%q);", row.value, row.base), row.report)
  }

  stringRule := "unicorn/prefer-string-starts-ends-with"
  for _, row := range []struct {
    name, literal string
    units         int
    report        bool
  }{
    {"ascii", `'A'`, 1, true},
    {"bmp", `'é'`, 1, true}, {"bmp-byte-count", `'é'`, 2, false},
    {"astral", `'😀'`, 2, true}, {"astral-byte-count", `'😀'`, 4, false},
    {"combining", `'e\u0301'`, 2, true}, {"combining-byte-count", `'e\u0301'`, 3, false},
    {"lone-high", `'\ud800'`, 1, true}, {"lone-high-encoded-bytes", `'\ud800'`, 3, false},
    {"lone-low", `'\udfff'`, 1, true}, {"lone-low-encoded-bytes", `'\udfff'`, 3, false},
  } {
    check("prefix/"+row.name, stringRule, "declare const s:string;", fmt.Sprintf("const value=s.slice(0,%d)===%s;", row.units, row.literal), row.report)
    check("suffix/"+row.name, stringRule, "declare const s:string;", fmt.Sprintf("const value=s.slice(-%d)===%s;", row.units, row.literal), row.report)
  }

  replaceRule := "unicorn/prefer-string-replace-all"
  for _, row := range []struct {
    name, expression string
    report           bool
  }{
    {"insensitive", `'aA'.replace(/a/gi,'x');`, false},
    {"sticky", `'baa'.replace(/a/gy,'x');`, false},
    {"global", `'baa'.replace(/a/g,'x');`, true},
    {"multiline", `'baa'.replace(/a/gm,'x');`, true},
    {"unicode", `'baa'.replace(/a/gu,'x');`, true},
    {"dotall", `'baa'.replace(/a/gs,'x');`, true},
    {"nonglobal", `'aA'.replace(/a/i,'x');`, false},
    {"nonliteral-pattern", `'aba'.replace(/a.b/g,'x');`, false},
  } {
    check("replace/"+row.name, replaceRule, "", row.expression, row.report)
  }
}
