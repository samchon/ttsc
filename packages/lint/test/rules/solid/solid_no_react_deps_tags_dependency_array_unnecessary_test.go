package linthost

import (
  "strings"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestSolidNoReactDepsTagsDependencyArrayUnnecessary verifies
// `solid/no-react-deps` tags its findings Unnecessary over exactly the dead
// array, and that its near-miss sibling stays untagged.
//
// Unnecessary claims that deleting the reported range is the resolution, so it
// is only sound when the range is the dead text and nothing wider — the editor
// fades whatever the finding covers. The tag is read once per rule, which is
// why `solid/no-react-specific-props` cannot carry it: its `key` arm is a
// deletion, but its `className` and `htmlFor` arms are renames, and greying a
// prop that only needs renaming would tell the author to delete a live
// attribute.
//
//  1. Report a `createEffect` dependency array and assert one Unnecessary tag.
//  2. Assert the tagged range is the array literal alone, not the whole call.
//  3. Prove aliased and namespace Solid imports retain the same classification.
//  4. Keep a same-named local helper and a similarly named custom module
//     silent, so only proven Solid calls inherit the tag.
//  5. Assert the negative twin `solid/no-react-specific-props` reports both
//     `className` and `key` with no tags at all.
func TestSolidNoReactDepsTagsDependencyArrayUnnecessary(t *testing.T) {
  source := "import { createEffect } from \"solid-js\";\n\ncreateEffect(() => {}, [first, second]);\n"
  _, _, findings := runRuleFindingsSnapshot(t, "solid/no-react-deps", source, nil)
  if len(findings) != 1 {
    t.Fatalf("findings = %d, want 1 (%+v)", len(findings), findings)
  }
  finding := findings[0]
  if len(finding.Tags) != 1 || finding.Tags[0] != publicrule.DiagnosticTagUnnecessary {
    t.Fatalf("tags = %v, want [Unnecessary]", finding.Tags)
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
      len(importedFindings[0].Tags) != 1 ||
      importedFindings[0].Tags[0] != publicrule.DiagnosticTagUnnecessary {
      t.Fatalf("imported Solid findings = %+v", importedFindings)
    }
  }

  for _, unrelated := range []string{
    "import { createSignal } from \"solid-js\";\n\nfunction createEffect(run: () => void, deps: unknown[]) { run(); }\ncreateEffect(() => {}, [first]);\n",
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
