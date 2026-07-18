package linthost

import (
  "path/filepath"
  "sort"
  "strconv"
  "testing"
)

// TestResidentWholeCorpusMatchesColdLoad verifies the ENTIRE built-in rule
// corpus reports identically after an incremental update and after a cold load.
//
// The sibling test proves the incremental mechanism with one synthetic rule.
// That is not enough to trust the resident daemon: the corpus is ~743 rules, and
// a rule that cached anything derived from the pre-edit Program — a node, a
// symbol, a per-file table — would keep answering from it after applyChange
// swapped the Program and rebuilt the checker. Such a rule would be correct in
// the one-shot path (fresh process every verb) and silently wrong only under
// residence, which is exactly the class of bug no existing test could catch.
// This runs every rule over the same source both ways and demands the same
// findings.
//
//  1. Enable every registered rule and lint a two-file project cold.
//  2. Edit one file on disk, applyChange only that file, and re-lint the warm
//     Program.
//  3. Assert the findings equal a cold load of the edited project, and that the
//     edit changed the findings at all (so the comparison cannot pass vacuously).
func TestResidentWholeCorpusMatchesColdLoad(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "skipLibCheck": true
  },
  "files": ["a.ts", "b.ts"]
}
`)
  // Deliberately varied source: several rule families must actually fire, or the
  // comparison would be between two empty sets and prove nothing.
  writeFile(t, filepath.Join(root, "a.ts"), `export const a = 1;
export function keep(value: string): string {
  return value;
}
`)
  const bBefore = `export var b = 2;
export function twice(n: number) {
  if (n == 2) {
    return n;
  }
  return n;
}
`
  writeFile(t, filepath.Join(root, "b.ts"), bBefore)

  every := AllRuleNames()
  if len(every) == 0 {
    t.Fatal("no rules registered; the corpus comparison would be vacuous")
  }
  newEngine := func() *Engine {
    rules := make(RuleConfig, len(every))
    for _, name := range every {
      rules[name] = SeverityWarn
    }
    engine := NewEngineWithResolver(InlineRuleResolver{Rules: rules})
    if err := engine.ConfigError(); err != nil {
      t.Fatalf("enabling the whole corpus failed config validation: %v", err)
    }
    engine.SetCurrentDirectory(root)
    return engine
  }

  load := func(label string) *program {
    t.Helper()
    engine := newEngine()
    prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
      forceNoEmit:      true,
      needsRuleChecker: engine.NeedsTypeChecker(),
    })
    if err != nil {
      t.Fatalf("%s loadProgram: %v", label, err)
    }
    if len(diags) != 0 {
      t.Fatalf("%s loadProgram diagnostics: %+v", label, diags)
    }
    return prog
  }

  warm := load("cold")
  defer warm.close()
  before := fingerprintFindings(warm.runLintCycle(newEngine()))
  if len(before) == 0 {
    t.Fatal("the corpus produced no findings on the seed source; the fixture cannot detect drift")
  }

  // Edit b.ts on disk: `var` becomes `const`, the loose `==` becomes `===`, and
  // a statement is added. a.ts is untouched and its AST must be reused.
  writeFile(t, filepath.Join(root, "b.ts"), `export const b = 2;
export function twice(n: number) {
  if (n === 2) {
    return n;
  }
  const doubled = n * 2;
  return doubled;
}
`)
  warm.applyChange(filepath.Join(root, "b.ts"))
  incremental := fingerprintFindings(warm.runLintCycle(newEngine()))

  cold := load("edited cold")
  defer cold.close()
  want := fingerprintFindings(cold.runLintCycle(newEngine()))

  if equalFingerprints(incremental, before) {
    t.Fatal("the edit did not change any finding; the comparison would pass even if applyChange did nothing")
  }
  if !equalFingerprints(incremental, want) {
    t.Fatalf(
      "incremental findings differ from a cold load of the same source\nincremental (%d):\n%s\ncold (%d):\n%s",
      len(incremental), joinLines(incremental), len(want), joinLines(want),
    )
  }
}

// fingerprintFindings renders findings into a sorted, comparable form. Order is
// not part of the contract — the file walk is parallel — so the fingerprint is
// sorted; rule, position and message are, because a drifted incremental result
// would differ in exactly those.
func fingerprintFindings(findings []*Finding) []string {
  out := make([]string, 0, len(findings))
  for _, finding := range findings {
    if finding == nil {
      continue
    }
    name := ""
    if finding.File != nil {
      name = filepath.Base(finding.File.FileName())
    }
    out = append(out, finding.Rule+"|"+name+"|"+
      strconv.Itoa(finding.Pos)+"|"+strconv.Itoa(finding.End)+"|"+finding.Message)
  }
  sort.Strings(out)
  return out
}

func equalFingerprints(a, b []string) bool {
  if len(a) != len(b) {
    return false
  }
  for i := range a {
    if a[i] != b[i] {
      return false
    }
  }
  return true
}

func joinLines(values []string) string {
  out := ""
  for _, value := range values {
    out += "  " + value + "\n"
  }
  return out
}
