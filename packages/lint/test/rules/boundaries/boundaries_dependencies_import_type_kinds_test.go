package linthost

import (
  "strings"
  "testing"
)

// TestBoundariesDependenciesClassifiesImportTypeNodeKinds verifies `import()`
// type nodes carry the `type` dependency kind and keep `typeof` distinct.
//
// An `import("m")` reference in type position is erased at runtime, so a
// `kind: "value"` policy must never capture it. Classifying it as `value`
// would let value-only denials block pure type plumbing, while collapsing
// `typeof import("m")` into `type` would erase the documented third kind.
//
// 1. Reference a domain module through plain and typeof import-type nodes.
// 2. Deny kind `type`, then kind `typeof`, then kind `value` on the edge.
// 3. Assert each denial reports exactly its own import-type flavor.
//
// @evidence contracts/testing.md#behavioral-verification Dependencies distinguish ordinary import-type, typeof import-type and value kind selectors with exact line placement.
// @evidence contracts/testing.md#independent-expectations The TypeScript syntax marks the first edge type and second typeof; value policy must match neither. Authored substrings and newline boundary independently locate each expected edge.
// @evidence contracts/testing.md#distinguishing-cases Three policy calls cover type positive, typeof positive and value negative; same module spelling cannot hide a wrong syntax-kind decision.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule calls NewEngineWithResolver.Run for type, typeof and value selector options. This entry owns all three results and newline-range assertions, with no dynamic registration outside the Test function.
func TestBoundariesDependenciesClassifiesImportTypeNodeKinds(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "type Shape = import(\"../domain/model\").Shape;\ntype Module = typeof import(\"../domain/model\");\n"
  firstLineEnd := strings.Index(source, "\n")
  files := map[string]string{"src/domain/model.ts": "export interface Shape {}\nexport const model = 1;\n"}
  base := `"elements":[
    {"type":"app","pattern":"src/app/**"},
    {"type":"domain","pattern":"src/domain/**"}
  ],"default":"allow"`

  typeOnly := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`,
    "policies":[{"from":"app","disallow":{"to":"domain","dependency":{"kind":"type"}}}]
  }`, files)
  assertBoundaryFindingTexts(t, source, typeOnly, `"../domain/model"`)
  if typeOnly[0].End > firstLineEnd {
    t.Fatalf("type denial must report the plain import-type node, got %+v", typeOnly)
  }

  typeofOnly := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`,
    "policies":[{"from":"app","disallow":{"to":"domain","dependency":{"kind":"typeof"}}}]
  }`, files)
  assertBoundaryFindingTexts(t, source, typeofOnly, `"../domain/model"`)
  if typeofOnly[0].Pos < firstLineEnd {
    t.Fatalf("typeof denial must report the typeof import-type node, got %+v", typeofOnly)
  }

  valueOnly := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`,
    "policies":[{"from":"app","disallow":{"to":"domain","dependency":{"kind":"value"}}}]
  }`, files)
  if len(valueOnly) != 0 {
    t.Fatalf("value denial must ignore type-position imports, got %+v", valueOnly)
  }
}
