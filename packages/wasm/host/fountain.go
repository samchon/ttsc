//go:build js && wasm

// Fountain-style JS endpoints for the host package.
//
// These verbs let JS callers hold a TypeScript-Go Program in memory across
// multiple queries — diagnostics, AST lookup, type-checker queries — without
// re-loading and re-checking the project on every call. The shape mirrors the
// `embed-typescript` `fountain()` escape hatch over the legacy TS API, adapted
// to ttsc's TypeScript-Go driver.
//
// Lifecycle: JS owns the handle. `snapshot` returns an opaque string handle;
// callers MUST call `releaseSnapshot` to free the Program's checker pool lease
// and let Go GC reclaim the AST. Unreleased handles leak memory in the wasm
// linear heap.
//
// Result envelope: every verb returns the standard `{code, stdout, stderr,
// result}` shape used by build/check/transform. The structured payload is
// JSON-encoded into `result`; JS callers parse it with the same `parseResult`
// helper they use for the base endpoints.
package host

import (
  "encoding/json"
  "fmt"
  "math"
  "path/filepath"
  "sync"
  "sync/atomic"
  "syscall/js"

  "github.com/microsoft/typescript-go/shim/ast"
  "github.com/microsoft/typescript-go/shim/astnav"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// snapshotEntry pairs a Program with the cwd it was loaded against so we can
// rewrite file paths to project-relative keys uniformly across all queries.
//
// `mu` serializes Checker-touching paths. driver.LoadProgram pins one
// Checker via forceSingleChecker, and TypeScript-Go's Checker is not
// documented thread-safe. On js/wasm cooperative scheduling normally
// prevents two goroutines from running concurrently, but any Go→JS bridge
// call (file read, Promise await) can yield mid-operation; without `mu`
// two fountain verbs invoked in the same frame could land their Checker
// reads on opposite sides of an internal mutation and corrupt state.
type snapshotEntry struct {
  mu   sync.Mutex
  prog *driver.Program
  cwd  string
}

var (
  snapshotsMu sync.RWMutex
  snapshots   = map[string]*snapshotEntry{}
  nextHandle  atomic.Uint64
)

// fountainAPIMap returns the verb → js.Func map appended to globalThis[apiName]
// during Expose. Kept in a helper so host.go's API map stays scannable.
func fountainAPIMap() map[string]any {
  return map[string]any{
    "snapshot":            js.FuncOf(jsSnapshot),
    "releaseSnapshot":     js.FuncOf(jsReleaseSnapshot),
    "snapshots":           js.FuncOf(jsListSnapshots),
    "getSourceFiles":      js.FuncOf(jsGetSourceFiles),
    "getSourceFileText":   js.FuncOf(jsGetSourceFileText),
    "getDiagnostics":      js.FuncOf(jsGetDiagnostics),
    "getNodeAtPosition":   js.FuncOf(jsGetNodeAtPosition),
    "getTypeAtPosition":   js.FuncOf(jsGetTypeAtPosition),
    "getSymbolAtPosition": js.FuncOf(jsGetSymbolAtPosition),
  }
}

// SnapshotResult is the response shape for `snapshot()`.
// The caller owns Handle and must pass it to releaseSnapshot after its queries.
//
// @evidence contracts/common.md#principled-implementation An opaque string projects registry identity without exposing a Go Program through JSON.
// @evidence contracts/common.md#clear-and-simple-design One opaque identity transfers query access while the Program and its ownership remain in the native registry.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Identity refers to an actual retained program rather than a reconstructed project path.
// @evidence contracts/common.md#meaningful-documentation The Go comment explains opaque identity and caller release ownership under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources SnapshotResult is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms SnapshotResult is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work SnapshotResult is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation SnapshotResult is a data type and performs no native filesystem, path or process operation.
type SnapshotResult struct {
  // Handle is opaque and valid until released in this wasm instance.
  Handle string `json:"handle"`
}

// ReleaseSnapshotResult is the response shape for `releaseSnapshot()`.
//
// @evidence contracts/common.md#principled-implementation A boolean distinguishes a removed registry entry from idempotent absent-handle release.
// @evidence contracts/common.md#clear-and-simple-design One outcome bit reports removal without duplicating the request handle or native cleanup state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts An absent entry is not reported as a fabricated successful removal.
// @evidence contracts/common.md#meaningful-documentation Native comments explain the release outcome under the documentation skill's absence guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ReleaseSnapshotResult is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms ReleaseSnapshotResult is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ReleaseSnapshotResult is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ReleaseSnapshotResult is a data type and performs no native filesystem, path or process operation.
type ReleaseSnapshotResult struct {
  // Released is false when the handle was never present or already removed.
  Released bool `json:"released"`
}

// ListSnapshotsResult is the response shape for `snapshots()`.
//
// @evidence contracts/common.md#principled-implementation A string slice projects registry identities without a second public program representation.
// @evidence contracts/common.md#clear-and-simple-design A flat current-handle list exposes membership without expanding each entry into an unused snapshot descriptor.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Current map membership supplies the list rather than a history of expected handles.
// @evidence contracts/common.md#meaningful-documentation Native member comments identify live state and unspecified order under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ListSnapshotsResult is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms ListSnapshotsResult is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ListSnapshotsResult is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ListSnapshotsResult is a data type and performs no native filesystem, path or process operation.
type ListSnapshotsResult struct {
  // Handles lists live registry keys in unspecified order; empty encodes as [].
  Handles []string `json:"handles"`
}

// GetSourceFilesResult is the response shape for `getSourceFiles()`.
//
// @evidence contracts/common.md#principled-implementation The program's SourceFiles are projected into path strings through the shared output-key policy.
// @evidence contracts/common.md#clear-and-simple-design File identities are separate from source text and semantic metadata, keeping listing focused on program membership.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler membership determines files instead of a guessed filesystem glob.
// @evidence contracts/common.md#meaningful-documentation The member comment explains path bases and declaration exclusion under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetSourceFilesResult is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetSourceFilesResult is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetSourceFilesResult is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetSourceFilesResult is a data type and performs no native filesystem, path or process operation.
type GetSourceFilesResult struct {
  // Files excludes declarations; paths outside cwd remain absolute slash paths.
  Files []string `json:"files"`
}

// GetSourceFileTextResult is the response shape for `getSourceFileText()`.
//
// @evidence contracts/common.md#principled-implementation A required string projects program text while file lookup failures use the error envelope.
// @evidence contracts/common.md#clear-and-simple-design One text field represents the selected file; request identity and transport status remain in their existing shapes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Text comes from the snapshot instead of a separately read file that may have changed.
// @evidence contracts/common.md#meaningful-documentation The member comment names retained-program provenance under the documentation skill's context guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetSourceFileTextResult is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetSourceFileTextResult is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetSourceFileTextResult is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetSourceFileTextResult is a data type and performs no native filesystem, path or process operation.
type GetSourceFileTextResult struct {
  // Text is the source currently held by the retained Program, including rewrites.
  Text string `json:"text"`
}

// GetDiagnosticsResult is the response shape for `getDiagnostics()`.
//
// @evidence contracts/common.md#principled-implementation The shared CompileDiagnostic slice preserves the compiler's public diagnostic projection.
// @evidence contracts/common.md#clear-and-simple-design The selected messages reuse the compile diagnostic DTO rather than introducing a snapshot-specific message model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Queries return compiler messages rather than source-pattern approximations of diagnostics.
// @evidence contracts/common.md#meaningful-documentation Native comments identify the payload and empty-array meaning under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetDiagnosticsResult is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetDiagnosticsResult is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetDiagnosticsResult is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetDiagnosticsResult is a data type and performs no native filesystem, path or process operation.
type GetDiagnosticsResult struct {
  // Diagnostics is an initialized slice, so no selected messages encodes as [].
  Diagnostics []CompileDiagnostic `json:"diagnostics"`
}

// NodeInfo is the serialized AST node returned by `getNodeAtPosition`.
//
// @evidence contracts/common.md#principled-implementation Kind metadata and native byte ranges project a token without exposing Go AST objects.
// @evidence contracts/common.md#clear-and-simple-design A flat kind/range/spelling value carries syntax information without mutable AST links or another token hierarchy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Native ranges remain byte coordinates rather than guessed JavaScript character indices.
// @evidence contracts/common.md#meaningful-documentation Member comments explain native identity, units and optional text under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NodeInfo is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms NodeInfo is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NodeInfo is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NodeInfo is a data type and performs no native filesystem, path or process operation.
type NodeInfo struct {
  // Kind is the numeric TypeScript-Go AST kind.
  Kind int `json:"kind"`

  // KindName is its human-readable Stringer name.
  KindName string `json:"kindName"`

  // Pos is the inclusive UTF-8 byte offset of the token's first byte, after any
  // leading whitespace and comments.
  Pos int `json:"pos"`

  // End is the exclusive UTF-8 byte offset.
  End int `json:"end"`

  // Text is omitted when the scanner has no nonempty source spelling.
  Text string `json:"text,omitempty"`
}

// GetNodeAtPositionResult is the response shape for `getNodeAtPosition()`.
//
// @evidence contracts/common.md#principled-implementation A nullable pointer distinguishes successful absence from the query's error envelope.
// @evidence contracts/common.md#clear-and-simple-design One nullable token projection conveys lookup outcome without another status flag or duplicated source identity.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fabricated node fills whitespace or an absent token.
// @evidence contracts/common.md#meaningful-documentation The member comment explains null token absence under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetNodeAtPositionResult is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetNodeAtPositionResult is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetNodeAtPositionResult is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetNodeAtPositionResult is a data type and performs no native filesystem, path or process operation.
type GetNodeAtPositionResult struct {
  // Node encodes as null when no syntax token touches the queried position.
  Node *NodeInfo `json:"node"`
}

// TypeInfo is the serialized type returned by `getTypeAtPosition`.
//
// @evidence contracts/common.md#principled-implementation Checker-printed text and native flags avoid a parallel incomplete public type model.
// @evidence contracts/common.md#clear-and-simple-design Presentation text and native classification bits are sufficient for this query; structural compiler types stay behind the checker boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The checker supplies type presentation rather than inferring it from token spelling.
// @evidence contracts/common.md#meaningful-documentation Native comments identify printing authority and flag provenance under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TypeInfo is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms TypeInfo is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work TypeInfo is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation TypeInfo is a data type and performs no native filesystem, path or process operation.
type TypeInfo struct {
  // Text is the checker's TypeToString presentation.
  Text string `json:"text"`

  // Flags is the numeric TypeScript-Go TypeFlags bitmask.
  Flags int `json:"flags"`
}

// GetTypeAtPositionResult is the response shape for `getTypeAtPosition()`.
//
// @evidence contracts/common.md#principled-implementation Nullable semantic output mirrors the TypeScript request result without overloading an error type.
// @evidence contracts/common.md#clear-and-simple-design One nullable type field separates semantic absence from transport errors without duplicating the type metadata representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Positions without type semantics remain absent rather than receiving a fabricated any type.
// @evidence contracts/common.md#meaningful-documentation The member comment explains null meaning under the documentation skill's absence guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetTypeAtPositionResult is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetTypeAtPositionResult is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetTypeAtPositionResult is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetTypeAtPositionResult is a data type and performs no native filesystem, path or process operation.
type GetTypeAtPositionResult struct {
  // Type encodes as null when the touching token has no semantic type result.
  Type *TypeInfo `json:"type"`
}

// SymbolDeclaration is the serialized declaration site returned by
// `getSymbolAtPosition`.
//
// @evidence contracts/common.md#principled-implementation Nullable source identity and native ranges preserve declaration provenance through JSON.
// @evidence contracts/common.md#clear-and-simple-design A declaration site contains only file identity and its byte interval; source text and compiler node ownership remain elsewhere.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A source-less declaration keeps nil identity rather than a placeholder filename.
// @evidence contracts/common.md#meaningful-documentation Member comments explain path identity and byte interval units under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources SymbolDeclaration is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms SymbolDeclaration is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work SymbolDeclaration is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation SymbolDeclaration is a data type and performs no native filesystem, path or process operation.
type SymbolDeclaration struct {
  // File is a project-relative or outside absolute path, nil for source-less nodes.
  File *string `json:"file"`

  // Pos is the inclusive UTF-8 byte offset of the declaration's first token,
  // after any leading whitespace, comments and JSDoc.
  Pos int `json:"pos"`

  // End is the declaration's exclusive UTF-8 byte offset.
  End int `json:"end"`
}

// SymbolInfo is the serialized symbol returned by `getSymbolAtPosition`.
//
// @evidence contracts/common.md#principled-implementation Raw and printed names, flags and declaration projections preserve the native checker result.
// @evidence contracts/common.md#clear-and-simple-design Identity and display text are distinct, and one capped site list plus its original total explains truncation without separate declaration handles.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The response cap preserves the original total rather than presenting a shortened declaration list as complete.
// @evidence contracts/common.md#meaningful-documentation Native comments distinguish internal names, display text and capped metadata under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources SymbolInfo is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms SymbolInfo is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work SymbolInfo is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation SymbolInfo is a data type and performs no native filesystem, path or process operation.
type SymbolInfo struct {
  // Name is the raw name, including TypeScript internal prefix markers.
  Name string `json:"name"`

  // Text is the optional checker-printed symbol representation.
  Text string `json:"text,omitempty"`

  // Flags is the numeric TypeScript-Go SymbolFlags bitmask.
  Flags int `json:"flags"`

  // Declarations contains at most 16 sites and is omitted when empty.
  Declarations []SymbolDeclaration `json:"declarations,omitempty"`

  // DeclarationCount retains the original total and is omitted when zero.
  DeclarationCount int `json:"declarationCount,omitempty"`
}

// GetSymbolAtPositionResult is the response shape for `getSymbolAtPosition()`.
//
// @evidence contracts/common.md#principled-implementation A nullable symbol pointer distinguishes absent semantics from a failed request.
// @evidence contracts/common.md#clear-and-simple-design One nullable symbol field expresses the binding outcome while symbol metadata and request status remain separate.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing binding does not produce a symbol guessed from the token's name.
// @evidence contracts/common.md#meaningful-documentation The member comment explains null result meaning under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetSymbolAtPositionResult is a data type and acquires no handle, task or retained state.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetSymbolAtPositionResult is a data type and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetSymbolAtPositionResult is a data type and coordinates no shared or repeated computation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetSymbolAtPositionResult is a data type and performs no native filesystem, path or process operation.
type GetSymbolAtPositionResult struct {
  // Symbol encodes as null when the touching token has no associated symbol.
  Symbol *SymbolInfo `json:"symbol"`
}

// jsSnapshot({cwd, tsconfig?}) → Promise<ITtscResult>.
//
// Loads the project once and retains the Program for follow-up queries. The
// returned handle is opaque; treat it as a string.
func jsSnapshot(this js.Value, args []js.Value) any {
  opts := optionsArg(args)
  return makePromise(func() any {
    cwd := stringProp(opts, "cwd")
    tsconfig := stringProp(opts, "tsconfig")
    if cwd == "" {
      return errorResponse(2, "host.snapshot: \"cwd\" is required")
    }
    if tsconfig == "" {
      tsconfig = "tsconfig.json"
    }
    prog, diags, err := driver.LoadProgram(cwd, tsconfig, driver.LoadProgramOptions{
      ForceNoEmit: true,
    })
    if err != nil {
      return errorResponse(2, err.Error())
    }
    if prog == nil {
      msg := "host.snapshot: project load failed"
      if len(diags) > 0 {
        msg = diags[0].Message
      }
      return errorResponse(2, msg)
    }
    handle := fmt.Sprintf("snap-%d", nextHandle.Add(1))
    snapshotsMu.Lock()
    snapshots[handle] = &snapshotEntry{prog: prog, cwd: cwd}
    snapshotsMu.Unlock()
    return fountainOK(SnapshotResult{Handle: handle})
  })
}

// jsReleaseSnapshot({handle}) → Promise<ITtscResult>.
//
// `released=false` indicates the handle was not present (already released or
// never created). The endpoint never errors on unknown handles so callers can
// release idempotently.
//
// Holds the write lock for the full delete+Close so any in-flight read
// (withSnapshot's RLock) finishes before the Program is closed. This is the
// pair of the TOCTOU guarantee documented on withSnapshot.
func jsReleaseSnapshot(this js.Value, args []js.Value) any {
  opts := optionsArg(args)
  return makePromise(func() any {
    handle := stringProp(opts, "handle")
    if handle == "" {
      return errorResponse(2, "host.releaseSnapshot: \"handle\" is required")
    }
    snapshotsMu.Lock()
    defer snapshotsMu.Unlock()
    entry, ok := snapshots[handle]
    if !ok {
      return fountainOK(ReleaseSnapshotResult{Released: false})
    }
    delete(snapshots, handle)
    if entry.prog != nil {
      // Recover from any panic inside Close so the rest of the wasm
      // instance survives; the entry has already been removed from
      // the table so the handle is effectively released either way.
      func() {
        defer func() { _ = recover() }()
        _ = entry.prog.Close()
      }()
    }
    return fountainOK(ReleaseSnapshotResult{Released: true})
  })
}

// jsListSnapshots() → Promise<ITtscResult>. Debug aid — lets a JS embedder
// verify it has released what it thinks it has.
func jsListSnapshots(this js.Value, args []js.Value) any {
  return makePromise(func() any {
    snapshotsMu.RLock()
    handles := make([]string, 0, len(snapshots))
    for h := range snapshots {
      handles = append(handles, h)
    }
    snapshotsMu.RUnlock()
    return fountainOK(ListSnapshotsResult{Handles: handles})
  })
}

// jsGetSourceFiles({handle}) → Promise<ITtscResult>. Lists the non-
// declaration source files in the program, keyed by project-relative path
// (same convention as build/transform output).
func jsGetSourceFiles(this js.Value, args []js.Value) any {
  return withSnapshot(args, func(entry *snapshotEntry, _ js.Value) any {
    files := entry.prog.SourceFiles()
    out := make([]string, 0, len(files))
    for _, f := range files {
      out = append(out, snapshotFileKey(entry.cwd, f.FileName().AsString()))
    }
    return fountainOK(GetSourceFilesResult{Files: out})
  })
}

// jsGetSourceFileText({handle, path}) → Promise<ITtscResult>. Returns the
// current source text the Program is holding for the file. After transform
// plugins have run, this reflects the post-transform text.
func jsGetSourceFileText(this js.Value, args []js.Value) any {
  return withSnapshot(args, func(entry *snapshotEntry, opts js.Value) any {
    path := stringProp(opts, "path")
    if path == "" {
      return errorResponse(2, "host.getSourceFileText: \"path\" is required")
    }
    file := resolveSnapshotFile(entry, path)
    if file == nil {
      return errorResponse(2, fmt.Sprintf("host.getSourceFileText: file not found: %q", path))
    }
    return fountainOK(GetSourceFileTextResult{Text: file.Text()})
  })
}

// jsGetDiagnostics({handle, file?}) → Promise<ITtscResult>. Returns the same
// diagnostic shape as build/check/transform. When `file` is set, results are
// filtered to that project-relative path.
func jsGetDiagnostics(this js.Value, args []js.Value) any {
  return withSnapshot(args, func(entry *snapshotEntry, opts js.Value) any {
    filter := stringProp(opts, "file")
    diags := entry.prog.Diagnostics()
    out := make([]CompileDiagnostic, 0, len(diags))
    for _, d := range diags {
      api := toAPIDiagnostic(d)
      if filter != "" {
        if api.File == nil {
          continue
        }
        rel := snapshotFileKey(entry.cwd, *api.File)
        if rel != filter && *api.File != filter {
          continue
        }
      }
      out = append(out, api)
    }
    return fountainOK(GetDiagnosticsResult{Diagnostics: out})
  })
}

// jsGetNodeAtPosition({handle, path, position}) → Promise<ITtscResult>.
// Returns the token touching the byte offset, including punctuation.
// Whitespace and comments return `{node: null}`. JS callers with a UTF-16
// line/character pair must resolve it to a byte offset first.
func jsGetNodeAtPosition(this js.Value, args []js.Value) any {
  return withSnapshotPosition(args, func(_ *snapshotEntry, file *ast.SourceFile, pos int) any {
    node := tokenAtPosition(file, pos)
    return fountainOK(GetNodeAtPositionResult{Node: nodeInfoOf(file, node)})
  })
}

// jsGetTypeAtPosition({handle, path, position}) → Promise<ITtscResult>.
// Resolves the touching token, then asks the Program's pinned single checker
// for the enclosing semantic AST node. Returns `{type: null}` when no token
// has type semantics, including whitespace, comments, and punctuation.
func jsGetTypeAtPosition(this js.Value, args []js.Value) any {
  return withSnapshotPosition(args, func(entry *snapshotEntry, file *ast.SourceFile, pos int) any {
    node := tokenAtPosition(file, pos)
    if !hasTypeAtLocation(node) || entry.prog.Checker == nil {
      return fountainOK(GetTypeAtPositionResult{Type: nil})
    }
    semanticNode := ast.GetNodeAtPosition(file, pos, false)
    if semanticNode == nil {
      return fountainOK(GetTypeAtPositionResult{Type: nil})
    }
    t := entry.prog.Checker.GetTypeAtLocation(semanticNode)
    if t == nil {
      return fountainOK(GetTypeAtPositionResult{Type: nil})
    }
    return fountainOK(GetTypeAtPositionResult{
      Type: &TypeInfo{
        Text:  entry.prog.Checker.TypeToString(t),
        Flags: int(t.Flags()),
      },
    })
  })
}

// jsGetSymbolAtPosition({handle, path, position}) → Promise<ITtscResult>.
// Returns `{symbol: null}` when the touching token has no associated symbol,
// including punctuation, whitespace, and comments.
func jsGetSymbolAtPosition(this js.Value, args []js.Value) any {
  return withSnapshotPosition(args, func(entry *snapshotEntry, file *ast.SourceFile, pos int) any {
    node := tokenAtPosition(file, pos)
    if node == nil || entry.prog.Checker == nil {
      return fountainOK(GetSymbolAtPositionResult{Symbol: nil})
    }
    sym := entry.prog.Checker.GetSymbolAtLocation(node)
    if sym == nil {
      return fountainOK(GetSymbolAtPositionResult{Symbol: nil})
    }
    return fountainOK(GetSymbolAtPositionResult{Symbol: symbolInfoOf(entry, sym)})
  })
}

// withSnapshot is the shared envelope for every read-only fountain verb. It
// parses the JS arg, resolves the handle, holds the snapshot table's read
// lock + the per-entry mutex, and runs `fn`. Two layered locks:
//
//   - snapshotsMu (RLock): pairs with jsReleaseSnapshot's write lock so
//     the entry's prog isn't Close()d under the caller. Closes the prior
//     TOCTOU between "found the entry" and "used entry.prog".
//   - entry.mu: serializes Checker-touching paths. TS-Go's Checker is
//     single-instance (forceSingleChecker) and not documented
//     thread-safe; two fountain verbs invoked in the same frame could
//     otherwise interleave Checker state mutations.
func withSnapshot(args []js.Value, fn func(*snapshotEntry, js.Value) any) any {
  opts := optionsArg(args)
  return makePromise(func() any {
    handle := stringProp(opts, "handle")
    if handle == "" {
      return errorResponse(2, "host: \"handle\" is required")
    }
    snapshotsMu.RLock()
    defer snapshotsMu.RUnlock()
    entry := snapshots[handle]
    if entry == nil {
      return errorResponse(2, fmt.Sprintf("host: snapshot %q not found (already released or never created)", handle))
    }
    entry.mu.Lock()
    defer entry.mu.Unlock()
    return fn(entry, opts)
  })
}

// withSnapshotPosition is the shared envelope for the 3 position-bound
// fountain verbs. Same read-lock lifecycle as withSnapshot, plus parses
// {path, position} and bounds-checks position against the file length. A
// position must address an existing byte, so the offset at end-of-file is
// rejected before it can reach AST navigation.
func withSnapshotPosition(args []js.Value, fn func(*snapshotEntry, *ast.SourceFile, int) any) any {
  return withSnapshot(args, func(entry *snapshotEntry, opts js.Value) any {
    path := stringProp(opts, "path")
    if path == "" {
      return errorResponse(2, "host: \"path\" is required")
    }
    posVal := opts.Get("position")
    if posVal.Type() != js.TypeNumber {
      return errorResponse(2, "host: \"position\" must be a number (byte offset)")
    }
    offset := posVal.Float()
    if math.IsNaN(offset) || math.IsInf(offset, 0) || math.Trunc(offset) != offset || offset < 0 {
      return errorResponse(2, "host: \"position\" must be a finite non-negative integer byte offset")
    }
    file := resolveSnapshotFile(entry, path)
    if file == nil {
      return errorResponse(2, fmt.Sprintf("host: file %q not found in snapshot", path))
    }
    if offset >= float64(len(file.Text())) {
      return errorResponse(2, fmt.Sprintf("host: \"position\" %v is outside file length %d", offset, len(file.Text())))
    }
    pos := int(offset)
    return fn(entry, file, pos)
  })
}

// tokenAtPosition resolves the exact token at pos. GetTouchingToken returns a
// containing AST node when a gap has no token, so preserve the fountain
// contract by filtering that fallback out explicitly.
func tokenAtPosition(file *ast.SourceFile, pos int) *ast.Node {
  node := astnav.GetTouchingToken(file, pos)
  if node == nil || !ast.IsTokenKind(node.Kind) {
    return nil
  }
  return node
}

// hasTypeAtLocation mirrors the public checker entrypoint's semantic cases.
// It deliberately excludes punctuation tokens, whose checker fallback is the
// error type even though a cursor query has no meaningful type answer.
func hasTypeAtLocation(node *ast.Node) bool {
  return node != nil && (ast.IsPartOfTypeNode(node) ||
    ast.IsExpressionNode(node) ||
    ast.IsTypeDeclaration(node) ||
    ast.IsTypeDeclarationName(node) ||
    ast.IsBindingElement(node) ||
    ast.IsDeclaration(node) ||
    ast.IsDeclarationNameOrImportPropertyName(node) ||
    ast.IsBindingPattern(node))
}

// resolveSnapshotFile finds a SourceFile by path, accepting either an
// absolute path or a path relative to the snapshot's cwd.
func resolveSnapshotFile(entry *snapshotEntry, path string) *ast.SourceFile {
  if file := entry.prog.SourceFile(path); file != nil {
    return file
  }
  if !filepath.IsAbs(path) {
    abs := filepath.Join(entry.cwd, path)
    if file := entry.prog.SourceFile(abs); file != nil {
      return file
    }
  }
  return nil
}

// snapshotFileKey delegates to apiOutputKey for use by all
// fountain endpoints that return file paths.
func snapshotFileKey(cwd, fileName string) string {
  return apiOutputKey(cwd, fileName)
}

// fountainOK wraps a JSON-able payload in the standard `{code, stdout,
// stderr, result}` envelope. The payload is JSON-encoded into `result`; JS
// callers `parseResult<T>` it the same way they do for build/check/transform.
func fountainOK(payload any) any {
  data, err := json.Marshal(payload)
  if err != nil {
    return errorResponse(3, fmt.Sprintf("host: fountain result marshal failed: %v", err))
  }
  return js.ValueOf(map[string]any{
    "code":   0,
    "stdout": "",
    "stderr": "",
    "result": string(data),
  })
}

// nodeInfoOf converts a *ast.Node into the JSON-serializable NodeInfo.
//
// Pos is the token's first byte, after leading whitespace and comments.
// TypeScript-Go's Node.Pos is the full start, which includes that trivia, so
// reporting it would give an interval wider than the Text it describes.
func nodeInfoOf(file *ast.SourceFile, node *ast.Node) *NodeInfo {
  if node == nil {
    return nil
  }
  info := &NodeInfo{
    Kind:     int(node.Kind),
    KindName: astKindName(node.Kind),
    Pos:      tokenStart(file, node),
    End:      node.End(),
  }
  if text := shimscanner.GetTextOfNode(node); text != "" {
    info.Text = text
  }
  return info
}

// symbolInfoOf converts a *ast.Symbol into the JSON-serializable SymbolInfo,
// including up to a few declaration sites so callers can implement "go to
// definition" without follow-up snapshot queries.
func symbolInfoOf(entry *snapshotEntry, sym *ast.Symbol) *SymbolInfo {
  if sym == nil {
    return nil
  }
  info := &SymbolInfo{
    Name:  sym.Name(),
    Flags: int(sym.Flags()),
  }
  if entry.prog.Checker != nil {
    info.Text = entry.prog.Checker.SymbolToString(sym)
  }
  decls := sym.Declarations()
  if len(decls) > 0 {
    // Cap at 16 to keep merged-namespace symbols (e.g. global lib types)
    // from ballooning the response.
    const maxDecls = 16
    n := len(decls)
    capped := n
    if n > maxDecls {
      capped = maxDecls
    }
    out := make([]SymbolDeclaration, 0, capped)
    for _, d := range decls[:capped] {
      if d == nil {
        continue
      }
      item := SymbolDeclaration{Pos: d.Pos(), End: d.End()}
      if file := ast.GetSourceFileOfNode(d); file != nil {
        item.Pos = tokenStart(file, d)
        key := snapshotFileKey(entry.cwd, file.FileName().AsString())
        item.File = &key
      }
      out = append(out, item)
    }
    info.Declarations = out
    info.DeclarationCount = n
  }
  return info
}

// tokenStart returns the byte offset of node's first token. It skips the leading
// whitespace and comments that TypeScript-Go's Node.Pos includes; JSDoc attached
// to a declaration is such a comment, so a declaration starts at its own first
// token rather than at its documentation.
func tokenStart(file *ast.SourceFile, node *ast.Node) int {
  return shimscanner.GetTokenPosOfNode(node, file, false)
}

// astKindName renders an ast.Kind to its string representation. ast.Kind has
// a Stringer impl in tsgo (`%v` produces "FunctionDeclaration" etc.).
func astKindName(k ast.Kind) string {
  return fmt.Sprintf("%v", k)
}
