// A stand-in for an `@ttsc/lint` plugin sidecar, for cases about the resident
// client rather than about any rule.
//
// The client's whole contract is that it degrades: a sidecar that does not know
// `lsp-serve`, or does not know a verb on it, has to leave the caller spawning
// one process per question. Both of those are answers, not crashes, and neither
// is visible from the caller's own result — the fallback returns the same bytes
// the daemon would have. So the fake records what it was spawned with and what
// it received, and a case reads that rather than inferring it from an answer
// that looks the same either way.
package main

import (
  "bufio"
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
)

type config struct {
  // Mode selects which sidecar generation this is standing in for.
  //
  //  serve      answers the stream
  //  no-serve   exits without reading, as one built before lsp-serve existed
  Mode string `json:"mode"`
  // RejectVerb narrows `serve` to a sidecar that answers the stream and does
  // not know one verb on it, which it reports the only way this protocol lets
  // it: a nonzero code, indistinguishable from a rule that failed.
  RejectVerb string `json:"rejectVerb"`
}

type request struct {
  Verb       string `json:"verb"`
  Invalidate bool   `json:"invalidate"`
}

type response struct {
  Result json.RawMessage `json:"result"`
  Code   int             `json:"code"`
}

func main() {
  cwd, err := os.Getwd()
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(2)
  }
  appendLine(filepath.Join(cwd, "sidecar-arguments.log"), mustJSON(os.Args[1:]))

  cfg := config{Mode: "serve"}
  if raw, readErr := os.ReadFile(filepath.Join(cwd, "lint-daemon-fake.json")); readErr == nil {
    if err := json.Unmarshal(raw, &cfg); err != nil {
      fmt.Fprintln(os.Stderr, err)
      os.Exit(2)
    }
  }
  if len(os.Args) < 2 || os.Args[1] != "lsp-serve" || cfg.Mode == "no-serve" {
    // Exactly what an older sidecar does with a subcommand it has never heard
    // of, and what a one-shot verb invocation must not be answered with here.
    fmt.Fprintln(os.Stderr, "unknown subcommand")
    os.Exit(2)
  }

  scanner := bufio.NewScanner(os.Stdin)
  scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
  encoder := json.NewEncoder(os.Stdout)
  served := 0
  for scanner.Scan() {
    appendLine(filepath.Join(cwd, "sidecar-requests.log"), scanner.Text())
    var req request
    if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
      _ = encoder.Encode(response{Code: 2})
      continue
    }
    if cfg.RejectVerb != "" && req.Verb == cfg.RejectVerb {
      _ = encoder.Encode(response{Code: 2})
      continue
    }
    served++
    // The payload names the request it answered, so a case can tell an answer
    // that came through this stream from one a fallback process produced.
    result := mustJSON(map[string]any{
      "servedBy":   "daemon",
      "verb":       req.Verb,
      "invalidate": req.Invalidate,
      "served":     served,
    })
    _ = encoder.Encode(response{Result: json.RawMessage(result), Code: 0})
  }
}

func mustJSON(value any) string {
  encoded, err := json.Marshal(value)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(2)
  }
  return string(encoded)
}

func appendLine(file, line string) {
  handle, err := os.OpenFile(file, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(2)
  }
  defer handle.Close()
  fmt.Fprintln(handle, line)
}
