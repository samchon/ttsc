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
}

// serveUpdateResponse is the reply to an update request: whether re-transforming
// the project with the new content succeeded. A false reply leaves the previous
// transform in place (for example the edit introduced a type error); the host's
// diagnostics are written to stderr.
type serveUpdateResponse struct {
  Updated bool `json:"updated"`
}

// RunServe is the resident transform host. It transforms the whole project once
// (the expensive compile plus linked-plugin pass) over an in-memory overlay,
// caches every file's transformed text, then answers newline-delimited requests
// read from in by writing one JSON reply per line to out, until in reaches EOF:
//
//   - {"file":"<path>"} returns that file's transformed TypeScript.
//   - {"update":"<path>","content":"<text>"} applies new content for the file
//     and re-transforms, so subsequent transform requests reflect the edit.
//
// One resident process answers a request stream without recompiling the project
// per call and reflects edits without respawning the host. Sharing one host
// across separate worker processes (a Metro worker pool) is tracked in
// samchon/ttsc#255.
//
// in and out are explicit so the request loop is testable; the utility-host
// command wires them to os.Stdin and os.Stdout.
func RunServe(in io.Reader, out io.Writer, args []string) int {
  opts, ok := parseHostOptions("serve", args, out, os.Stderr)
  if !ok {
    return 2
  }
  overlay := driver.NewOverlayFS(driver.DefaultFS())
  opts.fs = overlay
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
      cache = handleServeLine(line, opts, overlay, cache, encoder)
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
// otherwise.
func handleServeLine(
  line string,
  opts hostOptions,
  overlay *driver.OverlayFS,
  cache map[string]string,
  encoder *json.Encoder,
) map[string]string {
  var req serveRequest
  if err := json.Unmarshal([]byte(line), &req); err != nil {
    _ = encoder.Encode(serveResponse{})
    return cache
  }
  if req.Update != "" {
    abs := resolveServePath(opts.cwd, req.Update)
    prev, had := overlay.Get(abs)
    overlay.Set(abs, req.Content)
    if rebuilt, ok := buildServeCache(opts); ok {
      _ = encoder.Encode(serveUpdateResponse{Updated: true})
      return rebuilt
    }
    // Roll the failed edit back so a file that does not compile does not poison
    // every later rebuild; the previous transform stays in effect.
    if had {
      overlay.Set(abs, prev)
    } else {
      overlay.Unset(abs)
    }
    _ = encoder.Encode(serveUpdateResponse{Updated: false})
    return cache
  }
  key := apiOutputKey(opts.cwd, resolveServePath(opts.cwd, req.File))
  text, found := cache[key]
  _ = encoder.Encode(serveResponse{TypeScript: text, Found: found})
  return cache
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
  return cache, true
}

// resolveServePath turns a request's file into a normalized absolute path, the
// same form TypeScript-Go's own SourceFile.FileName() and the OverlayFS key
// already use, so apiOutputKey and overlay lookups match regardless of how the
// caller spelled the path. tspath.ResolvePath discards cwd and normalizes in
// place when file is already rooted, so one call covers both request cases
// (samchon/ttsc#319).
func resolveServePath(cwd, file string) string {
  return shimtspath.ResolvePath(cwd, file)
}
