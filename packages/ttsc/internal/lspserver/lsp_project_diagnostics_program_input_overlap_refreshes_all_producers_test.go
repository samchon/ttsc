package lspserver

import (
  "bytes"
  "path/filepath"
  "strings"
  "testing"
)

// TestLSPProjectDiagnosticsProgramInputOverlapRefreshesAllProducers verifies a
// declared input that can also belong to the Program widens diagnostic scope.
//
// Only the first producer declares the path, but both project-rule producers
// observe the shared Program. TypeScript and resolveJsonModule JSON edits must
// therefore refresh both, while a path that can only be data keeps the
// owner-scoped behavior pinned by
// lsp_project_diagnostics_refreshes_only_input_owners_test.go.
//
//  1. Declare one shared-Program path for the first producer only.
//  2. Resolve its owner scope and widen it as a watched Program input.
//  3. Assert the scope became all-producer.
//  4. Refresh and assert both producers were invoked.
//
// @evidence contracts/testing.md#behavioral-verification A declared input that can also be a Program source widens the owner scope to all producers, and the refresh invokes both producers.
// @evidence contracts/testing.md#independent-expectations The expected scope and invocation set are literals.
// @evidence contracts/testing.md#distinguishing-cases Only the first producer declares the path, so owner-only scoping would invoke one.
// @evidence contracts/testing.md#execution-ownership TestLSPProjectDiagnosticsProgramInputOverlapRefreshesAllProducers is a Go unit test in the lspserver package: it calls the unexported proxy or source operation in-process with substituted seams, unresolvable sidecars and temporary directories, installing no consumer and starting no product host.
func TestLSPProjectDiagnosticsProgramInputOverlapRefreshesAllProducers(
  t *testing.T,
) {
  for _, name := range []string{"shared.ts", "shared.json"} {
    t.Run(name, func(t *testing.T) {
      root := t.TempDir()
      first := NativeLSPPluginEntry{
        Binary:             "ttsc-no-such-first-program-sidecar",
        Name:               "@ttsc/first-program",
        ProjectDiagnostics: true,
        ProjectInputs:      true,
      }
      second := NativeLSPPluginEntry{
        Binary:             "ttsc-no-such-second-program-sidecar",
        Name:               "@ttsc/second-program",
        ProjectDiagnostics: true,
        ProjectInputs:      true,
      }
      var log bytes.Buffer
      source := &NativePluginSource{
        err:     &log,
        plugins: []NativeLSPPluginEntry{first, second},
      }
      input := filepath.Join(root, "src", name)
      source.storeProjectInputs(first, 1, LSPProjectInputSnapshot{
        Root:  filepath.ToSlash(root),
        Files: []string{filepath.ToSlash(input)},
      })
      source.storeProjectInputs(second, 1, LSPProjectInputSnapshot{
        Root: filepath.ToSlash(root),
        Files: []string{
          filepath.ToSlash(filepath.Join(root, "docs", "second.md")),
        },
      })
      uri := testFileURI(input)
      scope, matched := (&Proxy{source: source}).projectInputOwnerScope(uri)
      if !matched || scope.all || len(scope.owners) != 1 {
        t.Fatalf("declared owner scope = %#v, matched %v", scope, matched)
      }
      scope = projectDiagnosticScopeForWatchedInput(uri, scope)
      if !scope.all {
        t.Fatalf("Program input scope remained owner-only: %#v", scope)
      }

      result := source.ProjectDiagnosticsForOwners(nil)

      if result.selected != 2 || result.complete {
        t.Fatalf("all-producer failed refresh = %#v", result)
      }
      if !strings.Contains(log.String(), first.Name) ||
        !strings.Contains(log.String(), second.Name) {
        t.Fatalf("Program input did not invoke both producers:\n%s", log.String())
      }
    })
  }
}
