package main

import (
  "bufio"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "errors"
  "fmt"
  "os"
  "path/filepath"
  "sort"
  "time"
)

type config struct {
  Mode          string `json:"mode"`
  Stderr        string `json:"stderr"`
  DelayMs       int    `json:"delayMs"`
  SchemaVersion int    `json:"schemaVersion"`
}

type request struct {
  ID int `json:"id"`
}

func main() {
  cwd := argument("--cwd")
  raw, err := os.ReadFile(filepath.Join(cwd, "native-session-fake.json"))
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(2)
  }
  var cfg config
  if err := json.Unmarshal(raw, &cfg); err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(2)
  }
  recordPID(cwd)

  switch cfg.Mode {
  case "hang":
    hang(cfg)
  case "hang-once":
    if claimFirst(cwd) {
      hang(cfg)
    }
  case "malformed-once":
    if claimFirst(cwd) {
      scanner := bufio.NewScanner(os.Stdin)
      if scanner.Scan() {
        fmt.Println("{not-json")
        hangForever()
      }
      return
    }
  case "exit-once":
    if claimFirst(cwd) {
      os.Exit(17)
    }
  case "bad-shard-digest-once":
    if claimFirst(cwd) {
      scanner := bufio.NewScanner(os.Stdin)
      if scanner.Scan() {
        var req request
        if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
          os.Exit(3)
        }
        response, err := shardResponse(req.ID, cwd, cfg.SchemaVersion, "wrong-digest")
        if err != nil {
          os.Exit(4)
        }
        if err := json.NewEncoder(os.Stdout).Encode(response); err != nil {
          os.Exit(4)
        }
        hangForever()
      }
      return
    }
  case "bad-shard-generation-once":
    if claimFirst(cwd) {
      scanner := bufio.NewScanner(os.Stdin)
      if scanner.Scan() {
        var req request
        if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
          os.Exit(3)
        }
        response, err := shardResponse(req.ID, cwd, cfg.SchemaVersion, "")
        if err != nil {
          os.Exit(4)
        }
        response["snapshot"].(map[string]any)["generation"] = "wrong-generation"
        if err := json.NewEncoder(os.Stdout).Encode(response); err != nil {
          os.Exit(4)
        }
        hangForever()
      }
      return
    }
  case "bad-envelope-once":
    if claimFirst(cwd) {
      scanner := bufio.NewScanner(os.Stdin)
      if scanner.Scan() {
        var req request
        if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
          os.Exit(3)
        }
        frame := response(req.ID, true, cwd, cfg.SchemaVersion)
        frame["changed"] = false
        if err := json.NewEncoder(os.Stdout).Encode(frame); err != nil {
          os.Exit(4)
        }
        hangForever()
      }
      return
    }
  case "duplicate-shard-manifest-once":
    firstProcess := claimFirst(cwd)
    scanner := bufio.NewScanner(os.Stdin)
    encoder := json.NewEncoder(os.Stdout)
    if !scanner.Scan() {
      return
    }
    var initialRequest request
    if err := json.Unmarshal(scanner.Bytes(), &initialRequest); err != nil {
      os.Exit(3)
    }
    initial, err := shardResponse(initialRequest.ID, cwd, cfg.SchemaVersion, "")
    if err != nil || encoder.Encode(initial) != nil {
      os.Exit(4)
    }
    if !firstProcess {
      hangForever()
    }
    if !scanner.Scan() {
      return
    }
    var deltaRequest request
    if err := json.Unmarshal(scanner.Bytes(), &deltaRequest); err != nil {
      os.Exit(3)
    }
    delta, err := duplicateShardManifestResponse(deltaRequest.ID, cwd, cfg.SchemaVersion)
    if err != nil {
      os.Exit(4)
    }
    initialSnapshot := initial["snapshot"].(map[string]any)
    deltaSnapshot := delta["snapshot"].(map[string]any)
    delta["mode"] = "incremental"
    deltaSnapshot["sequence"] = 2
    deltaSnapshot["baseSequence"] = 1
    deltaSnapshot["baseGeneration"] = initialSnapshot["generation"]
    if err := encoder.Encode(delta); err != nil {
      os.Exit(4)
    }
    hangForever()
  case "unicode-shard-manifest":
    scanner := bufio.NewScanner(os.Stdin)
    if scanner.Scan() {
      var req request
      if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
        os.Exit(3)
      }
      response, err := unicodeShardManifestResponse(req.ID, cwd, cfg.SchemaVersion)
      if err != nil {
        os.Exit(4)
      }
      if err := json.NewEncoder(os.Stdout).Encode(response); err != nil {
        os.Exit(4)
      }
      hangForever()
    }
    return
  case "duplicate-config-universe-once":
    if claimFirst(cwd) {
      scanner := bufio.NewScanner(os.Stdin)
      if scanner.Scan() {
        var req request
        if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
          os.Exit(3)
        }
        response, err := duplicateConfigUniverseResponse(req.ID, cwd, cfg.SchemaVersion)
        if err != nil {
          os.Exit(4)
        }
        if err := json.NewEncoder(os.Stdout).Encode(response); err != nil {
          os.Exit(4)
        }
        hangForever()
      }
      return
    }
  }
  serve(cwd, cfg, cfg.Mode == "respond-then-hang" && claimFirst(cwd))
}

