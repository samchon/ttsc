package vfs

import (
	_ "github.com/microsoft/typescript-go/internal/vfs/osvfs"
	_ "unsafe"
)

// DecodeBytes applies the pinned compiler filesystem's BOM and UTF-16 decoding
// to one immutable byte string. Callers can hash the same captured bytes without
// another filesystem read; the returned text is suitable for compiler overlays.
//
// @evidence contracts/common.md#principled-implementation The exact pinned filesystem decoder receives the caller's captured byte string so raw hashes and decoded text can share one immutable read.
// @evidence contracts/common.md#clear-and-simple-design One thin linkname bridge exposes upstream decoding without another filesystem abstraction or copied algorithm.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This declaration links the actual upstream helper, retaining BOM, endian and malformed-code-unit behavior rather than approximating the decoder locally.
// @evidence contracts/common.md#meaningful-documentation Native prose states immutable input, decoded overlay output and ownership of the disk read.
//
//go:linkname DecodeBytes github.com/microsoft/typescript-go/internal/vfs/internal.decodeBytes
func DecodeBytes(s string) (contents string, ok bool)
