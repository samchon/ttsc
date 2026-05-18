package driver

import (
	"encoding/json"

	"github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

type LSPPosition = lspserver.LSPPosition
type LSPRange = lspserver.LSPRange
type LSPDiagnosticSeverity = lspserver.LSPDiagnosticSeverity

const (
	LSPDiagnosticSeverityError       = lspserver.LSPDiagnosticSeverityError
	LSPDiagnosticSeverityWarning     = lspserver.LSPDiagnosticSeverityWarning
	LSPDiagnosticSeverityInformation = lspserver.LSPDiagnosticSeverityInformation
	LSPDiagnosticSeverityHint        = lspserver.LSPDiagnosticSeverityHint
)

type LSPDiagnostic = lspserver.LSPDiagnostic
type LSPCodeAction = lspserver.LSPCodeAction
type LSPCommand = lspserver.LSPCommand
type LSPCodeActionContext = lspserver.LSPCodeActionContext
type LSPWorkspaceEdit = lspserver.LSPWorkspaceEdit
type LSPTextEdit = lspserver.LSPTextEdit
type LSPDocumentVersion = lspserver.LSPDocumentVersion
type PluginSource = lspserver.PluginSource
type NullPluginSource = lspserver.NullPluginSource

type ProxyOptions = lspserver.ProxyOptions
type Proxy = lspserver.Proxy

type FrameReader = lspserver.FrameReader
type Envelope = lspserver.Envelope

type LSPServerOptions = lspserver.LSPServerOptions
type LSPUpstreamRunner = lspserver.LSPUpstreamRunner

const MaxFrameBytes = lspserver.MaxFrameBytes

var ErrCommandNotHandled = lspserver.ErrCommandNotHandled
var ErrFrameClosed = lspserver.ErrFrameClosed
var ErrFrameTooLarge = lspserver.ErrFrameTooLarge
var ErrInvalidJSONRPC = lspserver.ErrInvalidJSONRPC
var ErrLSPUpstreamPanic = lspserver.ErrLSPUpstreamPanic
var ErrLSPCwdRequired = lspserver.ErrLSPCwdRequired
var ErrLSPTsgoBinaryRequired = lspserver.ErrLSPTsgoBinaryRequired

var NewProxy = lspserver.NewProxy
var NewFrameReader = lspserver.NewFrameReader
var WriteFrame = lspserver.WriteFrame
var ParseEnvelope = lspserver.ParseEnvelope
var RecoverPanicAs = lspserver.RecoverPanicAs
var WithUpstreamRunnerForTest = lspserver.WithUpstreamRunnerForTest
var RunLSPServer = lspserver.RunLSPServer
var DenyNpmInstall = lspserver.DenyNpmInstall

func idKeyFromRaw(raw json.RawMessage) string {
	return lspserver.IDKeyFromRaw(raw)
}
