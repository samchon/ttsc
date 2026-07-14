package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

const unicornPreventAbbreviationsRuleName = "unicorn/prevent-abbreviations"

func TestRuleCorpusUnicornPreventAbbreviations(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prevent-abbreviations.ts", "// expect: unicorn/prevent-abbreviations error\nconst errCb = (error: Error): void => {\n  console.error(error);\n};\n\nerrCb(new Error(\"fixture\"));\n")
}

func TestUnicornPreventAbbreviationsReportsBindingOnceAndFixesEveryReference(t *testing.T) {
  source := "function read(idx: number) {\n  const value = idx;\n  return { idx };\n}\nvoid read;\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreventAbbreviationsRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one binding diagnostic, got %d (%+v)", len(findings), findings)
  }
  if len(findings[0].Fix) != 3 {
    t.Fatalf("expected declaration and two reference edits, got %+v", findings[0].Fix)
  }
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function read(index: number) {\n  const value = index;\n  return { idx: index };\n}\nvoid read;\n",
  )
}

func TestUnicornPreventAbbreviationsKeepsShadowedBindingsIndependentAndAvoidsCollisions(t *testing.T) {
  source := "function outer(err: string) {\n  const error = \"kept\";\n  return err + error;\n}\nfunction sibling(err: string) {\n  return err;\n}\nvoid [outer, sibling];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function outer(error_: string) {\n  const error = \"kept\";\n  return error_ + error;\n}\nfunction sibling(error: string) {\n  return error;\n}\nvoid [outer, sibling];\n",
  )
}

func TestUnicornPreventAbbreviationsDoesNotCaptureUnresolvedNames(t *testing.T) {
  source := "function render(err: string): string {\n  console.log(error);\n  return err;\n}\nvoid render;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function render(error_: string): string {\n  console.log(error);\n  return error_;\n}\nvoid render;\n",
  )
}

func TestUnicornPreventAbbreviationsUsesFunctionScopeForVarCollisions(t *testing.T) {
  source := "function render(condition: boolean): string {\n  if (condition) {\n    var err = \"first\";\n  }\n  if (!condition) {\n    var error = \"second\";\n  }\n  return err + error;\n}\nvoid render;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function render(condition: boolean): string {\n  if (condition) {\n    var error_ = \"first\";\n  }\n  if (!condition) {\n    var error = \"second\";\n  }\n  return error_ + error;\n}\nvoid render;\n",
  )
}

func TestUnicornPreventAbbreviationsSeparatesGeneratedNamesInOneScope(t *testing.T) {
  source := "const idx = 0;\nconst i = 1;\nconsole.log(idx, i);\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const index = 0;\nconst index_ = 1;\nconsole.log(index, index_);\n",
  )
}

func TestUnicornPreventAbbreviationsExpandsCompoundAndCasedNamesButSkipsConstants(t *testing.T) {
  source := "class BtnFactory {}\nconst errCb = (): void => {};\nconst ENV = \"test\";\nvoid [BtnFactory, errCb, ENV];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "class ButtonFactory {}\nconst errorCallback = (): void => {};\nconst ENV = \"test\";\nvoid [ButtonFactory, errorCallback, ENV];\n",
  )
}

func TestUnicornPreventAbbreviationsOffersWholeBindingSuggestionsForAmbiguousNames(t *testing.T) {
  source := "const e = 1;\nconsole.log(e);\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreventAbbreviationsRuleName, source, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one diagnostic, got %d (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if len(finding.Fix) != 0 || len(finding.Suggestions) != 2 {
    t.Fatalf("expected two suggestions and no autofix, got fix=%+v suggestions=%+v", finding.Fix, finding.Suggestions)
  }
  if finding.Suggestions[0].Title != "Rename to `error`." || len(finding.Suggestions[0].Edits) != 2 ||
    finding.Suggestions[1].Title != "Rename to `event`." || len(finding.Suggestions[1].Edits) != 2 {
    t.Fatalf("unexpected suggestions: %+v", finding.Suggestions)
  }
}

