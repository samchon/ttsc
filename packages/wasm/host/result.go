// JSON payload shapes shared by the wasm and native entrypoints.
package host

// APIResult is the stdout/stderr capture returned by InvokePlugin. The
// js/wasm binding wraps it in the same JS result envelope that build/check/
// transform use, adding `result` when an endpoint has a JSON payload. `code`
// follows the native CLI exit-code contract (0 success, 2 compiler/config/
// usage error, 3 runtime error).
//
// @evidence contracts/common.md#principled-implementation Explicit stream fields mirror invocation capture and the JavaScript envelope.
// @evidence contracts/common.md#clear-and-simple-design One capture value separates exit status and the two streams, leaving project JSON to the JavaScript envelope.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The exit code remains data rather than being replaced by a success-only output shape.
// @evidence contracts/common.md#meaningful-documentation Native comments explain channels and exit codes under the documentation skill's context guidance.
type APIResult struct {
  // Code is the plugin's CLI exit status.
  Code   int    `json:"code"`

  // Stdout contains this invocation's standard output.
  Stdout string `json:"stdout"`

  // Stderr contains this invocation's diagnostic output.
  Stderr string `json:"stderr"`
}

// CompileResult mirrors `ttsc api-compile`. Field names are TypeScript-style
// so JS callers can use it directly without remapping.
//
// @evidence contracts/common.md#principled-implementation JSON field tags preserve the TypeScript-facing compiler payload and optional diagnostic list.
// @evidence contracts/common.md#clear-and-simple-design Diagnostics reuse one wire DTO while output text is keyed by destination; the transport envelope stays outside this payload.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Emitted paths and contents remain compiler data rather than a consumer-shaped output schema.
// @evidence contracts/common.md#meaningful-documentation Comments identify the wire shape, omission and output path base under the documentation skill's context rule.
type CompileResult struct {
  // Diagnostics is omitted when the result has no messages.
  Diagnostics []CompileDiagnostic `json:"diagnostics,omitempty"`

  // Output maps emitted paths to JS / d.ts text. Paths inside cwd are relative;
  // outside destinations stay absolute. Empty when no files were produced.
  Output map[string]string `json:"output"`
}

// TransformResult is the no-emit companion. The `typescript` map keys files
// the same way `output` does in compile mode.
//
// @evidence contracts/common.md#principled-implementation A distinct source-text map avoids conflating transformed TypeScript with emitted output.
// @evidence contracts/common.md#clear-and-simple-design The source-text map and shared diagnostics form one transform payload, separate from compile output and invocation streams.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The payload represents actual program text instead of reconstructing it from JavaScript emit.
// @evidence contracts/common.md#meaningful-documentation Native comments distinguish the source stage and optional messages under the documentation skill's clarity rule.
type TransformResult struct {
  // Diagnostics is omitted when the result has no messages.
  Diagnostics []CompileDiagnostic `json:"diagnostics,omitempty"`

  // TypeScript holds post-plugin text under project-relative or outside absolute paths.
  TypeScript  map[string]string   `json:"typescript"`
}

// CompileDiagnostic is the public TypeScript-side diagnostic DTO. Mirrors the
// shape `ttsc api-compile` writes so the JS host can render it without
// remapping fields.
//
// Start/Length are UTF-8 byte offsets and lengths. Line/Character are 1-based;
// Character counts UTF-8 bytes from the line start, as the native driver does.
// Zero display locations are omitted when no source context is available.
//
// @evidence contracts/common.md#principled-implementation Nullable file and optional location fields follow the driver's diagnostic projection through JSON.
// @evidence contracts/common.md#clear-and-simple-design File identity, severity, byte span and display location remain distinct fields, with pointers for absent spans rather than an alternate diagnostic model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler coordinates are preserved rather than guessed from JavaScript text indices.
// @evidence contracts/common.md#meaningful-documentation Separate comments explain coordinate units and absence under the documentation skill's paragraph guidance.
type CompileDiagnostic struct {
  // File is an absolute slash path, or nil for a project-wide message.
  File        *string `json:"file"`

  // Category is error or warning; errors affect the command exit code.
  Category    string  `json:"category"`

  // Code is the compiler or plugin diagnostic identifier.
  Code        int32   `json:"code"`

  // Start is the optional inclusive UTF-8 byte offset.
  Start       *int    `json:"start,omitempty"`

  // Length is the optional span length in UTF-8 bytes.
  Length      *int    `json:"length,omitempty"`

  // Line is 1-based and omitted without a display location.
  Line        int     `json:"line,omitempty"`

  // Character is a 1-based UTF-8 byte column, omitted without a location.
  Character   int     `json:"character,omitempty"`

  // MessageText is the complete compiler or plugin message.
  MessageText string  `json:"messageText"`
}
