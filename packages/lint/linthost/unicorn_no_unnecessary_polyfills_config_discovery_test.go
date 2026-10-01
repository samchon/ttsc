package linthost

import (
  "path/filepath"
  "sort"
  "testing"
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// runNoUnnecessaryPolyfillsInProject materializes a project (config files plus
// the linted source) under a fresh temp root and runs the owning rule in process,
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
    if finding.engineFailure || finding.Severity != SeverityError {
      t.Fatalf("expected a rule error, not a host failure or different severity: %+v", finding)
    }
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
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run resolves an actual fixture .browserslistrc and distinguishes the selected environment by an exact redundant object-assign error or zero findings.
// @evidence contracts/testing.md#independent-expectations The authored Node 6 versus 0.12 Object.assign boundary and default production section establish opposite results independently of the Go resolver.
// @evidence contracts/testing.md#distinguishing-cases Production 6/development 0.12 reports; production 0.12/development 6 is clean. PackageJsonBrowserslistSection owns the manifest counterpart.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsBrowserslistrcDiscovery owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsBrowserslistrcDiscovery(t *testing.T) {
  assertProjectReports(t, map[string]string{
    ".browserslistrc": "[production]\nnode 6\n\n[development]\nnode 0.12\n",
  }, "index.ts", `require("object-assign")`, "", polyfillMessageBuiltIn)

  assertProjectClean(t, map[string]string{
    ".browserslistrc": "[production]\nnode 0.12\n\n[development]\nnode 6\n",
  }, "index.ts", `require("object-assign")`, "")
}
