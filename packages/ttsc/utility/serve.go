package utility

import (
  "bufio"
  "encoding/json"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "strings"

  shimprinter "github.com/microsoft/typescript-go/shim/printer"

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
// One resident process can serve every Metro worker or an editor session, which
// removes the per-call recompile the transform subcommand incurs and lets edits
// be reflected without respawning the host (samchon/ttsc#255).
//
// in and out are explicit so the request loop is testable; the utility-host
// command wires them to os.Stdin and os.Stdout.
func RunServe(in io.Reader, out io.Writer, args []string) int {
  opts, ok := parseHostOptions("serve", args)
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
  scanner := bufio.NewScanner(in)
  scanner.Buffer(make([]byte, 0, 64*1024), 64*1024*1024)
  for scanner.Scan() {
    line := strings.TrimSpace(scanner.Text())
    if line == "" {
      continue
    }
    var req serveRequest
    if err := json.Unmarshal([]byte(line), &req); err != nil {
      _ = encoder.Encode(serveResponse{})
      continue
    }
    if req.Update != "" {
      overlay.Set(resolveServePath(opts.cwd, req.Update), req.Content)
      if rebuilt, ok := buildServeCache(opts); ok {
        cache = rebuilt
        _ = encoder.Encode(serveUpdateResponse{Updated: true})
      } else {
        _ = encoder.Encode(serveUpdateResponse{Updated: false})
      }
      continue
    }
    key := apiOutputKey(opts.cwd, resolveServePath(opts.cwd, req.File))
    text, found := cache[key]
    _ = encoder.Encode(serveResponse{TypeScript: text, Found: found})
  }
  if err := scanner.Err(); err != nil {
    fmt.Fprintf(os.Stderr, "ttsc utility serve: read error: %v\n", err)
    return 2
  }
  return 0
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

// resolveServePath turns a request's file into an absolute path so apiOutputKey
// computes the same key buildServeCache stored, and so overlay overrides are
// keyed the way the program asks for them.
func resolveServePath(cwd, file string) string {
  if filepath.IsAbs(file) {
    return file
  }
  return filepath.Join(cwd, file)
}
