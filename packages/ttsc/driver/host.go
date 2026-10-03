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

// DefaultFS wraps the shared native OS backend in a fresh metadata cache and
// the compiler's library adapter. Normal embedded builds use built-in library
// text; noembed builds instead rely on libraries available on disk. Neither
// mode downloads libraries here.
//
// @evidence contracts/common.md#principled-implementation The compiler's library adapter overlays a fresh cached native backend when embedding is enabled, or preserves that backend for the native noembed library layout.
// @evidence contracts/common.md#clear-and-simple-design One factory composes the three upstream filesystem layers rather than reproducing their lookup policies.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Bundled resolution uses the supported WrapFS boundary without patching upstream filesystem methods.
// @evidence contracts/common.md#meaningful-documentation Native prose explains embedded definitions and absence of a network fetch following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The factory preserves the upstream backend's reported compiler case policy and native operations, not a new per-directory or per-volume sensitivity probe.
// @evidence contracts/performance.md#bound-retention-and-release-resources The fresh metadata cache transfers to the caller-owned FS stack; queried paths, directory entries, realpaths and stat data can grow retained bytes without a cap here. Native cache clearing or losing caller references controls its lifetime, not a driver-owned close operation.
// @evidence contracts/performance.md#efficient-algorithms Construction allocates an empty metadata-cache wrapper and, in embedded builds, a library wrapper around the shared OS backend; it performs no source scan or metadata population. Later lookups and cache growth belong to the returned stack's use.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh wrapper stack; callers that want one shared stack hold the returned value.
func DefaultFS() vfs.FS {
  return bundled.WrapFS(cachedvfs.From(osvfs.FS()))
}

// DefaultHost returns a CompilerHost anchored at cwd that can find tsgo's
// bundled library files via `bundled.LibPath()`.
// The constructor retains the supplied cwd and FS without independently
// normalizing or probing that anchor. In noembed builds the native library
// provider initializes a process-wide disk location, which can perform native
// queries or panic if its required library layout is unavailable.
//
// @evidence contracts/common.md#principled-implementation The supplied FS and cwd are passed to the upstream CompilerHost with the matching bundled-library location.
// @evidence contracts/common.md#clear-and-simple-design Host construction stays in one adapter used by initial and incremental program creation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported CompilerHost constructor owns behavior without an injected foreign-method replacement.
// @evidence contracts/common.md#meaningful-documentation Native prose names project anchoring and bundled library lookup under documentation-skill guidance.
// @evidence contracts/portability.md#os-neutral-implementation The host uses the supplied filesystem's native capabilities and upstream path handling rather than hardcoded OS path rules.
// @evidence contracts/performance.md#bound-retention-and-release-resources The new host transfers its cwd/library strings and supplied FS reference to the caller; keeping it reachable also keeps that FS stack and its caches reachable. The factory adds no separate host cache, handle or release operation.
// @evidence contracts/performance.md#efficient-algorithms Host allocation initializes fixed fields; embedded library location is a constant, while first noembed location initialization can query executable/realpath/library metadata under the native provider's once cache. This constructor does not parse source files, but delegated location work is not universally a fixed field assignment.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each returned host retains its supplied cwd/FS without a driver-owned cache or request coordinator; the native library provider owns any process-wide location sharing.
func DefaultHost(cwd string, fs vfs.FS) shimcompiler.CompilerHost {
  return shimcompiler.NewCompilerHost(cwd, fs, bundled.LibPath(), nil, nil)
}
