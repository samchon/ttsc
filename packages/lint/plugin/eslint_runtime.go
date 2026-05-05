package main

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

type eslintRuntimeProvider interface {
  ExternalConfigPath() string
  WantsESLintRuntime() bool
  RequiresESLintRuntime() bool
}

type eslintRuntimeOutput struct {
  Missing bool                `json:"missing"`
  Results []eslintRuntimeFile `json:"results"`
}

type eslintRuntimeFile struct {
  FilePath string                 `json:"filePath"`
  Messages []eslintRuntimeMessage `json:"messages"`
}

type eslintRuntimeMessage struct {
  RuleID    string `json:"ruleId"`
  Severity  int    `json:"severity"`
  Message   string `json:"message"`
  Line      int    `json:"line"`
  Column    int    `json:"column"`
  EndLine   int    `json:"endLine"`
  EndColumn int    `json:"endColumn"`
}

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
        continue
      }
      ruleID := strings.TrimSpace(msg.RuleID)
      if ruleID == "" {
        ruleID = "eslint"
      }
      category := shimdw.LintCategoryWarning
      if msg.Severity >= 2 {
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

func runExternalESLint(cwd, configPath, fileListJSON string) (*eslintRuntimeOutput, error) {
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node = "node"
  }
  cmd := exec.Command(node, "-e", externalESLintRunnerScript, cwd, configPath, fileListJSON)
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
    ignore: true,
    warnIgnored: false,
  });
  const results = await eslint.lintFiles(files);
  process.stdout.write(JSON.stringify({
    missing: false,
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