func duplicateConfigUniverseResponse(id int, cwd string, schemaVersion int) (map[string]any, error) {
  response, err := shardResponse(id, cwd, schemaVersion, "")
  if err != nil {
    return nil, err
  }
  snapshot := response["snapshot"].(map[string]any)
  configA := map[string]any{
    "key": "3:config:a",
    "config": map[string]any{
      "file":   "tsconfig.json",
      "digest": "config-a",
    },
    "nodes":       []any{},
    "edges":       []any{},
    "diagnostics": []any{},
  }
  configB := map[string]any{
    "key": "3:config:b",
    "config": map[string]any{
      "file":   "hidden.json",
      "digest": "config-b",
    },
    "nodes":       []any{},
    "edges":       []any{},
    "diagnostics": []any{},
  }
  digestA, err := digestJSON(configA)
  if err != nil {
    return nil, err
  }
  digestB, err := digestJSON(configB)
  if err != nil {
    return nil, err
  }
  upserts := snapshot["upserts"].([]any)
  snapshot["upserts"] = append(
    upserts,
    map[string]any{"digest": digestA, "shard": configA},
    map[string]any{"digest": digestB, "shard": configB},
  )
  manifest := snapshot["manifest"].([]any)
  snapshot["manifest"] = append(
    manifest,
    map[string]any{"key": "3:config:a", "digest": digestA},
    map[string]any{"key": "3:config:b", "digest": digestB},
  )
  duplicateConfig := map[string]any{"file": "tsconfig.json", "digest": "config-a"}
  snapshot["universe"] = map[string]any{
    "configs": []any{duplicateConfig, duplicateConfig},
    "roots":   []any{},
  }
  if err := refreshSnapshotGeneration(snapshot); err != nil {
    return nil, err
  }
  return response, nil
}

func duplicateShardManifestResponse(id int, cwd string, schemaVersion int) (map[string]any, error) {
  response, err := shardResponse(id, cwd, schemaVersion, "")
  if err != nil {
    return nil, err
  }
  snapshot := response["snapshot"].(map[string]any)
  second := map[string]any{
    "key":         "0:metadata:test-2",
    "nodes":       []any{},
    "edges":       []any{},
    "diagnostics": []any{},
  }
  secondDigest, err := digestJSON(second)
  if err != nil {
    return nil, err
  }
  upserts := snapshot["upserts"].([]any)
  snapshot["upserts"] = append(upserts, map[string]any{
    "digest": secondDigest,
    "shard":  second,
  })
  first := snapshot["manifest"].([]any)[0]
  manifest := []any{first, first}
  snapshot["manifest"] = manifest
  if err := refreshSnapshotGeneration(snapshot); err != nil {
    return nil, err
  }
  return response, nil
}

