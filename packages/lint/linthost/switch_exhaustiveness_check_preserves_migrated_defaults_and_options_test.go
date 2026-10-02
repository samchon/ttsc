package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestSwitchExhaustivenessCheckPreservesMigratedDefaultsAndOptions verifies
// switch-exhaustiveness-check keeps its default and non-default option behavior.
//
// Scalar defaults and the four simultaneous non-default policies must report the
// original missing branches while exhaustive, default-covered and custom-comment
// controls stay silent.
//
//  1. Run two original consumer sources with default options and with the
//     simultaneous option tuple, replacing the configuration between runs.
//  2. Collect the findings and rendered code frames.
//  3. Assert the five and three errors at their lines, the missing-case messages and
//     that clean controls have no code frames.
//
// @evidence contracts/testing.md#behavioral-verification Scalar switch defaults and all four simultaneous non-default policies must report the original missing branches while exhaustive, default-covered and custom-comment controls remain silent after configuration replacement.
// @evidence contracts/testing.md#independent-expectations The two original consumer sources independently prescribe five errors at lines 3/6/9/14/17 and three at 6/9/15, exact missing-case message populations, visible violation codeframes and absent clean-control codeframes; expectations are not derived from compiler output.
// @evidence contracts/testing.md#distinguishing-cases Defaults cover incomplete unions with and without default, singleton, unique symbols and undefined versus an exhaustive switch; the simultaneous option tuple covers redundant default, open string, custom whitespace comment, rejected old comment and union covered by default.
// @evidence contracts/testing.md#execution-ownership TestSwitchExhaustivenessCheckPreservesMigratedDefaultsAndOptions replaces source and lint configuration in one real NodeNext fixture and executes two in-process check commands using the real Program/Checker and explicit lint manifest in the shared Go unit batch. Native package discovery, plugin build/cache and CLI transport remain owned by the shared E2E survivor.
func TestSwitchExhaustivenessCheckPreservesMigratedDefaultsAndOptions(t *testing.T) {
  root := seedLintProject(t, `type Choice = "alpha" | "beta";
declare const withDefault: Choice;
switch (withDefault) { case "alpha": break; default: break; }

declare const withoutDefault: Choice;
switch (withoutDefault) { case "alpha": break; }

declare const singleton: "only";
switch (singleton) {}

declare const first: unique symbol;
declare const second: unique symbol;
declare const symbolValue: typeof first | typeof second;
switch (symbolValue) { case first: break; }

declare const maybeText: string | undefined;
switch (maybeText) { case "known": break; }

declare const complete: Choice;
switch (complete) { case "alpha": break; case "beta": break; default: break; }
`)
  writeFile(t, filepath.Join(root, "package.json"), `{"devDependencies":{"@ttsc/lint":"*"}}`)
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","strict":true,"noEmit":true,"rootDir":"src"},"include":["src"]}`)
  cases := []struct {
    name, source string
    setting any
    lines []int
    messages map[string]int
    visible, clean []string
  }{
    {
      name: "scalar defaults",
      source: `type Choice = "alpha" | "beta";
declare const withDefault: Choice;
switch (withDefault) { case "alpha": break; default: break; }

declare const withoutDefault: Choice;
switch (withoutDefault) { case "alpha": break; }

declare const singleton: "only";
switch (singleton) {}

declare const first: unique symbol;
declare const second: unique symbol;
declare const symbolValue: typeof first | typeof second;
switch (symbolValue) { case first: break; }

declare const maybeText: string | undefined;
switch (maybeText) { case "known": break; }

declare const complete: Choice;
switch (complete) { case "alpha": break; case "beta": break; default: break; }
`,
      setting: "error",
      lines: []int{3, 6, 9, 14, 17},
      messages: map[string]int{`Cases not matched: "beta"`: 2, `Cases not matched: "only"`: 1, "Cases not matched: typeof second": 1, "Cases not matched: undefined": 1},
      visible: []string{"switch (withDefault)", "switch (withoutDefault)", "switch (singleton)", "switch (symbolValue)", "switch (maybeText)"},
      clean: []string{"switch (complete)"},
    },
    {
      name: "all non-default options",
      source: `type Choice = "alpha" | "beta";
declare const hiddenByDefault: Choice;
switch (hiddenByDefault) { case "alpha": break; default: break; }

declare const redundantDefault: Choice;
switch (redundantDefault) { case "alpha": break; case "beta": break; default: break; }

declare const openWithoutDefault: string;
switch (openWithoutDefault) { case "known": break; }

declare const customComment: string;
switch (customComment) { case "known": break; /* skip   default */ }

declare const oldDefaultComment: string;
switch (oldDefaultComment) { case "known": break; /* no default */ }
`,
      setting: []any{"error", map[string]any{
        "allowDefaultCaseForExhaustiveSwitch": false,
        "considerDefaultExhaustiveForUnions": true,
        "defaultCaseCommentPattern": `^skip\s+default$`,
        "requireDefaultForNonUnion": true,
      }},
      lines: []int{6, 9, 15},
      messages: map[string]int{"Cases not matched: default": 2, "default case is unnecessary": 1},
      visible: []string{"switch (redundantDefault)", "switch (openWithoutDefault)", "switch (oldDefaultComment)"},
      clean: []string{"switch (hiddenByDefault)", "switch (customComment)"},
    },
  }
  for _, test := range cases {
    writeFile(t, filepath.Join(root, "src", "main.ts"), test.source)
    seedLintConfig(t, root, map[string]any{"rules": map[string]any{switchExhaustivenessCheckRuleName: test.setting}})
    code, stdout, stderr := captureCommandOutput(t, func() int {
      return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
    })
    if stdout != "" { t.Fatalf("%s wrote stdout: %q", test.name, stdout) }
    assertSwitchExhaustivenessCheckResultForTest(t, code, stderr, len(test.lines), test.messages)
    assertTypedRuleRenderedErrors(t, switchExhaustivenessCheckRuleName, stderr, test.lines...)
    rendered := noMisusedPromisesANSI.ReplaceAllString(stderr, "")
    for _, text := range test.visible {
      if !strings.Contains(rendered, text) { t.Fatalf("%s omitted violation codeframe %q: %s", test.name, text, rendered) }
    }
    for _, text := range test.clean {
      if strings.Contains(rendered, text) { t.Fatalf("%s reported clean control %q: %s", test.name, text, rendered) }
    }
  }
}
