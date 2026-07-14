package linthost

import (
  "encoding/json"
  "sort"
  "strings"
  "testing"
)

type noRestrictedImportsFinding struct {
  target  string
  message string
  pos     int
}

func runNoRestrictedImports(
  t *testing.T,
  source string,
  options json.RawMessage,
) []noRestrictedImportsFinding {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, "no-restricted-imports", source, options)
  normalized := make([]noRestrictedImportsFinding, 0, len(findings))
  for _, finding := range findings {
    if finding.Rule != "no-restricted-imports" {
      t.Fatalf("unexpected rule in no-restricted-imports findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("no-restricted-imports must not offer edits: %+v", finding)
    }
    if finding.Pos < 0 || finding.End <= finding.Pos || finding.End > len(source) {
      t.Fatalf("no-restricted-imports returned an invalid source range: %+v", finding)
    }
    normalized = append(normalized, noRestrictedImportsFinding{
      target:  source[finding.Pos:finding.End],
      message: finding.Message,
      pos:     finding.Pos,
    })
  }
  sort.SliceStable(normalized, func(i, j int) bool {
    if normalized[i].pos != normalized[j].pos {
      return normalized[i].pos < normalized[j].pos
    }
    return normalized[i].message < normalized[j].message
  })
  return normalized
}

func noRestrictedImportsTargets(findings []noRestrictedImportsFinding) []string {
  targets := make([]string, len(findings))
  for index, finding := range findings {
    targets[index] = finding.target
  }
  return targets
}

func assertNoRestrictedImportsTargets(t *testing.T, findings []noRestrictedImportsFinding, want ...string) {
  t.Helper()
  got := noRestrictedImportsTargets(findings)
  if len(got) != len(want) {
    t.Fatalf("no-restricted-imports target count mismatch: want=%q got=%q findings=%+v", want, got, findings)
  }
  for index := range want {
    if got[index] != want[index] {
      t.Fatalf("no-restricted-imports target[%d] mismatch: want=%q got=%q all=%q", index, want[index], got[index], got)
    }
  }
}

func TestNoRestrictedImportsMissingAndEmptyRestrictionsAreNoOp(t *testing.T) {
  source := `import lodash from "lodash";
export { map } from "underscore";
import * as fs from "node:fs";
void lodash;
void fs;
`
  options := []json.RawMessage{
    nil,
    json.RawMessage(`{}`),
    json.RawMessage(`[]`),
    json.RawMessage(`{"paths":[]}`),
    json.RawMessage(`{"patterns":[]}`),
    json.RawMessage(`{"paths":[],"patterns":[]}`),
  }
  for _, option := range options {
    if findings := runNoRestrictedImports(t, source, option); len(findings) != 0 {
      t.Fatalf("empty options %s inferred a restriction: %+v", option, findings)
    }
  }
}

func TestNoRestrictedImportsExactPathsCoverEveryStaticModuleForm(t *testing.T) {
  source := `import Default from "blocked";
import { source as alias } from "blocked";
import * as namespace from "blocked";
import "blocked";
export { source as renamed } from "blocked";
export * from "blocked";
export * as exportedNamespace from "blocked";
import legacy = require("blocked");
import allowed from "allowed";
void Default;
void namespace;
void legacy;
void allowed;
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"paths":[{"name":"blocked","message":"Use the supported boundary instead."}]}`),
  )
  assertNoRestrictedImportsTargets(
    t,
    findings,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
    `"blocked"`,
  )
  for _, finding := range findings {
    if finding.message != "'blocked' import is restricted from being used. Use the supported boundary instead." {
      t.Fatalf("unexpected exact-path message: %+v", finding)
    }
  }
}

func TestNoRestrictedImportsPositionalPathsDoNotReachDynamicImports(t *testing.T) {
  source := `import direct from "blocked";
const dynamic = import("blocked");
const commonJS = require("blocked");
JSON.stringify([direct, dynamic, commonJS]);
`
  findings := runNoRestrictedImports(t, source, json.RawMessage(`"blocked"`))
  assertNoRestrictedImportsTargets(t, findings, `"blocked"`)
}

func TestNoRestrictedImportsExactPathsPreserveModuleSpecifierWhitespace(t *testing.T) {
  source := `import exact from "pkg";
import spaced from " pkg ";
JSON.stringify([exact, spaced]);
`
  exact := runNoRestrictedImports(t, source, json.RawMessage(`"pkg"`))
  assertNoRestrictedImportsTargets(t, exact, `"pkg"`)

  spaced := runNoRestrictedImports(t, source, json.RawMessage(`" pkg "`))
  assertNoRestrictedImportsTargets(t, spaced, `" pkg "`)
}

