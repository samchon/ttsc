package main

import (
  "os"
  "path/filepath"
  "testing"
)

// TestServeSessionKeepsESMDirectoryCandidateUnchanged verifies ESM relative
// resolution does not inherit CommonJS directory probes.
//
// TypeScript-Go may substitute value.ts for the explicit value.js import, but
// it never performs the CommonJS value/package.json or value/index.* lookup in
// ESM mode. Those directory members must therefore stay out of a resident
// session's freshness inputs.
//
// 1. Load an ESM value.js import with a resolved JavaScript fallback.
// 2. Create a directory package candidate, then the higher-priority value.ts candidate.
// 3. Require the directory candidate to leave the session unchanged and value.ts to reload with typescriptWinner.
//
// @evidence contracts/testing.md#behavioral-verification In nodenext ESM mode, creating a value/ directory with package.json and index.ts does not change a resident session that resolves ./value.js to the JavaScript file, while creating the higher-priority value.ts reloads it and the new dump contains typescriptWinner.
// @evidence contracts/testing.md#independent-expectations The expected outcomes come from the TypeScript resolution rule the test cites (ESM mode substitutes value.ts for value.js but never probes the CommonJS directory/index lookup): the directory creation must be unchanged with no dump, and creating value.ts must be mode reload with a node named typescriptWinner. A session that tracked directory probes would reload on the first step.
// @evidence contracts/testing.md#distinguishing-cases Load an ESM value.js import with a resolved JavaScript fallback. Create a directory package candidate, then the higher-priority value.ts candidate. Require the directory candidate to leave the session unchanged and value.ts to reload with typescriptWinner.
// @evidence contracts/testing.md#execution-ownership TestServeSessionKeepsESMDirectoryCandidateUnchanged is a Go source-unit entry. snapshotGraphState calls the actual prepareDumpSnapshot state operation and completes its graph projection with explicit empty ignore membership. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary. The separate worktree E2E owns real Git acquisition.
func TestServeSessionKeepsESMDirectoryCandidateUnchanged(t *testing.T) {
  root := t.TempDir()
  writeGraphFile(t, filepath.Join(root, "package.json"), `{"type":"module"}`)
  writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
  writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from './value.js';\nexport function main(): void { winner(); }\n")
  writeGraphFile(t, filepath.Join(root, "src", "value.js"), "export function winner() {}\n")

  session, err := newGraphSession(root, "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  defer session.Close()
  if _, _, _, err := snapshotGraphState(session); err != nil {
    t.Fatal(err)
  }

  if err := os.MkdirAll(filepath.Join(root, "src", "value"), 0o755); err != nil {
    t.Fatal(err)
  }
  writeGraphFile(t, filepath.Join(root, "src", "value", "package.json"), `{"type":"module"}`)
  writeGraphFile(t, filepath.Join(root, "src", "value", "index.ts"), "export function winner(): void {}\n")
  dump, mode, changed, err := snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump != nil || mode != serveModeUnchanged || changed {
    t.Fatalf("ESM directory candidate = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }

  writeGraphFile(t, filepath.Join(root, "src", "value.ts"), "export function winner(): void {}\nexport function typescriptWinner(): void {}\n")
  dump, mode, changed, err = snapshotGraphState(session)
  if err != nil {
    t.Fatal(err)
  }
  if dump == nil || mode != serveModeReload || !changed || !hasDumpNode(*dump, "typescriptWinner") {
    t.Fatalf("ESM higher-priority file = dump:%v mode:%q changed:%v", dump != nil, mode, changed)
  }
}
