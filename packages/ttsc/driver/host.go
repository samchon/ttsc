// Package driver wraps the typescript-go compiler so the rest of ttsc doesn't
// need to know about shim packages directly. It is the only part of the engine
// that imports `shim/*` by design — everything downstream consumes a small,
// shim-agnostic interface (`*Program`).
//
// Structural note: this file is deliberately adapted from tsgonest's
// `internal/compiler/host.go` (MIT, github.com/tsgonest/tsgonest).
// The helper surface is the same because both hosts need the same bundled-lib
// filesystem and CompilerHost construction.
package driver

import (
  "github.com/microsoft/typescript-go/shim/bundled"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  "github.com/microsoft/typescript-go/shim/vfs"
  "github.com/microsoft/typescript-go/shim/vfs/cachedvfs"
  "github.com/microsoft/typescript-go/shim/vfs/osvfs"
)

// DefaultFS returns an OS-backed filesystem wrapped with tsgo's bundled libs so
// built-in definitions (lib.es*.d.ts, dom, etc.) resolve without a network
// fetch. Mirrors tsgonest/tsgolint behavior.
//
// @evidence contracts/common.md#principled-implementation Bundled libraries overlay the compiler's cached OS filesystem so standard definitions use the compiler version's embedded contents.
// @evidence contracts/common.md#clear-and-simple-design One factory composes the three upstream filesystem layers rather than reproducing their lookup policies.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Bundled resolution uses the supported WrapFS boundary without patching upstream filesystem methods.
// @evidence contracts/common.md#meaningful-documentation Native prose explains embedded definitions and absence of a network fetch following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Upstream osvfs supplies native filesystem behavior and capabilities; the factory does not guess them from a platform string.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned stack owns its cache for as long as the caller keeps it; the function itself retains nothing.
// @evidenceExclude contracts/performance.md#efficient-algorithms Composes three filesystem wrappers once per call; there is no loop.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh wrapper stack; callers that want one shared stack hold the returned value.
func DefaultFS() vfs.FS {
  return bundled.WrapFS(cachedvfs.From(osvfs.FS()))
}

// DefaultHost returns a CompilerHost anchored at cwd that can find tsgo's
// bundled library files via `bundled.LibPath()`.
//
// @evidence contracts/common.md#principled-implementation The supplied FS and cwd are passed to the upstream CompilerHost with the matching bundled-library location.
// @evidence contracts/common.md#clear-and-simple-design Host construction stays in one adapter used by initial and incremental program creation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported CompilerHost constructor owns behavior without an injected foreign-method replacement.
// @evidence contracts/common.md#meaningful-documentation Native prose names project anchoring and bundled library lookup under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation The host uses the supplied filesystem's native capabilities and upstream path handling rather than hardcoded OS path rules.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources DefaultHost acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms DefaultHost performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work DefaultHost computes one result per call, so there is no repeated work to share.
func DefaultHost(cwd string, fs vfs.FS) shimcompiler.CompilerHost {
  return shimcompiler.NewCompilerHost(cwd, fs, bundled.LibPath(), nil, nil)
}
