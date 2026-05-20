// lsp.go re-exports the public LSP surface from internal/lspserver so that
// downstream consumers (plugins, the VSCode extension, tests) import only the
// driver package rather than reaching into the internal package directly. All
// symbols are type aliases or var assignments so they are interchangeable with
// the originals at the call site.
package driver

import (
  "encoding/json"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// LSPPosition is the driver-level alias for lspserver.LSPPosition.
type LSPPosition = lspserver.LSPPosition

// LSPRange is the driver-level alias for lspserver.LSPRange.
type LSPRange = lspserver.LSPRange

// LSPDiagnosticSeverity is the driver-level alias for lspserver.LSPDiagnosticSeverity.
type LSPDiagnosticSeverity = lspserver.LSPDiagnosticSeverity

// LSP diagnostic severity constants forwarded from lspserver.
const (
  LSPDiagnosticSeverityError       = lspserver.LSPDiagnosticSeverityError
  LSPDiagnosticSeverityWarning     = lspserver.LSPDiagnosticSeverityWarning
  LSPDiagnosticSeverityInformation = lspserver.LSPDiagnosticSeverityInformation
  LSPDiagnosticSeverityHint        = lspserver.LSPDiagnosticSeverityHint
)

// LSPDiagnostic is the driver-level alias for lspserver.LSPDiagnostic.
type LSPDiagnostic = lspserver.LSPDiagnostic

// LSPCodeAction is the driver-level alias for lspserver.LSPCodeAction.
type LSPCodeAction = lspserver.LSPCodeAction

// LSPCommand is the driver-level alias for lspserver.LSPCommand.
type LSPCommand = lspserver.LSPCommand

// LSPCodeActionContext is the driver-level alias for lspserver.LSPCodeActionContext.
type LSPCodeActionContext = lspserver.LSPCodeActionContext

// LSPWorkspaceEdit is the driver-level alias for lspserver.LSPWorkspaceEdit.
type LSPWorkspaceEdit = lspserver.LSPWorkspaceEdit

// LSPTextEdit is the driver-level alias for lspserver.LSPTextEdit.
type LSPTextEdit = lspserver.LSPTextEdit

// LSPDocumentVersion is the driver-level alias for lspserver.LSPDocumentVersion.
type LSPDocumentVersion = lspserver.LSPDocumentVersion

// PluginSource is the driver-level alias for lspserver.PluginSource.
// It is the public seam downstream pipelines implement to contribute
// diagnostics, code actions, and workspace commands to the LSP proxy.
type PluginSource = lspserver.PluginSource

// NullPluginSource is the driver-level alias for lspserver.NullPluginSource.
type NullPluginSource = lspserver.NullPluginSource

// ProxyOptions is the driver-level alias for lspserver.ProxyOptions.
type ProxyOptions = lspserver.ProxyOptions

// Proxy is the driver-level alias for lspserver.Proxy.
type Proxy = lspserver.Proxy

// FrameReader is the driver-level alias for lspserver.FrameReader.
type FrameReader = lspserver.FrameReader

// Envelope is the driver-level alias for lspserver.Envelope.
type Envelope = lspserver.Envelope

// LSPServerOptions is the driver-level alias for lspserver.LSPServerOptions.
type LSPServerOptions = lspserver.LSPServerOptions

// LSPUpstreamRunner is the driver-level alias for lspserver.LSPUpstreamRunner.
type LSPUpstreamRunner = lspserver.LSPUpstreamRunner

// MaxFrameBytes is the maximum byte length of a single JSON-RPC frame
// the proxy will read without returning ErrFrameTooLarge.
const MaxFrameBytes = lspserver.MaxFrameBytes

// Sentinel errors forwarded from lspserver.
var ErrCommandNotHandled = lspserver.ErrCommandNotHandled
var ErrFrameClosed = lspserver.ErrFrameClosed
var ErrFrameTooLarge = lspserver.ErrFrameTooLarge
var ErrInvalidJSONRPC = lspserver.ErrInvalidJSONRPC
var ErrLSPUpstreamPanic = lspserver.ErrLSPUpstreamPanic
var ErrLSPCwdRequired = lspserver.ErrLSPCwdRequired
var ErrLSPTsgoBinaryRequired = lspserver.ErrLSPTsgoBinaryRequired

// Constructor and utility functions forwarded from lspserver.
var NewProxy = lspserver.NewProxy
var NewFrameReader = lspserver.NewFrameReader
var WriteFrame = lspserver.WriteFrame
var ParseEnvelope = lspserver.ParseEnvelope
var RecoverPanicAs = lspserver.RecoverPanicAs
var WithUpstreamRunnerForTest = lspserver.WithUpstreamRunnerForTest
var RunLSPServer = lspserver.RunLSPServer
var DenyNpmInstall = lspserver.DenyNpmInstall

// idKeyFromRaw normalizes a raw JSON-RPC id to a string map key. It is
// exposed here (unexported) so tests can access it via go:linkname without
// importing the internal package.
func idKeyFromRaw(raw json.RawMessage) string {
  return lspserver.IDKeyFromRaw(raw)
}
