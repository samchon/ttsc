package main

import (
	"crypto/sha256"
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"unicode/utf16"

	"github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

// TestServeSourceEncodingKeepsRawIdentityAndDecodedResidentText verifies eight
// source encodings through one real resident compiler and shard owner.
//
// Cold and unchanged snapshots contrast an unrelated edit, encoded edits and
// restoration. Raw disk digests remain byte hashes while overlay source text
// stays compiler-decoded. Every independent file assertion is collected.
//
// 1. Load eight encoded sources into one real resident compiler.
// 2. Request unchanged, unrelated-edit, encoded-edit and restored snapshots.
// 3. Check publication, decoded text and raw-byte identity independently.
//
// @evidence contracts/testing.md#behavioral-verification The real resident graph session publishes cold and incremental shard snapshots, retains decoded compiler text, and keeps raw disk hashes and changed-source decisions consistent for all eight encodings.
// @evidence contracts/testing.md#independent-expectations Literal source text and BOM/endian byte encoding define both domains; standard SHA-256 supplies expected raw identity independently of session hashing and decoding.
// @evidence contracts/testing.md#distinguishing-cases UTF-8 BOM, UTF-16 LE/BE and five newline spellings run through unchanged requests, an unrelated source edit, encoded edits, restoration and another unchanged request; every source assertion is collected independently.
// @evidence contracts/testing.md#execution-ownership This Go source-unit entry calls the actual resident compiler and prepared shard transaction through snapshotGraphShardState with explicit empty ignore membership. The owned fixture and compiler close in this process; no consumer installation, native product build or product child is used.
//
func TestServeSourceEncodingKeepsRawIdentityAndDecodedResidentText(t *testing.T) {
	root := t.TempDir()
	writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true},"include":["src"]}`)
	writeGraphFile(t, filepath.Join(root, "src", "unrelated.ts"), "export const unrelated = 1;\n")
	names := []string{"Utf8Bom", "Utf16Le", "Utf16Be", "Lf", "CrLf", "Cr", "Ls", "Ps"}
	text := func(name, suffix string) string {
		separator := map[string]string{"CrLf":"\r\n", "Cr":"\r", "Ls":"\u2028", "Ps":"\u2029"}[name]
		if separator == "" { separator = "\n" }
		return strings.Join([]string{"/** " + name + suffix + " docs. */", "export function " + name + "(): string {", "  return \"" + name + suffix + "\";", "}", ""}, separator)
	}
	bytesOf := func(name, source string) []byte {
		if name == "Utf8Bom" { return append([]byte{0xef, 0xbb, 0xbf}, []byte(source)...) }
		if name != "Utf16Le" && name != "Utf16Be" { return []byte(source) }
		units := utf16.Encode([]rune(source))
		var order binary.ByteOrder = binary.LittleEndian
		result := make([]byte, 2+len(units)*2)
		copy(result, []byte{0xff, 0xfe})
		if name == "Utf16Be" { order = binary.BigEndian; copy(result, []byte{0xfe, 0xff}) }
		for i, unit := range units { order.PutUint16(result[2+i*2:], unit) }
		return result
	}
	write := func(suffix string) {
		for _, name := range names {
			file := filepath.Join(root, "src", name+".ts")
			if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil { t.Fatal(err) }
			if err := os.WriteFile(file, bytesOf(name, text(name, suffix)), 0o644); err != nil { t.Fatal(err) }
		}
	}
	write("")
	session, err := newGraphSession(root, "tsconfig.json")
	if err != nil { t.Fatal(err) }
	defer session.Close()
	verify := func(stage, suffix, expectedMode string) {
		snapshot, mode, changed, err := snapshotGraphShardState(session)
		if err != nil { t.Fatal(err) }
		if mode != expectedMode { t.Errorf("%s mode=%s want=%s", stage, mode, expectedMode) }
		if expectedMode == serveModeUnchanged {
			if snapshot != nil || changed { t.Errorf("%s unexpectedly published a changed snapshot", stage) }
		} else if snapshot == nil || !changed {
			t.Errorf("%s did not publish its changed snapshot", stage)
		}
		hashes, digests, err := hashProgramSources(session.compiler.Program())
		if err != nil { t.Fatal(err) }
		for _, name := range names {
			file := filepath.Join(root, "src", name+".ts")
			source := session.compiler.Program().SourceFile(file)
			if source == nil { t.Errorf("%s missing source %s", stage, name); continue }
			if source.Text() != text(name, suffix) { t.Errorf("%s %s decoded text=%q want=%q", stage, name, source.Text(), text(name, suffix)) }
			rawHash := sha256.Sum256(bytesOf(name, text(name, suffix)))
			if hashes[source.FileName()] != rawHash { t.Errorf("%s %s invalidation identity differs from raw bytes", stage, name) }
			if digests[source.FileName()] != graph.Digest(rawHash) { t.Errorf("%s %s disk digest differs from raw bytes", stage, name) }
		}
		changes, deleted, err := changedSources(hashes)
		if err != nil { t.Fatal(err) }
		if deleted || len(changes) != 0 { t.Errorf("%s unchanged encoded sources marked dirty: %v deleted=%v", stage, changes, deleted) }
	}
	verify("cold", "", serveModeInitial)
	verify("unchanged", "", serveModeUnchanged)
	writeGraphFile(t, filepath.Join(root, "src", "unrelated.ts"), "export const unrelated = 2;\n")
	verify("unrelated edit", "", serveModeIncremental)
	write(" edited")
	verify("encoded edits", " edited", serveModeIncremental)
	write("")
	verify("restored", "", serveModeIncremental)
	verify("restored unchanged", "", serveModeUnchanged)
}
