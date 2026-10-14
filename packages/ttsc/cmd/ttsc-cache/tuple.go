package main

import (
  "bytes"
  "context"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/internal/packageartifacts"
)

func readGoTuple(goBinary string) (packageartifacts.Tuple, error) {
  var tuple packageartifacts.Tuple
  if !filepath.IsAbs(goBinary) {
    return tuple, errors.New("artifact Go executable must be absolute")
  }
  info, err := os.Stat(goBinary)
  if err != nil || !info.Mode().IsRegular() || info.Size() > 256<<20 {
    return tuple, errors.New("artifact Go executable is missing or too large")
  }
  file, err := os.Open(goBinary)
  if err != nil {
    return tuple, err
  }
  goHash := sha256.New()
  _, copyErr := io.Copy(goHash, io.LimitReader(file, (256<<20)+1))
  closeErr := file.Close()
  if copyErr != nil || closeErr != nil {
    return tuple, errors.Join(copyErr, closeErr)
  }
  output, err := runGoProbe(goBinary, "env", "-json", "GOVERSION", "GOOS", "GOARCH", "GOAMD64", "GOARM", "GOARM64", "GO386", "GOMIPS", "GOMIPS64", "GOPPC64", "GORISCV64", "GOWASM", "CGO_ENABLED", "GOEXPERIMENT", "GOFLAGS")
  if err != nil {
    return tuple, err
  }
  var values map[string]string
  if err := json.Unmarshal(output, &values); err != nil {
    return tuple, fmt.Errorf("decode Go tuple: %w", err)
  }
  if values["CGO_ENABLED"] != "0" || values["GOFLAGS"] != "" {
    return tuple, errors.New("publisher artifacts require effective CGO_ENABLED=0 and no GOFLAGS")
  }
  if values["GOVERSION"] != "go1.26.0" {
    return tuple, errors.New("publisher cache protocol is validated only for stock Go 1.26.0")
  }
  if values["GOVERSION"] == "" || values["GOOS"] == "" || values["GOARCH"] == "" {
    return tuple, errors.New("Go did not report a complete artifact tuple")
  }
  toolHash := sha256.New()
  for _, name := range []string{"asm", "cgo", "compile", "cover", "link", "vet"} {
    version, err := runGoProbe(goBinary, "tool", name, "-V=full")
    if err != nil {
      return tuple, fmt.Errorf("Go tool %s identity unavailable: %w", name, err)
    }
    _, _ = fmt.Fprintf(toolHash, "%s:%d:%s\n", name, len(version), version)
  }
  architecture := make(map[string]string)
  for _, key := range []string{"GOAMD64", "GOARM", "GOARM64", "GO386", "GOMIPS", "GOMIPS64", "GOPPC64", "GORISCV64", "GOWASM"} {
    if value := values[key]; value != "" {
      architecture[key] = value
    }
  }
  return packageartifacts.Tuple{
    GoVersion: values["GOVERSION"], GoToolSHA256: hex.EncodeToString(goHash.Sum(nil)),
    GOOS: values["GOOS"], GOARCH: values["GOARCH"], Architecture: architecture,
    CGOEnabled: values["CGO_ENABLED"], GoExperiment: values["GOEXPERIMENT"],
    BuildFlags: []string{"-trimpath"}, BuildTags: []string{},
    ToolIDsSHA256: hex.EncodeToString(toolHash.Sum(nil)),
  }, nil
}

func runGoProbe(goBinary string, arguments ...string) ([]byte, error) {
  ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
  defer cancel()
  command := exec.CommandContext(ctx, goBinary, arguments...)
  output := boundedBuffer{limit: 64 << 10}
  command.Stdout = &output
  diagnostic := boundedBuffer{limit: 16 << 10}
  command.Stderr = &diagnostic
  if err := command.Run(); err != nil {
    return nil, fmt.Errorf("stock Go probe %s failed: %w (%s)", strings.Join(arguments, " "), err, strings.TrimSpace(diagnostic.String()))
  }
  return output.Bytes(), nil
}

type boundedBuffer struct {
  bytes.Buffer
  limit int
}

func (buffer *boundedBuffer) Write(value []byte) (int, error) {
  if len(value) > buffer.limit-buffer.Len() {
    return 0, errors.New("stock Go identity output is too large")
  }
  return buffer.Buffer.Write(value)
}
