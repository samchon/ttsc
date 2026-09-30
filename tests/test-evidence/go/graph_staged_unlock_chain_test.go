package evidence

import (
  "encoding/json"
  "fmt"
  "strings"
  "testing"
)

/**
 * Verifies each prefix of a staged claim chain exposes exactly its own debts.
 *
 * A final-state assertion cannot establish intermediate activation quality.
 * This unit test keeps every staged prefix visible: a later claim must neither
 * report early nor cover an earlier obligation. Integration checkpoints remain
 * until their complete assertion surface has equivalent unit coverage.
 *
 * 1. Declare three uncited host layers, with references chaining between them.
 * 2. Enable every prefix, including none and all, in the same Go test process.
 * 3. Assert exact diagnostic counts and the original identity of each claim.
 */
func TestEvidenceSemanticStagedUnlockChainPreservesEveryIntermediateObligation(t *testing.T) {
  files := map[string]string{
    "docs/requirement.md": "## Requirement {#requirement}\n",
    "src/model.ts":        "export interface IModel {}\n",
    "src/operation.ts":    "export function operation(): void {}\n",
    "src/journey.ts":      "export function journey(): void {}\n",
  }
  for enabled := 0; enabled <= 3; enabled++ {
    t.Run(fmt.Sprintf("enabled-%d", enabled), func(t *testing.T) {
      claims := []map[string]any{
        {"name": "model", "type": "typescript", "files": []string{"src/model.ts"}, "symbol": "type",
          "reference": map[string]any{"type": "markdown", "files": []string{"docs/requirement.md"}, "symbol": "h2"}},
        {"name": "operation", "type": "typescript", "files": []string{"src/operation.ts"}, "symbol": "function",
          "reference": map[string]any{"type": "typescript", "files": []string{"src/model.ts"}, "symbol": "type"}},
        {"name": "journey", "type": "typescript", "files": []string{"src/journey.ts"}, "symbol": "function",
          "reference": map[string]any{"type": "typescript", "files": []string{"src/operation.ts"}, "symbol": "function"}},
      }
      for index, claim := range claims {
        claim["disabled"] = index >= enabled
      }
      raw, err := json.Marshal(map[string]any{"claims": claims})
      if err != nil {
        t.Fatal(err)
      }
      messages := runIndexRule(t, files, string(raw))
      if len(messages) != enabled {
        t.Fatalf("want %d active obligations, got %v", enabled, messages)
      }
      for index, claim := range claims {
        identity := fmt.Sprintf("Claim %d ('%s')", index+1, claim["name"])
        count := 0
        for _, message := range messages {
          if strings.Contains(message, identity) && strings.Contains(message, "Missing acknowledgement") {
            count++
          }
        }
        want := 0
        if index < enabled {
          want = 1
        }
        if count != want {
          t.Fatalf("%s: want %d debts, got %v", identity, want, messages)
        }
      }
    })
  }
}
