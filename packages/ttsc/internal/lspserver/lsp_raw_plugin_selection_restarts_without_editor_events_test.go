package lspserver

import (
  "bytes"
  "context"
  "encoding/base64"
  "encoding/json"
  "errors"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strconv"
  "syscall"
  "testing"
  "time"
)

// TestLSPWorkspaceMetadataMatchesNode validates the native wire on a regular
// file and a Windows junction or POSIX directory link.
//
//  1. Have Node read metadata from authored fixture paths.
//  2. Require the native observer to admit both unchanged baselines.
//  3. Replace the regular file with bytes and a modification time that match
//     the original, then require its old baseline to fail.
//
// @evidence contracts/testing.md#behavioral-verification Native Go compares actual Node filesystem metadata, including the received link target and file identity.
// @evidence contracts/testing.md#independent-expectations Node observes the authored fixtures without using the Go observer or shared helper under test.
// @evidence contracts/testing.md#distinguishing-cases Ordinary files compare identity and change time. A Windows junction or POSIX directory link compares the leaf and readlink payload.
// @evidence contracts/testing.md#execution-ownership The test owns its files and joins one Node reporter. A host without Node cannot run this interoperability case.
func TestLSPWorkspaceMetadataMatchesNode(t *testing.T) {
  node, err := exec.LookPath("node")
  if err != nil {
    t.Skip("Node is unavailable")
  }
  root := t.TempDir()
  command := exec.Command(node, "-e", `
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[1];
const file = path.join(root, "workspace");
const target = path.join(root, "target");
const link = path.join(root, "alias");
fs.writeFileSync(file, "bytes");
fs.mkdirSync(target);
fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
const entries = [[file, "stat"], [link, "link"]];
if (process.platform !== "win32") {
  for (const name of ["first", "second"]) {
    fs.mkdirSync(path.join(root, name, "directory"), {recursive:true});
    fs.writeFileSync(path.join(root, name, "go-env"), "bytes");
  }
  fs.symlinkSync(path.join(root, "first", "directory"), path.join(root, "parent"));
  entries.push([root + "/parent/../go-env", "stat"]);
}
process.stdout.write(JSON.stringify(entries.map(([from, kind]) => {
  const stat = (kind === "stat" ? fs.statSync : fs.lstatSync)(from, {bigint:true});
  return {
    path: Buffer.from(from).toString("base64"), kind, mode: Number(stat.mode),
    modified: String(stat.mtimeNs), changed: String(stat.ctimeNs),
    size: kind === "stat" ? String(stat.size) : undefined,
    device: String(stat.dev), inode: String(stat.ino),
    target: kind === "link" ? fs.readlinkSync(from,{encoding:"buffer"}).toString("base64") : undefined
  };
})));
`, root)
  output, err := command.Output()
  if err != nil {
    t.Fatalf("Node fixture failed: %v", err)
  }
  var wire []NativePluginWorkspaceFile
  if err := json.Unmarshal(output, &wire); err != nil {
    t.Fatal(err)
  }
  want := 2
  if runtime.GOOS != "windows" {
    want = 3
  }
  if len(wire) != want {
    t.Fatalf("Node returned %d observations, want %d", len(wire), want)
  }
  selection, err := newPluginSelectionInputs(NativePluginSelectionInputs{WorkspaceFiles: wire})
  if err != nil {
    t.Fatal(err)
  }
  for _, input := range selection.workspaceFiles {
    if !input.current() {
      t.Fatalf("unchanged %s metadata differs: %#v", input.Kind, input.NativePluginWorkspaceFile)
    }
  }
  file := filepath.Join(root, "workspace")
  info, err := os.Stat(file)
  if err != nil {
    t.Fatal(err)
  }
  if err := os.Rename(file, filepath.Join(root, "previous")); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(file, []byte("bytes"), info.Mode().Perm()); err != nil {
    t.Fatal(err)
  }
  if err := os.Chtimes(file, info.ModTime(), info.ModTime()); err != nil {
    t.Fatal(err)
  }
  if selection.current() {
    t.Fatal("the replacement passed the previous workspace proof")
  }
  if runtime.GOOS != "windows" {
    input := selection.workspaceFiles[2]
    if !input.current() {
      t.Fatal("the unchanged lexical alias no longer resolves")
    }
    alias := filepath.Join(root, "parent")
    if err := os.Remove(alias); err != nil {
      t.Fatal(err)
    }
    if err := os.Symlink(filepath.Join(root, "second", "directory"), alias); err != nil {
      t.Fatal(err)
    }
    if input.current() {
      t.Fatal("retargeting before a parent component kept the old proof")
    }
  }
}