func TestNoRestrictedImportsMatchesSourceNamesAndReportsExactSpecifierRanges(t *testing.T) {
  source := `import Default, { source as alias, allowed } from "pkg";
import * as namespace from "pkg";
export { source as renamed, allowed } from "pkg";
export { default as exportedDefault } from "pkg";
export * from "pkg";
export * as exportedNamespace from "pkg";
import "pkg";
void Default;
void namespace;
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"paths":[{"name":"pkg","importNames":["default","source"]}]}`),
  )
  assertNoRestrictedImportsTargets(
    t,
    findings,
    "Default",
    "source as alias",
    "* as namespace",
    "source as renamed",
    "default as exportedDefault",
    "*",
    "*",
  )
  if !strings.Contains(findings[0].message, "'default' import from 'pkg' is restricted") ||
    !strings.Contains(findings[1].message, "'source' import from 'pkg' is restricted") {
    t.Fatalf("aliases were matched by local rather than source names: %+v", findings)
  }
  for _, index := range []int{2, 5, 6} {
    if !strings.Contains(findings[index].message, "* import is invalid because 'default' and 'source' from 'pkg' are restricted") {
      t.Fatalf("namespace diagnostic mismatch: %+v", findings[index])
    }
  }
}

func TestNoRestrictedImportsPatternsHonorNegationCaseRegexAndNamePatterns(t *testing.T) {
  source := `import "LIB/private";
import "LIB/pick";
import { secret, unsafeThing, safe } from "@internal/pkg";
import { secret as allowedByCase } from "@Internal/pkg";
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"patterns":[{"group":["lib/*","!lib/pick"],"message":"Grouped restriction."},{"regex":"^@internal/","caseSensitive":true,"importNames":["secret"],"importNamePattern":"^unsafe","message":"Internal name."}]}`),
  )
  assertNoRestrictedImportsTargets(t, findings, `"LIB/private"`, "secret", "unsafeThing")
  if findings[0].message != "'LIB/private' import is restricted from being used by a pattern. Grouped restriction." {
    t.Fatalf("group message mismatch: %+v", findings[0])
  }
  for _, finding := range findings[1:] {
    if !strings.HasSuffix(finding.message, "Internal name.") {
      t.Fatalf("pattern custom message was not appended: %+v", finding)
    }
  }
}

func TestNoRestrictedImportsStringPatternsKeepGitignoreParentNegationSemantics(t *testing.T) {
  source := `import "lib/private/value";
import "lib/public/value";
import "other/value";
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"patterns":["lib/*","!lib/public"]}`),
  )
  assertNoRestrictedImportsTargets(t, findings, `"lib/private/value"`)
}

func TestNoRestrictedImportsGroupsKeepGitignoreAnchorsGlobstarsAndUnicode(t *testing.T) {
  anchoredSource := `import "root";
import "nested/root";
`
  anchored := runNoRestrictedImports(
    t,
    anchoredSource,
    json.RawMessage(`{"patterns":[{"group":["/root"]}]}`),
  )
  assertNoRestrictedImportsTargets(t, anchored, `"root"`)

  ordinaryStarsSource := `import "fooxbar";
import "foo/deep/bar";
`
  ordinaryStars := runNoRestrictedImports(
    t,
    ordinaryStarsSource,
    json.RawMessage(`{"patterns":[{"group":["foo**bar"]}]}`),
  )
  assertNoRestrictedImportsTargets(t, ordinaryStars, `"fooxbar"`)

  trailingSource := `import "foo/";
import "foo/value";
`
  trailingStar := runNoRestrictedImports(
    t,
    trailingSource,
    json.RawMessage(`{"patterns":[{"group":["foo/*"]}]}`),
  )
  assertNoRestrictedImportsTargets(t, trailingStar, `"foo/value"`)
  trailingGlobstar := runNoRestrictedImports(
    t,
    trailingSource,
    json.RawMessage(`{"patterns":[{"group":["foo/**"]}]}`),
  )
  assertNoRestrictedImportsTargets(t, trailingGlobstar, `"foo/value"`)

  unicodeSource := `import "패키지/내부";
import "패키지/공개";
`
  unicodeGroup := runNoRestrictedImports(
    t,
    unicodeSource,
    json.RawMessage(`{"patterns":[{"group":["패키지/*","!패키지/공개"]}]}`),
  )
  assertNoRestrictedImportsTargets(t, unicodeGroup, `"패키지/내부"`)

  invalidRange := runNoRestrictedImports(
    t,
    `import "range-target";`,
    json.RawMessage(`{"patterns":[{"group":["[z-a]"]}]}`),
  )
  if len(invalidRange) != 0 {
    t.Fatalf("an unusable gitignore range must not reject configuration or match imports: %+v", invalidRange)
  }
}

