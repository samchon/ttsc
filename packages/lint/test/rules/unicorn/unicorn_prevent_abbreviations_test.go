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
  source := "// expect: unicorn/prevent-abbreviations error\nconst errCb = (error: Error): void => {\n  console.error(error);\n};\n\nerrCb(new Error(\"fixture\"));\n"
  expected := parseRuleExpectations(t, source)
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreventAbbreviationsRuleName, source, nil)
  if len(findings) == 0 {
    t.Fatalf("unicorn/prevent-abbreviations.ts: want %v, got no findings", expected)
  }
  actual := normalizeRuleFindings(findings[0].File, findings)
  if len(actual) != len(expected) {
    t.Fatalf("unicorn/prevent-abbreviations.ts: want %v, got %v", expected, actual)
  }
  for index := range expected {
    if actual[index] != expected[index] {
      t.Fatalf("unicorn/prevent-abbreviations.ts[%d]: want %+v, got %+v", index, expected[index], actual[index])
    }
  }
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

func TestUnicornPreventAbbreviationsDoesNotTreatDestructuringPropertyKeysAsCollisions(t *testing.T) {
  source := "function render(err: string, source: { error: string }): string {\n  const { error: value } = source;\n  return err + value;\n}\nvoid render;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function render(error: string, source: { error: string }): string {\n  const { error: value } = source;\n  return error + value;\n}\nvoid render;\n",
  )
}

func TestUnicornPreventAbbreviationsAvoidsCompilerProvidedGlobalBindings(t *testing.T) {
  source := "class Err {}\nvoid Err;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "class Error_ {}\nvoid Error_;\n",
  )
}

func TestUnicornPreventAbbreviationsRenamesClassInnerAndOuterReferencesTogether(t *testing.T) {
  source := "class err {\n  static create(): err {\n    return new err();\n  }\n}\nvoid err;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "class error {\n  static create(): error {\n    return new error();\n  }\n}\nvoid error;\n",
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

func TestUnicornPreventAbbreviationsUsesFunctionScopeForDestructuredVarCollisions(t *testing.T) {
  source := "function read(source: Record<string, number>): void {\n  if (source.first) {\n    var { first: idx } = source;\n    console.log(idx);\n  }\n  if (source.second) {\n    var { second: i } = source;\n    console.log(i);\n  }\n}\nvoid read;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function read(source: Record<string, number>): void {\n  if (source.first) {\n    var { first: index } = source;\n    console.log(index);\n  }\n  if (source.second) {\n    var { second: index_ } = source;\n    console.log(index_);\n  }\n}\nvoid read;\n",
  )
}

func TestUnicornPreventAbbreviationsAvoidsCatchParameterBodyRedeclarations(t *testing.T) {
  source := "try {\n  throw 0;\n} catch (idx) {\n  const i = 1;\n  console.log(i);\n}\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "try {\n  throw 0;\n} catch (index) {\n  const index_ = 1;\n  console.log(index_);\n}\n",
  )
}

func TestUnicornPreventAbbreviationsAvoidsVarLexicalEarlyErrorCollisions(t *testing.T) {
  source := "function check(values: number[]): void {\n  {\n    const cur = 0;\n    if (cur === 0) {\n      var curr = 1;\n      console.log(curr);\n    }\n  }\n  for (const idx of values) {\n    if (values.length > 0) {\n      var i = 1;\n      console.log(i);\n    }\n  }\n  try {\n    throw { value: 0 };\n  } catch ({ value: fn }) {\n    if (values.length > 0) {\n      var func = 1;\n      console.log(func);\n    }\n  }\n}\nvoid check;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function check(values: number[]): void {\n  {\n    const current = 0;\n    if (current === 0) {\n      var current_ = 1;\n      console.log(current_);\n    }\n  }\n  for (const index of values) {\n    if (values.length > 0) {\n      var index_ = 1;\n      console.log(index_);\n    }\n  }\n  try {\n    throw { value: 0 };\n  } catch ({ value: function_ }) {\n    if (values.length > 0) {\n      var function__ = 1;\n      console.log(function__);\n    }\n  }\n}\nvoid check;\n",
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

func TestUnicornPreventAbbreviationsAllowsGeneratedNamesToShadowWithoutCapture(t *testing.T) {
  source := "const errCb = \"outer\";\n{\n  const errCb = \"inner\";\n  console.log(errCb);\n}\nconsole.log(errCb);\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const errorCallback = \"outer\";\n{\n  const errorCallback = \"inner\";\n  console.log(errorCallback);\n}\nconsole.log(errorCallback);\n",
  )
}

