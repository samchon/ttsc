package linthost

import (
  "path/filepath"
  "sort"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// runNoUnnecessaryPolyfillsInProject materializes a project (config files plus
// the linted source) under a fresh temp root and runs the rule end to end,
// exercising the on-disk target-resolution chain the option-only tests skip:
// Browserslist config discovery, custom-stats files, package.json
// `browserslist` sections, and package.json `engines`. It returns each
// finding's message in source order.
//
// files maps forward-slash relative paths to content; rel is the linted file's
// relative path; options is the rule's JSON options ("" for the default,
// discovery-driven path). The engine's current directory is the temp root, and
// the file is parsed under its real absolute path, so `filepath.Dir` sees the
// materialized siblings exactly as a real host would.
func runNoUnnecessaryPolyfillsInProject(t *testing.T, files map[string]string, rel, source, options string) []string {
  t.Helper()
  root := t.TempDir()
  for name, content := range files {
    writeFile(t, filepath.Join(root, filepath.FromSlash(name)), content)
  }
  filePath := filepath.Join(root, filepath.FromSlash(rel))
  writeFile(t, filePath, source)

  var engine *Engine
  if options == "" {
    engine = NewEngine(RuleConfig{unicornNoUnnecessaryPolyfillsRuleName: SeverityError})
  } else {
    engine = NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornNoUnnecessaryPolyfillsRuleName: SeverityError},
      Options: RuleOptionsMap{unicornNoUnnecessaryPolyfillsRuleName: []byte(options)},
    })
  }
  engine.SetCurrentDirectory(root)
  file := parseTSFile(t, filePath, source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)

  type positioned struct {
    pos     int
    message string
  }
  entries := make([]positioned, 0, len(findings))
  for _, finding := range findings {
    if finding.Rule != unicornNoUnnecessaryPolyfillsRuleName {
      t.Fatalf("unexpected rule in findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("%s must not offer edits: %+v", unicornNoUnnecessaryPolyfillsRuleName, finding)
    }
    entries = append(entries, positioned{pos: finding.Pos, message: finding.Message})
  }
  sort.SliceStable(entries, func(i, j int) bool { return entries[i].pos < entries[j].pos })
  messages := make([]string, len(entries))
  for i, entry := range entries {
    messages[i] = entry.message
  }
  return messages
}

func assertProjectClean(t *testing.T, files map[string]string, rel, source, options string) {
  t.Helper()
  if got := runNoUnnecessaryPolyfillsInProject(t, files, rel, source, options); len(got) != 0 {
    t.Fatalf("want no findings (rel=%s options=%s), got %v", rel, options, got)
  }
}

func assertProjectReports(t *testing.T, files map[string]string, rel, source, options, wantMessage string) {
  t.Helper()
  got := runNoUnnecessaryPolyfillsInProject(t, files, rel, source, options)
  if len(got) != 1 || got[0] != wantMessage {
    t.Fatalf("want single finding %q (rel=%s options=%s), got %v", wantMessage, rel, options, got)
  }
}

// TestUnicornNoUnnecessaryPolyfillsBrowserslistrcDiscovery verifies the second
// link in the resolution chain: with no `targets` option the rule reads the
// nearest `.browserslistrc`, resolves it under the `production` environment,
// and reports only when every production target already ships the feature.
//
// The two upstream fixtures are exact twins — same file, opposite
// production/development node floors — so they pin both that the config is
// honored and that the `development` section is ignored.
//
//  1. `production node 6` makes `object-assign` redundant -> report.
//  2. `production node 0.12` still needs it -> silent (development `node 6` is
//     not consulted).
func TestUnicornNoUnnecessaryPolyfillsBrowserslistrcDiscovery(t *testing.T) {
  assertProjectReports(t, map[string]string{
    ".browserslistrc": "[production]\nnode 6\n\n[development]\nnode 0.12\n",
  }, "index.ts", `require("object-assign")`, "", polyfillMessageBuiltIn)

  assertProjectClean(t, map[string]string{
    ".browserslistrc": "[production]\nnode 0.12\n\n[development]\nnode 6\n",
  }, "index.ts", `require("object-assign")`, "")
}

// TestUnicornNoUnnecessaryPolyfillsCustomStatsDiscovery verifies the
// custom-stats path: a `> 0% in my stats` query resolves against a sibling
// `browserslist-stats.json`, both when the query comes from `.browserslistrc`
// discovery and when it is supplied through the `targets` option.
//
// `chrome 80` supports `Object.assign` but not `Array#toSorted`, so the stats
// query must reproduce exactly the `{chrome: 80}` decision for both — proving
// it resolves to that browser rather than to an empty (vacuously-available)
// target list. A port that dropped custom-stats support would either
// under-report or over-report.
//
//  1. Discover the query from `.browserslistrc` + stats file: `object-assign`
//     reports, `array/to-sorted` stays silent.
//  2. Supply the same query through the option with only the stats file: same
//     positive/negative split.
func TestUnicornNoUnnecessaryPolyfillsCustomStatsDiscovery(t *testing.T) {
  stats := "{\"chrome\":{\"80\":1}}"
  const stillNeeded = `require("core-js/features/array/to-sorted")`

  assertProjectReports(t, map[string]string{
    ".browserslistrc":         "> 0% in my stats\n",
    "browserslist-stats.json": stats,
  }, "index.ts", `require("object-assign")`, "", polyfillMessageBuiltIn)
  assertProjectClean(t, map[string]string{
    ".browserslistrc":         "> 0% in my stats\n",
    "browserslist-stats.json": stats,
  }, "index.ts", stillNeeded, "")

  assertProjectReports(t, map[string]string{
    "browserslist-stats.json": stats,
  }, "index.ts", `require("object-assign")`, `{"targets":"> 0% in my stats"}`, polyfillMessageBuiltIn)
  assertProjectClean(t, map[string]string{
    "browserslist-stats.json": stats,
  }, "index.ts", stillNeeded, `{"targets":"> 0% in my stats"}`)
}

