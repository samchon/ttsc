package linthost

import (
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "unicode/utf8"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimdw "github.com/microsoft/typescript-go/shim/diagnosticwriter"
)

// eslintRuntimeProvider is the optional interface that a RuleResolver
// implementation may satisfy to enable the external ESLint subprocess path.
// ConfigStore implements all three methods; other resolvers that do not
// implement this interface silently bypass the ESLint runtime.
type eslintRuntimeProvider interface {
  ExternalConfigPath() string
  WantsESLintRuntime() bool
  RequiresESLintRuntime() bool
}

// eslintRuntimeOutput is the top-level JSON object written to stdout by
// the embedded externalESLintRunnerScript.
type eslintRuntimeOutput struct {
  Missing bool                `json:"missing"`
  Fixed   int                 `json:"fixed"`
  Results []eslintRuntimeFile `json:"results"`
}

// eslintRuntimeFile mirrors one entry from ESLint's LintResult array.
type eslintRuntimeFile struct {
  FilePath string                 `json:"filePath"`
  Messages []eslintRuntimeMessage `json:"messages"`
}

// eslintRuntimeMessage mirrors one entry from ESLint's LintMessage array.
type eslintRuntimeMessage struct {
  RuleID    string `json:"ruleId"`
  Severity  int    `json:"severity"`
  Message   string `json:"message"`
  Line      int    `json:"line"`
  Column    int    `json:"column"`
  EndLine   int    `json:"endLine"`
  EndColumn int    `json:"endColumn"`
}

// runExternalESLintDiagnostics delegates to the project's installed ESLint
// binary (via the embedded JS runner) and converts the JSON output into
// LintDiagnostic values anchored to their source positions. Returns
// (nil, false, nil) when the resolver does not want the ESLint runtime,
// (nil, true, nil) when no source files qualify, and (diags, true, nil)
// on success. The bool return is "ran ESLint" — callers use it to skip
// native-rule diagnostics when ESLint was the sole configured source.
func runExternalESLintDiagnostics(
  resolver RuleResolver,
  cwd string,
  files []*shimast.SourceFile,
) ([]*shimdw.LintDiagnostic, bool, error) {
  provider, ok := resolver.(eslintRuntimeProvider)
  if !ok || !provider.WantsESLintRuntime() {
    return nil, false, nil
  }
  configPath := provider.ExternalConfigPath()
  if configPath == "" {
    return nil, false, nil
  }

  fileNames := make([]string, 0, len(files))
  byPath := make(map[string]*shimast.SourceFile, len(files))
  for _, file := range files {
    if file == nil || file.IsDeclarationFile {
      continue
    }
    name := file.FileName()
    if !filepath.IsAbs(name) {
      name = filepath.Join(cwd, name)
    }
    if abs, err := filepath.Abs(name); err == nil {
      name = abs
    }
    fileNames = append(fileNames, name)
    byPath[filepath.ToSlash(name)] = file
  }
  if len(fileNames) == 0 {
    return nil, true, nil
  }

  payload, err := json.Marshal(fileNames)
  if err != nil {
    return nil, false, fmt.Errorf("@ttsc/lint: encode ESLint file list: %w", err)
  }

  output, err := runExternalESLint(cwd, configPath, string(payload))
  if err != nil {
    return nil, false, err
  }
  if output.Missing {
    if provider.RequiresESLintRuntime() {
      return nil, false, fmt.Errorf("@ttsc/lint: ESLint runtime is required by %s; install eslint in the project or replace runtime-only config features", configPath)
    }
    return nil, false, nil
  }

  diagnostics := make([]*shimdw.LintDiagnostic, 0)
  for _, result := range output.Results {
    file := byPath[filepath.ToSlash(result.FilePath)]
    if file == nil {
      continue
    }
    for _, msg := range result.Messages {
      if msg.Severity == 0 {
        // ESLint severity 0 means "off" — skip silently.
        continue
      }
      ruleID := strings.TrimSpace(msg.RuleID)
      if ruleID == "" {
        // ESLint can emit messages without a ruleId for parse errors.
        ruleID = "eslint"
      }
      category := shimdw.LintCategoryWarning
      if msg.Severity >= 2 {
        // severity 2 = error; values above 2 are treated as error too.
        category = shimdw.LintCategoryError
      }
      pos := positionOfESLintLocation(file.Text(), msg.Line, msg.Column)
      end := positionOfESLintLocation(file.Text(), msg.EndLine, msg.EndColumn)
      if end <= pos {
        end = pos + 1
      }
      diagnostics = append(diagnostics, shimdw.NewLintDiagnostic(
        file,
        pos,
        end,
        ruleCode(ruleID),
        category,
        fmt.Sprintf("[%s] %s", ruleID, msg.Message),
      ))
    }
  }
  return diagnostics, true, nil
}

// runExternalESLint invokes ESLint in check (read-only) mode.
func runExternalESLint(cwd, configPath, fileListJSON string) (*eslintRuntimeOutput, error) {
  return runExternalESLintWithMode(cwd, configPath, fileListJSON, false)
}

