package driver

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
)

// EmitServer is the per-file transform host that backs `ttsx`'s loader.
//
// The runner needs exactly two things, the ts-node way: emit one file, and a
// Node loader hook. This server provides the first half. It holds one loaded
// Program per owning tsconfig (the in-process `ts.createProgram` reuse a
// language service does), so each file emits through the checker and plugins of
// the project that actually owns it — never a foreign project's settings. A
// request names the file and its owning tsconfig; the response is the emitted
// JavaScript, byte-for-byte what `ttsc build` would write for that file.
//
// There is no whole-program emit, no byte store, and no output-to-source
// remapping: a single `EmitFile` has one source, so the mapping is the identity
// and the classes of edge cases that whole-include emit invented cannot arise.

// EmitFileFunc emits one source file through its owning program and returns the
// JavaScript. The plugin host supplies this so transform-stage rewrites (e.g.
// typia's) and any post-processing stay owned by the plugin; the server only
// caches programs and frames the protocol. `tsconfig` is the owning project's
// config path (plugins may read their options from it); `file` is the absolute
// source path.
type EmitFileFunc func(prog *Program, cwd, tsconfig, file string) (string, error)

// emitRequest asks the server to emit `File` using the program of `Tsconfig`.
type emitRequest struct {
	Tsconfig string `json:"tsconfig"`
	File     string `json:"file"`
}

// emitResponse carries the emitted JavaScript or a failure message. Exactly one
// of Code / Error is meaningful per response. The first frame the server writes
// is a readiness handshake (Ready=true) so the client can tell a serve-capable
// host apart from a binary that fell through to another command.
type emitResponse struct {
	Code  string `json:"code,omitempty"`
	Error string `json:"error,omitempty"`
	Ready bool   `json:"ready,omitempty"`
}

// maxEmitFrameBytes bounds a single protocol frame (64 MiB) so a corrupt length
// prefix cannot make the server allocate unbounded memory.
const maxEmitFrameBytes = 64 << 20

// RunEmitServer serves per-file emits over a length-prefixed stdio protocol
// until the input stream closes. Each frame is a 4-byte big-endian length
// followed by a JSON `emitRequest`; each reply is the same framing around a
// JSON `emitResponse`. Programs are cached by tsconfig path for the lifetime of
// the server and closed on return.
func RunEmitServer(in io.Reader, out io.Writer, cwd string, emit EmitFileFunc) error {
	reader := bufio.NewReaderSize(in, 1<<16)
	cache := newProgramCache()
	defer cache.closeAll()

	// Announce readiness before the first request so the client can detect a
	// host that does not actually speak this protocol (e.g. an older plugin
	// binary whose unknown-command fallback runs a build instead).
	if ready, merr := json.Marshal(emitResponse{Ready: true}); merr == nil {
		if werr := writeEmitFrame(out, ready); werr != nil {
			return werr
		}
	}

	for {
		payload, err := readEmitFrame(reader)
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		resp := emitResponse{}
		var req emitRequest
		if jerr := json.Unmarshal(payload, &req); jerr != nil {
			resp.Error = fmt.Sprintf("emit server: bad request: %v", jerr)
		} else {
			code, eerr := cache.emit(cwd, req.Tsconfig, req.File, emit)
			if eerr != nil {
				resp.Error = eerr.Error()
			} else {
				resp.Code = code
			}
		}

		replyBytes, merr := json.Marshal(resp)
		if merr != nil {
			replyBytes, _ = json.Marshal(emitResponse{Error: "emit server: marshal failure"})
		}
		if werr := writeEmitFrame(out, replyBytes); werr != nil {
			return werr
		}
	}
}

// programCache memoizes one loaded Program per owning tsconfig path. Not safe
// for concurrent use: the server loop is single-threaded by contract, matching
// the synchronous request/response the Node loader hook needs.
type programCache struct {
	byTsconfig map[string]*Program
}

func newProgramCache() *programCache {
	return &programCache{byTsconfig: map[string]*Program{}}
}

// emit returns the JavaScript for `file`, loading and caching the owning
// program on first use. ForceEmit is set so a project defaulting to `noEmit`
// still produces output for the runner.
func (c *programCache) emit(cwd, tsconfig, file string, emit EmitFileFunc) (string, error) {
	prog := c.byTsconfig[tsconfig]
	if prog == nil {
		loaded, diags, err := LoadProgram(cwd, tsconfig, LoadProgramOptions{ForceEmit: true})
		if err != nil {
			return "", err
		}
		if len(diags) != 0 {
			return "", fmt.Errorf("emit server: %s: %s", tsconfig, diags[0].Message)
		}
		c.byTsconfig[tsconfig] = loaded
		prog = loaded
	}
	if emit == nil {
		return "", fmt.Errorf("emit server: no emit function configured")
	}
	return emit(prog, cwd, tsconfig, file)
}

func (c *programCache) closeAll() {
	for _, prog := range c.byTsconfig {
		_ = prog.Close()
	}
}

// readEmitFrame reads one length-prefixed frame: a 4-byte big-endian byte count
// followed by that many bytes of payload.
func readEmitFrame(r *bufio.Reader) ([]byte, error) {
	var header [4]byte
	if _, err := io.ReadFull(r, header[:]); err != nil {
		return nil, err
	}
	size := binary.BigEndian.Uint32(header[:])
	if size > maxEmitFrameBytes {
		return nil, fmt.Errorf("emit server: frame exceeds %d bytes", maxEmitFrameBytes)
	}
	payload := make([]byte, size)
	if _, err := io.ReadFull(r, payload); err != nil {
		return nil, err
	}
	return payload, nil
}

// writeEmitFrame writes one length-prefixed frame.
func writeEmitFrame(w io.Writer, payload []byte) error {
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], uint32(len(payload)))
	if _, err := w.Write(header[:]); err != nil {
		return err
	}
	_, err := w.Write(payload)
	return err
}
