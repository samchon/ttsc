package sourceprocess

import (
  "encoding/base64"
  "encoding/json"
  "path/filepath"
  "reflect"
  "testing"
)

// TestRequestPreservesNativeCommandInputs verifies independent control and
// payload interpretation without starting a native command.
//
// 1. Decode argv, environment and binary stdin containing shell-shaped text.
// 2. Require exact values and a deterministic environment vector.
// 3. Reject unknown fields, invalid payloads, trailing JSON and timeout overflow.
//
// @evidence contracts/testing.md#behavioral-verification The actual protocol decoder and stdin/environment adapters preserve explicit arguments, empty values and binary input while refusing malformed or unsupported protocol records.
// @evidence contracts/testing.md#independent-expectations Literal argument/environment vectors and byte sequences follow the version-one JSON contract; malformed records are independently enumerated rather than generated from decoder decisions.
// @evidence contracts/testing.md#distinguishing-cases Positive empty and binary inputs contrast with unknown fields, unsupported versions, invalid base64, relative cwd, negative and overflow timeouts and multiple JSON values.
// @evidence contracts/testing.md#execution-ownership This Go test invokes portable owning operations directly; no consumer installation, native producer or product host is started.
func TestRequestPreservesNativeCommandInputs(t *testing.T) {
  root, err := filepath.Abs(t.TempDir())
  if err != nil {
    t.Fatal(err)
  }
  payload := []byte{0, 255, '\n', '\r', 1}
  argv0 := "custom native argv0"
  input := request{
    Version: 1, Command: "native-tool", Cwd: root,
    Argv0:       &argv0,
    Args:        []string{"", "a b", "%PATH%", "$(echo x)", "quoted\"\\"},
    Env:         map[string]string{"Z": "", "A": "a=b\nvalue"},
    InputBase64: base64.StdEncoding.EncodeToString(payload),
    TimeoutMs:   30_000,
  }
  data, err := json.Marshal(input)
  if err != nil {
    t.Fatal(err)
  }
  actual, err := decodeRequest(data)
  if err != nil {
    t.Fatal(err)
  }
  if !reflect.DeepEqual(actual, input) {
    t.Fatalf("decoded values changed: %#v", actual)
  }
  decoded, err := inputBytes(actual)
  if err != nil || !reflect.DeepEqual(decoded, payload) {
    t.Fatalf("binary stdin changed: %v, %v", decoded, err)
  }
  if actual := environment(input.Env); !reflect.DeepEqual(actual, []string{"A=a=b\nvalue", "Z="}) {
    t.Fatalf("environment changed: %#v", actual)
  }
  empty, err := inputBytes(request{})
  if err != nil || len(empty) != 0 {
    t.Fatalf("absent stdin is not empty: %v", err)
  }
  for name, mutation := range map[string]func(map[string]any){
    "unknown":          func(value map[string]any) { value["shell"] = true },
    "version":          func(value map[string]any) { value["version"] = 2 },
    "relative-cwd":     func(value map[string]any) { value["cwd"] = "relative" },
    "missing-env":      func(value map[string]any) { delete(value, "env") },
    "base64":           func(value map[string]any) { value["inputBase64"] = "!" },
    "negative-timeout": func(value map[string]any) { value["timeoutMs"] = -1 },
    "overflow-timeout": func(value map[string]any) { value["timeoutMs"] = int64(1<<63 - 1) },
  } {
    t.Run(name, func(t *testing.T) {
      var value map[string]any
      if err := json.Unmarshal(data, &value); err != nil {
        t.Fatal(err)
      }
      mutation(value)
      encoded, err := json.Marshal(value)
      if err != nil {
        t.Fatal(err)
      }
      if _, err := decodeRequest(encoded); err == nil {
        t.Fatal("invalid request was admitted")
      }
    })
  }
  if _, err := decodeRequest(append(data, []byte(" {}")...)); err == nil {
    t.Fatal("trailing JSON was admitted")
  }
}
