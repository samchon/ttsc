package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedTypesMatchesEveryOfficialTypeSurfaceExactly verifies each
// supported type surface is matched exactly and runtime heritage is not.
//
// Keywords, empty types, nested tuples, names and type heritage are banned
// surfaces; a runtime extends clause is not a type.
//
//  1. Parse a source with twenty-four marked type surfaces and a runtime extends
//     clause.
//  2. Run the rule with a ban on each surface.
//  3. Assert the exact ranges and messages at error severity with no edits and
//     nothing for the runtime clause.
//
// @evidence contracts/testing.md#behavioral-verification Configured restrictions must cover supported type surfaces without matching runtime heritage.
// @evidence contracts/testing.md#independent-expectations Twenty-four authored marker/text spans fix complete ranges and messages; exact rule, error severity and absent edits are required.
// @evidence contracts/testing.md#distinguishing-cases Keywords, empty types, nested tuples, names and type heritage are positive cases; runtime extends stays clean.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedTypesMatchesEveryOfficialTypeSurfaceExactly invokes the registered rule over an in-process parsed source through runRuleFindingsSnapshot; no native plugin build, compiler child or installation is involved.
func TestNoRestrictedTypesMatchesEveryOfficialTypeSurfaceExactly(t *testing.T) {
  source := `
type T01 = /*01*/bigint;
type T02 = /*02*/boolean;
type T03 = /*03*/never;
type T04 = /*04*/null;
type T05 = /*05*/number;
type T06 = /*06*/object;
type T07 = /*07*/string;
type T08 = /*08*/symbol;
type T09 = /*09*/undefined;
type T10 = /*10*/unknown;
type T11 = /*11*/void;
type T12 = /*12*/{  };
type T13 = /*13*/[  ];
type T14 = [/*14*/[ ]];
type T15 = /*15*/Banned;
type T16 = /*16*/Plain<Allowed>;
type T17 = /*17*/Generic < A, B >;
type T18 = /*18*/NS . Banned;
class C19 implements /*19*/Contract {}
class C20 implements /*20*/GenericContract < Allowed > {}
interface I21 extends /*21*/ContractBase {}
interface I22 extends /*22*/GenericBase < Allowed > {}
type T23 = Allowed | /*23*/RestrictedUnion;
type T24 = Allowed & /*24*/RestrictedIntersection;
declare class RuntimeBase {}
class CleanRuntimeHeritage extends RuntimeBase {}
`
  options := json.RawMessage(`{
    "types": {
      "bigint": true,
      "boolean": true,
      "never": true,
      "null": true,
      "number": true,
      "object": true,
      "string": true,
      "symbol": true,
      "undefined": true,
      "unknown": true,
      "void": true,
      "{}": true,
      "[]": true,
      "Banned": "Prefer Allowed.",
      "Plain": true,
      " Generic < A, B > ": true,
      "NS.Banned": true,
      "Contract": true,
      "GenericContract<Allowed>": true,
      "ContractBase": true,
      "GenericBase<Allowed>": true,
      "RestrictedUnion": true,
      "RestrictedIntersection": true,
      "RuntimeBase": true
    }
  }`)
  expected := []struct {
    marker string
    text   string
    name   string
    custom string
  }{
    {"/*01*/", "bigint", "bigint", ""},
    {"/*02*/", "boolean", "boolean", ""},
    {"/*03*/", "never", "never", ""},
    {"/*04*/", "null", "null", ""},
    {"/*05*/", "number", "number", ""},
    {"/*06*/", "object", "object", ""},
    {"/*07*/", "string", "string", ""},
    {"/*08*/", "symbol", "symbol", ""},
    {"/*09*/", "undefined", "undefined", ""},
    {"/*10*/", "unknown", "unknown", ""},
    {"/*11*/", "void", "void", ""},
    {"/*12*/", "{  }", "{}", ""},
    {"/*13*/", "[  ]", "[]", ""},
    {"/*14*/", "[ ]", "[]", ""},
    {"/*15*/", "Banned", "Banned", "Prefer Allowed."},
    {"/*16*/", "Plain", "Plain", ""},
    {"/*17*/", "Generic < A, B >", "Generic<A,B>", ""},
    {"/*18*/", "NS . Banned", "NS.Banned", ""},
    {"/*19*/", "Contract", "Contract", ""},
    {"/*20*/", "GenericContract < Allowed >", "GenericContract<Allowed>", ""},
    {"/*21*/", "ContractBase", "ContractBase", ""},
    {"/*22*/", "GenericBase < Allowed >", "GenericBase<Allowed>", ""},
    {"/*23*/", "RestrictedUnion", "RestrictedUnion", ""},
    {"/*24*/", "RestrictedIntersection", "RestrictedIntersection", ""},
  }

  findings := runNoRestrictedTypes(t, source, options)
  if len(findings) != len(expected) {
    t.Fatalf("findings = %d, want %d: %+v", len(findings), len(expected), findings)
  }
  wanted := make(map[[2]int]string, len(expected))
  for _, item := range expected {
    span := noRestrictedTypesMarkedSpan(t, source, item.marker, item.text)
    message := "Don't use `" + item.name + "` as a type."
    if item.custom != "" {
      message += " " + item.custom
    }
    wanted[span] = message
  }
  for _, finding := range findings {
    span := [2]int{finding.Pos, finding.End}
    message, ok := wanted[span]
    if !ok {
      t.Fatalf("unexpected finding range %v: %+v", span, finding)
    }
    if finding.Rule != noRestrictedTypesRuleName ||
      finding.Severity != SeverityError || finding.Message != message {
      t.Fatalf("finding at %v = %+v, want message %q", span, finding, message)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("boolean/string policy unexpectedly edits at %v: %+v", span, finding)
    }
    delete(wanted, span)
  }
  if len(wanted) != 0 {
    t.Fatalf("missing expected finding ranges: %+v", wanted)
  }
}
