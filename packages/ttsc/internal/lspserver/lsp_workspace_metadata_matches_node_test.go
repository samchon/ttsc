package lspserver

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

// TestLSPWorkspaceMetadataMatchesNode validates the native wire on a regular
// file and a Windows junction or POSIX directory link.
//
//  1. Have Node read metadata from authored fixture paths.
//  2. Require the native observer to admit unchanged baselines.
//  3. Replace a file under identical bytes and modification time, then rename
//     a directory under the same identity and retarget its alias.
//
// @evidence contracts/testing.md#behavioral-verification Native Go compares actual Node filesystem metadata, including the received link target and file identity.
// @evidence contracts/testing.md#independent-expectations Node observes the authored fixtures without using the Go observer or shared helper under test.
// @evidence contracts/testing.md#distinguishing-cases Ordinary files compare identity and change time. A Windows junction or POSIX directory link compares its leaf and its physical directory spelling separately. POSIX preserves link traversal before a lexical parent component.
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
const entries = [[file, "stat"], [link, "link"], [link, "directory"]];
if (process.platform !== "win32") {
  for (const name of ["first", "second"]) {
    fs.mkdirSync(path.join(root, name, "directory"), {recursive:true});
  }
  fs.mkdirSync(path.join(root, "first", "configuration"));
  fs.symlinkSync(path.join(root, "first", "directory"), path.join(root, "parent"));
  entries.push([root + "/parent/../configuration", "directory"]);
}
process.stdout.write(JSON.stringify(entries.map(([from, kind]) => {
  const stat = (kind === "link" ? fs.lstatSync : fs.statSync)(from, {bigint:true});
  return {
    path: Buffer.from(from).toString("base64"), kind, mode: Number(stat.mode),
    modified: kind === "directory" ? undefined : String(stat.mtimeNs),
    changed: kind === "directory" ? undefined : String(stat.ctimeNs),
    size: kind === "stat" ? String(stat.size) : undefined,
    device: String(stat.dev), inode: String(stat.ino),
    physical: kind === "directory" ? Buffer.from(fs.realpathSync.native(from)).toString("base64") : undefined,
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
	want := 3
	if runtime.GOOS != "windows" {
		want = 4
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
	moved := exec.Command(node, "-e", `
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[1];
const alias = path.join(root, "alias");
const renamed = path.join(root, "renamed");
fs.renameSync(path.join(root, "target"), renamed);
fs.unlinkSync(alias);
fs.symlinkSync(renamed, alias, process.platform === "win32" ? "junction" : "dir");
`, root)
	if output, err := moved.CombinedOutput(); err != nil {
		t.Fatalf("retargeting directory fixture: %v\n%s", err, output)
	}
	directory := selection.workspaceFiles[2]
	if directory.current() {
		t.Fatal("a new physical spelling passed the original directory proof")
	}
	directory.physical = ""
	if !directory.current() {
		t.Fatal("a rename of the original directory did not preserve its metadata")
	}
	if runtime.GOOS != "windows" {
		input := selection.workspaceFiles[3]
		if !input.current() {
			t.Fatal("the unchanged lexical alias no longer resolves")
		}
		alias := filepath.Join(root, "parent")
		if err := os.Remove(alias); err != nil {
			t.Fatal(err)
		}
		if err := os.Rename(filepath.Join(root, "first", "configuration"), filepath.Join(root, "second", "configuration")); err != nil {
			t.Fatal(err)
		}
		if err := os.Symlink(filepath.Join(root, "second", "directory"), alias); err != nil {
			t.Fatal(err)
		}
		if input.current() {
			t.Fatal("retargeting before a parent component kept the old proof")
		}
		input.physical = ""
		if !input.current() {
			t.Fatal("retargeting before a parent component did not preserve the directory's metadata")
		}
	}
}