func TestUnicornPreventAbbreviationsKeepsIndependentLoopAndSwitchScopesIndependent(t *testing.T) {
  source := "function log(errors: string[], first: number, second: number): void {\n  for (const err of errors) console.log(err);\n  for (const err of errors) console.log(err);\n  switch (first) {\n    case 0:\n      const err = \"first\";\n      console.log(err);\n      break;\n  }\n  switch (second) {\n    case 0:\n      const err = \"second\";\n      console.log(err);\n      break;\n  }\n}\nvoid log;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function log(errors: string[], first: number, second: number): void {\n  for (const error of errors) console.log(error);\n  for (const error of errors) console.log(error);\n  switch (first) {\n    case 0:\n      const error = \"first\";\n      console.log(error);\n      break;\n  }\n  switch (second) {\n    case 0:\n      const error = \"second\";\n      console.log(error);\n      break;\n  }\n}\nvoid log;\n",
  )
}

func TestUnicornPreventAbbreviationsIgnoresNonLexicalJSXAndTupleNamesForCollisions(t *testing.T) {
  source := "type Pair = [error: string];\nconst btn = document.createElement(\"button\");\nconst err = new Error();\nconst view = <button />;\nconsole.log(btn, err, view);\n"
  assertFixSnapshotFile(
    t,
    unicornPreventAbbreviationsRuleName,
    "main.tsx",
    source,
    "type Pair = [error: string];\nconst button = document.createElement(\"button\");\nconst error = new Error();\nconst view = <button />;\nconsole.log(button, error, view);\n",
  )
}

func TestUnicornPreventAbbreviationsSeparatesGeneratedNamesAtCrossScopeReads(t *testing.T) {
  source := "const errCb = \"outer\";\n{\n  console.log(errCb);\n  const errorCb = \"inner\";\n  console.log(errorCb);\n}\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const errorCallback = \"outer\";\n{\n  console.log(errorCallback);\n  const errorCallback_ = \"inner\";\n  console.log(errorCallback_);\n}\n",
  )
}

func TestUnicornPreventAbbreviationsDoesNotCaptureOuterReadsWithUnusedInnerBindings(t *testing.T) {
  source := "const cur = 1;\n{\n  const curr = 2;\n  {\n    console.log(cur);\n  }\n}\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const current = 1;\n{\n  const current_ = 2;\n  {\n    console.log(current);\n  }\n}\n",
  )
}

func TestUnicornPreventAbbreviationsExpandsCompoundAndCasedNamesButSkipsConstants(t *testing.T) {
  source := "class BtnFactory {}\nconst errCb = (): void => {};\nconst err文 = 1;\nconst errʰ = 2;\nconst ENV = \"test\";\nvoid [BtnFactory, errCb, err文, errʰ, ENV];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "class ButtonFactory {}\nconst errorCallback = (): void => {};\nconst error文 = 1;\nconst errorʰ = 2;\nconst ENV = \"test\";\nvoid [ButtonFactory, errorCallback, error文, errorʰ, ENV];\n",
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
    finding.Suggestions[1].Title != "Rename to `event_`." || len(finding.Suggestions[1].Edits) != 2 {
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

func TestUnicornPreventAbbreviationsHonorsNegativeReplacementAndAllowListPatches(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const e = new Error();\nvoid e;\n",
    `{"replacements":{"e":{"event":false}}}`,
    "const error = new Error();\nvoid error;\n",
  )

  source := "const defaultProps = {};\nvoid defaultProps;\n"
  assertRuleSkipsSource(t, unicornPreventAbbreviationsRuleName, source)
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"allowList":{"defaultProps":false}}`,
    "const defaultProperties = {};\nvoid defaultProperties;\n",
  )
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"extendDefaultAllowList":false}`,
    "const defaultProperties = {};\nvoid defaultProperties;\n",
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

func TestUnicornPreventAbbreviationsSupportsCanonicalEmptyReplacementSpelling(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nvoid err;\n",
    `{"extendDefaultReplacements":false,"replacements":{"err":{"":true}}}`,
    "const _ = new Error();\nvoid _;\n",
  )
}

