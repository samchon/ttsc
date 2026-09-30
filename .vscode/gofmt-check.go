// Command gofmt-check formats independent stdin records without file writes.
// The CI caller selects this engine only with the matching SDK's gofmt binary;
// its existing Perl lexer remains the owner of two-space normalization.
package main

import (
  "encoding/json"
  "fmt"
  "go/format"
  "io"
  "os"
)

func main() {
  decoder := json.NewDecoder(os.Stdin)
  encoder := json.NewEncoder(os.Stdout)
  for {
    var record struct {
      File      string `json:"file"`
      Source    string `json:"source"`
      Formatted string `json:"formatted"`
      Error     string `json:"error,omitempty"`
    }
    err := decoder.Decode(&record)
    if err == io.EOF {
      break
    }
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      os.Exit(2)
    }
    if record.Error == "" {
      formatted, err := format.Source([]byte(record.Source))
      if err != nil {
        record.Error = err.Error()
      } else {
        record.Formatted = string(formatted)
      }
    }
    if err := encoder.Encode(record); err != nil {
      fmt.Fprintln(os.Stderr, err)
      os.Exit(2)
    }
  }
}
