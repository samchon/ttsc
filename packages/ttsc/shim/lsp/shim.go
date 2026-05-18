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
type Server = innerlsp.Server

// ServerOptions mirrors the upstream construction parameters. Fields with
// internal-package types (e.g. ParseCache *project.ParseCache) can be left
// unset by callers when upstream accepts nil.
type ServerOptions = innerlsp.ServerOptions

// Reader / Writer carry framed lsproto.Message values.
type Reader = innerlsp.Reader
type Writer = innerlsp.Writer

//go:linkname NewServer github.com/microsoft/typescript-go/internal/lsp.NewServer
func NewServer(opts *ServerOptions) *Server

//go:linkname ToReader github.com/microsoft/typescript-go/internal/lsp.ToReader
func ToReader(r io.Reader) Reader

//go:linkname ToWriter github.com/microsoft/typescript-go/internal/lsp.ToWriter
func ToWriter(w io.Writer) Writer