func TestUnicornPreventAbbreviationsUsesStrictBindingGrammarForCustomReplacements(t *testing.T) {
  for _, name := range []string{
    "arguments", "await", "break", "case", "catch", "class", "const", "continue",
    "debugger", "default", "delete", "do", "else", "enum", "eval", "export",
    "extends", "false", "finally", "for", "function", "if", "implements", "import",
    "in", "instanceof", "interface", "let", "new", "null", "package", "private",
    "protected", "public", "return", "static", "super", "switch", "this", "throw",
    "true", "try", "typeof", "var", "void", "while", "with", "yield",
  } {
    if unicornPreventAbbreviationsValidIdentifier(name) {
      t.Fatalf("strict binding reserved word %q must not be used directly", name)
    }
  }
  for _, name := range []string{
    "any", "as", "boolean", "constructor", "declare", "from", "get", "module",
    "number", "of", "require", "set", "string", "symbol", "type",
  } {
    if !unicornPreventAbbreviationsValidIdentifier(name) {
      t.Fatalf("contextual TypeScript keyword %q is a valid binding name", name)
    }
  }

  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "export {};\nconst err = new Error();\nvoid err;\n",
    `{"extendDefaultReplacements":false,"replacements":{"err":{"eval":true}}}`,
    "export {};\nconst eval_ = new Error();\nvoid eval_;\n",
  )
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nvoid err;\n",
    `{"extendDefaultReplacements":false,"replacements":{"err":{"type":true}}}`,
    "const type = new Error();\nvoid type;\n",
  )
}

func TestUnicornPreventAbbreviationsPreservesCanonicalUpperFirstForUncasedPrefixes(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const $err = new Error();\nvoid $err;\n",
    `{"extendDefaultReplacements":false,"replacements":{"$err":{"failure":true}}}`,
    "const Failure = new Error();\nvoid Failure;\n",
  )
}

func TestUnicornPreventAbbreviationsPreservesAstralFirstRuneCasing(t *testing.T) {
  const astralUpper = "\U00010400Name"
  const astralLower = "\U00010428Name"
  if actual := lowerUnicornPreventAbbreviationsFirst(astralUpper); actual != astralUpper {
    t.Fatalf("lower-first must preserve an astral first rune: %q", actual)
  }
  if actual := upperUnicornPreventAbbreviationsFirst(astralLower); actual != astralLower {
    t.Fatalf("upper-first must preserve an astral first rune: %q", actual)
  }
  if !unicornPreventAbbreviationsStartsUpper(astralLower) {
    t.Fatal("an astral first rune must match JavaScript's upper-first classification")
  }
}

func TestUnicornPreventAbbreviationsUsesJavaScriptFullUnicodeCasing(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "const ß = 1;\nvoid ß;\n",
    `{"extendDefaultReplacements":false,"replacements":{"ß":{"sharpSValue":true}}}`,
    "const sharpSValue = 1;\nvoid sharpSValue;\n",
  )
  if actual := upperUnicornPreventAbbreviationsFirst("ßeta"); actual != "SSeta" {
    t.Fatalf("upper-first must use full Unicode casing: %q", actual)
  }
  if actual := lowerUnicornPreventAbbreviationsFirst("İtem"); actual != "i\u0307tem" {
    t.Fatalf("lower-first must use full Unicode casing: %q", actual)
  }
}

