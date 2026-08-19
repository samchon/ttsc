package linthost

import (
  "encoding/json"
  "io"
  "testing"
)

// TestResidentRulesAreReusedOnlyWhileTheirConfigIsUnchanged verifies the
// daemon's rule memo answers from cache while the configuration it was loaded
// from is untouched, and reloads the moment it is not.
//
// Loading rules evaluates the project's lint configuration, which stands up a
// JavaScript runtime — the dominant cost of a verb that builds no Program at
// all. A one-shot process pays it once and exits. The daemon was paying it per
// request, and a consumer that asks again whenever a watched file moves asks
// once per edit, forever.
//
// The direction that matters is the second one. A memo that reloaded too often
// would only be slow; a memo that kept a rule set the author has just changed
// answers with rules the project no longer has, and every consumer downstream
// reads that as the project's own answer. So the reuse is validated against the
// config file's contents rather than trusted for the daemon's life.
//
//  1. Install a resident memo and load a project's rules through it.
//  2. Ask again unchanged and require the very same resolver back.
//  3. Rewrite the configuration and require a different one.
//  4. Send the client invalidate control and require the memo to survive it.
//  5. Ask about a second project and require it to load on its own.
func TestResidentRulesAreReusedOnlyWhileTheirConfigIsUnchanged(t *testing.T) {
  root := seedLintProject(t, "/** Public value. */\nexport const value = 1;\n")
  seedLintRules(t, root, map[string]string{"jsdoc/check-tag-names": "warn"})
  manifest := lintManifest(t)

  // Without a memo installed every call loads, which is what a one-shot process
  // does and must keep doing: it has nothing to amortize and no way to be told
  // the configuration moved.
  residentRules = nil
  if _, err := acquireRules(manifest, root, "tsconfig.json"); err != nil {
    t.Fatalf("a process with no resident memo could not load rules: %v", err)
  }

  cache := &residentRuleCache{}
  residentRules = cache
  // The Program cache too, because the invalidate control below runs the
  // daemon's real request handler and that handler drops the Program first.
  residentPrograms = newResidentProgramCache()
  defer func() {
    residentRules = nil
    residentPrograms.invalidate()
    residentPrograms = nil
  }()

  load := func(what string) {
    t.Helper()
    if _, err := acquireRules(manifest, root, "tsconfig.json"); err != nil {
      t.Fatalf("%s: %v", what, err)
    }
  }

  load("first request")
  if cache.loads != 1 {
    t.Fatalf("the first request did %d loads, want 1", cache.loads)
  }

  load("unchanged request")
  if cache.loads != 1 {
    t.Fatal("an unchanged configuration was evaluated twice; the memo never hits, and nothing below this proves anything")
  }

  // The edit the memo exists to notice. A rule set the author has just changed
  // is exactly what a resident consumer must stop answering from.
  seedLintRules(t, root, map[string]string{"jsdoc/require-description": "warn"})
  load("request after an edit")
  if cache.loads != 2 {
    t.Fatal("an edited configuration kept answering from the memo; the daemon would serve rules the project no longer declares")
  }

  load("request after the edit settled")
  if cache.loads != 2 {
    t.Fatal("the memo did not settle after the edit it had just absorbed")
  }

  // The client's own invalidate control is deliberately not wired to this memo,
  // and that is worth pinning: it arrives with every change a consumer cannot
  // localize, so honouring it here would re-evaluate the configuration exactly
  // as often as before the memo existed. The Program has no such self-check and
  // is what that control is for.
  handleServeLSPLine(`{"invalidate":true}`, &lspCommandOptions{
    cwd:         root,
    pluginsJSON: manifest,
    tsconfig:    "tsconfig.json",
  }, json.NewEncoder(io.Discard))
  load("request after a client invalidate")
  if cache.loads != 2 {
    t.Fatalf("a client invalidate dropped the rule memo (loads=%d); it would then reload on every unlocalized change, which is every one", cache.loads)
  }

  // A different project through the same daemon is a different answer, and the
  // memo holds one. Keyed reuse is what keeps it from handing one project's
  // rules to another.
  other := seedLintProject(t, "export const other = 1;\n")
  seedLintRules(t, other, map[string]string{"jsdoc/check-tag-names": "warn"})
  if _, err := acquireRules(manifest, other, "tsconfig.json"); err != nil {
    t.Fatalf("second project: %v", err)
  }
  if cache.loads != 3 {
    t.Fatal("a second project reused the first one's rules")
  }
}
