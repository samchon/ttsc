package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatSortImportsHonorsCustomImportOrder verifies user-supplied
// `importOrder` regexes drive the group sequence.
//
// The fixture has three import classes — `@api/*`, plain third-party, and
// relative — in shuffled source order. With
// `importOrder: ["<THIRD_PARTY_MODULES>", "@api(.*)$", "^[./]"]` the
// expected output is third-party first, then `@api/*`, then relative,
// with one blank line between groups. This pins the trivago-compat
// option path through the engine.
//
//  1. Parse a source file with mixed import classes.
//  2. Apply the rule with a custom `importOrder` matching trivago's
//     workspace config (third-party, then `@api/*`, then relative).
//  3. Assert the rewritten file has the imports laid out per the spec.
func TestFormatSortImportsHonorsCustomImportOrder(t *testing.T) {
  root := t.TempDir()
  filePath := filepath.Join(root, "src", "main.ts")
  source := "import { reduce } from \"./local-b\";\n" +
    "import { request } from \"@api/http\";\n" +
    "import alpha from \"alpha\";\n" +
    "import { x } from \"./local-a\";\n" +
    "JSON.stringify({ reduce, request, alpha, x });\n"
  writeFile(t, filePath, source)
  file := parseTSFile(t, filePath, source)

  resolver := InlineRuleResolver{
    Rules: RuleConfig{"formatSortImports": SeverityError},
    Options: RuleOptionsMap{
      "formatSortImports": json.RawMessage(
        `{"importOrder":["<THIRD_PARTY_MODULES>","@api(.*)$","^[./]"]}`,
      ),
    },
  }
  // The block reorder + specifier sort cascade may need a second pass to
  // settle (block first, specifiers second). The Go-side test does a
  // single Run; the engine returns whatever fires this iteration. The
  // assertion below tolerates either resolution order.
  const maxPasses = 4
  converged := false
  for pass := 0; pass < maxPasses; pass++ {
    findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
    fixed, err := applyFindingFixes(root, findings)
    if err != nil {
      t.Fatalf("applyFindingFixes: %v", err)
    }
    if fixed == 0 {
      converged = true
      break
    }
    raw, err := os.ReadFile(filePath)
    if err != nil {
      t.Fatalf("ReadFile: %v", err)
    }
    file = parseTSFile(t, filePath, string(raw))
  }
  if !converged {
    // A non-converged exit means the rule kept rewriting on every pass.
    // Either the test fixture grew complexity the rule cannot settle, or
    // the rule itself regressed into a re-emit loop. Either way we want a
    // loud failure instead of a misleading green when the loop falls
    // through with edits still pending.
    t.Fatalf("formatSortImports did not converge within %d passes", maxPasses)
  }
  got, err := os.ReadFile(filePath)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  // Verify group ordering: alpha (third-party) before request (@api)
  // before reduce (relative).
  alphaIdx := strings.Index(string(got), "alpha")
  apiIdx := strings.Index(string(got), "@api/http")
  localIdx := strings.Index(string(got), "./local-")
  if !(alphaIdx >= 0 && apiIdx > alphaIdx && localIdx > apiIdx) {
    t.Fatalf("group ordering wrong: alpha=%d api=%d local=%d\nsource:\n%s",
      alphaIdx, apiIdx, localIdx, got)
  }
  // Confirm a blank line separator survives between each group.
  if !strings.Contains(string(got), "\"alpha\";\n\nimport") {
    t.Fatalf("missing blank line after third-party group:\n%s", got)
  }
}