func TestUnicornPreventAbbreviationsAppliesInternalImportDefaultsAndPreservesImportedNames(t *testing.T) {
  source := "import err from \"./local-default\";\nimport * as ctx from \"external-ns\";\nimport doc from \"./node_modules/external-default\";\nimport { prop } from \"./local-named\";\nimport { ref } from \"external-named\";\nvoid [err, ctx, doc, prop, ref];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "import error from \"./local-default\";\nimport * as ctx from \"external-ns\";\nimport doc from \"./node_modules/external-default\";\nimport { prop as property } from \"./local-named\";\nimport { ref } from \"external-named\";\nvoid [error, ctx, doc, property, ref];\n",
  )
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    json.RawMessage(`{"checkDefaultAndNamespaceImports":true,"checkShorthandImports":true}`),
  )
  if len(findings) != 5 {
    t.Fatalf("expected all five imports when enabled, got %d (%+v)", len(findings), findings)
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

func TestUnicornPreventAbbreviationsPreservesExplicitImportedAliasNames(t *testing.T) {
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    "import { err as err } from \"external\";\nvoid err;\n",
    "import { err as error } from \"external\";\nvoid error;\n",
  )
}

func TestUnicornPreventAbbreviationsDoesNotApplyRequireModeToQualifiedImportEquals(t *testing.T) {
  source := "namespace Source {\n  export const err = new Error();\n}\nimport err = Source.err;\nvoid err;\n"
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkDefaultAndNamespaceImports":false}`,
    "namespace Source {\n  export const err = new Error();\n}\nimport error = Source.err;\nvoid error;\n",
  )
}

func TestUnicornPreventAbbreviationsAppliesImportModeToExternalImportEquals(t *testing.T) {
  source := "import err = require(\"./local\");\nvoid err;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "import error = require(\"./local\");\nvoid error;\n",
  )
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkDefaultAndNamespaceImports":false}`,
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

func TestUnicornPreventAbbreviationsRecognizesOnlyCanonicalStaticRequireCalls(t *testing.T) {
  cases := []struct {
    name        string
    initializer string
  }{
    {name: "extra argument", initializer: `require("./local", {})`},
    {name: "optional call", initializer: `require?.("./local")`},
    {name: "template argument", initializer: "require(`./local`)"},
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      source := "declare function require(...values: unknown[]): unknown;\nconst err = " + testCase.initializer + ";\nvoid err;\n"
      assertFixSnapshotWithOptions(
        t,
        unicornPreventAbbreviationsRuleName,
        source,
        `{"checkDefaultAndNamespaceImports":false}`,
        "declare function require(...values: unknown[]): unknown;\nconst error = " + testCase.initializer + ";\nvoid error;\n",
      )
    })
  }

  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    "declare function require(...values: unknown[]): unknown;\nconst err = require(\"\");\nvoid err;\n",
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

func TestUnicornPreventAbbreviationsPreservesExportedAliasNames(t *testing.T) {
  source := "const err = new Error();\nexport { err };\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "const error = new Error();\nexport { error as err };\n",
  )
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nexport { err as err };\n",
    "const error = new Error();\nexport { error as err };\n",
  )
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    "const err = new Error();\nexport { err as publicError };\n",
    "const error = new Error();\nexport { error as publicError };\n",
  )
}

func TestUnicornPreventAbbreviationsRenamesDefaultExportLocalNames(t *testing.T) {
  source := "export default function err(depth: number): void {\n  if (depth > 0) err(depth - 1);\n}\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "export default function error(depth: number): void {\n  if (depth > 0) error(depth - 1);\n}\n",
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

func TestUnicornPreventAbbreviationsDoesNotReportDestructuringAssignmentKeysAsProperties(t *testing.T) {
  source := "const source = {} as Record<string, number>;\nlet local = 0;\n({ err: local } = source);\nvoid local;\n"
  assertRuleSkipsSourceWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    `{"checkVariables":false,"checkProperties":true}`,
  )
}

