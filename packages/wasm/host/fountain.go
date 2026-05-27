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
	"path/filepath"
	"sync"
	"sync/atomic"
	"syscall/js"

	"github.com/microsoft/typescript-go/shim/ast"
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
type SnapshotResult struct {
	Handle string `json:"handle"`
}

// ReleaseSnapshotResult is the response shape for `releaseSnapshot()`.
type ReleaseSnapshotResult struct {
	Released bool `json:"released"`
}

// ListSnapshotsResult is the response shape for `snapshots()`.
type ListSnapshotsResult struct {
	Handles []string `json:"handles"`
}

// GetSourceFilesResult is the response shape for `getSourceFiles()`.
type GetSourceFilesResult struct {
	Files []string `json:"files"`
}

// GetSourceFileTextResult is the response shape for `getSourceFileText()`.
type GetSourceFileTextResult struct {
	Text string `json:"text"`
}

// GetDiagnosticsResult is the response shape for `getDiagnostics()`.
type GetDiagnosticsResult struct {
	Diagnostics []CompileDiagnostic `json:"diagnostics"`
}

// NodeInfo is the serialized AST node returned by `getNodeAtPosition`.
type NodeInfo struct {
	Kind     int    `json:"kind"`
	KindName string `json:"kindName"`
	Pos      int    `json:"pos"`
	End      int    `json:"end"`
	Text     string `json:"text,omitempty"`
}

// GetNodeAtPositionResult is the response shape for `getNodeAtPosition()`.
type GetNodeAtPositionResult struct {
	Node *NodeInfo `json:"node"`
}

// TypeInfo is the serialized type returned by `getTypeAtPosition`.
type TypeInfo struct {
	Text  string `json:"text"`
	Flags int    `json:"flags"`
}

// GetTypeAtPositionResult is the response shape for `getTypeAtPosition()`.
type GetTypeAtPositionResult struct {
	Type *TypeInfo `json:"type"`
}

// SymbolDeclaration is the serialized declaration site returned by
// `getSymbolAtPosition`.
type SymbolDeclaration struct {
	File *string `json:"file"`
	Pos  int     `json:"pos"`
	End  int     `json:"end"`
}

// SymbolInfo is the serialized symbol returned by `getSymbolAtPosition`.
type SymbolInfo struct {
	Name             string              `json:"name"`
	Text             string              `json:"text,omitempty"`
	Flags            int                 `json:"flags"`
	Declarations     []SymbolDeclaration `json:"declarations,omitempty"`
	DeclarationCount int                 `json:"declarationCount,omitempty"`
}

// GetSymbolAtPositionResult is the response shape for `getSymbolAtPosition()`.
type GetSymbolAtPositionResult struct {
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
			out = append(out, snapshotFileKey(entry.cwd, f.FileName()))
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
// `position` is a byte offset into the source text (the same coordinate the
// AST uses internally). JS callers that have a UTF-16 line/character pair
// should resolve it to a byte offset before calling (the @ttsc/playground
// helper does this).
func jsGetNodeAtPosition(this js.Value, args []js.Value) any {
	return withSnapshotPosition(args, func(_ *snapshotEntry, file *ast.SourceFile, pos int) any {
		node := ast.GetNodeAtPosition(file, pos, false)
		return fountainOK(GetNodeAtPositionResult{Node: nodeInfoOf(node)})
	})
}

// jsGetTypeAtPosition({handle, path, position}) → Promise<ITtscResult>.
// Resolves the node at position via GetNodeAtPosition and asks the Program's
// pinned single checker for its type. Returns `{type: null}` when there is no
// node at that position or no checker is available.
func jsGetTypeAtPosition(this js.Value, args []js.Value) any {
	return withSnapshotPosition(args, func(entry *snapshotEntry, file *ast.SourceFile, pos int) any {
		node := ast.GetNodeAtPosition(file, pos, false)
		if node == nil || entry.prog.Checker == nil {
			return fountainOK(GetTypeAtPositionResult{Type: nil})
		}
		t := entry.prog.Checker.GetTypeAtLocation(node)
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
// Returns `{symbol: null}` when the node at position has no associated
// symbol (e.g. punctuation, whitespace).
func jsGetSymbolAtPosition(this js.Value, args []js.Value) any {
	return withSnapshotPosition(args, func(entry *snapshotEntry, file *ast.SourceFile, pos int) any {
		node := ast.GetNodeAtPosition(file, pos, false)
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
// {path, position} and bounds-checks position against the file length so an
// out-of-range offset reaches `ast.GetNodeAtPosition` only as a clean
// error response instead of an internal panic.
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
		pos := posVal.Int()
		if pos < 0 {
			return errorResponse(2, "host: \"position\" must be non-negative")
		}
		file := resolveSnapshotFile(entry, path)
		if file == nil {
			return errorResponse(2, fmt.Sprintf("host: file %q not found in snapshot", path))
		}
		if pos > len(file.Text()) {
			return errorResponse(2, fmt.Sprintf("host: \"position\" %d exceeds file length %d", pos, len(file.Text())))
		}
		return fn(entry, file, pos)
	})
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

// snapshotFileKey mirrors apiOutputKey but is exported for use by all
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
func nodeInfoOf(node *ast.Node) *NodeInfo {
	if node == nil {
		return nil
	}
	info := &NodeInfo{
		Kind:     int(node.Kind),
		KindName: astKindName(node.Kind),
		Pos:      node.Pos(),
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
		Name:  sym.Name,
		Flags: int(sym.Flags),
	}
	if entry.prog.Checker != nil {
		info.Text = entry.prog.Checker.SymbolToString(sym)
	}
	decls := sym.Declarations
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
				key := snapshotFileKey(entry.cwd, file.FileName())
				item.File = &key
			}
			out = append(out, item)
		}
		info.Declarations = out
		info.DeclarationCount = n
	}
	return info
}

// astKindName renders an ast.Kind to its string representation. ast.Kind has
// a Stringer impl in tsgo (`%v` produces "FunctionDeclaration" etc.).
func astKindName(k ast.Kind) string {
	return fmt.Sprintf("%v", k)
}
