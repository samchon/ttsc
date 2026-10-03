package vfs

import "testing"

// TestDecodeBytesUsesCompilerFilesystemSemantics verifies the real pinned
// decoder bridge against literal byte/text pairs, including endian, empty,
// truncated-code-unit and surrogate boundaries.
//
// The bridge must call upstream code so filesystem and overlay decoding cannot
// drift. No copied decoder or filesystem substitute runs in this test.
//
// 1. Supply literal byte inputs for each decoding boundary.
// 2. Call the linked compiler decoder in the test process.
// 3. Collect each independently specified Unicode text and success assertion.
//
// @evidence contracts/testing.md#behavioral-verification DecodeBytes links and calls the real pinned compiler filesystem decoder for every byte/text pair.
// @evidence contracts/testing.md#independent-expectations Literal bytes and Unicode text specify expected decoding independently of the linked implementation.
// @evidence contracts/testing.md#distinguishing-cases Plain newline spellings contrast UTF-8 BOM, both UTF-16 byte orders, empty inputs, odd trailing bytes, paired and unpaired surrogates.
// @evidence contracts/testing.md#execution-ownership TestDecodeBytesUsesCompilerFilesystemSemantics is a Go source unit executed through the actual shim module dependency from the owning compiler module, without an installed consumer or native product process.
func TestDecodeBytesUsesCompilerFilesystemSemantics(t *testing.T) {
	for _, input := range []struct{ name, bytes, text string }{
		{"plain", "a\r\nb\u2028c\u2029", "a\r\nb\u2028c\u2029"},
		{"utf8", "\xef\xbb\xbfhello", "hello"},
		{"little", "\xff\xfeh\x00i\x00", "hi"},
		{"big", "\xfe\xff\x00h\x00i", "hi"},
		{"empty", "", ""},
		{"empty little", "\xff\xfe", ""},
		{"empty big", "\xfe\xff", ""},
		{"odd little", "\xff\xfea\x00b", "a"},
		{"odd big", "\xfe\xff\x00ab", "a"},
		{"surrogate little", "\xff\xfe\x3d\xd8\x00\xde", "\U0001f600"},
		{"surrogate big", "\xfe\xff\xd8\x3d\xde\x00", "\U0001f600"},
		{"unpaired little", "\xff\xfe\x3d\xd8", "\ufffd"},
	} {
		t.Run(input.name, func(t *testing.T) {
			text, ok := DecodeBytes(input.bytes)
			if !ok || text != input.text { t.Errorf("DecodeBytes = %q, %v; want %q, true", text, ok, input.text) }
		})
	}
}