func TestUnicornPreventAbbreviationsAllowsReservedWordsInPropertySuggestions(t *testing.T) {
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    "({e: 1});\n",
    json.RawMessage(`{
      "checkVariables": false,
      "checkProperties": true,
      "extendDefaultReplacements": false,
      "replacements": {"e": {"class": true, "function": true}}
    }`),
  )
  if len(findings) != 1 || len(findings[0].Suggestions) != 2 ||
    findings[0].Suggestions[0].Title != "Rename to `class`." ||
    findings[0].Suggestions[1].Title != "Rename to `function`." {
    t.Fatalf("unexpected reserved-word property suggestions: %+v", findings)
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
  if extension := unicornPreventAbbreviationsFilenameExtension(".err"); extension != "" {
    t.Fatalf("leading-dot basename must not be treated as an extension: %q", extension)
  }

  if unicornPreventAbbreviationsIsVirtualFilename("foo<err>.ts") {
    t.Fatal("a physical filename containing angle brackets must not be treated as virtual")
  }

  for _, filename := range []string{"<input>", "<text>"} {
    if !unicornPreventAbbreviationsIsVirtualFilename(filename) {
      t.Fatalf("virtual filename %q must be recognized", filename)
    }
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
    {
      name:     "parameter property",
      fileName: "main.ts",
      source:   "class Store {\n  constructor(public err: Error) {}\n}\nvoid Store;\n",
    },
    {
      name:     "JSDoc function type parameter",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\ntype Middleware = (ctx: object) => void;\n",
    },
    {
      name:     "JSDoc destructured parameter",
      fileName: "main.ts",
      source:   "/** @param options supplied options */\nfunction log({ cause: err }: { cause: Error }): void {\n  console.error(err);\n}\nvoid log;\n",
    },
    {
      name:     "exported destructured declaration",
      fileName: "main.ts",
      source:   "declare const source: { cause: Error };\nexport const { cause: err } = source;\n",
    },
    {
      name:     "nested ambient declaration",
      fileName: "main.ts",
      source:   "declare namespace API {\n  const err: Error;\n}\n",
    },
    {
      name:     "JSDoc parameter through parentheses",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\nconst middleware = ((ctx: object): object => ctx);\n",
    },
    {
      name:     "JSDoc parameter through as assertion",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\nconst middleware = (((ctx: object): object => ctx) as ((value: object) => object));\n",
    },
    {
      name:     "JSDoc parameter through satisfies",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\nconst middleware = (((ctx: object): object => ctx) satisfies ((value: object) => object));\n",
    },
    {
      name:     "JSDoc parameter through non-null assertion",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\nconst middleware = (((ctx: object): object => ctx)!);\n",
    },
    {
      name:     "JSDoc parameter through angle-bracket assertion",
      fileName: "main.ts",
      source:   "/** @param ctx middleware context */\nconst middleware = <((value: object) => object)>((ctx: object): object => ctx);\n",
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

func TestUnicornPreventAbbreviationsIgnoresDetachedJSDocWhenDecidingFixSafety(t *testing.T) {
  cases := []struct {
    name   string
    source string
    want   string
  }{
    {
      name:   "blank line",
      source: "/** @param err historical text */\n\nfunction log(err: Error): void {\n  console.error(err);\n}\nvoid log;\n",
      want:   "/** @param err historical text */\n\nfunction log(error: Error): void {\n  console.error(error);\n}\nvoid log;\n",
    },
    {
      name:   "Unicode blank line",
      source: "/** @param err historical text */\u2028\u2028function log(err: Error): void {\n  console.error(err);\n}\nvoid log;\n",
      want:   "/** @param err historical text */\u2028\u2028function log(error: Error): void {\n  console.error(error);\n}\nvoid log;\n",
    },
    {
      name:   "ordinary intervening comment",
      source: "/** @param err historical text */\n/* ordinary */\nfunction log(err: Error): void {\n  console.error(err);\n}\nvoid log;\n",
      want:   "/** @param err historical text */\n/* ordinary */\nfunction log(error: Error): void {\n  console.error(error);\n}\nvoid log;\n",
    },
    {
      name:   "longer tag name",
      source: "/** @parameter err historical text */\nfunction log(err: Error): void {\n  console.error(err);\n}\nvoid log;\n",
      want:   "/** @parameter err historical text */\nfunction log(error: Error): void {\n  console.error(error);\n}\nvoid log;\n",
    },
  }
  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      assertFixSnapshot(t, unicornPreventAbbreviationsRuleName, testCase.source, testCase.want)
    })
  }
}