func TestNoRestrictedImportsAllowedNamesRejectOnlyTheComplement(t *testing.T) {
  source := `import Default, { safe, unsafe } from "pkg/module";
import * as namespace from "pkg/module";
export { safe, unsafe as renamed } from "pkg/module";
void Default;
void namespace;
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"patterns":[{"group":["pkg/*"],"allowImportNames":["safe"],"message":"Use the public name."}]}`),
  )
  assertNoRestrictedImportsTargets(t, findings, "Default", "unsafe", "* as namespace", "unsafe as renamed")
  for _, finding := range findings {
    if !strings.Contains(finding.message, "only 'safe'") || !strings.HasSuffix(finding.message, "Use the public name.") {
      t.Fatalf("allow-list diagnostic mismatch: %+v", finding)
    }
  }
}

func TestNoRestrictedImportsAllowedNamePatternCoversImportsAndReexports(t *testing.T) {
  source := `import { publicValue, privateValue } from "pkg/names";
export { publicType, privateType } from "pkg/names";
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"patterns":[{"regex":"^pkg/","allowImportNamePattern":"^public"}]}`),
  )
  assertNoRestrictedImportsTargets(t, findings, "privateValue", "privateType")
}

func TestNoRestrictedImportsAllowTypeImportsHandlesWholeAndInlineTypeSyntax(t *testing.T) {
  source := `import type { Foo } from "types";
import { type Foo } from "types";
import { type Foo, Bar } from "types";
export type { Foo } from "types";
export { type Foo } from "types";
export type * from "types";
import type Legacy = require("types");
import { type Foo, Bar } from "names";
export { type Foo, Bar } from "names";
import Value from "types";
void Bar;
void Value;
`
  findings := runNoRestrictedImports(
    t,
    source,
    json.RawMessage(`{"paths":[{"name":"types","allowTypeImports":true},{"name":"names","importNames":["Foo","Bar"],"allowTypeImports":true}]}`),
  )
  assertNoRestrictedImportsTargets(t, findings, `"types"`, "Bar", "Bar", `"types"`)
}

func noRestrictedImportsValidationEngine(options json.RawMessage) *Engine {
  return NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"no-restricted-imports": SeverityError},
    Options: RuleOptionsMap{
      "no-restricted-imports": options,
    },
  })
}

func TestNoRestrictedImportsValidatorAcceptsEveryOfficialOptionBranch(t *testing.T) {
  valid := []json.RawMessage{
    nil,
    json.RawMessage(`"fs"`),
    json.RawMessage(`["fs",{"name":"pkg","message":"Use another module.","importNames":[],"allowTypeImports":true}]`),
    json.RawMessage(`{}`),
    json.RawMessage(`{"paths":[],"patterns":[]}`),
    json.RawMessage(`{"paths":["fs",{"name":"pkg","allowImportNames":[]}],"patterns":["pkg/*","!pkg/public"]}`),
    json.RawMessage(`{"patterns":[{"group":["pkg/*"],"importNames":["one"],"importNamePattern":"^unsafe","caseSensitive":true,"allowTypeImports":true}]}`),
    json.RawMessage(`{"patterns":[{"regex":"^pkg/","allowImportNames":["safe"]},{"regex":"^other/","allowImportNamePattern":"^public"}]}`),
  }
  for _, options := range valid {
    engine := noRestrictedImportsValidationEngine(options)
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("valid no-restricted-imports options %s were rejected: %v", options, err)
    }
    if engine.EnabledRules()["no-restricted-imports"] != SeverityError {
      t.Fatalf("valid no-restricted-imports options did not activate the rule: %v", engine.EnabledRules())
    }
    if engine.NeedsTypeChecker() {
      t.Fatal("no-restricted-imports unexpectedly requested a type checker")
    }
  }
}