func TestUnicornPreventAbbreviationsHonorsReplacementAllowAndIgnoreOptions(t *testing.T) {
  source := "const err = 1;\nconst cmd = 2;\nconst ignoredCmd = 3;\nconst allowedCmd = 4;\nvoid [err, cmd, ignoredCmd, allowedCmd];\n"
  options := `{
    "extendDefaultReplacements": false,
    "replacements": {"cmd": {"command": true}},
    "allowList": {"allowedCmd": true},
    "ignore": ["^ignored"]
  }`
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    json.RawMessage(options),
  )
  if len(findings) != 1 || !strings.Contains(findings[0].Message, "`cmd`") {
    t.Fatalf("expected only custom cmd diagnostic, got %+v", findings)
  }
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    options,
    "const err = 1;\nconst command = 2;\nconst ignoredCmd = 3;\nconst allowedCmd = 4;\nvoid [err, command, ignoredCmd, allowedCmd];\n",
  )
}

func TestUnicornPreventAbbreviationsFalseReplacementDisablesCompoundMatches(t *testing.T) {
  source := "const ref = 1;\nconst someRef = ref;\nvoid someRef;\n"
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"replacements":{"ref":false}}`,
  )
}

func TestUnicornPreventAbbreviationsFalseReplacementStopsCaseVariantFallback(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nvoid err;\n",
    `{"replacements":{"err":false,"Err":{"failure":true}}}`,
  )
}

func TestUnicornPreventAbbreviationsAppliesInternalImportDefaultsAndPreservesImportedNames(t *testing.T) {
  source := "import err from \"./local-default\";\nimport * as ctx from \"external-ns\";\nimport { prop } from \"./local-named\";\nimport { ref } from \"external-named\";\nvoid [err, ctx, prop, ref];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "import error from \"./local-default\";\nimport * as ctx from \"external-ns\";\nimport { prop as property } from \"./local-named\";\nimport { ref } from \"external-named\";\nvoid [error, ctx, property, ref];\n",
  )
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    json.RawMessage(`{"checkDefaultAndNamespaceImports":true,"checkShorthandImports":true}`),
  )
  if len(findings) != 4 {
    t.Fatalf("expected all four imports when enabled, got %d (%+v)", len(findings), findings)
  }
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkDefaultAndNamespaceImports":false,"checkShorthandImports":false}`,
  )
}

func TestUnicornPreventAbbreviationsUsesDefaultImportControlForNamedDefaultSyntax(t *testing.T) {
  source := "import { default as err } from \"external\";\nvoid err;\n"
  assertRuleSkipsSource(t, unicornPreventAbbreviationsRuleName, source)
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkDefaultAndNamespaceImports":true}`,
    "import { default as error } from \"external\";\nvoid error;\n",
  )
}

func TestUnicornPreventAbbreviationsAppliesImportControlsToStaticRequireBindings(t *testing.T) {
  source := "declare function require(name: string): unknown;\nconst err = require(\"./local\");\nconst ctx = require(\"external\");\nvoid [err, ctx];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "declare function require(name: string): unknown;\nconst error = require(\"./local\");\nconst ctx = require(\"external\");\nvoid [error, ctx];\n",
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkDefaultAndNamespaceImports":false}`,
  )
}

func TestUnicornPreventAbbreviationsChecksShorthandDestructuringOnlyWhenEnabled(t *testing.T) {
  source := "declare const source: { err: Error };\nconst { err } = source;\nconsole.error(err);\n"
  assertRuleSkipsSource(t, unicornPreventAbbreviationsRuleName, source)
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkShorthandProperties":true}`,
    "declare const source: { err: Error };\nconst { err: error } = source;\nconsole.error(error);\n",
  )
}

func TestUnicornPreventAbbreviationsPreservesShorthandExportNames(t *testing.T) {
  source := "const err = new Error();\nexport { err };\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const error = new Error();\nexport { error as err };\n",
  )
}

func TestUnicornPreventAbbreviationsPropertyChecksAreOptInAndSuggestionOnly(t *testing.T) {
  source := "class Store {\n  e = 0;\n  update(): void {\n    this.e = 1;\n  }\n}\nvoid Store;\n"
  assertRuleSkipsSource(t, unicornPreventAbbreviationsRuleName, source)
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    json.RawMessage(`{"checkVariables":false,"checkProperties":true}`),
  )
  if len(findings) != 2 {
    t.Fatalf("expected property definition and write diagnostics, got %d (%+v)", len(findings), findings)
  }
  for _, finding := range findings {
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 2 {
      t.Fatalf("properties must be suggestion-only for ambiguous names: %+v", finding)
    }
  }
}