// TestUnicornNoUnnecessaryPolyfillsPackageJsonBrowserslistSection verifies the
// rule reads a sectioned `browserslist` object from `package.json` (not just a
// standalone `.browserslistrc`), selecting the `production` section.
//
//  1. `package.json` carries `browserslist.production = ["node 6"]`.
//  2. `object-assign` is redundant on node 6 -> report.
func TestUnicornNoUnnecessaryPolyfillsPackageJsonBrowserslistSection(t *testing.T) {
  assertProjectReports(t, map[string]string{
    "package.json": `{"browserslist":{"production":["node 6"],"development":["node 0.12"]}}`,
  }, "index.ts", `require("object-assign")`, "", polyfillMessageBuiltIn)
}

// TestUnicornNoUnnecessaryPolyfillsEnginesDiscovery verifies the final
// fallback: with neither option nor Browserslist config, the rule uses the
// nearest `package.json` `engines`.
//
// The two upstream issue-2270 fixtures pin the `array-from-async` boundary:
// still needed on the node 18 range, redundant on node 22.
//
//  1. `engines.node ">=18"` -> `array-from-async` still needed -> silent.
//  2. `engines.node "22"` -> redundant -> report.
func TestUnicornNoUnnecessaryPolyfillsEnginesDiscovery(t *testing.T) {
  assertProjectClean(t, map[string]string{
    "package.json": `{"engines":{"node":">=18"}}`,
  }, "index.ts", `import x from "array-from-async"`, "")

  assertProjectReports(t, map[string]string{
    "package.json": `{"engines":{"node":"22"}}`,
  }, "index.ts", `import x from "array-from-async"`, "", polyfillMessageBuiltIn)
}

// TestUnicornNoUnnecessaryPolyfillsOptionOverridesConfigDiscovery verifies the
// resolution precedence: an explicit `targets` option wins over an on-disk
// Browserslist config that would decide the opposite way.
//
// The directory's `.browserslistrc` says `node 6` (which would report), but the
// option pins `node 0.12` (which still needs the polyfill), so the option must
// silence the rule — proving the option short-circuits config discovery.
//
//  1. Materialize a `.browserslistrc` that alone would report.
//  2. Lint with `targets: {node: "0.12"}`.
//  3. Assert silence.
func TestUnicornNoUnnecessaryPolyfillsOptionOverridesConfigDiscovery(t *testing.T) {
  assertProjectClean(t, map[string]string{
    ".browserslistrc": "[production]\nnode 6\n\n[development]\nnode 0.12\n",
  }, "index.ts", `require("object-assign")`, `{"targets":{"node":"0.12"}}`)
}

// TestUnicornNoUnnecessaryPolyfillsSilentWithoutResolvableTargets verifies the
// rule stays silent when no targets resolve at all: no option, no Browserslist
// config, and a nearest `package.json` that carries no `engines`.
//
// This is the branch upstream's `getTargets` returns `undefined` for; without
// it the rule would either crash or fabricate a target and over-report.
//
//  1. Materialize a `package.json` with neither `browserslist` nor `engines`.
//  2. Import a normally-redundant polyfill.
//  3. Assert silence.
func TestUnicornNoUnnecessaryPolyfillsSilentWithoutResolvableTargets(t *testing.T) {
  assertProjectClean(t, map[string]string{
    "package.json": `{"name":"fixture","version":"1.0.0"}`,
  }, "index.ts", `require("object-assign")`, "")
}

// TestUnicornNoUnnecessaryPolyfillsCorpusProjectScenario verifies the shipped
// corpus fixture's real-world shape end to end: a source file that imports a
// redundant polyfill next to a sibling `package.json` whose `engines.node`
// makes the polyfill unnecessary.
//
// The flat `// expect:` corpus runner cannot express `targets`, so the corpus
// fixture keeps its `@ttsc-corpus-skip`; this test is the behavioral stand-in,
// pinning the same discovery the corpus would exercise if it could.
//
//  1. Place `src/main.ts` (importing `object-assign`) beside `src/package.json`.
//  2. Set `engines.node` to a version that already ships `Object.assign`.
//  3. Assert exactly one built-in diagnostic.
func TestUnicornNoUnnecessaryPolyfillsCorpusProjectScenario(t *testing.T) {
  assertProjectReports(t, map[string]string{
    "src/package.json": `{"engines":{"node":"8"}}`,
  }, "src/main.ts", `import assign from "object-assign";
void assign;
`, "", polyfillMessageBuiltIn)
}
