package linthost

import (
  "bytes"
  "encoding/json"
  "errors"
  "io"
  "os"
  "path/filepath"
  "strings"
)

// errNoLintConfigFile is the sentinel LoadConfigResolver wraps when no
// lint.config.*/ttsc-lint.config.* file is found. The format paths
// (loadFormatRules) treat it as "use defaults" rather than a hard error, so
// formatOnSave / `ttsc format` work even when a project ships no lint config.
var errNoLintConfigFile = errors.New("@ttsc/lint: no lint.config.* or ttsc-lint.config.* file found")

// loadFormatRules loads the rule resolver for the format paths, tolerating a
// missing lint config. The lint check/build path requires a config and surfaces
// the error, but formatting falls back to the documented defaults: a project
// with no lint.config.* still formats on save. Any other load error (a broken
// or malformed config) is propagated unchanged.
func loadFormatRules(pluginsJSON, cwd, tsconfigPath string) (RuleResolver, error) {
  rules, err := loadRules(pluginsJSON, cwd, tsconfigPath)
  if err != nil {
    if errors.Is(err, errNoLintConfigFile) {
      return RuleConfig{}, nil
    }
    return nil, err
  }
  return rules, nil
}

// editorFormatOverrides reads the nearest ancestor `.vscode/settings.json`
// relative to startDir and maps the editor's formatting settings onto the
// `format` block keys the default formatter understands. Only keys the user
// explicitly set are returned, so any setting that is absent falls through to
// the documented format defaults.
//
// This is consulted only when lint.config.* configures no `format` block: a
// configured format block always wins and never reaches this path. Within
// settings.json, matching combined language sections are applied in source
// order and an exact single-language section is applied last, mirroring VS
// Code's own resolution. Pass language="" to skip language sections (e.g. the
// project-wide `ttsc format` CLI path).
//
// Mapping (values use JSON types so they parse identically to a real `format`
// block, where numbers decode as float64):
//
//   - editor.tabSize      -> tabWidth   (number)
//   - editor.insertSpaces -> useTabs    (bool, inverted)
//   - files.eol           -> endOfLine  ("\n" -> "lf", "\r\n" -> "crlf")
//
// editor.detectIndentation auto-detection is intentionally not emulated; the
// explicit tabSize/insertSpaces are honored as written. A relative startDir is
// ignored (returns no overrides) so unit tests that format from a bare cwd stay
// hermetic and never walk up into a real workspace's .vscode directory.
func editorFormatOverrides(startDir string, language string) map[string]any {
  out := map[string]any{}
  if !filepath.IsAbs(startDir) {
    return out
  }
  settings, ok := loadNearestVSCodeSettings(startDir)
  if !ok {
    return out
  }
  // Top-level keys first, then matching combined language sections in source
  // order. VS Code holds an exact single-language section aside and applies it
  // last, regardless of where its full selector appears in settings.json.
  applyEditorSettings(out, settings.values)
  if language != "" {
    var exact map[string]any
    for _, section := range settings.languageSections {
      if len(section.identifiers) == 1 && section.identifiers[0] == language {
        exact = section.values
        continue
      }
      if languageSectionContains(section.identifiers, language) {
        applyEditorSettings(out, section.values)
      }
    }
    applyEditorSettings(out, exact)
  }
  return out
}

// applyEditorSettings reads the recognized editor keys from a settings object
// (either the top-level document or a language-specific section) and writes the
// corresponding format-block overrides into out, overwriting earlier values so
// callers can layer language sections over the top-level defaults.
func applyEditorSettings(out map[string]any, settings map[string]any) {
  if v, ok := settings["editor.tabSize"]; ok {
    if f, ok := v.(float64); ok {
      out["tabWidth"] = f
    }
  }
  if v, ok := settings["editor.insertSpaces"]; ok {
    if b, ok := v.(bool); ok {
      out["useTabs"] = !b
    }
  }
  if v, ok := settings["files.eol"]; ok {
    if s, ok := v.(string); ok {
      switch s {
      case "\n":
        out["endOfLine"] = "lf"
      case "\r\n":
        out["endOfLine"] = "crlf"
      }
    }
  }
}

// languageSectionIdentifiers parses a complete VS Code language selector such
// as "[typescript]" or "[javascript][typescript][json]". Each full selector is
// one override scope; its identifiers are used only to determine whether that
// scope applies to the requested language. Identifiers are trimmed and
// deduplicated, and empty normalized identifiers are discarded, before
// exact-versus-combined precedence is decided.
func languageSectionIdentifiers(key string) ([]string, bool) {
  identifiers := []string{}
  for len(key) != 0 {
    if key[0] != '[' {
      return nil, false
    }
    close := strings.IndexByte(key, ']')
    if close <= 1 {
      return nil, false
    }
    identifier := strings.TrimSpace(key[1:close])
    if identifier == "" {
      key = key[close+1:]
      continue
    }
    if !languageSectionContains(identifiers, identifier) {
      identifiers = append(identifiers, identifier)
    }
    key = key[close+1:]
  }
  return identifiers, len(identifiers) != 0
}

func languageSectionContains(identifiers []string, language string) bool {
  if language == "" {
    return false
  }
  for _, identifier := range identifiers {
    if identifier == language {
      return true
    }
  }
  return false
}