// TestLSPWorkspaceMetadataRestartsWithoutEditorEvents verifies that a workspace
// selector has its own native polling lane on every host.
//
//  1. Admit the observed metadata of one ordinary external file.
//  2. Change only the fixture file without sending an editor event.
//  3. Require the live proxy to announce and return a selection restart.
//
// @evidence contracts/testing.md#behavioral-verification The proxy runs its actual polling loop against a changed native file.
// @evidence contracts/testing.md#independent-expectations The fixture supplies a literal file size and its independently observed modification time. Its written contents make the new file longer.
// @evidence contracts/testing.md#distinguishing-cases The unchanged file first validates and is absent from editor watch registrations.
// @evidence contracts/testing.md#execution-ownership The Go test owns the file and both ends of the simulated editor transport.
func TestLSPWorkspaceMetadataRestartsWithoutEditorEvents(t *testing.T) {
  root := t.TempDir()
  file := filepath.Join(root, "go-env")
  if err := os.WriteFile(file, []byte("first"), 0o600); err != nil {
    t.Fatal(err)
  }
  // Node reports writable permission on Windows and native permission on POSIX.
  mode := uint32(0o100600)
  if runtime.GOOS != "windows" {
    if err := os.Chmod(file, 0o600); err != nil {
      t.Fatal(err)
    }
  }
  info, err := os.Stat(file)
  if err != nil {
    t.Fatal(err)
  }
  selection := NativePluginSelectionInputs{WorkspaceFiles: []NativePluginWorkspaceFile{{
    Path: base64.StdEncoding.EncodeToString([]byte(file)), Kind: "stat", Mode: &mode,
    Size: "5", Modified: strconv.FormatInt(info.ModTime().UnixNano(), 10),
  }}}
  assertLSPRawPluginSelectionRestart(t, root, selection, func() {
    if err := os.WriteFile(file, []byte("second"), 0o600); err != nil {
      t.Fatal(err)
    }
  })
}

// TestLSPRawPluginSelectionRestartsWithoutEditorEvents verifies that changes
// at POSIX byte paths end the proxy session without an editor watcher event.
// Editors may be unable to represent those paths.
//
//  1. Load a selection for a raw link or an aliased source directory.
//  2. Initialize the proxy and retarget the link, modify a source file, or add a
//     source file.
//  3. Check the client notification and the session's restart verdict.
//
// @evidence contracts/testing.md#behavioral-verification Native link retargeting, source content, source membership and workspace mode changes each drive the periodic check, restart sentinel and client notification through Run.
// @evidence contracts/testing.md#independent-expectations Equal-content files isolate retargeting. Independent source mutations change either one recorded file or the directory population. Each case expects the restart sentinel and literal notification payload. The production digest helper supplies the baseline.
// @evidence contracts/testing.md#distinguishing-cases Unchanged inputs are current. Both ordinary and raw workspace paths detect a mode-only change. A source directory is declared through a UTF-8 alias and uses no raw descriptor entries, so the source cases require normalization and polling of the directory group itself. Windows and filesystems that reject the byte fixtures with EILSEQ skip the relevant cases.
// @evidence contracts/testing.md#execution-ownership The Go unit owns its temporary files, proxy pipes and source. Pipe cleanup unblocks pumps on failure. No real editor or sidecar is required.
func TestLSPRawPluginSelectionRestartsWithoutEditorEvents(t *testing.T) {
  if runtime.GOOS == "windows" {
    t.Skip("requires POSIX byte paths")
  }
  for _, name := range []string{"workspace", "workspace-\xff"} {
    t.Run(name+" metadata", func(t *testing.T) {
      root := t.TempDir()
      file := filepath.Join(root, name)
      if err := os.WriteFile(file, []byte("configuration"), 0o600); err != nil {
        if errors.Is(err, syscall.EILSEQ) {
          t.Skip("filesystem refused a non-UTF-8 filename")
        }
        t.Fatal(err)
      }
      // Fix the mask independently of the process umask.
      if err := os.Chmod(file, 0o600); err != nil {
        t.Fatal(err)
      }
      mode := uint32(0o100600)
      inputs := NativePluginSelectionInputs{WorkspaceFiles: []NativePluginWorkspaceFile{{
        Path: base64.StdEncoding.EncodeToString([]byte(file)), Kind: "stat", Mode: &mode,
      }}}
      assertLSPRawPluginSelectionRestart(t, root, inputs, func() {
        if err := os.Chmod(file, 0o400); err != nil {
          t.Fatal(err)
        }
      })
    })
  }
  t.Run("same-content link retarget", func(t *testing.T) {
    root := t.TempDir()
    first := filepath.Join(root, "first.js")
    second := filepath.Join(root, "second.js")
    for _, file := range []string{first, second} {
      if err := os.WriteFile(file, []byte("module.exports = {};"), 0o644); err != nil {
        t.Fatal(err)
      }
    }
    middle := filepath.Join(root, "middle-\xff")
    if err := os.Symlink(first, middle); err != nil {
      if errors.Is(err, syscall.EILSEQ) {
        t.Skip("filesystem refused a non-UTF-8 filename")
      }
      t.Fatal(err)
    }
    selection := NativePluginSelectionInputs{
      RawDescriptorFiles: map[string]string{
        base64.StdEncoding.EncodeToString([]byte(middle)): projectInputReloadFileDigest(middle),
      },
    }
    assertLSPRawPluginSelectionRestart(t, root, selection, func() {
      if err := os.Remove(middle); err != nil {
        t.Fatal(err)
      }
      if err := os.Symlink(second, middle); err != nil {
        t.Fatal(err)
      }
    })
  })

  for _, change := range []struct {
    name string
    file string
  }{
    {"source content", "compiler.go"},
    {"source membership", "added.go"},
  } {
    t.Run(change.name, func(t *testing.T) {
      root := t.TempDir()
      physical := filepath.Join(root, "compiler-\xff")
      if err := os.Mkdir(physical, 0o755); err != nil {
        if errors.Is(err, syscall.EILSEQ) {
          t.Skip("filesystem refused a non-UTF-8 directory")
        }
        t.Fatal(err)
      }
      alias := filepath.Join(root, "compiler")
      if err := os.Symlink(physical, alias); err != nil {
        t.Fatal(err)
      }
      file := filepath.Join(alias, "compiler.go")
      if err := os.WriteFile(file, []byte("package original\n"), 0o644); err != nil {
        t.Fatal(err)
      }
      selection := NativePluginSelectionInputs{
        SourceFiles: map[string]map[string]string{
          alias: {"compiler.go": projectInputReloadFileDigest(file)},
        },
      }
      assertLSPRawPluginSelectionRestart(t, root, selection, func() {
        if err := os.WriteFile(filepath.Join(physical, change.file), []byte("package changed\n"), 0o644); err != nil {
          t.Fatal(err)
        }
      })
    })
  }
}

