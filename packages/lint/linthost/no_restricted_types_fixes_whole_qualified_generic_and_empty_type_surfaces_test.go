package linthost

import (
  "testing"
  "encoding/json"
)

// TestNoRestrictedTypesFixesWholeQualifiedGenericAndEmptyTypeSurfaces verifies
// fixes replace the complete qualified, generic and empty type surface.
//
// An identifier-only replacement would corrupt spaced qualified or generic
// names, empty objects and empty tuples.
//
//  1. Configure replacements for a qualified name, a generic name, an empty object
//     and an empty tuple.
//  2. Apply the automatic fixes.
//  3. Assert the four replacements, the exact rewritten program, a valid parse and a
//     clean second pass.
//
// @evidence contracts/testing.md#behavioral-verification Fixes must replace complete qualified, generic and empty type surfaces.
// @evidence contracts/testing.md#independent-expectations Four authored replacements determine the complete rewritten program and applied count, syntax validity and clean fixed point.
// @evidence contracts/testing.md#distinguishing-cases Spaced qualified/generic names and empty objects/tuples reject identifier-only replacements.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedTypesFixesWholeQualifiedGenericAndEmptyTypeSurfaces invokes the registered rule over an in-process parsed source through runRuleFindingsSnapshot; no native plugin build, compiler child or installation is involved.
func TestNoRestrictedTypesFixesWholeQualifiedGenericAndEmptyTypeSurfaces(t *testing.T) {
  source := `type Qualified = NS . Legacy;
type Full = Generic < Old >;
type EmptyObject = { };
type EmptyTuple = [ ];
`
  options := json.RawMessage(`{
    "types": {
      "NS.Legacy": {"message":"Use NS.Modern.","fixWith":"NS.Modern"},
      "Generic<Old>": {"message":"Use ModernGeneric.","fixWith":"ModernGeneric"},
      "{}": {"message":"Use object.","fixWith":"object"},
      "[]": {"message":"Use unknown[].","fixWith":"unknown[]"}
    }
  }`)
  findings := runNoRestrictedTypes(t, source, options)
  if len(findings) != 4 {
    t.Fatalf("findings = %d, want 4: %+v", len(findings), findings)
  }
  for _, finding := range findings {
    if finding.Rule != noRestrictedTypesRuleName || finding.Severity != SeverityError { t.Fatalf("restriction identity = %+v", finding) }
  }
  rewritten, applied := applyFindingFixesToText(source, findings)
  if applied != 4 {
    t.Fatalf("applied = %d, want 4; findings=%+v", applied, findings)
  }
  noRestrictedTypesAssertStableRewrite(t, rewritten, `type Qualified = NS.Modern;
type Full = ModernGeneric;
type EmptyObject = object;
type EmptyTuple = unknown[];
`, options)
}
