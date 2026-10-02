//go:build e2e

package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPNativePluginSourcePipesContentStdin verifies that
// ExecuteCommandWithContent passes the buffer text to the sidecar on stdin and
// appends the --content-stdin flag. The fake sidecar reads stdin to EOF, checks
// the flag is present, and echoes the received text back inside the
// WorkspaceEdit's newText so the test can prove the bytes reached the sidecar.
//
// 1. Build a fake sidecar that owns ttsc.format.document and reflects stdin.
// 2. Call ExecuteCommandWithContent with buffer text.
// 3. Assert the returned edit's newText equals the piped buffer text.
//
// @evidence contracts/testing.md#behavioral-verification ExecuteCommandWithContent returns FLAG:const buffered = 1; from the fixture echo, proving the flag and stdin text crossed the process connection.
// @evidence contracts/testing.md#independent-expectations The fixture reads actual stdin and independently marks flag presence; the supplied buffer defines the exact expected edit.
// @evidence contracts/testing.md#distinguishing-cases Nonempty editor content is one of three explicit content-presence states sharing the same fixture program.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourcePipesContentStdin is its own Go E2E entry selected by the central ttsc experiment and built only with -tags=e2e; all assertions and failure messages remain with this discoverable function.
// @evidence contracts/e2e.md#necessary-boundary NativePluginSource discovers and invokes actual fixture executables across argv/stdin/stdout/stderr and JSON; direct payload validation cannot establish process transport, framing or failed-exit capture for this response.
// @evidence contracts/e2e.md#shared-execution buildNativePluginSourceTestSidecar links all twelve authored fixture programs in one standard-library dispatcher build. Equal content-presence cases reuse the same fixture program; executable names select different payload producers. Discovery and operation each use separate synchronous child processes because the product sidecar protocol accepts one verb per process, and no per-case Go build remains.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each source and fixture cwd belong to this case. Its fixture owner installs an observer during cleanup and requests a completion refresh; the callback runs after native hint calls finish, closes the source and signals completion before fixture deletion. Close drops queued work and joins resident children; no full scheduler-goroutine join is claimed. A thirty-second wait reports failure and cancels the source, then a ten-second wait still requires the callback barrier. An unresolved barrier retains both the fixture and shared producer directory and fails the suite. The call-log environment is restored through t.Setenv. No cache invalidation is claimed.
// @evidence contracts/e2e.md#preserved-coverage This body retains its reviewed payload, command, edit, diagnostic, size or stream assertions and failure identity. The shared producer preserves each authored fixture verb body and deliberate failure; no assertion is replaced by metadata inspection and no portable assertion transfer is claimed.
func TestLSPNativePluginSourcePipesContentStdin(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceContentStdinSidecar)
  manifest, err := json.Marshal(driver.NativePluginManifest{
    LSPPlugins: []driver.NativeLSPPluginEntry{{Binary: sidecar, Name: "@ttsc/fake"}},
  })
  if err != nil {
    t.Fatal(err)
  }
  source, err := driver.NewNativePluginSource(driver.NativePluginSourceOptions{
    Cwd:          dir,
    ManifestJSON: string(manifest),
    Tsconfig:     "tsconfig.json",
  })
  if err != nil {
    t.Fatalf("NewNativePluginSource failed: %v", err)
  }
  fixture.source = source

  uri := "file:///tmp/a.ts"
  arg, _ := json.Marshal(uri)
  edit, err := source.ExecuteCommandWithContent("ttsc.format.document", []json.RawMessage{arg}, "const buffered = 1;", true)
  if err != nil {
    t.Fatalf("ExecuteCommandWithContent failed: %v", err)
  }
  if edit == nil {
    t.Fatal("expected a WorkspaceEdit, got nil")
  }
  edits := edit.Changes[uri]
  if len(edits) != 1 {
    t.Fatalf("expected one edit for %q, got %#v", uri, edit.Changes)
  }
  if edits[0].NewText != "FLAG:const buffered = 1;" {
    t.Fatalf("sidecar did not receive piped stdin with --content-stdin flag: %q", edits[0].NewText)
  }
}

