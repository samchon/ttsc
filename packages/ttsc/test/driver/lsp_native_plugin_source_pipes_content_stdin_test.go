//go:build e2e

package driver_test

import (
  _ "embed"
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
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes NativePluginSource against a built static child that reflects actual argv and stdin into a decoded edit; this is a native protocol boundary, without an editor or formatter CLI.
// @evidence contracts/e2e.md#necessary-boundary The nonempty bytes and content-presence flag must cross the child connection together; the independent FLAG: echo detects lost text or missing native argv, unlike a local option decision.
// @evidence contracts/e2e.md#shared-execution One existing lazy dispatcher build supplies the same static content fixture to nonempty, absent and empty-present cases; they request no independent compilation.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its source and cwd, while unchanged echo-program bytes are shared. Cleanup waits for the supported source completion barrier before reclamation or retains unresolved inputs; no arbitrary descendant join is inferred.
// @evidence contracts/e2e.md#preserved-coverage Original nonempty text, command URI, one-edit assertion and exact FLAG:const buffered = 1; value remain here; actual formatting and editor application are outside this echo oracle.
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
// no-content command path: an ordinary ExecuteCommand call must not
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
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the ordinary native command against the built static echo child; its actual argv observation returns through WorkspaceEdit decoding, without an editor or disk formatter.
// @evidence contracts/e2e.md#necessary-boundary The child must observe no content-stdin flag for the ordinary command path. Its NOFLAG: result checks the actual argv connection; this branch intentionally does not read stdin and therefore does not certify absent stdin bytes.
// @evidence contracts/e2e.md#shared-execution The ordinary command uses the same unchanged echo entry from the one lazy dispatcher build as both explicit-content cases.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private source and cwd isolate command ownership for this case. Shared artifact bytes are unchanged; source completion precedes normal cleanup and unresolved execution retains inputs rather than assuming release.
// @evidence contracts/e2e.md#preserved-coverage Original ExecuteCommand input, single edit and exact NOFLAG: result remain; explicit empty-present and nonempty content keep separate assertions, and no disk-formatting effect is claimed.
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
    t.Fatalf("expected the fixture's no --content-stdin flag marker, got %q", edit.Changes[uri][0].NewText)
  }
}

// TestLSPNativePluginSourcePipesEmptyContentStdin verifies the empty-buffer gate.
// When hasContent is true the source must append --content-stdin and pipe stdin
// even though content is "". The fixture reports the flag present and echoes
// empty stdin bytes; this does not execute actual formatting or compare disk
// contents, and the authored echo fixture does not report io.ReadAll errors.
//
// 1. Select the content-echo fixture from the shared native batch.
// 2. Pass empty text with hasContent=true to ExecuteCommandWithContent.
// 3. Require one edit containing FLAG: to distinguish present from absent content.
//
// @evidence contracts/testing.md#behavioral-verification ExecuteCommandWithContent with hasContent=true and empty text returns FLAG:, proving explicit empty content is not mistaken for missing content.
// @evidence contracts/testing.md#independent-expectations The explicit content-presence contract requires the flag even for empty text; the independent FLAG: literal distinguishes it from the no-content path, without certifying disk or formatting semantics.
// @evidence contracts/testing.md#distinguishing-cases Empty-but-present input complements both nonempty content and the ordinary no-content command.
// @evidence contracts/testing.md#execution-ownership Go test/driver sends explicit empty content through the native command and receives the built fixture's decoded flag/echo edit; this is a child protocol boundary, not an editor formatting test.
// @evidence contracts/e2e.md#necessary-boundary The actual child argv must retain content presence when the transmitted text is empty; FLAG: versus NOFLAG: distinguishes this connection's presence gate, without independently proving the fixture's unchecked stdin read succeeded.
// @evidence contracts/e2e.md#shared-execution This empty-present input reuses the unchanged content-echo fixture from the lazy batch build used by the other two content states.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns its source and cwd; unchanged echo binary inputs are shared, and cleanup waits for the source completion barrier before removal or retains unresolved inputs.
// @evidence contracts/e2e.md#preserved-coverage Original hasContent=true/empty text, single-edit and exact FLAG: assertions remain here; ordinary absent-content and nonempty-text outcomes remain distinct cases, without claiming editor or disk effects.
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

//go:embed testdata/native-plugin-source/content-stdin.go.txt
var nativePluginSourceContentStdinSidecar string
