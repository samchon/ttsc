package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

const noRestrictedTypesRuleName = "typescript/no-restricted-types"

func runNoRestrictedTypes(
  t *testing.T,
  source string,
  options json.RawMessage,
) []*Finding {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(
    t,
    noRestrictedTypesRuleName,
    source,
    options,
  )
  return findings
}

func TestNoRestrictedTypesHasNoImplicitDefaults(t *testing.T) {
  source := `
type A = Object;
type B = Function;
type C = Number;
type D = String;
type E = Boolean;
type F = Local;
`
  cases := []struct {
    name    string
    options json.RawMessage
  }{
    {name: "bare severity"},
    {name: "empty options", options: json.RawMessage(`{}`)},
    {name: "empty map", options: json.RawMessage(`{"types":{}}`)},
    {
      name: "disabled entries",
      options: json.RawMessage(
        `{"types":{"Object":false,"Function":null,"Number":false,"String":null,"Boolean":false,"Local":null}}`,
      ),
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      if findings := runNoRestrictedTypes(t, source, test.options); len(findings) != 0 {
        t.Fatalf("findings = %+v, want none", findings)
      }
    })
  }
}

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

func TestNoRestrictedTypesRejectsOnlyExactTypeSyntax(t *testing.T) {
  source := `
const runtime = Object();
const created = Object.create(null);
const nullValue = null;
const voidValue = void runtime;
type Query = typeof Banned;
type QualifiedMiss = namespace.Object;
type PrefixMiss = _.NS.Banned;
type SuffixMiss = NS.Banned._;
type GenericMiss = Generic<Other>;
type NonEmptyTuple = [Other];
type NonEmptyObject = { value: Other };
declare class RuntimeBase {}
class RuntimeDerived extends RuntimeBase {}
JSON.stringify({ created, nullValue, voidValue });
`
  options := json.RawMessage(`{
    "types": {
      "Object": true,
      "null": true,
      "void": true,
      "Banned": true,
      "NS.Banned": true,
      "Generic<Wanted>": true,
      "[]": true,
      "{}": true,
      "RuntimeBase": true
    }
  }`)
  if findings := runNoRestrictedTypes(t, source, options); len(findings) != 0 {
    t.Fatalf("non-type or inexact matches produced findings: %+v", findings)
  }
}

func TestNoRestrictedTypesUsesConfiguredSurfaceSpellingAcrossSymbols(t *testing.T) {
  tests := []struct {
    name    string
    source  string
    options json.RawMessage
    want    int
  }{
    {
      name: "local declaration is still restricted",
      source: `interface Shadowed {}
type Use = Shadowed;
`,
      options: json.RawMessage(`{"types":{"Shadowed":true}}`),
      want: 1,
    },
    {
      name: "imported alias spelling is restricted",
      source: `import type { Remote as Imported } from "pkg";
type Use = Imported;
`,
      options: json.RawMessage(`{"types":{"Imported":true}}`),
      want: 1,
    },
    {
      name: "original export name does not replace alias spelling",
      source: `import type { Remote as Imported } from "pkg";
type Use = Imported;
`,
      options: json.RawMessage(`{"types":{"Remote":true}}`),
    },
  }
  for _, test := range tests {
    t.Run(test.name, func(t *testing.T) {
      findings := runNoRestrictedTypes(t, test.source, test.options)
      if len(findings) != test.want {
        t.Fatalf("findings = %d, want %d: %+v", len(findings), test.want, findings)
      }
    })
  }
}

