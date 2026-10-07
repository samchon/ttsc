package linthost

import (
  "encoding/json"
  "io"
  "os"
  "testing"
  "time"
)

// TestResidentRulesAreReusedOnlyWhileTheirConfigIsUnchanged verifies the
// daemon's rule memo answers from cache while the configuration it was loaded
// from is untouched, and reloads the moment it is not.
//
// This entry loads JSON configuration directly and observes resolver-load
// attempts through the resident cache's counter. Executable configuration and
// its child runtime are separate E2E connections, not exercised here.
//
// The direction that matters is the second one. A memo that reloaded too often
// would only be slow; a memo that kept a rule set the author has just changed
// answers with rules the project no longer has, and every consumer downstream
// reads that as the project's own answer. So the reuse is validated against the
// config file's contents rather than trusted for the daemon's life.
//
//  1. Install a resident memo and load a project's rules through it.
//  2. Ask again unchanged and require no additional resolver load.
//  3. Rewrite the configuration and require another resolver load.
//  4. Send the client invalidate control and require the memo to survive it.
//  5. Ask about a second project and require it to load on its own.
//  6. Require a configuration that moved during the evaluation to be recorded
//     as nothing at all, and one that shares the load's start instant to be
//     recorded normally.
//  7. Disable caching and require two loads for two unchanged JSON requests.
//
// @evidence contracts/testing.md#behavioral-verification Resident JSON resolution avoids additional loads while configuration is unchanged, reloads after edits, survives client invalidation, separates projects and rejects snapshots whose files postdate the supplied start instant. Explicit cache opt-out forces two loads for two unchanged requests.
// @evidence contracts/testing.md#independent-expectations Authored configuration rewrites and project keys specify literal load counts, not returned resolver identity comparisons. Supplied current/past/file-modification instants independently specify the snapshot time boundary; no expected digest is copied from the memo.
// @evidence contracts/testing.md#distinguishing-cases Original load counts remain 1/1/2/2/2/3 for initial, unchanged, edited, settled, invalidated and other-project requests. Snapshot recording accepts now and the exact file modification instant but rejects an hour-earlier instant. A separate disabled memo must load twice for two unchanged requests. Only JSON configuration is exercised; actual executable evaluation counts and project-input results remain E2E responsibilities.
// @evidence contracts/testing.md#execution-ownership Calls acquireRules with test-owned resident caches, drives handleServeLSPLine for invalidation and calls hashRuleConfigs with supplied instants in process. Previous resident rule/program globals and the opt-out environment are restored, and the acquired Program cache is invalidated during cleanup. JSON loading starts no executable-config subprocess.
func TestResidentRulesAreReusedOnlyWhileTheirConfigIsUnchanged(t *testing.T) {
  root := seedLintProject(t, "/** Public value. */\nexport const value = 1;\n")
  seedLintRules(t, root, map[string]string{"jsdoc/check-tag-names": "warn"})
  manifest := lintManifest(t)
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
  previousRules, previousPrograms := residentRules, residentPrograms
  programCache := newResidentProgramCache()
  defer func() {
    programCache.invalidate()
    residentRules = previousRules
    residentPrograms = previousPrograms
  }()

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
  residentPrograms = programCache

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

  // What the recorded state has to describe is the load, not the disk at the
  // moment recording happened. Evaluating a configuration takes seconds, which
  // is ample room for the author's next save to land inside it, and the bytes
  // readable afterwards are then the save rather than what the resolver was
  // built from. That is the one wrong answer that never corrects itself: the
  // memo would agree with a file the resolver does not match, and every later
  // request would pass the reuse test until some further edit disagreed.
  //
  // Driven by the start instant rather than by racing a real write, because the
  // property is about which state a load is allowed to claim and a timing race
  // would pin the scheduler instead.
  resolver, err := acquireRules(manifest, other, "tsconfig.json")
  if err != nil {
    t.Fatalf("recording a settled configuration: %v", err)
  }
  if hashRuleConfigs(resolver, time.Now()) == nil {
    t.Fatal("a configuration that settled before the load began recorded nothing; the memo could never hit and every assertion above it would pass vacuously")
  }
  if hashRuleConfigs(resolver, time.Now().Add(-time.Hour)) != nil {
    t.Fatal("a configuration that moved after the load began was recorded as the state the resolver was built from; the memo would answer from rules the project no longer declares until some later edit happened to disagree")
  }

  // Each file's actual modification instant supplies the equality boundary.
  // Equality must remain accepted rather than be classified as a later write.
  for _, location := range configPathsOf(t, resolver) {
    info, err := os.Stat(location)
    if err != nil {
      t.Fatalf("stating %s: %v", location, err)
    }
    if hashRuleConfigs(resolver, info.ModTime()) == nil {
      t.Fatalf("a configuration whose save shares the load's start instant recorded nothing; on a platform with a coarse clock that is every save, and the memo would never record at all")
    }
  }

  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "1")
  disabled := &residentRuleCache{}
  residentRules = disabled
  load("cache-disabled first request")
  load("cache-disabled unchanged request")
  if disabled.loads != 2 {
    t.Fatalf("two unchanged requests with caching disabled did %d resolver loads, want 2", disabled.loads)
  }
}

// configPathsOf names the files a resolver was built from, which is what the
// recording it is asked for above reads.
func configPathsOf(t *testing.T, resolver RuleResolver) []string {
  t.Helper()
  source, ok := resolver.(interface{ ConfigPaths() []string })
  if !ok {
    t.Fatal("the resolver does not name the files it was built from, so nothing here could be recorded")
  }
  paths := source.ConfigPaths()
  if len(paths) == 0 {
    t.Fatal("the resolver named no configuration file, so the boundary below would pass vacuously")
  }
  return paths
}
