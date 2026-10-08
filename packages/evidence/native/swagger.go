package evidence

import (
  "bytes"
  "context"
  "encoding/json"
  "errors"
  "net/url"
  "os"
  "os/exec"
  "regexp"
  "sort"
  "strings"
  "time"

  "github.com/samchon/ttsc/packages/lint/rule"
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
// It is empty for a remote source, whose successful result is reused by URL
// rather than by content for the process lifetime.
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
) (map[string]*artifactInventory, graphDiagnostics) {
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
  config.inputs.Unavailable()
  digests := swaggerContentDigests(root, sources, config.inputs)
  trace := newEvidenceBridgeTrace("swagger")
  if trace != nil {
    trace.nativeLookup = true
    trace.record("bridge-lookup", os.Getpid(), map[string]any{
      "bridge": "swagger", "root": root, "sources": sources,
      "nativeDigests": digests, "nativeLookup": true,
    })
  }
  pending := []string{}
  problems := graphDiagnostics{}
  severity := artifactSeverity(config, artifactSwagger)
  for _, source := range sources {
    outcome, hit := lookupSwaggerDocument(source, digests[source])
    if !hit {
      if trace != nil {
        _, present := digests[source]
        trace.record("bridge-cache-miss", os.Getpid(), map[string]any{
          "bridge": "swagger", "source": source, "nativeDigest": digests[source], "nativeDigestPresent": present,
        })
      }
      pending = append(pending, source)
      continue
    }
    if trace != nil {
      _, present := digests[source]
      trace.record("bridge-cache-hit", os.Getpid(), map[string]any{
        "bridge": "swagger", "source": source, "nativeDigest": digests[source], "nativeDigestPresent": present,
      })
    }
    problems = problems.add(
      swaggerSeverity(config, source),
      swaggerUnitsFromOutcome(source, inventories[source], outcome)...,
    )
  }
  if len(pending) == 0 {
    return inventories, problems
  }

  result, err := normalizeSwaggerSources(root, pending, trace)
  if err != nil {
    reason := causeText(err)
    for _, source := range pending {
      reason = redactSwaggerError(source, reason)
    }
    message := "Evidence graph could not run its Swagger normalizer: " + reason + ". Swagger references require Node.js and the installed @typia/interface, @typia/utils, and yaml dependencies."
    for _, source := range pending {
      inventories[source].LoadFailed = true
      inventories[source].Problems = append(
        inventories[source].Problems,
        inventoryProblem{Symbol: "operation", Message: message},
      )
    }
    var pendingSeverity rule.Severity
    for _, source := range pending {
      pendingSeverity = max(pendingSeverity, swaggerSeverity(config, source))
    }
    return inventories, problems.add(pendingSeverity, message)
  }

  seen := map[string]bool{}
  for _, document := range result.Documents {
    inventory := inventories[document.Source]
    if inventory == nil {
      problems = problems.add(
        severity,
        "Evidence graph Swagger normalizer returned an unconfigured source '"+displaySwaggerSource(document.Source)+"'. Reinstall @ttsc/evidence; the native and JavaScript bridge contracts disagree.",
      )
      continue
    }
    if seen[document.Source] {
      problems = problems.add(
        swaggerSeverity(config, document.Source),
        "Evidence graph Swagger normalizer returned source '"+displaySwaggerSource(document.Source)+"' more than once. Reinstall @ttsc/evidence; the native and JavaScript bridge contracts disagree.",
      )
      continue
    }
    seen[document.Source] = true
    outcome := swaggerDocumentOutcome{Operations: document.Operations}
    problems = problems.add(
      swaggerSeverity(config, document.Source),
      swaggerUnitsFromOutcome(document.Source, inventory, outcome)...,
    )
    rememberSwaggerDocument(document.Source, document.Digest, outcome)
  }
  for _, problem := range result.Problems {
    inventory := inventories[problem.Source]
    if inventory == nil {
      problems = problems.add(
        severity,
        "Evidence graph Swagger normalizer rejected an unconfigured source '"+displaySwaggerSource(problem.Source)+"'. Reinstall @ttsc/evidence; the native and JavaScript bridge contracts disagree.",
      )
      continue
    }
    seen[problem.Source] = true
    outcome := swaggerDocumentOutcome{
      Rejected: true,
      Problem:  problem.Message,
    }
    problems = problems.add(
      swaggerSeverity(config, problem.Source),
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
    problems = problems.add(swaggerSeverity(config, source), message)
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

// normalizeSwaggerSources retains the real Node request/Run/unmarshal boundary.
// Optional private trace context pairs the caller's existing local digest map;
// direct calls remain unpaired and do not invent native lookup values. Actual
// pending source order, wire bytes, returned outcomes and cache keys are kept.
func normalizeSwaggerSources(
  root string,
  sources []string,
  traces ...*evidenceBridgeTrace,
) (swaggerNormalizationResult, error) {
  var trace *evidenceBridgeTrace
  if len(traces) != 0 {
    trace = traces[0]
  } else {
    trace = newEvidenceBridgeTrace("swagger")
  }
  request, err := json.Marshal(swaggerNormalizationRequest{
    Root:    root,
    Sources: sources,
  })
  if err != nil {
    trace.preparationFailure(err)
    return swaggerNormalizationResult{}, err
  }
  if trace != nil {
    trace.record("bridge-request", os.Getpid(), map[string]any{
      "bridge": "swagger", "root": root, "sources": sources, "nativeLookup": trace.nativeLookup,
    })
  }
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node, err = exec.LookPath("node")
    if err != nil {
      failure := errors.New("Node.js executable was not found")
      trace.preparationFailure(failure)
      return swaggerNormalizationResult{}, failure
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
  start := trace.attempt(command)
  runErr := command.Run()
  deadlineExceeded := false
  if runErr != nil {
    deadlineExceeded = ctx.Err() == context.DeadlineExceeded
  }
  end := time.Time{}
  if trace != nil {
    end = time.Now().UTC()
  }
  if runErr != nil {
    trace.result(command, stdout, stderr, start, end, runErr, "not-attempted", nil, nil, nil)
    if deadlineExceeded {
      return swaggerNormalizationResult{}, errors.New("Swagger normalizer exceeded its 60 second timeout")
    }
    detail := strings.TrimSpace(stderr.String())
    if detail == "" {
      detail = runErr.Error()
    }
    return swaggerNormalizationResult{}, errors.New(detail)
  }
  var result swaggerNormalizationResult
  if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
    trace.result(command, stdout, stderr, start, end, nil, "failed", err, nil, nil)
    return swaggerNormalizationResult{}, errors.New("Swagger normalizer returned invalid JSON: " + err.Error())
  }
  if trace != nil {
    documents := make([]string, 0, len(result.Documents))
    problems := make([]string, 0, len(result.Problems))
    for _, document := range result.Documents {
      documents = append(documents, document.Source)
    }
    for _, problem := range result.Problems {
      problems = append(problems, problem.Source)
    }
    trace.result(command, stdout, stderr, start, end, nil, "succeeded", nil, documents, problems)
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

var swaggerErrorURL = regexp.MustCompile(`(?i)https?://[^\s"'<>]+`)

// displaySwaggerSource presents a URL without userinfo, query or fragment.
// Lexical boundaries also cover malformed URLs rejected by net/url. Local
// filesystem paths retain their spelling; this value never enters cache or
// transport identity. A malformed HTTP spelling without an authority has no
// reliably separable host/path and is shown only with its scheme.
func displaySwaggerSource(source string) string {
  lower := strings.ToLower(source)
  if !strings.Contains(source, "://") && !strings.HasPrefix(lower, "http:") && !strings.HasPrefix(lower, "https:") {
    return source
  }
  suffix := strings.IndexAny(source, "?#")
  base := source
  if suffix >= 0 {
    base = source[:suffix]
  }
  scheme := strings.Index(base, "://")
  if scheme < 0 {
    return source[:strings.Index(source, ":")+1] + "[redacted]"
  }
  start := scheme + 3
  end := len(base)
  if slash := strings.Index(base[start:], "/"); slash >= 0 {
    end = start + slash
  }
  if user := strings.LastIndex(base[start:end], "@"); user >= 0 {
    base = base[:start] + "***@" + base[start+user+1:]
  } else if _, err := url.Parse(base[:end]); err != nil {
    // A malformed authority can be truncated userinfo, not a separable host.
    base = base[:start] + "[redacted]" + base[end:]
  }
  if suffix >= 0 {
    base += "?[redacted]"
  }
  return base
}

// redactSwaggerError sanitizes remote diagnostic presentation, including every
// repeated or foreign URL reflected by an external error. Exact source lookup
// and cache state retain their raw keys. Local filesystem causes stay intact.
func redactSwaggerError(source string, message string) string {
  if displaySwaggerSource(source) == source && !isRemoteSwaggerSource(source) {
    return message
  }
  message = strings.ReplaceAll(message, source, displaySwaggerSource(source))
  return swaggerErrorURL.ReplaceAllStringFunc(message, displaySwaggerSource)
}

type limitedBuffer struct {
  bytes.Buffer
  Limit int
  // Exceeded observes the existing failure boundary without changing its bytes
  // or return error. A captured prefix cannot be a complete wire observation.
  Exceeded bool
}

func (buffer *limitedBuffer) Write(content []byte) (int, error) {
  if buffer.Len()+len(content) > buffer.Limit {
    buffer.Exceeded = true
    remaining := buffer.Limit - buffer.Len()
    if remaining > 0 {
      _, _ = buffer.Buffer.Write(content[:remaining])
    }
    return len(content), errors.New("process output exceeded its limit")
  }
  return buffer.Buffer.Write(content)
}
