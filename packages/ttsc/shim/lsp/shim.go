// gen_shims:hand-maintained
//
// Minimal shim of tsgo's internal/lsp package. Hand-written instead of
// generated so the surface stays narrow for custom in-process host
// experiments. The shipped ttscserver wraps `tsgo --lsp --stdio` as an
// external process and does not import this package. The marker on the
// first line tells gen_shims to skip this file.
package lsp

import (
  "io"
  _ "unsafe"

  innerlsp "github.com/microsoft/typescript-go/internal/lsp"
)

// Server is the opaque LSP server type from tsgo.
//
// @evidence contracts/common.md#principled-implementation A Go alias preserves the upstream server identity and method set, so NewServer results can be used without an incompatible wrapper type.
// @evidence contracts/common.md#clear-and-simple-design The opaque alias leaves protocol state and execution with the existing server instead of duplicating its lifecycle in the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts This bridge names the actual upstream type without substituting a ttsc-specific server or mutating its methods.
// @evidence contracts/common.md#meaningful-documentation The declaration identifies opaque server provenance; package prose explains the experimental in-process scope and the shipped external-process host distinction.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Server = innerlsp.Server

// ServerOptions mirrors the upstream construction parameters. Fields with
// internal-package types (e.g. ParseCache *project.ParseCache) can be left
// unset by callers when upstream accepts nil.
//
// @evidence contracts/common.md#principled-implementation The alias retains the upstream options fields and callback types exactly; no shadow struct loses filesystem, transport or construction distinctions.
// @evidence contracts/common.md#clear-and-simple-design Server construction accepts its native configuration directly, avoiding a second options mapper beside NewServer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Callers supply upstream configuration rather than consumer-specific defaults or fabricated project state.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies construction purpose and the internal-type limitation, conditioning omission on upstream nil support rather than promising every field is optional.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ServerOptions = innerlsp.ServerOptions

// Reader receives decoded lsproto.Message values from the upstream LSP transport.
//
// @evidence contracts/common.md#principled-implementation Aliasing the upstream interface preserves its Read result and error contract, including its exact message identity.
// @evidence contracts/common.md#clear-and-simple-design The reader interface names the inbound message boundary independently of byte-stream adaptation in ToReader.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Messages remain upstream protocol values rather than a simplified ttsc-only request schema.
// @evidence contracts/common.md#meaningful-documentation The comment identifies decoded inbound messages; it does not conflate this message reader with io.Reader bytes.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Reader = innerlsp.Reader

// Writer sends lsproto.Message values through the upstream LSP transport.
//
// @evidence contracts/common.md#principled-implementation Aliasing the upstream Write interface preserves message type identity and its returned transport error.
// @evidence contracts/common.md#clear-and-simple-design The outbound message interface remains distinct from the byte writer wrapped by ToWriter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The transport keeps upstream protocol messages without modifying a foreign writer or hiding failed writes.
// @evidence contracts/common.md#meaningful-documentation The native comment names outbound messages and distinguishes the interface from raw byte output.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Writer = innerlsp.Writer

// NewServer constructs the upstream in-process server. opts must be non-nil
// and supply Cwd; missing Cwd panics under the upstream construction contract.
//
// @evidence contracts/common.md#principled-implementation The exact linked constructor receives aliased options and returns the upstream Server; its non-nil options and required Cwd premises remain caller obligations.
// @evidence contracts/common.md#clear-and-simple-design One constructor bridge leaves initialization, project state and queues with the upstream server rather than layering a separate host lifecycle.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit symbol linkage exposes the existing implementation; the shim does not fake server readiness or patch construction defaults.
// @evidence contracts/common.md#meaningful-documentation Native prose states in-process purpose, required options and the Cwd panic boundary before the linked declaration.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NewServer declares a signature only; the implementation owns acquisition and release of resources.
// @evidenceExclude contracts/performance.md#efficient-algorithms NewServer declares a signature only; the implementation owns the processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NewServer declares a signature only; the implementation owns any shared work.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NewServer is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
//
//go:linkname NewServer github.com/microsoft/typescript-go/internal/lsp.NewServer
func NewServer(opts *ServerOptions) *Server

// ToReader adapts an io.Reader into the upstream framed-message decoder.
// It retains the supplied stream; the caller owns that stream's lifetime.
//
// @evidence contracts/common.md#principled-implementation The linked adapter constructs upstream lsproto framing and message decoding over the supplied byte stream, preserving the server's Reader contract.
// @evidence contracts/common.md#clear-and-simple-design A single adapter separates raw bytes from decoded messages without a parallel JSON-RPC parser in the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The actual stream is supplied explicitly; no process-global input replacement or canned decoded request is used.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies framing and retained-stream ownership rather than merely repeating the conversion name.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ToReader declares a signature only; the implementation owns acquisition and release of resources.
// @evidenceExclude contracts/performance.md#efficient-algorithms ToReader declares a signature only; the implementation owns the processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ToReader declares a signature only; the implementation owns any shared work.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ToReader is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
//
//go:linkname ToReader github.com/microsoft/typescript-go/internal/lsp.ToReader
func ToReader(r io.Reader) Reader

// ToWriter adapts an io.Writer into the upstream framed-message encoder.
// It retains the supplied stream; the caller owns that stream's lifetime.
//
// @evidence contracts/common.md#principled-implementation The linked adapter uses upstream JSON encoding and lsproto framing on the supplied byte writer, retaining the Writer error contract.
// @evidence contracts/common.md#clear-and-simple-design One adapter owns message-to-byte representation while the upstream transport owns serialization and framing details.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Output uses the caller's stream rather than a replacement global stdout or a success-only transport stub.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies encoding and retained-stream ownership, with a blank comment separator before the acknowledgment tags.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ToWriter declares a signature only; the implementation owns acquisition and release of resources.
// @evidenceExclude contracts/performance.md#efficient-algorithms ToWriter declares a signature only; the implementation owns the processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ToWriter declares a signature only; the implementation owns any shared work.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ToWriter is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
//
//go:linkname ToWriter github.com/microsoft/typescript-go/internal/lsp.ToWriter
func ToWriter(w io.Writer) Writer