// runExternalESLintFixes invokes ESLint in fix mode and returns the number of
// files that were actually modified. The fix runner calls ESLint.outputFixes
// inside the JS subprocess, which writes changes directly to disk.
func runExternalESLintFixes(
  resolver RuleResolver,
  cwd string,
  files []*shimast.SourceFile,
) (int, error) {
  provider, ok := resolver.(eslintRuntimeProvider)
  if !ok || !provider.WantsESLintRuntime() {
    return 0, nil
  }
  configPath := provider.ExternalConfigPath()
  if configPath == "" {
    return 0, nil
  }

  fileNames := make([]string, 0, len(files))
  for _, file := range files {
    if file == nil || file.IsDeclarationFile {
      continue
    }
    name := file.FileName()
    if !filepath.IsAbs(name) {
      name = filepath.Join(cwd, name)
    }
    if abs, err := filepath.Abs(name); err == nil {
      name = abs
    }
    fileNames = append(fileNames, name)
  }
  if len(fileNames) == 0 {
    return 0, nil
  }

  payload, err := json.Marshal(fileNames)
  if err != nil {
    return 0, fmt.Errorf("@ttsc/lint: encode ESLint file list: %w", err)
  }

  output, err := runExternalESLintWithMode(cwd, configPath, string(payload), true)
  if err != nil {
    return 0, err
  }
  if output.Missing {
    if provider.RequiresESLintRuntime() {
      return 0, fmt.Errorf("@ttsc/lint: ESLint runtime is required by %s; install eslint in the project or replace runtime-only config features", configPath)
    }
    return 0, nil
  }
  return output.Fixed, nil
}

// runExternalESLintWithMode spawns a Node.js subprocess that runs the embedded
// externalESLintRunnerScript. When fix is true the runner calls
// ESLint.outputFixes and returns the count of modified files; when false it
// returns diagnostics only and leaves files untouched.
func runExternalESLintWithMode(cwd, configPath, fileListJSON string, fix bool) (*eslintRuntimeOutput, error) {
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node = "node"
  }
  mode := "check"
  if fix {
    mode = "fix"
  }
  cmd := exec.Command(node, "-e", externalESLintRunnerScript, cwd, configPath, fileListJSON, mode)
  cmd.Env = nodeConfigLoaderEnv(configPath)
  cmd.Dir = cwd
  raw, err := cmd.Output()
  if err != nil {
    stderr := ""
    if exit, ok := err.(*exec.ExitError); ok {
      stderr = strings.TrimSpace(string(exit.Stderr))
    }
    if stderr != "" {
      return nil, fmt.Errorf("@ttsc/lint: run ESLint config %s: %s", configPath, stderr)
    }
    return nil, fmt.Errorf("@ttsc/lint: run ESLint config %s: %w", configPath, err)
  }
  var output eslintRuntimeOutput
  if err := json.Unmarshal(raw, &output); err != nil {
    return nil, fmt.Errorf("@ttsc/lint: parse ESLint output for %s: %w", configPath, err)
  }
  return &output, nil
}

// positionOfESLintLocation converts a 1-based (line, column) position from
// ESLint's output — where column is a UTF-16 code-unit offset — into a
// zero-based byte offset into text. This matches how tsgo positions source
// spans: lines are 1-based, columns are UTF-16 units (so a supplementary
// codepoint counts as 2). Returns len(text) when the position is past EOF.
func positionOfESLintLocation(text string, line, column int) int {
  if line <= 0 {
    line = 1
  }
  if column <= 0 {
    column = 1
  }
  lineStart := 0
  currentLine := 1
  for i := 0; i < len(text) && currentLine < line; {
    r, size := utf8.DecodeRuneInString(text[i:])
    if r == '\n' {
      currentLine++
      lineStart = i + size
    }
    i += size
  }
  targetUTF16 := column - 1
  seenUTF16 := 0
  for i := lineStart; i < len(text); {
    if seenUTF16 >= targetUTF16 {
      return i
    }
    r, size := utf8.DecodeRuneInString(text[i:])
    if r == '\n' || r == '\r' {
      return i
    }
    if r > 0xFFFF {
      seenUTF16 += 2
    } else {
      seenUTF16++
    }
    i += size
  }
  return len(text)
}

const externalESLintRunnerScript = `
const { createRequire } = require("node:module");
const path = require("node:path");

(async () => {
  const cwd = process.argv[1];
  const configPath = process.argv[2];
  const files = JSON.parse(process.argv[3]);
  const shouldFix = process.argv[4] === "fix";
  const requireFromProject = createRequire(path.join(cwd, "package.json"));
  let eslintPath;
  try {
    eslintPath = requireFromProject.resolve("eslint");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      process.stdout.write(JSON.stringify({ missing: true, results: [] }));
      return;
    }
    throw error;
  }
  const eslintModule = requireFromProject(eslintPath);

  const ESLintCtor = typeof eslintModule.loadESLint === "function"
    ? await eslintModule.loadESLint({ useFlatConfig: true })
    : eslintModule.ESLint ?? eslintModule.default?.ESLint ?? eslintModule.default;

  if (typeof ESLintCtor !== "function") {
    throw new Error("installed eslint package does not export ESLint or loadESLint");
  }

  const eslint = new ESLintCtor({
    cwd,
    overrideConfigFile: configPath,
    fix: shouldFix,
    ignore: true,
    warnIgnored: false,
  });
  const results = await eslint.lintFiles(files);
  if (shouldFix) {
    const outputFixes =
      ESLintCtor.outputFixes ||
      eslintModule.ESLint?.outputFixes ||
      eslintModule.default?.ESLint?.outputFixes;
    if (typeof outputFixes !== "function") {
      throw new Error("installed eslint package does not expose ESLint.outputFixes");
    }
    await outputFixes.call(ESLintCtor, results);
  }
  process.stdout.write(JSON.stringify({
    missing: false,
    fixed: shouldFix
      ? results.filter((result) => typeof result.output === "string").length
      : 0,
    results: results.map((result) => ({
      filePath: result.filePath,
      messages: result.messages.map((message) => ({
        ruleId: message.ruleId || "eslint",
        severity: message.severity,
        message: message.message,
        line: message.line || 1,
        column: message.column || 1,
        endLine: message.endLine || message.line || 1,
        endColumn: message.endColumn || message.column || 1,
      })),
    })),
  }));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
`