func unicodeShardManifestResponse(id int, cwd string, schemaVersion int) (map[string]any, error) {
  response, err := shardResponse(id, cwd, schemaVersion, "")
  if err != nil {
    return nil, err
  }
  snapshot := response["snapshot"].(map[string]any)
  keys := []string{"0:metadata:\ue000", "0:metadata:\U00010000"}
  sort.Strings(keys)
  upserts := make([]any, 0, len(keys))
  manifest := make([]any, 0, len(keys))
  for _, key := range keys {
    shard := map[string]any{
      "key":         key,
      "nodes":       []any{},
      "edges":       []any{},
      "diagnostics": []any{},
    }
    shardDigest, err := digestJSON(shard)
    if err != nil {
      return nil, err
    }
    upserts = append(upserts, map[string]any{"digest": shardDigest, "shard": shard})
    manifest = append(manifest, map[string]any{"key": key, "digest": shardDigest})
  }
  snapshot["upserts"] = upserts
  snapshot["manifest"] = manifest
  if err := refreshSnapshotGeneration(snapshot); err != nil {
    return nil, err
  }
  return response, nil
}

func refreshSnapshotGeneration(snapshot map[string]any) error {
  generation, err := digestJSON(struct {
    Tsconfig     string         `json:"tsconfig"`
    Producer     map[string]any `json:"producer"`
    Capabilities []string       `json:"capabilities"`
    Universe     map[string]any `json:"universe"`
    Manifest     []any          `json:"manifest"`
  }{
    Tsconfig:     snapshot["tsconfig"].(string),
    Producer:     snapshot["producer"].(map[string]any),
    Capabilities: snapshot["capabilities"].([]string),
    Universe:     snapshot["universe"].(map[string]any),
    Manifest:     snapshot["manifest"].([]any),
  })
  if err != nil {
    return err
  }
  snapshot["generation"] = generation
  return nil
}

func shardResponse(id int, cwd string, schemaVersion int, forcedDigest string) (map[string]any, error) {
  key := "0:metadata:test"
  shard := map[string]any{
    "key":         key,
    "nodes":       []any{},
    "edges":       []any{},
    "diagnostics": []any{},
  }
  digest, err := digestJSON(shard)
  if err != nil {
    return nil, err
  }
  if forcedDigest != "" {
    digest = forcedDigest
  }
  producer := map[string]any{
    "tool":       "native-session-fake",
    "version":    "test",
    "typescript": "test",
  }
  universe := map[string]any{
    "configs": []any{},
    "roots":   []any{},
  }
  manifest := []any{map[string]any{
    "key":    key,
    "digest": digest,
  }}
  generation, err := digestJSON(struct {
    Tsconfig     string         `json:"tsconfig"`
    Producer     map[string]any `json:"producer"`
    Capabilities []string       `json:"capabilities"`
    Universe     map[string]any `json:"universe"`
    Manifest     []any          `json:"manifest"`
  }{
    Tsconfig:     "tsconfig.json",
    Producer:     producer,
    Capabilities: []string{},
    Universe:     universe,
    Manifest:     manifest,
  })
  if err != nil {
    return nil, err
  }
  return map[string]any{
    "id":              id,
    "protocolVersion": 1,
    "mode":            "initial",
    "capabilities":    []string{},
    "changed":         true,
    "snapshot": map[string]any{
      "protocolVersion": 1,
      "schemaVersion":   schemaVersion,
      "project":         cwd,
      "tsconfig":        "tsconfig.json",
      "producer":        producer,
      "capabilities":    []string{},
      "universe":        universe,
      "sequence":        1,
      "generation":      generation,
      "upserts": []any{map[string]any{
        "digest": digest,
        "shard":  shard,
      }},
      "deletes":  []any{},
      "manifest": manifest,
    },
  }, nil
}

