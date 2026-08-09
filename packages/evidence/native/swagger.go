package evidence

import (
  "bytes"
  "context"
  "encoding/json"
  "errors"
  "net/url"
  "os"
  "os/exec"
  "sort"
  "strings"
  "time"
)

const swaggerBridgeTimeout = 60 * time.Second
const swaggerBridgeOutputLimit = 64 * 1024 * 1024
const swaggerBridgeErrorLimit = 64 * 1024

const swaggerBridgeScript = `
const path = require("node:path");
const { createRequire } = require("node:module");

const root = process.argv[1];
const projectRequire = createRequire(path.join(root, "package.json"));
const manifest = projectRequire.resolve("@ttsc/evidence/package.json");
const pluginRequire = createRequire(manifest);
const normalizer = pluginRequire(
  path.join(path.dirname(manifest), "lib", "internal", "loadSwaggerOperations.js"),
);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", async () => {
  try {
    const result = await normalizer.loadSwaggerOperations(JSON.parse(input));
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    process.stderr.write(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
});
`

type swaggerNormalizationRequest struct {
  Root    string   `json:"root"`
  Sources []string `json:"sources"`
}

type swaggerNormalizationResult struct {
  Documents []swaggerDocumentInventory `json:"documents"`
  Problems  []swaggerDocumentProblem   `json:"problems"`
}

// swaggerDocumentInventory is one normalized document.
//
// Digest is the SHA-256 of the bytes the normalizer itself read, and it is what
// the result is remembered under. Hashing here rather than trusting the digest
// this process took beforehand is what makes the key exact: the normalizer runs
// in another process and opens the file again, so a write landing between the
// two reads would otherwise bind one document's operations to another
// document's bytes — an entry that answers a later cycle with the wrong
// document, forever.
//
// It is empty for a remote source, which never participates in reuse.
type swaggerDocumentInventory struct {
  Source     string             `json:"source"`
  Operations []swaggerOperation `json:"operations"`
  Digest     string             `json:"digest"`
}

// swaggerDocumentProblem is one source the normalizer refused. Digest carries
// the same meaning as on an inventory, so a document that cannot be normalized
// is remembered as a failure rather than re-normalized on every later cycle.
type swaggerDocumentProblem struct {
  Source  string `json:"source"`
  Message string `json:"message"`
  Digest  string `json:"digest"`
}

type swaggerOperation struct {
  Method string `json:"method"`
  Path   string `json:"path"`
  // Digest is the operation's content, hashed by the bridge that normalized it.
  //
  // This side never sees the document, so the value travels with the identity
  // rather than being recomputed here. The document-wide digest beside it is a
  // cache key and answers a different question: one value shared by every
  // operation expires every review in a document whenever any part of it moves.
  Digest string `json:"digest"`
}

func loadSwaggerInventories(
  root string,
  config graphConfig,
) (map[string]*artifactInventory, []string) {
  sources := configuredSwaggerSources(config)
  inventories := map[string]*artifactInventory{}
  for _, source := range sources {
    inventories[source] = &artifactInventory{
      Path: source,
      Type: artifactSwagger,
    }
  }
  if len(sources) == 0 {
    return inventories, nil
  }

  // Normalizing a document costs a Node process, and the process start
  // dominates the parse — a three-operation document and a
  // two-hundred-operation one pay nearly the same. A resident host repeats
  // this every cycle, so an unchanged document is re-normalized on every
  // TypeScript keystroke that triggers a rebuild.
  digests := swaggerContentDigests(root, sources)
  pending := []string{}
  problems := []string{}
  for _, source := range sources {
    outcome, hit := lookupSwaggerDocument(source, digests[source])
    if !hit {
      pending = append(pending, source)
      continue
    }
    problems = append(
      problems,
      swaggerUnitsFromOutcome(source, inventories[source], outcome)...,
    )
  }
  if len(pending) == 0 {
    return inventories, problems
  }

  result, err := normalizeSwaggerSources(root, pending)
  if err != nil {
    message := "Evidence graph could not run its Swagger normalizer: " + err.Error() + ". Swagger references require Node.js and the installed @typia/interface, @typia/utils, and yaml dependencies."
    for _, source := range pending {
      inventories[source].LoadFailed = true
      inventories[source].Problems = append(
        inventories[source].Problems,
        inventoryProblem{Symbol: "operation", Message: message},
      )
    }
    return inventories, append(problems, message)
  }

  seen := map[string]bool{}
  for _, document := range result.Documents {
    inventory := inventories[document.Source]
    if inventory == nil {
      problems = append(
        problems,
        "Evidence graph Swagger normalizer returned an unconfigured source '"+displaySwaggerSource(document.Source)+"'. Reinstall @ttsc/evidence; the native and JavaScript bridge contracts disagree.",
      )
      continue
    }
    if seen[document.Source] {
      problems = append(
        problems,
        "Evidence graph Swagger normalizer returned source '"+displaySwaggerSource(document.Source)+"' more than once. Reinstall @ttsc/evidence; the native and JavaScript bridge contracts disagree.",
      )
      continue
    }
    seen[document.Source] = true
    outcome := swaggerDocumentOutcome{Operations: document.Operations}
    problems = append(
      problems,
      swaggerUnitsFromOutcome(document.Source, inventory, outcome)...,
    )
    rememberSwaggerDocument(document.Source, document.Digest, outcome)
  }
  for _, problem := range result.Problems {
    inventory := inventories[problem.Source]
    if inventory == nil {
      problems = append(
        problems,
        "Evidence graph Swagger normalizer rejected an unconfigured source '"+displaySwaggerSource(problem.Source)+"'. Reinstall @ttsc/evidence; the native and JavaScript bridge contracts disagree.",
      )
      continue
    }
    seen[problem.Source] = true
    outcome := swaggerDocumentOutcome{
      Rejected: true,
      Problem:  problem.Message,
    }
    problems = append(
      problems,
      swaggerUnitsFromOutcome(problem.Source, inventory, outcome)...,
    )
    rememberSwaggerDocument(problem.Source, problem.Digest, outcome)
  }
  for _, source := range pending {
    if seen[source] {
      continue
    }
    message := "Evidence graph Swagger normalizer returned no result for '" + displaySwaggerSource(source) + "'. Reinstall @ttsc/evidence; the native and JavaScript bridge contracts disagree."
    inventories[source].LoadFailed = true
    inventories[source].Problems = append(
      inventories[source].Problems,
      inventoryProblem{Symbol: "operation", Message: message},
    )
    problems = append(problems, message)
  }
  return inventories, problems
}

