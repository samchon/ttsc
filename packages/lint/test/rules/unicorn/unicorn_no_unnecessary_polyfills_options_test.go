package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsAcceptsUpstreamSchemaShapes verifies the
// option decoder accepts exactly the shapes upstream's JSON schema allows: an
// omitted option, an empty object, a null/absent `targets`, and a `targets`
// that is a query string, an array of queries, or a targets object.
//
// A decoder that rejected a legal shape would break real configs; the negative
// twin (illegal shapes) is asserted below.
//
//  1. Build an engine with each legal options payload.
//  2. Assert no ConfigError is raised.
func TestUnicornNoUnnecessaryPolyfillsAcceptsUpstreamSchemaShapes(t *testing.T) {
  legal := []string{
    ``,
    `{}`,
    `{"targets":"node 8"}`,
    `{"targets":["node 8","chrome 100"]}`,
    `{"targets":{"node":"8"}}`,
  }
  for _, options := range legal {
    engine := NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornNoUnnecessaryPolyfillsRuleName: SeverityError},
      Options: RuleOptionsMap{unicornNoUnnecessaryPolyfillsRuleName: json.RawMessage(options)},
    })
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("legal options %q raised ConfigError: %v", options, err)
    }
  }
}

// TestUnicornNoUnnecessaryPolyfillsRejectsMalformedOptions verifies option
// validation happens at engine construction: every shape upstream's schema
// rejects surfaces as a ConfigError before any file is linted.
//
// Silent acceptance would let a typo disable the rule with no signal — the same
// failure mode the silent stub this rule replaces had.
//
//  1. Build an engine with each malformed payload.
//  2. Assert ConfigError carries the expected message fragment.
func TestUnicornNoUnnecessaryPolyfillsRejectsMalformedOptions(t *testing.T) {
  cases := []struct {
    name    string
    options string
    want    string
  }{
    {name: "array", options: `[]`, want: "must be an object"},
    {name: "string", options: `"node 8"`, want: "must be an object"},
    {name: "unknown key", options: `{"target":"node 8"}`, want: "only `targets`"},
    {name: "targets number", options: `{"targets":1}`, want: "Browserslist query"},
    {name: "targets boolean", options: `{"targets":true}`, want: "Browserslist query"},
    {name: "targets null", options: `{"targets":null}`, want: "Browserslist query"},
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      engine := NewEngineWithResolver(InlineRuleResolver{
        Rules:   RuleConfig{unicornNoUnnecessaryPolyfillsRuleName: SeverityError},
        Options: RuleOptionsMap{unicornNoUnnecessaryPolyfillsRuleName: json.RawMessage(testCase.options)},
      })
      err := engine.ConfigError()
      if err == nil || !strings.Contains(err.Error(), testCase.want) {
        t.Fatalf("options %q: want ConfigError containing %q, got %v", testCase.options, testCase.want, err)
      }
    })
  }
}

// TestUnicornNoUnnecessaryPolyfillsChecksOnlyStaticStringSpecifiers verifies
// the specifier extractor mirrors upstream's listener exactly: it reports a
// static import, a dynamic `import()`, and a static `require()` of a redundant
// polyfill, but ignores every near-miss shape.
//
// Each negative is one property away from a reported form, so an over-broad
// matcher in the import or call path fails here. All cases share `node 8`
// targets, where `object-assign` is redundant, so a spurious match would report.
//
//  1. Assert the three canonical positive forms each report once.
//  2. Assert relative/absolute specifiers, member/optional/multi-arg require,
//     `import = require`, `export ... from`, and non-literal specifiers are all
//     silent.
func TestUnicornNoUnnecessaryPolyfillsChecksOnlyStaticStringSpecifiers(t *testing.T) {
  const options = `{"targets":{"node":"8"}}`

  // Positive controls: the three forms upstream reports.
  assertPolyfillReports(t, `import assign from "object-assign";`, options, polyfillMessageBuiltIn)
  assertPolyfillReports(t, `import("object-assign");`, options, polyfillMessageBuiltIn)
  assertPolyfillReports(t, `require("object-assign");`, options, polyfillMessageBuiltIn)

  // Negatives: every near-miss must stay silent.
  negatives := []string{
    `require("./object-assign");`,
    `require("/object-assign");`,
    `import assign from "./object-assign";`,
    `require("object-assign", extra);`,
    `require?.("object-assign");`,
    `foo.require("object-assign");`,
    "require(`object-assign`);",
    `import(objectAssignSpecifier);`,
    `export { assign } from "object-assign";`,
    `export * from "object-assign";`,
    `import obj = require("object-assign");`,
  }
  for _, source := range negatives {
    assertPolyfillClean(t, source, options)
  }
}
