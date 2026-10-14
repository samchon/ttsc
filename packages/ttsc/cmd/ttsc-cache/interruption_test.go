package main

import (
  "bufio"
  "bytes"
  "crypto/sha256"
  "encoding/base64"
  "encoding/hex"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
  "time"
)

// TestCacheHelperInterruption verifies that an interrupted protocol operation cannot publish an incomplete action.
//
// Verifies: killing a helper during a streamed put leaves the new action absent, and a broken get response leaves an older complete action readable.
// 1. Seed a complete action, start the production helper protocol, and send only the beginning of a larger put body.
// 2. Kill the helper after its staging file appears, then reopen the store and compare the old hit and interrupted miss.
// 3. Break the response pipe during a get and reopen the store to require the same complete hit.
//
// @evidence contracts/testing.md#behavioral-verification Runs the production helper as a child through its public protocol, kills it during a partial streamed put, and interrupts the direct server's response writer on a real get.
// @evidence contracts/testing.md#independent-expectations An action mapping requires a complete body matching its SHA-256 OutputID; a partly received body has no valid mapping, while an earlier completed mapping must survive both failures.
// @evidence contracts/testing.md#distinguishing-cases Covers process death after a partial body is sent and a get response failure with a prior valid hit and a new missing action; stock Go's reaction to a bad helper is owned by TestStockGoCacheFailures.
// @evidence contracts/testing.md#execution-ownership This Go test uses a temporary local helper process and store; it does not install a consumer or run a product E2E build.
func TestCacheHelperInterruption(t *testing.T) {
  root := t.TempDir()
  oldAction := bytes.Repeat([]byte{0x31}, 32)
  newAction := bytes.Repeat([]byte{0x32}, 32)
  oldBody := []byte("completed archive")
  oldOutput := sha256.Sum256(oldBody)
  initial, err := openArtifactStore(root, nil)
  if err != nil {
    t.Fatal(err)
  }
  if _, err := initial.put(hex.EncodeToString(oldAction), hex.EncodeToString(oldOutput[:]), int64(len(oldBody)), bytes.NewReader(oldBody)); err != nil {
    t.Fatal(err)
  }
  if err := initial.close(); err != nil {
    t.Fatal(err)
  }

  helper := filepath.Join(t.TempDir(), "cache helper"+exeSuffix())
  build := exec.Command("go", "build", "-trimpath", "-o", helper, ".")
  build.Env = append(os.Environ(), "GOCACHEPROG=", "GOTOOLCHAIN=local")
  if output, err := build.CombinedOutput(); err != nil {
    t.Fatalf("building cache helper: %v\n%s", err, output)
  }
  command := exec.Command(helper, "-root", root)
  stdin, err := command.StdinPipe()
  if err != nil {
    t.Fatal(err)
  }
  stdout, err := command.StdoutPipe()
  if err != nil {
    t.Fatal(err)
  }
  var stderr bytes.Buffer
  command.Stderr = &stderr
  if err := command.Start(); err != nil {
    t.Fatal(err)
  }
  defer func() {
    if command.ProcessState == nil {
      command.Process.Kill()
      command.Wait()
    }
  }()
  startup, err := bufio.NewReader(stdout).ReadBytes('\n')
  if err != nil {
    t.Fatalf("reading helper startup: %v; stderr: %s", err, &stderr)
  }
  var capability response
  if err := json.Unmarshal(startup, &capability); err != nil || fmt.Sprint(capability.KnownCommands) != "[get put close]" {
    t.Fatalf("helper did not advertise the Go cache protocol: %s; %v", startup, err)
  }
  body := bytes.Repeat([]byte("interrupted archive body"), 50000)
  outputID := sha256.Sum256(body)
  header, err := json.Marshal(request{ID: 1, Command: "put", ActionID: newAction, OutputID: outputID[:], BodySize: int64(len(body))})
  if err != nil {
    t.Fatal(err)
  }
  if _, err := fmt.Fprintf(stdin, "%s\n\n\"%s", header, base64.StdEncoding.EncodeToString(body[:98304])); err != nil {
    t.Fatalf("sending partial Go cache body: %v", err)
  }
  staging := filepath.Join(root, "overlay", "staging")
  deadline := time.Now().Add(10 * time.Second)
  staged := false
  for time.Now().Before(deadline) {
    entries, err := os.ReadDir(staging)
    if err != nil {
      t.Fatal(err)
    }
    staged = len(entries) > 0
    if staged {
      break
    }
    time.Sleep(10 * time.Millisecond)
  }
  if !staged {
    entries, _ := os.ReadDir(staging)
    command.Process.Kill()
    command.Wait()
    remaining, _ := io.ReadAll(stdout)
    t.Fatalf("helper never opened a put staging file: entries=%d remaining=%q stderr=%s", len(entries), remaining, &stderr)
  }
  if err := command.Process.Kill(); err != nil {
    t.Fatal(err)
  }
  command.Wait()
  stdin.Close()
  stdout.Close()

  reopened, err := openArtifactStore(root, nil)
  if err != nil {
    t.Fatal(err)
  }
  _, _, found, err := reopened.get(hex.EncodeToString(newAction))
  if err != nil || found {
    t.Fatalf("interrupted put became a hit: found=%v error=%v", found, err)
  }
  oldValue, oldPath, found, err := reopened.get(hex.EncodeToString(oldAction))
  if err != nil || !found || oldValue.OutputID != hex.EncodeToString(oldOutput[:]) {
    t.Fatalf("interrupted put damaged the complete action: value=%+v found=%v error=%v", oldValue, found, err)
  }
  if raw, err := os.ReadFile(oldPath); err != nil || !bytes.Equal(raw, oldBody) {
    t.Fatalf("complete body changed after interruption: %q %v", raw, err)
  }
  if err := reopened.close(); err != nil {
    t.Fatal(err)
  }

  interruptedGet, err := openArtifactStore(root, nil)
  if err != nil {
    t.Fatal(err)
  }
  getHeader, err := json.Marshal(request{ID: 2, Command: "get", ActionID: oldAction})
  if err != nil {
    t.Fatal(err)
  }
  broken := &failSecondResponse{}
  err = serve(strings.NewReader(string(getHeader)+"\n"), broken, interruptedGet)
  if !errors.Is(err, errBrokenResponse) {
    t.Fatalf("interrupted get did not report its broken response: %v", err)
  }
  if err := interruptedGet.close(); err != nil {
    t.Fatal(err)
  }
  settled, err := openArtifactStore(root, nil)
  if err != nil {
    t.Fatal(err)
  }
  defer settled.close()
  value, location, found, err := settled.get(hex.EncodeToString(oldAction))
  if err != nil || !found || value.OutputID != hex.EncodeToString(oldOutput[:]) {
    t.Fatalf("interrupted get damaged the complete action: value=%+v path=%q found=%v error=%v", value, location, found, err)
  }
}

var errBrokenResponse = errors.New("client response pipe closed")

type failSecondResponse struct{ writes int }

func (writer *failSecondResponse) Write(value []byte) (int, error) {
  writer.writes++
  if writer.writes == 2 {
    return 0, errBrokenResponse
  }
  return len(value), nil
}
