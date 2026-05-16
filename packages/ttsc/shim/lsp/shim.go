// gen_shims:hand-maintained
//
// Minimal shim of tsgo's internal/lsp package. Hand-written instead of
// generated so the surface stays narrow: ttscserver embeds the tsgo LSP
// server unmodified and intercepts traffic at the byte level, so the only
// types it touches are the opaque Server, its options struct, and the
// Reader/Writer interfaces that ToReader/ToWriter return. The marker on
// the first line tells gen_shims to skip this file.
package lsp

import (
  "io"
  _ "unsafe"

  innerlsp "github.com/microsoft/typescript-go/internal/lsp"
)

// Server is the opaque LSP server type from tsgo. ttscserver does not poke
// its internals; it only calls Run and (via wrapped Writer) observes the
// traffic the server emits.
type Server = innerlsp.Server

// ServerOptions mirrors the upstream construction parameters. Fields with
// internal-package types (e.g. ParseCache *project.ParseCache) are left
// unset by ttscserver, which is safe because every such field is an
// optional pointer the upstream constructor accepts as nil.
type ServerOptions = innerlsp.ServerOptions

// Reader / Writer carry framed lsproto.Message values. ttscserver feeds
// the server through io.Pipe shims of these so it can splice its own
// JSON-RPC traffic into the same stream the editor speaks.
type Reader = innerlsp.Reader
type Writer = innerlsp.Writer

//go:linkname NewServer github.com/microsoft/typescript-go/internal/lsp.NewServer
func NewServer(opts *ServerOptions) *Server

//go:linkname ToReader github.com/microsoft/typescript-go/internal/lsp.ToReader
func ToReader(r io.Reader) Reader

//go:linkname ToWriter github.com/microsoft/typescript-go/internal/lsp.ToWriter
func ToWriter(w io.Writer) Writer