func configuredSwaggerSources(config graphConfig) []string {
  unique := map[string]bool{}
  sources := []string{}
  for _, claim := range config.Claims {
    for _, reference := range claim.References {
      if reference.Type != artifactSwagger {
        continue
      }
      if unique[reference.Source] {
        continue
      }
      unique[reference.Source] = true
      sources = append(sources, reference.Source)
    }
  }
  sort.Strings(sources)
  return sources
}

func normalizeSwaggerSources(
  root string,
  sources []string,
) (swaggerNormalizationResult, error) {
  request, err := json.Marshal(swaggerNormalizationRequest{
    Root:    root,
    Sources: sources,
  })
  if err != nil {
    return swaggerNormalizationResult{}, err
  }
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node, err = exec.LookPath("node")
    if err != nil {
      return swaggerNormalizationResult{}, errors.New("Node.js executable was not found")
    }
  }
  ctx, cancel := context.WithTimeout(context.Background(), swaggerBridgeTimeout)
  defer cancel()
  command := exec.CommandContext(ctx, node, "-e", swaggerBridgeScript, root)
  command.Dir = root
  command.Stdin = bytes.NewReader(request)
  stdout := &limitedBuffer{Limit: swaggerBridgeOutputLimit}
  stderr := &limitedBuffer{Limit: swaggerBridgeErrorLimit}
  command.Stdout = stdout
  command.Stderr = stderr
  if err := command.Run(); err != nil {
    if ctx.Err() == context.DeadlineExceeded {
      return swaggerNormalizationResult{}, errors.New("Swagger normalizer exceeded its 60 second timeout")
    }
    detail := strings.TrimSpace(stderr.String())
    if detail == "" {
      detail = err.Error()
    }
    return swaggerNormalizationResult{}, errors.New(detail)
  }
  var result swaggerNormalizationResult
  if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
    return swaggerNormalizationResult{}, errors.New("Swagger normalizer returned invalid JSON: " + err.Error())
  }
  return result, nil
}

func swaggerOperationUnit(
  source string,
  operation swaggerOperation,
) (*evidenceUnit, string) {
  method := strings.TrimSpace(operation.Method)
  operationPath := operation.Path
  if method == "" || strings.ContainsAny(method, ":\t\r\n ") {
    return nil, "Swagger source '" + displaySwaggerSource(source) + "' contains an operation method that cannot form a '<METHOD>:<path>' evidence target."
  }
  if !strings.HasPrefix(operationPath, "/") || containsWhitespace(operationPath) {
    return nil, "Swagger source '" + displaySwaggerSource(source) + "' contains operation path '" + operationPath + "', which cannot form a whitespace-free '<METHOD>:<path>' evidence target."
  }
  target := strings.ToUpper(method) + ":" + operationPath
  readable := "Swagger operation '" + strings.ToUpper(method) + " " + operationPath + "'"
  return &evidenceUnit{
    ID:       "swagger:" + source + ":" + target,
    Target:   target,
    Type:     artifactSwagger,
    Symbol:   "operation",
    Path:     displaySwaggerSource(source),
    Readable: readable,
    Digest:   operation.Digest,
  }, ""
}

// isRemoteSwaggerSource reports whether a normalized Swagger source names a URL
// rather than a project-relative file.
//
// Two callers depend on it and both fail quietly when it is wrong: a remote
// source declared as a project input is rejected by the host and takes the
// whole snapshot down with it, and a remote source admitted to the content
// cache would be answered from bytes that were never fetched.
//
// The scheme is read through `url.Parse` rather than matched as a prefix
// because `normalizeSwaggerSource` stores the author's spelling, and a scheme
// is case-insensitive — `HTTPS://host/s.json` is accepted there and would slip
// past a literal `https://` comparison.
func isRemoteSwaggerSource(source string) bool {
  parsed, err := url.Parse(source)
  return err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

func displaySwaggerSource(source string) string {
  parsed, err := url.Parse(source)
  if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
    return source
  }
  if parsed.User != nil {
    parsed.User = url.User("***")
  }
  if parsed.RawQuery != "" {
    parsed.RawQuery = "<redacted>"
  }
  return parsed.String()
}

type limitedBuffer struct {
  bytes.Buffer
  Limit int
}

func (buffer *limitedBuffer) Write(content []byte) (int, error) {
  if buffer.Len()+len(content) > buffer.Limit {
    remaining := buffer.Limit - buffer.Len()
    if remaining > 0 {
      _, _ = buffer.Buffer.Write(content[:remaining])
    }
    return len(content), errors.New("process output exceeded its limit")
  }
  return buffer.Buffer.Write(content)
}