func TestUnicornPreventAbbreviationsChecksPhysicalFilenameWithoutOfferingEdits(t *testing.T) {
  _, _, findings := runRuleFindingsSnapshotFile(
    t,
    unicornPreventAbbreviationsRuleName,
    "idx.ts",
    "export {};\n",
    nil,
  )
  if len(findings) != 1 || findings[0].Message != "The filename `idx.ts` should be named `index.ts`. A more descriptive name will do too." ||
    len(findings[0].Fix) != 0 || len(findings[0].Suggestions) != 0 {
    t.Fatalf("unexpected filename finding: %+v", findings)
  }
  _, _, findings = runRuleFindingsSnapshotFile(
    t,
    unicornPreventAbbreviationsRuleName,
    "idx.ts",
    "export {};\n",
    json.RawMessage(`{"checkFilenames":false}`),
  )
  if len(findings) != 0 {
    t.Fatalf("checkFilenames false should suppress filename findings: %+v", findings)
  }
}

func TestUnicornPreventAbbreviationsKeepsExportedJSDocAndJSXBindingsDiagnosticOnly(t *testing.T) {
  cases := []struct {
    name     string
    fileName string
    source   string
  }{
    {
      name:     "exported declaration",
      fileName: "main.ts",
      source:   "export const err = new Error();\n",
    },
    {
      name:     "JSDoc parameter",
      fileName: "main.ts",
      source:   "/** @param err supplied error */\nfunction log(err: Error): void {\n  console.error(err);\n}\nvoid log;\n",
    },
    {
      name:     "JSX tag",
      fileName: "main.tsx",
      source:   "const Btn = (): JSX.Element => <button />;\nconst view = <Btn />;\nvoid view;\n",
    },
    {
      name:     "merged exported declaration",
      fileName: "main.ts",
      source:   "interface Ctx {}\nexport namespace Ctx {}\nconst value: Ctx = {};\nvoid value;\n",
    },
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshotFile(
        t,
        unicornPreventAbbreviationsRuleName,
        testCase.fileName,
        testCase.source,
        nil,
      )
      if len(findings) != 1 || len(findings[0].Fix) != 0 || len(findings[0].Suggestions) != 0 {
        t.Fatalf("expected one diagnostic-only binding, got %+v", findings)
      }
    })
  }
}

func TestUnicornPreventAbbreviationsRenamesTypePredicateReferences(t *testing.T) {
  source := "function isString(val: unknown): val is string {\n  return typeof val === \"string\";\n}\nvoid isString;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function isString(value: unknown): value is string {\n  return typeof value === \"string\";\n}\nvoid isString;\n",
  )
}

func TestUnicornPreventAbbreviationsRejectsMalformedOptions(t *testing.T) {
  invalid := []string{
    `[]`,
    `null`,
    `{"unknown":true}`,
    `{"checkVariables":null}`,
    `{"checkShorthandImports":"external"}`,
    `{"replacements":{"err":true}}`,
    `{"allowList":{"err":"yes"}}`,
    `{"ignore":["("]}`,
  }
  rule := unicornPreventAbbreviations{}
  for _, options := range invalid {
    if err := rule.ValidateOptions(json.RawMessage(options)); err == nil {
      t.Fatalf("expected options to fail validation: %s", options)
    }
  }
}

func TestCommandFixUnicornPreventAbbreviationsReparsesAndIsIdempotent(t *testing.T) {
  root := seedLintProject(t, "const idx = 0;\nconsole.log({ idx });\n")
  seedLintRules(t, root, map[string]string{unicornPreventAbbreviationsRuleName: "error"})
  for pass := 1; pass <= 2; pass++ {
    code, stdout, stderr := captureCommandOutput(t, func() int {
      return run([]string{"fix", "--cwd", root, "--plugins-json", lintManifest(t)})
    })
    if code != 0 || stdout != "" || stderr != "" {
      t.Fatalf("fix pass %d mismatch: code=%d stdout=%q stderr=%q", pass, code, stdout, stderr)
    }
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  want := "const index = 0;\nconsole.log({ idx: index });\n"
  if string(got) != want {
    t.Fatalf("fixed source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
