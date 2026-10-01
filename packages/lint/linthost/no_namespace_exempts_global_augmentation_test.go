package linthost

import (
  "strings"
  "testing"
)

// TestNoNamespaceExemptsGlobalAugmentation verifies `typescript/no-namespace`
// leaves `declare global` alone while still reporting a real namespace.
//
// The rule's advice is "use ES module syntax instead", and a global
// augmentation is the one declaration that cannot take it: augmenting a global
// interface has no ES-module equivalent. `declare global` is spelled with the
// `global` keyword rather than `namespace` or `module`, which is the same
// discriminator upstream uses to exempt it. Reported externally as #797.
//
//  1. Augment a global interface and declare an ordinary namespace in one file.
//  2. Run the rule.
//  3. Assert only the namespace reports, and that ambient module declarations
//     stay exempt as before.
// @evidence contracts/testing.md#behavioral-verification Namespace syntax must report without flagging global augmentation or ambient quoted modules.
// @evidence contracts/testing.md#independent-expectations The authored namespace keyword and closing brace fix the complete finding span, rule and error severity; standalone global and ambient module fixtures require no findings.
// @evidence contracts/testing.md#distinguishing-cases An ordinary namespace is positive; declare global and declare module string syntax are independent clean controls.
// @evidence contracts/testing.md#execution-ownership TestNoNamespaceExemptsGlobalAugmentation invokes the registered rule through runRuleFindingsSnapshot and assertRuleSkipsSource in one shared Go unit process; all original inputs/assertions remain and no child compiler, native build or installed consumer runs.
func TestNoNamespaceExemptsGlobalAugmentation(t *testing.T) {
  source := "declare global {\n  interface Window {\n    myField: number;\n  }\n}\nnamespace Ns {\n  export const z = 1;\n}\nexport {};\n"
  _, _, findings := runRuleFindingsSnapshot(t, "typescript/no-namespace", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1 (%+v)", len(findings), findings)
  }
  if got := findings[0].Pos; got < len("declare global {\n  interface Window {\n    myField: number;\n  }\n}\n") {
    t.Fatalf("finding at %d covers the global augmentation, want the namespace below it", got)
  }

  start := strings.Index(source, "namespace Ns")
  end := strings.Index(source, "\nexport {}")
  if findings[0].Rule != "typescript/no-namespace" || findings[0].Severity != SeverityError || findings[0].Pos != start || findings[0].End != end { t.Fatalf("namespace finding = %+v, want exact %d..%d", findings[0], start, end) }

  assertRuleSkipsSource(
    t,
    "typescript/no-namespace",
    "declare global {\n  interface Window {\n    myField: number;\n  }\n}\nexport {};\n",
  )
  assertRuleSkipsSource(
    t,
    "typescript/no-namespace",
    "declare module \"fs\" {\n  export function extra(): void;\n}\nexport {};\n",
  )
}