// TestLSPNativePluginSourceOmitsContentStdinWhenEmpty verifies the existing
// disk-formatting path is unchanged: with empty content the source must not
// append --content-stdin; the sidecar reports the flag absent and does not
// inspect stdin in this branch.
//
// 1. Select the content-echo fixture from the shared native batch.
// 2. Call ExecuteCommand through the ordinary disk-content path.
// 3. Require one edit containing NOFLAG: without a content-presence marker.
//
// @evidence contracts/testing.md#behavioral-verification ExecuteCommand returns NOFLAG: from the fixture, establishing the ordinary disk-command path sends no content-stdin flag.
// @evidence contracts/testing.md#independent-expectations The fixture independently reports the flag absence and only reads stdin when it is present.
// @evidence contracts/testing.md#distinguishing-cases The ordinary no-content call is distinct from hasContent=true with an empty editor buffer and from nonempty content.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourceOmitsContentStdinWhenEmpty is its own Go E2E entry selected by the central ttsc experiment and built only with -tags=e2e; all assertions and failure messages remain with this discoverable function.
// @evidence contracts/e2e.md#necessary-boundary NativePluginSource discovers and invokes actual fixture executables across argv/stdin/stdout/stderr and JSON; direct payload validation cannot establish process transport, framing or failed-exit capture for this response.
// @evidence contracts/e2e.md#shared-execution buildNativePluginSourceTestSidecar links all twelve authored fixture programs in one standard-library dispatcher build. Equal content-presence cases reuse the same fixture program; executable names select different payload producers. Discovery and operation each use separate synchronous child processes because the product sidecar protocol accepts one verb per process, and no per-case Go build remains.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each source and fixture cwd belong to this case. Its fixture owner installs an observer during cleanup and requests a completion refresh; the callback runs after native hint calls finish, closes the source and signals completion before fixture deletion. Close drops queued work and joins resident children; no full scheduler-goroutine join is claimed. A thirty-second wait reports failure and cancels the source, then a ten-second wait still requires the callback barrier. An unresolved barrier retains both the fixture and shared producer directory and fails the suite. The call-log environment is restored through t.Setenv. No cache invalidation is claimed.
// @evidence contracts/e2e.md#preserved-coverage This body retains its reviewed payload, command, edit, diagnostic, size or stream assertions and failure identity. The shared producer preserves each authored fixture verb body and deliberate failure; no assertion is replaced by metadata inspection and no portable assertion transfer is claimed.
func TestLSPNativePluginSourceOmitsContentStdinWhenEmpty(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceContentStdinSidecar)
  manifest, err := json.Marshal(driver.NativePluginManifest{
    LSPPlugins: []driver.NativeLSPPluginEntry{{Binary: sidecar, Name: "@ttsc/fake"}},
  })
  if err != nil {
    t.Fatal(err)
  }
  source, err := driver.NewNativePluginSource(driver.NativePluginSourceOptions{
    Cwd:          dir,
    ManifestJSON: string(manifest),
    Tsconfig:     "tsconfig.json",
  })
  if err != nil {
    t.Fatalf("NewNativePluginSource failed: %v", err)
  }
  fixture.source = source

  uri := "file:///tmp/a.ts"
  arg, _ := json.Marshal(uri)
  edit, err := source.ExecuteCommand("ttsc.format.document", []json.RawMessage{arg})
  if err != nil {
    t.Fatalf("ExecuteCommand failed: %v", err)
  }
  if edit == nil || len(edit.Changes[uri]) != 1 {
    t.Fatalf("expected one edit, got %#v", edit)
  }
  if edit.Changes[uri][0].NewText != "NOFLAG:" {
    t.Fatalf("expected no --content-stdin flag and no stdin, got %q", edit.Changes[uri][0].NewText)
  }
}

