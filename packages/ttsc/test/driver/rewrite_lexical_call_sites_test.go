package driver_test

import (
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteLexicalCallSites Verifies call selection uses executable
// syntax independently of each inert text context and distinct receiver.
//
// The public runtime case combines these inputs. This direct matrix keeps each
// lexical distinction observable even when another context also has a defect.
// Exact output bytes preserve comments and literal spellings around the splice.
//
// 1. Place one inert or distinct call-shaped expression before the live call.
// 2. Run the actual output-rewrite owner with one consuming descriptor.
// 3. Require the independent complete output and executable-template contrast.
//
// @evidence contracts/testing.md#behavioral-verification applyRewrites replaces the live plugin.make expression while every quoted, commented, regex, template-text or distinct-receiver prefix remains byte-identical and the real header marker appears; an executable template substitution is replaced at its actual call range.
// @evidence contracts/testing.md#independent-expectations Exact expected strings retain the authored prefix and substitute the literal 42 only for the supported executable property-chain call; no parser or rewriter computes the expectations.
// @evidence contracts/testing.md#distinguishing-cases Single/double quotes, escaped quotes, line/block comments, template text, return-position regex, regex classes, nested receiver, Unicode longer identifier, template substitution and nested regex/template arguments distinguish lexical identity from substring and handwritten delimiter scanning.
// @evidence contracts/testing.md#execution-ownership This direct Go matrix invokes the actual output-rewrite owner through rewriteTextForTest with a parsed filename identity and authored output text; TestDriverRewriteLexicalCallSites owns all named cases without a native build, consumer installation or process host.
func TestDriverRewriteLexicalCallSites(t *testing.T) {
  rewrite := driver.Rewrite{RootName: "plugin", Method: "make", Replacement: "42", ConsumeParens: true}
  for _, test := range []struct { name, prefix string }{
    {"double-string", `const data = "plugin.make()"; `},
    {"single-string", `const data = 'plugin.make()'; `},
    {"escaped-string", `const data = "\"plugin.make(\""; `},
    {"line-comment", "// plugin.make()\n"},
    {"block-comment", "/* plugin.make() */ "},
    {"template-text", "const data = `plugin.make()`; "},
    {"regex-return", "function data() { return /plugin.make()/; } "},
    {"regex-class", "const data = /[plugin.make()]/; "},
    {"receiver", "holder.plugin.make(); "},
    {"unicode-identifier", "橘plugin.make(); "},
  } {
    t.Run(test.name, func(t *testing.T) {
      input := test.prefix+"const value = plugin.make();"
      expected := driver.RewriteSentinel+"\n"+test.prefix+"const value = 42;"
      got, err := rewriteTextForTest(input, rewrite)
      if err != nil || got != expected {
        t.Fatalf("rewrite = %q err=%v; want %q", got, err, expected)
      }
    })
  }
  for _, test := range []struct { name, input, expected string }{
    {"template-expression", "const value = `plugin.make() ${plugin.make()}`;", "const value = `plugin.make() ${42}`;"},
    {"nested-template-regex", "const value = plugin.make(`x${/}/.test('}') ? `nested ${/\\)/.source}` : ''}`);", "const value = 42;"},
    {"property-trivia", "const value = plugin /* root */ . /* method */ make /* call */ ();", "const value = 42;"},
  } {
    t.Run(test.name, func(t *testing.T) {
      got, err := rewriteTextForTest(test.input, rewrite)
      expected := driver.RewriteSentinel+"\n"+test.expected
      if err != nil || got != expected {
        t.Fatalf("rewrite = %q err=%v; want %q", got, err, expected)
      }
    })
  }
}