// assertLSPRawPluginSelectionRestart checks the restart after initialization
// without registering editor watchers or sending a watched-files event.
func assertLSPRawPluginSelectionRestart(
  t *testing.T,
  root string,
  selection NativePluginSelectionInputs,
  change func(),
) {
  t.Helper()
  manifest, err := json.Marshal(NativePluginManifest{SelectionInputs: &selection})
  if err != nil {
    t.Fatal(err)
  }
  source, err := NewNativePluginSource(NativePluginSourceOptions{Cwd: root, ManifestJSON: string(manifest)})
  if err != nil {
    t.Fatal(err)
  }
  t.Cleanup(source.shutdownResidents)
  if !source.ProjectInputReloadFingerprintsAreCurrent() || len(source.ProjectInputs().WatchDirectories) != 0 {
    t.Fatal("the unchanged byte path should be current and stay out of editor registrations")
  }

  editorIn, editorWrite := io.Pipe()
  upstreamOut, upstreamWrite := io.Pipe()
  t.Cleanup(func() {
    editorIn.Close()
    editorWrite.Close()
    upstreamOut.Close()
    upstreamWrite.Close()
  })
  var editorOut bytes.Buffer
  proxy := NewProxy(ProxyOptions{
    EditorIn:    editorIn,
    EditorOut:   &editorOut,
    UpstreamIn:  io.Discard,
    UpstreamOut: upstreamOut,
    Source:      source,
  })
  done := make(chan error, 1)
  go func() { done <- proxy.Run(context.Background()) }()
  if err := WriteFrame(editorWrite, []byte(`{"jsonrpc":"2.0","method":"initialized","params":{}}`)); err != nil {
    t.Fatal(err)
  }
  change()
  select {
  case err := <-done:
    if !errors.Is(err, ErrLSPPluginSelectionChanged) {
      t.Fatalf("proxy result = %v, want plugin selection restart", err)
    }
  case <-time.After(5 * time.Second):
    t.Fatal("the proxy did not restart after a change at a non-UTF-8 path")
  }
  _, body, err := NewFrameReader(&editorOut).Read()
  if err != nil {
    t.Fatal(err)
  }
  env, err := ParseEnvelope(body)
  if err != nil || env.Method != "ttsc/pluginSelectionChanged" || string(env.Params) != `{"reason":"projectInputChanged"}` {
    t.Fatalf("unexpected restart notification %q: %v", body, err)
  }
}