// TestLSPNativePluginSourcePipesEmptyContentStdin verifies the empty-buffer gate.
// When hasContent is true the source must append --content-stdin and pipe stdin
// even though content is "", so an emptied editor buffer formats in-memory
// instead of falling through to stale disk content. The sidecar reports the flag
// present and echoes the (empty) stdin back.
//
// 1. Select the content-echo fixture from the shared native batch.
// 2. Pass empty text with hasContent=true to ExecuteCommandWithContent.
// 3. Require one edit containing FLAG: to distinguish present from absent content.
//
// @evidence contracts/testing.md#behavioral-verification ExecuteCommandWithContent with hasContent=true and empty text returns FLAG:, proving explicit empty content is not mistaken for missing content.
// @evidence contracts/testing.md#independent-expectations The explicit content-presence contract makes an empty editor buffer authoritative instead of stale disk text.
// @evidence contracts/testing.md#distinguishing-cases Empty-but-present input complements both nonempty content and the ordinary no-content command.
// @evidence contracts/testing.md#execution-ownership TestLSPNativePluginSourcePipesEmptyContentStdin is its own Go E2E entry selected by the central ttsc experiment and built only with -tags=e2e; all assertions and failure messages remain with this discoverable function.
// @evidence contracts/e2e.md#necessary-boundary NativePluginSource discovers and invokes actual fixture executables across argv/stdin/stdout/stderr and JSON; direct payload validation cannot establish process transport, framing or failed-exit capture for this response.
// @evidence contracts/e2e.md#shared-execution buildNativePluginSourceTestSidecar links all twelve authored fixture programs in one standard-library dispatcher build. Equal content-presence cases reuse the same fixture program; executable names select different payload producers. Discovery and operation each use separate synchronous child processes because the product sidecar protocol accepts one verb per process, and no per-case Go build remains.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each source and fixture cwd belong to this case. Its fixture owner installs an observer during cleanup and requests a completion refresh; the callback runs after native hint calls finish, closes the source and signals completion before fixture deletion. Close drops queued work and joins resident children; no full scheduler-goroutine join is claimed. A thirty-second wait reports failure and cancels the source, then a ten-second wait still requires the callback barrier. An unresolved barrier retains both the fixture and shared producer directory and fails the suite. The call-log environment is restored through t.Setenv. No cache invalidation is claimed.
// @evidence contracts/e2e.md#preserved-coverage This body retains its reviewed payload, command, edit, diagnostic, size or stream assertions and failure identity. The shared producer preserves each authored fixture verb body and deliberate failure; no assertion is replaced by metadata inspection and no portable assertion transfer is claimed.
func TestLSPNativePluginSourcePipesEmptyContentStdin(t *testing.T) {
  fixture := newNativePluginSourceTestFixture(t)
  dir := fixture.directory
  sidecar := buildNativePluginSourceTestSidecar(t, nativePluginSourceContentStdinSidecar)
  manifest, err := json.Marshal(driver.NativePluginManifest{
    LSPPlugins: []driver.NativeLSPPluginEntry{{Binary: sidecar, Name: "@ttsc/fake"}},
  })
  if err != nil {
    t.Fatal(err)
  }
  source, err := driver.NewNativePluginSource(driver.NativePluginSourceOptions{
    Cwd:          dir,
    ManifestJSON: string(manifest),
    Tsconfig:     "tsconfig.json",
  })
  if err != nil {
    t.Fatalf("NewNativePluginSource failed: %v", err)
  }
  fixture.source = source

  uri := "file:///tmp/a.ts"
  arg, _ := json.Marshal(uri)
  edit, err := source.ExecuteCommandWithContent("ttsc.format.document", []json.RawMessage{arg}, "", true)
  if err != nil {
    t.Fatalf("ExecuteCommandWithContent failed: %v", err)
  }
  if edit == nil || len(edit.Changes[uri]) != 1 {
    t.Fatalf("expected one edit, got %#v", edit)
  }
  if edit.Changes[uri][0].NewText != "FLAG:" {
    t.Fatalf("hasContent=true with empty content must still pass --content-stdin and pipe empty stdin, got %q", edit.Changes[uri][0].NewText)
  }
}

const nativePluginSourceContentStdinSidecar = `package main

import (
  "encoding/json"
  "fmt"
  "io"
  "os"
)

func main() {
  if len(os.Args) < 2 {
    os.Exit(2)
  }
  switch os.Args[1] {
  case "lsp-command-ids":
    fmt.Println(` + "`" + `["ttsc.format.document"]` + "`" + `)
  case "lsp-code-action-kinds":
    fmt.Println(` + "`" + `[]` + "`" + `)
  case "lsp-execute-command":
    hasFlag := false
    for _, a := range os.Args {
      if a == "--content-stdin" {
        hasFlag = true
      }
    }
    stdin := ""
    if hasFlag {
      data, _ := io.ReadAll(os.Stdin)
      stdin = string(data)
    }
    prefix := "NOFLAG:"
    if hasFlag {
      prefix = "FLAG:"
    }
    edit := map[string]any{
      "changes": map[string]any{
        "file:///tmp/a.ts": []any{
          map[string]any{
            "range": map[string]any{
              "start": map[string]any{"line": 0, "character": 0},
              "end":   map[string]any{"line": 0, "character": 0},
            },
            "newText": prefix + stdin,
          },
        },
      },
    }
    out, _ := json.Marshal(edit)
    fmt.Println(string(out))
  default:
    fmt.Println(` + "`" + `[]` + "`" + `)
  }
}
`
