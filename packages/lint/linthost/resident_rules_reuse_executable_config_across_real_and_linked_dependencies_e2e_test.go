//go:build e2e

package linthost

import (
  "encoding/json"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "runtime"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

const residentConfigProjectInputRuleName = "test/resident-config-project-input"

type residentConfigProjectInputRule struct{}

func (residentConfigProjectInputRule) Name() string {
  return residentConfigProjectInputRuleName
}
func (residentConfigProjectInputRule) Check(*publicrule.ProjectContext) {}
func (residentConfigProjectInputRule) ProjectInputs(
  ctx *publicrule.ProjectInputContext,
) []publicrule.ProjectInput {
  var options struct {
    File string `json:"file"`
  }
  if err := ctx.DecodeOptions(&options); err != nil {
    panic(err)
  }
  return []publicrule.ProjectInput{{
    Kind:    publicrule.ProjectInputFile,
    Pattern: options.File,
  }}
}

// TestResidentRulesReuseExecutableConfigAcrossRealAndLinkedDependencies
// verifies the daemon owns the complete executable-config dependency state,
// including package dependencies reached through a directory link.
//
// The original resident-rule case writes JSON and calls acquireRules directly,
// so it bypasses the executable loader, its dependency fingerprints, and the
// lsp-serve request loop. A real TypeScript config records package-resolution
// candidates and cache-only package files; losing either half makes an
// unchanged daemon re-evaluate forever or makes a changed package answer with
// stale project inputs.
//
//  1. Start lsp-serve with a TypeScript config importing a real package, then
//     repeat with the package reached through a junction or symlink.
//  2. Ask project-inputs three times and require one resolver load and one
//     executable-config evaluation.
//  3. Edit only the imported package and require one fresh evaluation and the
//     new project-input answer.
//  4. Ask once more unchanged and require the refreshed resolver to settle.
//
// @evidence contracts/testing.md#behavioral-verification Exercises RunLSPServe over real pipes with the TypeScript executable config evaluator and physical package dependency; asserts one load/evaluation for three unchanged requests, exactly two after a dependency edit, old-input removal, new-input retention and settling on a final unchanged request, distinguishing the named lost connection or changed behavior from valid execution.
// @evidence contracts/testing.md#independent-expectations The config dependency writes an independent evaluation counter and literal before/after project-input paths.
// @evidence contracts/testing.md#distinguishing-cases This case owns real directory and linked dependency paths both reuse valid answers and invalidate only when imported bytes change; portable rule decisions remain in the shared Go unit population.
// @evidence contracts/testing.md#execution-ownership The lint E2E entry calls nativeLintConnections, which selects TestResidentRulesReuseExecutableConfigAcrossRealAndLinkedDependencies by exact name through GoBoundary.run with the e2e build tag in packages/lint/linthost. Go test retains this entry and its subcase failure identities; ordinary Go unit execution does not select this tagged file.
// @evidence contracts/e2e.md#necessary-boundary The actual connection is RunLSPServe over real pipes with the TypeScript executable config evaluator and physical package dependency; direct native operation calls cannot prove that separate evaluator, formatter, binary-stdin or JavaScript runtime behavior.
// @evidence contracts/e2e.md#shared-execution Each real/linked topology uses one persistent daemon for all five requests; the package-owned Go test binary is shared, while conflicting physical dependency identities require separate consumer fixtures.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Subcases own temporary modules and pipes; deferred closeDaemon closes the request stream, joins the daemon and checks its exit. Local config memo and registered project-rule state are restored and environment counters use t.Setenv.
// @evidence contracts/e2e.md#preserved-coverage Keeps one load/evaluation for three unchanged requests, exactly two after a dependency edit, old-input removal, new-input retention and settling on a final unchanged request and every original input/control branch; preparation sharing changes no expected result or admitted case.
func TestResidentRulesReuseExecutableConfigAcrossRealAndLinkedDependencies(t *testing.T) {
  installResidentConfigProjectInputRule(t)

  for _, linked := range []bool{false, true} {
    name := "real-directory"
    if linked {
      name = "linked-directory"
    }
    t.Run(name, func(t *testing.T) {
      root := seedLintProject(t, "export const value = 1;\n")
      packageRoot := filepath.Join(
        root,
        "node_modules",
        "resident-config-dependency",
      )
      if linked {
        target := filepath.Join(t.TempDir(), "resident-config-dependency")
        seedResidentConfigDependency(t, target, "docs/before.md")
        if err := os.MkdirAll(filepath.Dir(packageRoot), 0o755); err != nil {
          t.Fatalf("create node_modules: %v", err)
        }
        if runtime.GOOS == "windows" {
          if err := windowsjunction.Create(packageRoot, target); err != nil {
            t.Fatalf("create dependency junction: %v", err)
          }
        } else if err := os.Symlink(target, packageRoot); err != nil {
          t.Fatalf("create dependency symlink: %v", err)
        }
      } else {
        seedResidentConfigDependency(t, packageRoot, "docs/before.md")
      }
      writeResidentProjectInputConfig(t, root)

      evaluations := filepath.Join(root, "evaluations.txt")
      if err := os.WriteFile(evaluations, nil, 0o644); err != nil {
        t.Fatalf("seed evaluation log: %v", err)
      }
      t.Setenv("TTSC_LINT_TEST_EVALUATIONS", evaluations)
      t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
      configEvalCacheMu.Lock()
      previousEvaluations := configEvalCache
      configEvalCache = map[string]cachedConfigEvaluation{}
      configEvalCacheMu.Unlock()
      defer func() {
        configEvalCacheMu.Lock()
        configEvalCache = previousEvaluations
        configEvalCacheMu.Unlock()
      }()

      ask, closeDaemon := startResidentProjectInputDaemon(t, root)
      defer closeDaemon()

      var snapshot ProjectInputSnapshot
      for request := 1; request <= 3; request++ {
        snapshot = ask(fmt.Sprintf("unchanged request %d", request))
        assertResidentProjectInput(t, snapshot, root, "docs/before.md", true)
      }
      assertResidentRuleLoads(t, 1)
      assertResidentConfigEvaluations(t, evaluations, 1)

      writeResidentConfigDependencyIndex(
        t,
        realProjectPath(packageRoot),
        "docs/after.md",
      )
      snapshot = ask("request after dependency edit")
      assertResidentRuleLoads(t, 2)
      assertResidentConfigEvaluations(t, evaluations, 2)
      assertResidentProjectInput(t, snapshot, root, "docs/before.md", false)
      assertResidentProjectInput(t, snapshot, root, "docs/after.md", true)

      snapshot = ask("unchanged request after dependency edit")
      assertResidentRuleLoads(t, 2)
      assertResidentConfigEvaluations(t, evaluations, 2)
      assertResidentProjectInput(t, snapshot, root, "docs/after.md", true)
    })
  }
}

func installResidentConfigProjectInputRule(t *testing.T) {
  t.Helper()
  previousRule, existed := registeredProjectRules[residentConfigProjectInputRuleName]
  registeredProjectRules[residentConfigProjectInputRuleName] = projectRuleAdapter{
    inner:          residentConfigProjectInputRule{},
    name:           residentConfigProjectInputRuleName,
    acceptsOptions: true,
  }
  t.Cleanup(func() {
    if existed {
      registeredProjectRules[residentConfigProjectInputRuleName] = previousRule
    } else {
      delete(registeredProjectRules, residentConfigProjectInputRuleName)
    }
  })
}

func writeResidentProjectInputConfig(t *testing.T, root string) {
  t.Helper()
  writeFile(t, filepath.Join(root, "lint.config.ts"), fmt.Sprintf(`
import options from "resident-config-dependency";

export default {
  rules: { %q: ["error", options] },
};
`, residentConfigProjectInputRuleName))
}

func startResidentProjectInputDaemon(
  t *testing.T,
  root string,
) (func(string) ProjectInputSnapshot, func()) {
  t.Helper()
  requestsReader, requestsWriter := io.Pipe()
  responsesReader, responsesWriter := io.Pipe()
  done := make(chan int, 1)
  manifest := lintManifest(t)
  go func() {
    code := RunLSPServe(
      requestsReader,
      responsesWriter,
      []string{
        "--cwd", root,
        "--tsconfig", "tsconfig.json",
        "--plugins-json", manifest,
      },
    )
    _ = responsesWriter.Close()
    done <- code
  }()

  decoder := json.NewDecoder(responsesReader)
  ask := func(what string) ProjectInputSnapshot {
    t.Helper()
    if _, err := fmt.Fprintln(requestsWriter, `{"verb":"project-inputs"}`); err != nil {
      t.Fatalf("%s request: %v", what, err)
    }
    var reply serveLSPResponse
    if err := decoder.Decode(&reply); err != nil {
      t.Fatalf("%s reply: %v", what, err)
    }
    if reply.Code != 0 {
      t.Fatalf("%s reply code = %d, want 0", what, reply.Code)
    }
    var snapshot ProjectInputSnapshot
    if err := json.Unmarshal(reply.Result, &snapshot); err != nil {
      t.Fatalf("%s snapshot: %v", what, err)
    }
    return snapshot
  }
  closeDaemon := func() {
    _ = requestsWriter.Close()
    code := <-done
    _ = responsesReader.Close()
    if code != 0 {
      t.Errorf("lsp-serve exit: want 0, got %d", code)
    }
  }
  return ask, closeDaemon
}

func seedResidentConfigDependency(t *testing.T, root, input string) {
  t.Helper()
  writeFile(t, filepath.Join(root, "package.json"), `{
  "name": "resident-config-dependency",
  "type": "module",
  "exports": "./index.js"
}
`)
  writeResidentConfigDependencyIndex(t, root, input)
}

func writeResidentConfigDependencyIndex(t *testing.T, root, input string) {
  t.Helper()
  writeFile(t, filepath.Join(root, "index.js"), fmt.Sprintf(`
import fs from "node:fs";

fs.appendFileSync(process.env.TTSC_LINT_TEST_EVALUATIONS, "evaluation\n");
export default { file: %q };
`, input))
}

func assertResidentRuleLoads(t *testing.T, want int) {
  t.Helper()
  cache := residentRules
  if cache == nil {
    t.Fatal("lsp-serve resident rule cache is not installed")
  }
  cache.mu.Lock()
  got := cache.loads
  cache.mu.Unlock()
  if got != want {
    t.Fatalf("resident rule loads = %d, want %d", got, want)
  }
}

func assertResidentConfigEvaluations(t *testing.T, location string, want int) {
  t.Helper()
  body, err := os.ReadFile(location)
  if err != nil {
    t.Fatalf("read evaluation log: %v", err)
  }
  got := 0
  for _, value := range body {
    if value == '\n' {
      got++
    }
  }
  if got != want {
    t.Fatalf("executable config evaluations = %d, want %d", got, want)
  }
}

func assertResidentProjectInput(
  t *testing.T,
  snapshot ProjectInputSnapshot,
  root string,
  relative string,
  want bool,
) {
  t.Helper()
  expected := filepath.ToSlash(realProjectPath(filepath.Join(root, relative)))
  for _, location := range snapshot.Files {
    if location == expected {
      if !want {
        t.Fatalf("project inputs retained stale path %s", expected)
      }
      return
    }
  }
  if want {
    t.Fatalf("project inputs do not contain %s: %#v", expected, snapshot.Files)
  }
}