func TestNoRestrictedTypesStructuredPolicyProvidesFixAndEverySuggestion(t *testing.T) {
  source := "type Value = /*target*/Legacy;\n"
  options := json.RawMessage(`{
    "types": {
      "Legacy": {
        "message": "Use an explicit safe type.",
        "fixWith": "Modern",
        "suggest": ["Safer", "Safest"]
      }
    }
  }`)
  findings := runNoRestrictedTypes(t, source, options)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1: %+v", len(findings), findings)
  }
  finding := findings[0]
  span := noRestrictedTypesMarkedSpan(t, source, "/*target*/", "Legacy")
  if finding.Pos != span[0] || finding.End != span[1] ||
    finding.Message != "Don't use `Legacy` as a type. Use an explicit safe type." {
    t.Fatalf("finding = %+v, want span %v", finding, span)
  }
  if len(finding.Fix) != 1 || finding.Fix[0] != (TextEdit{Pos: span[0], End: span[1], Text: "Modern"}) {
    t.Fatalf("automatic fix = %+v", finding.Fix)
  }
  if len(finding.Suggestions) != 2 {
    t.Fatalf("suggestions = %+v, want 2", finding.Suggestions)
  }
  replacements := []string{"Safer", "Safest"}
  for index, replacement := range replacements {
    suggestion := finding.Suggestions[index]
    wantTitle := "Replace `Legacy` with `" + replacement + "`."
    if suggestion.Title != wantTitle || len(suggestion.Edits) != 1 ||
      suggestion.Edits[0] != (TextEdit{Pos: span[0], End: span[1], Text: replacement}) {
      t.Fatalf("suggestion %d = %+v, want %q -> %q", index, suggestion, wantTitle, replacement)
    }
    rewritten, applied := applyFindingFixesToText(
      source,
      []*Finding{{Fix: suggestion.Edits}},
    )
    noRestrictedTypesAssertStableRewrite(
      t,
      rewritten,
      "type Value = /*target*/"+replacement+";\n",
      options,
    )
    if applied != 1 {
      t.Fatalf("suggestion %d applied %d edits, want 1", index, applied)
    }
  }

  rewritten, applied := applyFindingFixesToText(source, findings)
  if applied != 1 {
    t.Fatalf("automatic fix applied %d edits, want 1", applied)
  }
  noRestrictedTypesAssertStableRewrite(
    t,
    rewritten,
    "type Value = /*target*/Modern;\n",
    options,
  )

  optionalFields := []struct {
    name        string
    typeName    string
    policy      string
    fixWith     string
    suggestions []string
  }{
    {
      name:     "empty object uses the default message",
      typeName: "EmptyPolicy",
      policy:   `{}`,
    },
    {
      name:     "fix without message",
      typeName: "FixOnly",
      policy:   `{"fixWith":"Modern"}`,
      fixWith:  "Modern",
    },
    {
      name:        "suggestions without message",
      typeName:    "SuggestOnly",
      policy:      `{"suggest":["Safer","Safest"]}`,
      suggestions: []string{"Safer", "Safest"},
    },
  }
  for _, test := range optionalFields {
    t.Run(test.name, func(t *testing.T) {
      source := "type Value = " + test.typeName + ";\n"
      options := json.RawMessage(
        `{"types":{"` + test.typeName + `":` + test.policy + `}}`,
      )
      findings := runNoRestrictedTypes(t, source, options)
      if len(findings) != 1 {
        t.Fatalf("findings = %d, want 1: %+v", len(findings), findings)
      }
      finding := findings[0]
      if finding.Message != "Don't use `"+test.typeName+"` as a type." {
        t.Fatalf("default message mismatch: %+v", finding)
      }
      if test.fixWith == "" {
        if len(finding.Fix) != 0 {
          t.Fatalf("unexpected automatic fix: %+v", finding.Fix)
        }
      } else {
        rewritten, applied := applyFindingFixesToText(source, findings)
        if applied != 1 {
          t.Fatalf("automatic fix applied %d edits, want 1", applied)
        }
        noRestrictedTypesAssertStableRewrite(
          t,
          rewritten,
          "type Value = "+test.fixWith+";\n",
          options,
        )
      }
      if len(finding.Suggestions) != len(test.suggestions) {
        t.Fatalf("suggestions = %+v, want %v", finding.Suggestions, test.suggestions)
      }
      for index, replacement := range test.suggestions {
        suggestion := finding.Suggestions[index]
        if suggestion.Title != "Replace `"+test.typeName+"` with `"+replacement+"`." {
          t.Fatalf("suggestion %d title = %q", index, suggestion.Title)
        }
        rewritten, applied := applyFindingFixesToText(
          source,
          []*Finding{{Fix: suggestion.Edits}},
        )
        if applied != 1 {
          t.Fatalf("suggestion %d applied %d edits, want 1", index, applied)
        }
        noRestrictedTypesAssertStableRewrite(
          t,
          rewritten,
          "type Value = "+replacement+";\n",
          options,
        )
      }
    })
  }
}

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

func TestNoRestrictedTypesLaterWhitespaceEquivalentKeyWins(t *testing.T) {
  source := "type Value = Banned;\n"
  disabledLast := json.RawMessage(`{"types":{" Banned ":true,"Banned":false}}`)
  if findings := runNoRestrictedTypes(t, source, disabledLast); len(findings) != 0 {
    t.Fatalf("later disabled key did not win: %+v", findings)
  }
  enabledLast := json.RawMessage(`{"types":{"Banned":false," B a n n e d ":true}}`)
  findings := runNoRestrictedTypes(t, source, enabledLast)
  if len(findings) != 1 || findings[0].Message != "Don't use `Banned` as a type." {
    t.Fatalf("later enabled key did not win: %+v", findings)
  }
}

func TestNoRestrictedTypesRunsOnDeclarationFiles(t *testing.T) {
  _, _, findings := runRuleFindingsSnapshotFile(
    t,
    noRestrictedTypesRuleName,
    "types.d.ts",
    "declare const value: Banned;\n",
    json.RawMessage(`{"types":{"Banned":true}}`),
  )
  if len(findings) != 1 || findings[0].Message != "Don't use `Banned` as a type." {
    t.Fatalf("declaration findings = %+v", findings)
  }
}

func noRestrictedTypesMarkedSpan(
  t *testing.T,
  source string,
  marker string,
  text string,
) [2]int {
  t.Helper()
  markerPos := strings.Index(source, marker)
  if markerPos < 0 || strings.LastIndex(source, marker) != markerPos {
    t.Fatalf("marker %q must occur exactly once", marker)
  }
  searchFrom := markerPos + len(marker)
  offset := strings.Index(source[searchFrom:], text)
  if offset < 0 {
    t.Fatalf("text %q not found after marker %q", text, marker)
  }
  start := searchFrom + offset
  return [2]int{start, start + len(text)}
}

func noRestrictedTypesAssertStableRewrite(
  t *testing.T,
  rewritten string,
  expected string,
  options json.RawMessage,
) {
  t.Helper()
  if rewritten != expected {
    t.Fatalf("rewrite mismatch:\nwant %q\ngot  %q", expected, rewritten)
  }
  file := parseTSFile(t, "/virtual/no-restricted-types-rewrite.ts", rewritten)
  if diagnostics := file.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("rewrite has parse diagnostics: %+v\n%s", diagnostics, rewritten)
  }
  if findings := runNoRestrictedTypes(t, rewritten, options); len(findings) != 0 {
    t.Fatalf("rewrite is not a clean fixed point: %+v\n%s", findings, rewritten)
  }
}