func TestNoRestrictedImportsValidatorRejectsMalformedConfigurationAtTheBoundary(t *testing.T) {
  cases := []struct {
    options json.RawMessage
    want    string
  }{
    {options: json.RawMessage(`null`), want: "options must be path entries"},
    {options: json.RawMessage(`{"paths":`), want: "options must be an object"},
    {options: json.RawMessage(`{"paths":[],"unexpected":true}`), want: `unknown option "unexpected"`},
    {options: json.RawMessage(`{"paths":"fs"}`), want: `option "paths" must be an array`},
    {options: json.RawMessage(`{"name":1}`), want: `option "name" must be a string`},
    {options: json.RawMessage(`{"message":"missing name"}`), want: `requires "name"`},
    {options: json.RawMessage(`{"name":"pkg","message":""}`), want: `option "message" must not be empty`},
    {options: json.RawMessage(`{"name":"pkg","allowTypeImports":null}`), want: `option "allowTypeImports" must be a boolean`},
    {options: json.RawMessage(`{"name":"pkg","importNames":[],"allowImportNames":[]}`), want: "cannot be combined"},
    {options: json.RawMessage(`["fs","fs"]`), want: `option "paths" contains a duplicate entry`},
    {options: json.RawMessage(`{"patterns":["pkg/*",{"group":["other/*"]}]}`), want: "only strings or only objects"},
    {options: json.RawMessage(`{"patterns":[{}]}`), want: "exactly one"},
    {options: json.RawMessage(`{"patterns":[{"group":["pkg/*"],"regex":"pkg"}]}`), want: "exactly one"},
    {options: json.RawMessage(`{"patterns":[{"group":[]}]}`), want: "at least one string"},
    {options: json.RawMessage(`{"patterns":[{"group":["pkg/*","pkg/*"]}]}`), want: "duplicate value"},
    {options: json.RawMessage(`{"patterns":[{"regex":"["}]}`), want: "valid regular expression"},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","importNames":[]}]}`), want: "at least one string"},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","allowImportNames":["safe"],"allowImportNamePattern":"^safe"}]}`), want: "cannot be combined"},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","unknown":true}]}`), want: `unknown option "unknown"`},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","caseSensitive":null}]}`), want: `option "caseSensitive" must be a boolean`},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","message":""}]}`), want: `option "message" must not be empty`},
    {options: json.RawMessage(`{"patterns":[{"regex":"pkg","message":"x"},{"message":"x","regex":"pkg"}]}`), want: `option "patterns" contains a duplicate entry`},
  }
  for _, tc := range cases {
    engine := noRestrictedImportsValidationEngine(tc.options)
    err := engine.ConfigError()
    if err == nil || !strings.Contains(err.Error(), tc.want) {
      t.Fatalf("invalid options %s mismatch: want=%q got=%v", tc.options, tc.want, err)
    }
    if _, active := engine.EnabledRules()["no-restricted-imports"]; active {
      t.Fatalf("invalid options entered the dispatch table: %v", engine.EnabledRules())
    }
  }
}

func TestCommandCheckNoRestrictedImportsUsesRealConfigOptions(t *testing.T) {
  root := seedLintProject(t, `import { unsafe, safe } from "pkg/private";
JSON.stringify([unsafe, safe]);
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-restricted-imports": []any{
        "error",
        map[string]any{
          "patterns": []any{
            map[string]any{
              "group":       []string{"pkg/*"},
              "importNames": []string{"unsafe"},
              "message":     "Import from the public module.",
            },
          },
        },
      },
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  const message = "[no-restricted-imports] 'unsafe' import from 'pkg/private' is restricted from being used by a pattern. Import from the public module."
  if code != 2 || stdout != "" || strings.Count(stderr, message) != 1 || strings.Contains(stderr, "'safe' import") {
    t.Fatalf("no-restricted-imports command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}

func TestCommandCheckRejectsInvalidNoRestrictedImportsOptionsBeforeLinting(t *testing.T) {
  root := seedLintProject(t, `import value from "pkg";
JSON.stringify(value);
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-restricted-imports": []any{
        "error",
        map[string]any{
          "patterns": []any{
            map[string]any{"regex": "["},
          },
        },
      },
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" ||
    !strings.Contains(stderr, `@ttsc/lint: invalid options for rule "no-restricted-imports"`) ||
    !strings.Contains(stderr, `option "regex" must be a valid regular expression`) ||
    strings.Contains(stderr, "[no-restricted-imports]") {
    t.Fatalf("invalid no-restricted-imports command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
