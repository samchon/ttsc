package vfs

import (
	_ "github.com/microsoft/typescript-go/internal/vfs/osvfs"
	_ "unsafe"
)

// DecodeBytes applies the pinned compiler filesystem's BOM and UTF-16 decoding
// to one immutable byte string. Callers can hash the same captured bytes without
// another filesystem read; the returned text is suitable for compiler overlays.
// UTF-8 BOMs are removed; UTF-16 BOMs select byte order and upstream code-unit
// decoding. Other bytes pass through unchanged without UTF-8 validation. The
// pinned helper returns ok=true in every branch, so that flag does not certify
// well-formed encoding or successful file acquisition.
//
// @evidence contracts/common.md#principled-implementation The exact pinned filesystem decoder receives the caller's captured byte string so raw hashes and decoded text can share one immutable read.
// @evidence contracts/common.md#clear-and-simple-design One thin linkname bridge exposes upstream decoding without another filesystem abstraction or copied algorithm.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This declaration links the actual upstream helper, retaining BOM, endian and malformed-code-unit behavior rather than approximating the decoder locally.
// @evidence contracts/common.md#meaningful-documentation Native prose states captured-input ownership, BOM selection, unchanged non-BOM bytes and the pinned ok flag's lack of encoding or file-read certification.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources DecodeBytes declares a signature only; the implementation owns acquisition and release of resources.
// @evidenceExclude contracts/performance.md#efficient-algorithms DecodeBytes declares a signature only; the implementation owns the processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work DecodeBytes declares a signature only; the implementation owns any shared work.
// @evidenceExclude contracts/portability.md#os-neutral-implementation DecodeBytes is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
//
//go:linkname DecodeBytes github.com/microsoft/typescript-go/internal/vfs/internal.decodeBytes
func DecodeBytes(s string) (contents string, ok bool)
