package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionKeepsLowerPriorityPathsPatternUnchanged verifies only the
// most-specific TypeScript-Go paths pattern contributes freshness candidates.
//
// `@/special/*` outranks `@/*`; a file under the broad substitution never
// participates in this lookup, while a missing .ts sibling of the selected
// specific substitution does.
//
// 1. Load overlapping broad and specific paths patterns for a special import.
// 2. Create the broad candidate, then the selected specific candidate.
// 3. Require the broad candidate to remain unchanged and the specific candidate to reload with specificPathsWinner.
//
// @evidence contracts/testing.md#behavioral-verification Require the broad candidate to remain unchanged and the specific candidate to reload with specificPathsWinner.
// @evidence contracts/testing.md#independent-expectations The literal fixture and the supported graph contract establish these expectations: Require the broad candidate to remain unchanged and the specific candidate to reload with specificPathsWinner.
// @evidence contracts/testing.md#distinguishing-cases Load overlapping broad and specific paths patterns for a special import. Create the broad candidate, then the selected specific candidate. Require the broad candidate to remain unchanged and the specific candidate to reload with specificPathsWinner.
// @evidence contracts/testing.md#execution-ownership TestServeSessionKeepsLowerPriorityPathsPatternUnchanged is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionKeepsLowerPriorityPathsPatternUnchanged(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "baseUrl": ".",
    "module": "commonjs",
    "paths": {
      "@/*": ["broad/*"],
      "@/special/*": ["specific/*"]
    },
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from '@/special/value';\nexport function main(): void { winner(); }\n")
  writeGraphFile(t, filepath.Join(root, "specific", "value.js"), "export function winner() {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  writeGraphFile(t, filepath.Join(root, "broad", "special", "value.ts"), "export function winner(): void {}\n")
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("broad paths pattern = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  writeGraphFile(t, filepath.Join(root, "specific", "value.ts"), "export function winner(): void {}\nexport function specificPathsWinner(): void {}\n")
  dump, mode, changed, err = snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNode(*dump, "specificPathsWinner") {
    t.Fatalf("specific paths pattern = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