func TestUnicornPreventAbbreviationsKeepsTypeScriptSignatureScopesIndependent(t *testing.T) {
  source := "type First = (ctx: object) => void;\ntype Second = new (ctx: object) => object;\ninterface Third {\n  (ctx: object): void;\n  method(ctx: object): void;\n}\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "type First = (context: object) => void;\ntype Second = new (context: object) => object;\ninterface Third {\n  (context: object): void;\n  method(context: object): void;\n}\n",
  )
}

func TestUnicornPreventAbbreviationsKeepsMappedAndConditionalTypeScopesIndependent(t *testing.T) {
  source := "type Pair<T, U> = [\n  T extends infer Ctx ? Ctx : never,\n  U extends infer Ctx ? Ctx : never,\n  { [Ctx in keyof T]: T[Ctx] },\n  { [Ctx in keyof U]: U[Ctx] },\n];\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "type Pair<T, U> = [\n  T extends infer Context ? Context : never,\n  U extends infer Context ? Context : never,\n  { [Context in keyof T]: T[Context] },\n  { [Context in keyof U]: U[Context] },\n];\n",
  )
}

func TestUnicornPreventAbbreviationsRenamesMergedTypeAndValueReferencesTogether(t *testing.T) {
  source := "interface Prop {\n  id: number;\n}\nconst Prop: Prop = { id: 1 };\nexport default Prop;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "interface Property {\n  id: number;\n}\nconst Property: Property = { id: 1 };\nexport default Property;\n",
  )
}

func TestUnicornPreventAbbreviationsRenamesTypePredicateReferences(t *testing.T) {
  source := "function isString(val: unknown): val is string {\n  return typeof val === \"string\";\n}\ntype AssertString = (val: unknown) => asserts val is string;\nvoid isString;\n"
  assertFixSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    "function isString(value: unknown): value is string {\n  return typeof value === \"string\";\n}\ntype AssertString = (value: unknown) => asserts value is string;\nvoid isString;\n",
  )
}

func TestUnicornPreventAbbreviationsRejectsMalformedOptions(t *testing.T) {
  invalid := []string{
    `[]`,
    `null`,
    `{"unknown":true}`,
    `{"CheckVariables":false}`,
    `{"checkVariables":null}`,
    `{"checkShorthandImports":"external"}`,
    `{"replacements":{"err":true}}`,
    `{"replacements":{"err":null}}`,
    `{"allowList":{"err":"yes"}}`,
    `{"ignore":["("]}`,
    `{"ignore":["^skip","^skip"]}`,
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

func TestCommandFixUnicornPreventAbbreviationsKeepsCrossFileMergesDiagnosticOnly(t *testing.T) {
  const mainSource = "interface Ctx { first: string }\n"
  const otherSource = "interface Ctx { second: string }\n"
  root := seedLintProject(t, mainSource)
  otherPath := filepath.Join(root, "src", "other.ts")
  writeFile(t, otherPath, otherSource)
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts", "src/other.ts"]
}
`)
  seedLintRules(t, root, map[string]string{unicornPreventAbbreviationsRuleName: "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"fix", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "["+unicornPreventAbbreviationsRuleName+"]") {
    t.Fatalf("cross-file fix mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertFileText(t, filepath.Join(root, "src", "main.ts"), mainSource)
  assertFileText(t, otherPath, otherSource)
}
