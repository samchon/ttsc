package linthost

import (
  "strings"
  "testing"
)

// TestSolidNoReactDepsTagsDependencyArrayUnnecessary verifies
// `solid/no-react-deps` reports exactly the dependency array without promising
// its evaluation can be safely deleted. The historical entry name is retained.
//
// The callback does not consume the array value, but array evaluation can call
// functions, read getters or throw. The rule-wide Unnecessary classification
// cannot establish safe deletion for all of those reported expressions.
//
//  1. Report a `createEffect` dependency array and assert no tags.
//  2. Assert the reported range is the array literal alone, not the whole call.
//  3. Prove aliased and namespace Solid imports retain the same classification.
//  4. Keep a same-named local helper, shadowed named and namespace imports, and
//     a similarly named custom module silent, so only the exact Solid binding
//     inherits the tag.
//  5. Assert the negative twin `solid/no-react-specific-props` reports both
//     `className` and `key` with no tags at all.
//
// @evidence contracts/testing.md#behavioral-verification The actual engine reports the exact dependency-array span with no tags. Calls, getter reads, spread calls and throwing expressions retain that untagged range; React-specific prop reports also remain untagged.
// @evidence contracts/testing.md#independent-expectations Array evaluation can have effects even when its resulting value is unused. The public safe-to-delete tag contract therefore requires no Unnecessary claim without an effect proof. Independent literal array markers determine the expected ranges; the expressions are parsed, not executed here.
// @evidence contracts/testing.md#distinguishing-cases Named/aliased/namespace imports report; local, shadowed and similarly named custom APIs stay clean. Four effect-bearing array shapes expose the unsafe rule-wide deletion claim, while className/key reports have no tag.
// @evidence contracts/testing.md#execution-ownership TestSolidNoReactDepsTagsDependencyArrayUnnecessary owns the explicit variants below as one discoverable Go unit entry; its parsed-source engine calls, with an in-process checker when required, execute in the shared process without a Solid installation or native product host.
func TestSolidNoReactDepsTagsDependencyArrayUnnecessary(t *testing.T) {
  source := "import { createEffect } from \"solid-js\";\n\ncreateEffect(() => {}, [first, second]);\n"
  _, _, findings := runRuleFindingsSnapshot(t, "solid/no-react-deps", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1 (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if len(finding.Tags) != 0 {
    t.Fatalf("tags = %v, want none", finding.Tags)
  }
  marker := "[first, second]"
  start := strings.Index(source, marker)
  if finding.Pos != start || finding.End != start+len(marker) {
    t.Fatalf(
      "range = [%d,%d), want [%d,%d) covering %q",
      finding.Pos,
      finding.End,
      start,
      start+len(marker),
      marker,
    )
  }

  for _, imported := range []string{
    "import { createMemo as memo } from \"solid-js\";\n\nmemo(() => 1, [first]);\n",
    "import * as Solid from \"solid-js\";\n\nSolid.createEffect(() => {}, [first]);\n",
    "import * as Solid from \"solid-js/universal\";\n\nSolid.createEffect(() => {}, [first]);\n",
  } {
    _, _, importedFindings := runRuleFindingsSnapshot(t, "solid/no-react-deps", imported, nil)
    if len(importedFindings) != 1 ||
      len(importedFindings[0].Tags) != 0 {
      t.Fatalf("imported Solid findings = %+v", importedFindings)
    }
  }

  for _, array := range []string{
    "[recordEffect()]",
    "[getter.value]",
    "[...readValues()]",
    "[(() => { throw new Error(\"dependency\"); })()]",
  } {
    source := "import { createEffect } from \"solid-js\";\ncreateEffect(() => {}, " + array + ");\n"
    _, _, effectFindings := runRuleFindingsSnapshot(t, "solid/no-react-deps", source, nil)
    if len(effectFindings) != 1 || len(effectFindings[0].Tags) != 0 {
      t.Fatalf("effect-bearing array %q findings = %+v, want one untagged finding", array, effectFindings)
    }
    start := strings.Index(source, array)
    if effectFindings[0].Pos != start || effectFindings[0].End != start+len(array) {
      t.Fatalf("effect-bearing array %q range = [%d,%d), want [%d,%d)", array, effectFindings[0].Pos, effectFindings[0].End, start, start+len(array))
    }
  }

  for _, unrelated := range []string{
    "import { createSignal } from \"solid-js\";\n\nfunction createEffect(run: () => void, deps: unknown[]) { run(); }\ncreateEffect(() => {}, [first]);\n",
    "import { createEffect } from \"solid-js\";\n\nfunction run(createEffect: (callback: () => void, deps: unknown[]) => void) {\n  createEffect(() => {}, [first]);\n}\nconsole.log(run);\n",
    "import * as Solid from \"solid-js\";\n\nfunction run(Solid: { createEffect(callback: () => void, deps: unknown[]): void }) {\n  Solid.createEffect(() => {}, [first]);\n}\nconsole.log(run);\n",
    "import { createEffect } from \"solid-js-testing\";\n\ncreateEffect(() => {}, [first]);\n",
  } {
    assertRuleSkipsSource(t, "solid/no-react-deps", unrelated)
  }

  props := "import { createSignal } from \"solid-js\";\n\nexport const App = () => <div className=\"x\" key=\"k\" />;\n"
  _, _, propFindings := runRuleFindingsSnapshotFile(
    t,
    "solid/no-react-specific-props",
    "main.tsx",
    props,
    nil,
  )
  if len(propFindings) != 2 {
    t.Fatalf("no-react-specific-props findings = %d, want 2 (%+v)", len(propFindings), propFindings)
  }
  for index, propFinding := range propFindings {
    if len(propFinding.Tags) != 0 {
      t.Fatalf("no-react-specific-props finding %d tags = %v, want none", index, propFinding.Tags)
    }
  }
}
