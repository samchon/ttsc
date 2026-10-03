package utility

import (
  "bufio"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "strings"

  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// serveRequest is one newline-delimited request the resident host reads from its
// input stream. It is either a transform request (File set) for the transformed
// TypeScript of a file, or an update request (Update set) that applies new
// in-memory content for a file and re-transforms the project.
type serveRequest struct {
  Content string `json:"content"`
  File    string `json:"file"`
  Update  string `json:"update"`
}

// serveResponse is the reply to a transform request: the transformed TypeScript
// for the requested file and whether the resident program had it.
type serveResponse struct {
  TypeScript string `json:"typescript"`
  Found      bool   `json:"found"`

  // ObservationsComplete is false when the committed generation declared a
  // public observation boundary unavailable. Absence supplies no complete proof.
  ObservationsComplete *bool `json:"observationsComplete,omitempty"`
}

// serveUpdateResponse is the reply to an update request: whether re-transforming
// the project with the new content succeeded. A false reply leaves the previous
// transform in place (for example the edit introduced a type error); the host's
// diagnostics are written to stderr.
type serveUpdateResponse struct {
  Updated bool `json:"updated"`

  // ObservationsComplete describes the committed generation, including the
  // retained generation when an update fails. Only explicit false is emitted.
  ObservationsComplete *bool `json:"observationsComplete,omitempty"`
}

// RunServe is the resident transform host. It transforms the whole project once
// (the expensive compile plus linked-plugin pass) over an in-memory overlay,
// caches every file's transformed text, then answers nonblank newline-delimited
// request lines with one JSON reply to out, until in reaches EOF:
//
//   - {"file":"<path>"} returns that file's transformed TypeScript.
//   - {"update":"<path>","content":"<text>"} applies new content for the file
//     and re-transforms, so subsequent transform requests reflect the edit.
//
// One resident process answers a request stream without recompiling the project
// per call and reflects edits without respawning the host. Sharing one host
// across separate worker processes (a Metro worker pool) is not supported.
//
// in and out are explicit so the request loop is testable; the utility-host
// command wires them to os.Stdin and os.Stdout. Both must be usable nonnil
// streams; the caller owns closing them.
// Read or response-write failure terminates the request stream with status 2.
// Well-formed file/update replies preserve explicit incomplete observations
// from the committed generation; malformed JSON receives an empty not-found
// response without that field. Neither omission nor a cached reply establishes
// complete input observation or continuing equivalence with external files.
//
// @evidence contracts/common.md#principled-implementation Requests share committed transformed text and its explicit observation limitation; each accepted edit rebuilds fresh mutable plugin ASTs, while a failed edit restores the previous overlay, output and limitation state.
// @evidence contracts/common.md#clear-and-simple-design One overlay, one current transformed-text cache, and one request loop own the resident protocol.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Mutated ASTs are not incrementally reused as clean compiler input, failed responses do not return success, and failed edits do not leave poisoned overlay state.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain request forms, committed caching, updates, stream termination and the observation limitation's meaning following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Overlay keys use the compiler's native cwd resolution and actual filesystem case policy; input and output are explicit stream boundaries.
// @evidence contracts/performance.md#efficient-algorithms File requests use one current-text map lookup after request-line reading, JSON decoding and lexical path/key processing; response encoding and stream work grow with returned text bytes. Updates load and diagnose a fresh whole program, apply generation-latched hooks and print all resident source files, including upstream trivia/handler work, because program hooks can mutate resident ASTs. This is not constant request work or compilation limited to the edited file.
// @evidence contracts/performance.md#reuse-equivalent-work Repeated file requests share the committed cache until an update replaces it; equivalent mutable AST work is not presumed safe across edits.
// @evidence contracts/performance.md#bound-retention-and-release-resources Each successfully loaded rebuild defers Program checker-lease release; only a successful rebuild replaces the prior text cache, while a failed edit restores its overlay entry and retains committed output. Current output and overlay values for all distinct edited paths live until the stream ends, with old/new cache and request/JSON buffers overlapping during updates. There is no line, edited-path or output-byte cap; callers retain stream and any writer-buffer ownership, and lease Close does not immediately destroy all graph memory.
func RunServe(in io.Reader, out io.Writer, args []string) int {
  opts, ok := parseHostOptions("serve", args, out, os.Stderr)
  if !ok {
    return 2
  }
  overlay := driver.NewOverlayFS(driver.DefaultFS())
  opts.fs = overlay
  observationsIncomplete := false
  opts.observationsIncomplete = &observationsIncomplete
  cache, ok := buildServeCache(opts)
  if !ok {
    return 2
  }
  encoder := json.NewEncoder(out)
  // ReadString imposes no line-length limit. An update request carries a whole
  // file's content on one line, so the line is as large as that content; a
  // bufio.Scanner cap would be an arbitrary ceiling at which the resident host
  // dies, and there is no such natural ceiling on source size.
  reader := bufio.NewReader(in)
  for {
    raw, err := reader.ReadString('\n')
    if line := strings.TrimSpace(raw); line != "" {
      var writeErr error
      cache, writeErr = handleServeLine(line, opts, overlay, cache, encoder)
      if writeErr != nil {
        fmt.Fprintf(os.Stderr, "ttsc utility serve: write error: %v\n", writeErr)
        return 2
      }
    }
    if err != nil {
      if err != io.EOF {
        fmt.Fprintf(os.Stderr, "ttsc utility serve: read error: %v\n", err)
        return 2
      }
      return 0
    }
  }
}

// handleServeLine answers one request line and returns the cache to use for the
// next request: the rebuilt cache after a successful update, the unchanged cache
// otherwise. Response encoding errors terminate the outer request loop.
func handleServeLine(
  line string,
  opts hostOptions,
  overlay *driver.OverlayFS,
  cache map[string]string,
  encoder *json.Encoder,
) (map[string]string, error) {
  var req serveRequest
  if err := json.Unmarshal([]byte(line), &req); err != nil {
    return cache, encoder.Encode(serveResponse{})
  }
  if req.Update != "" {
    abs := resolveServePath(opts.cwd, req.Update)
    prev, had := overlay.Get(abs)
    overlay.Set(abs, req.Content)
    if rebuilt, ok := buildServeCache(opts); ok {
      return rebuilt, encoder.Encode(serveUpdateResponse{
        Updated: true, ObservationsComplete: serveObservationCompleteness(opts),
      })
    }
    // Roll the failed edit back so a file that does not compile does not poison
    // every later rebuild; the previous transform stays in effect.
    if had {
      overlay.Set(abs, prev)
    } else {
      overlay.Unset(abs)
    }
    return cache, encoder.Encode(serveUpdateResponse{
      Updated: false, ObservationsComplete: serveObservationCompleteness(opts),
    })
  }
  key := apiOutputKey(opts.cwd, resolveServePath(opts.cwd, req.File))
  text, found := cache[key]
  return cache, encoder.Encode(serveResponse{
    TypeScript: text, Found: found, ObservationsComplete: serveObservationCompleteness(opts),
  })
}

// serveObservationCompleteness exposes only an explicit limitation. A nil result
// does not establish that every input was observed.
func serveObservationCompleteness(opts hostOptions) *bool {
  if opts.observationsIncomplete == nil || !*opts.observationsIncomplete {
    return nil
  }
  complete := false
  return &complete
}

// buildServeCache runs the whole-project transform once over the current overlay
// state and returns the transformed text keyed exactly like the transform
// subcommand's JSON envelope.
func buildServeCache(opts hostOptions) (map[string]string, bool) {
  prog, _, ok := loadUtilityProgram(opts)
  if !ok {
    return nil, false
  }
  defer prog.Close()
  if err := prog.ApplyLinkedPlugins(); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, false
  }
  printer := shimprinter.NewPrinter(shimprinter.PrinterOptions{}, shimprinter.PrintHandlers{}, nil)
  cache := map[string]string{}
  for _, file := range prog.SourceFiles() {
    cache[apiOutputKey(opts.cwd, file.FileName())] = shimprinter.EmitSourceFile(printer, file)
  }
  if opts.observationsIncomplete != nil {
    *opts.observationsIncomplete = prog.PluginObservationsIncomplete()
  }
  return cache, true
}

// resolveServePath turns a request's file into a normalized absolute path, the
// same form TypeScript-Go's own SourceFile.FileName() and the OverlayFS key
// already use, so apiOutputKey and overlay lookups match regardless of how the
// caller spelled the path. tspath.ResolvePath discards cwd and normalizes in
// place when file is already rooted, so one call covers both request cases.
func resolveServePath(cwd, file string) string {
  return shimtspath.ResolvePath(cwd, file)
}