// vscodeLanguageID maps a file extension to the VS Code language identifier
// used in settings.json language sections. Extensions outside the formatter's
// supported set return "" so no language section matches.
func vscodeLanguageID(filePath string) string {
  switch strings.ToLower(filepath.Ext(filePath)) {
  case ".ts", ".mts", ".cts":
    return "typescript"
  case ".tsx":
    return "typescriptreact"
  case ".js", ".mjs", ".cjs":
    return "javascript"
  case ".jsx":
    return "javascriptreact"
  default:
    return ""
  }
}

type vscodeSettings struct {
  values           map[string]any
  languageSections []vscodeLanguageSection
}

type vscodeLanguageSection struct {
  identifiers []string
  values      map[string]any
}

// loadNearestVSCodeSettings walks up from startDir looking for a
// `.vscode/settings.json`, returning the first one found decoded as a JSONC
// document. It returns ok=false when none exists or the file cannot be parsed,
// so a broken settings file degrades to the format defaults instead of breaking
// the formatter.
func loadNearestVSCodeSettings(startDir string) (vscodeSettings, bool) {
  dir := startDir
  for {
    candidate := filepath.Join(dir, ".vscode", "settings.json")
    if data, err := os.ReadFile(candidate); err == nil {
      data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
      parsed, err := decodeVSCodeSettings(stripJSONC(data))
      if err == nil {
        return parsed, true
      }
      return vscodeSettings{}, false
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return vscodeSettings{}, false
    }
    dir = parent
  }
}

// decodeVSCodeSettings decodes the top-level JSON object without discarding
// declaration order. encoding/json maps are intentionally unordered, while VS
// Code merges matching combined language sections in the order they appear in
// settings.json and applies the exact single-language section afterwards. A
// repeated property keeps its first insertion position and final value, as it
// does in VS Code's parsed settings object.
func decodeVSCodeSettings(data []byte) (vscodeSettings, error) {
  decoder := json.NewDecoder(bytes.NewReader(data))
  token, err := decoder.Token()
  if err != nil {
    return vscodeSettings{}, err
  }
  if token != json.Delim('{') {
    return vscodeSettings{}, errors.New("VS Code settings must be a JSON object")
  }

  orderedKeys := []string{}
  values := map[string]any{}
  for decoder.More() {
    token, err := decoder.Token()
    if err != nil {
      return vscodeSettings{}, err
    }
    key, ok := token.(string)
    if !ok {
      return vscodeSettings{}, errors.New("VS Code setting key must be a string")
    }
    var value any
    if err := decoder.Decode(&value); err != nil {
      return vscodeSettings{}, err
    }
    if _, exists := values[key]; !exists {
      orderedKeys = append(orderedKeys, key)
    }
    values[key] = value
  }
  token, err = decoder.Token()
  if err != nil {
    return vscodeSettings{}, err
  }
  if token != json.Delim('}') {
    return vscodeSettings{}, errors.New("VS Code settings object is not closed")
  }
  if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
    if err != nil {
      return vscodeSettings{}, err
    }
    return vscodeSettings{}, errors.New("VS Code settings contain trailing JSON")
  }
  settings := vscodeSettings{values: map[string]any{}}
  for _, key := range orderedKeys {
    value := values[key]
    identifiers, isLanguageSection := languageSectionIdentifiers(key)
    if !isLanguageSection {
      settings.values[key] = value
      continue
    }
    section, ok := value.(map[string]any)
    if !ok {
      continue
    }
    settings.languageSections = append(settings.languageSections, vscodeLanguageSection{
      identifiers: identifiers,
      values:      section,
    })
  }
  return settings, nil
}

// stripJSONC removes `//` line comments, `/* */` block comments, and trailing
// commas from a JSONC byte slice so encoding/json can parse VS Code's
// settings.json. It is string-literal aware: comment markers and commas inside
// string values are preserved.
func stripJSONC(data []byte) []byte {
  out := make([]byte, 0, len(data))
  inString := false
  escaped := false
  for i := 0; i < len(data); i++ {
    c := data[i]
    if inString {
      out = append(out, c)
      if escaped {
        escaped = false
        continue
      }
      switch c {
      case '\\':
        escaped = true
      case '"':
        inString = false
      }
      continue
    }
    switch {
    case c == '"':
      inString = true
      out = append(out, c)
    case c == '/' && i+1 < len(data) && data[i+1] == '/':
      for i < len(data) && data[i] != '\n' {
        i++
      }
      if i < len(data) {
        out = append(out, data[i])
      }
    case c == '/' && i+1 < len(data) && data[i+1] == '*':
      i += 2
      for i+1 < len(data) && !(data[i] == '*' && data[i+1] == '/') {
        i++
      }
      i++
    default:
      out = append(out, c)
    }
  }
  return dropTrailingCommas(out)
}

// dropTrailingCommas removes a comma that is followed (after optional
// whitespace) by a closing `}` or `]`, the one JSONC affordance encoding/json
// rejects. It is string-literal aware so commas inside strings survive.
func dropTrailingCommas(data []byte) []byte {
  out := make([]byte, 0, len(data))
  inString := false
  escaped := false
  for i := 0; i < len(data); i++ {
    c := data[i]
    if inString {
      out = append(out, c)
      if escaped {
        escaped = false
        continue
      }
      switch c {
      case '\\':
        escaped = true
      case '"':
        inString = false
      }
      continue
    }
    if c == '"' {
      inString = true
      out = append(out, c)
      continue
    }
    if c == ',' {
      j := i + 1
      for j < len(data) && isJSONSpace(data[j]) {
        j++
      }
      if j < len(data) && (data[j] == '}' || data[j] == ']') {
        continue
      }
    }
    out = append(out, c)
  }
  return out
}

func isJSONSpace(c byte) bool {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}