func digestJSON(value any) (string, error) {
  encoded, err := json.Marshal(value)
  if err != nil {
    return "", err
  }
  digest := sha256.Sum256(encoded)
  return hex.EncodeToString(digest[:]), nil
}

func argument(name string) string {
  for i := 1; i+1 < len(os.Args); i++ {
    if os.Args[i] == name {
      return os.Args[i+1]
    }
  }
  fmt.Fprintf(os.Stderr, "missing %s\n", name)
  os.Exit(2)
  return ""
}

func recordPID(cwd string) {
  file, err := os.OpenFile(filepath.Join(cwd, "pids.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(2)
  }
  defer file.Close()
  fmt.Fprintln(file, os.Getpid())
}

func claimFirst(cwd string) bool {
  file, err := os.OpenFile(filepath.Join(cwd, "first.marker"), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
  if err == nil {
    file.Close()
    return true
  }
  if errors.Is(err, os.ErrExist) {
    return false
  }
  fmt.Fprintln(os.Stderr, err)
  os.Exit(2)
  return false
}

func hang(cfg config) {
  scanner := bufio.NewScanner(os.Stdin)
  if !scanner.Scan() {
    return
  }
  message := cfg.Stderr
  if message == "" {
    message = "fake native child accepted the request and stalled"
  }
  fmt.Fprintln(os.Stderr, message)
  hangForever()
}

func hangForever() {
  for {
    time.Sleep(time.Hour)
  }
}

func serve(cwd string, cfg config, stallAfterFirst bool) {
  scanner := bufio.NewScanner(os.Stdin)
  encoder := json.NewEncoder(os.Stdout)
  initial := true
  requests := 0
  for scanner.Scan() {
    var req request
    if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
      fmt.Fprintln(os.Stderr, err)
      os.Exit(3)
    }
    if cfg.DelayMs > 0 {
      time.Sleep(time.Duration(cfg.DelayMs) * time.Millisecond)
    }
    if stallAfterFirst && requests == 1 {
      message := cfg.Stderr
      if message == "" {
        message = "fake native child stalled after its first response"
      }
      fmt.Fprintln(os.Stderr, message)
      hangForever()
    }
    if cfg.Mode == "unknown-then-respond" {
      // Carries a graph, not an unchanged reply. A client that settled on this
      // frame would hand the caller a graph the request never asked for, and
      // that is exactly the harm the id check exists to prevent — an unchanged
      // frame could be mistaken for the right answer by accident.
      if err := encoder.Encode(response(req.ID+1000, true, cwd, cfg.SchemaVersion)); err != nil {
        os.Exit(4)
      }
    }
    if err := encoder.Encode(response(req.ID, initial, cwd, cfg.SchemaVersion)); err != nil {
      os.Exit(4)
    }
    initial = false
    requests++
  }
}

func response(id int, changed bool, cwd string, schemaVersion int) map[string]any {
  frame := map[string]any{
    "id":              id,
    "protocolVersion": 1,
    "mode":            "unchanged",
    "capabilities":    []string{},
    "changed":         changed,
  }
  if !changed {
    return frame
  }
  frame["mode"] = "initial"
  frame["dump"] = map[string]any{
    "project":     cwd,
    "tsconfig":    "tsconfig.json",
    "diagnostics": []any{},
    "nodes":       []any{},
    "edges":       []any{},
    "provenance": map[string]any{
      "schemaVersion": schemaVersion,
      "capabilities":  []string{},
      "producer": map[string]any{
        "tool":       "native-session-fake",
        "version":    "test",
        "typescript": "test",
      },
      "universe": map[string]any{
        "configs": []any{},
        "roots":   []any{},
      },
      "sources": []any{},
    },
  }
  return frame
}
