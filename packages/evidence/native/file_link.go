package evidence

import (
  "encoding/json"
  "net/url"
  "path"
  "path/filepath"
  "sort"
  "strings"
  "unicode"
)

const fileLinkPrefix = "\x00file:"

func isFileLinkTarget(target string) bool {
  return strings.HasPrefix(target, fileLinkPrefix)
}

// splitFileLinkBody reads one address, allowing spaces only inside a quoted
// accessor segment. Paths use percent encoding, so # always separates the file.
func splitFileLinkBody(body string) (string, string, bool) {
  forced := isFileLinkTarget(body)
  if !forced {
    for _, marker := range inlineLinkTags {
      if strings.HasPrefix(body, marker) {
        return "", "", false
      }
    }
  }
  body = strings.TrimPrefix(body, fileLinkPrefix)
  file, _, qualified := strings.Cut(body, "#")
  if decoded, err := url.PathUnescape(file); err == nil {
    file = decoded
  }
  if !forced && (!qualified || !isTypeScriptPath(file)) {
    return "", "", false
  }
  quoted, escaped := false, false
  end := len(body)
  for index, char := range body {
    if escaped {
      escaped = false
      continue
    }
    if quoted && char == '\\' {
      escaped = true
      continue
    }
    if char == '"' {
      quoted = !quoted
    }
    if !quoted && unicode.IsSpace(char) {
      end = index
      break
    }
  }
  target := body[:end]
  if target == "" {
    return "", strings.TrimSpace(body[end:]), true
  }
  if link, problem := parseFileLink(target); problem == "" {
    target = encodeFileLinkPath(link.File) + "#" + formatFileAccessor(link.Segments)
  }
  return fileLinkPrefix + target, strings.TrimSpace(body[end:]), true
}

type fileLink struct {
  File     string
  Segments []string
}

func parseFileLink(target string) (fileLink, string) {
  target = strings.TrimPrefix(target, fileLinkPrefix)
  file, accessor, found := strings.Cut(target, "#")
  if !found || file == "" || accessor == "" {
    return fileLink{}, "write a TypeScript file path followed by '#' and an exported declaration or member"
  }
  decoded, err := url.PathUnescape(file)
  if err != nil || strings.ContainsAny(decoded, "\x00\r\n") || !isTypeScriptPath(decoded) {
    return fileLink{}, "the file must be a TypeScript path with valid percent escapes; use %20 for a space and %23 for a literal '#'"
  }
  normalized := strings.ReplaceAll(decoded, "\\", "/")
  // path.Clean collapses a UNC prefix; preserve that volume spelling.
  unc := strings.HasPrefix(normalized, "//")
  normalized = path.Clean(normalized)
  if unc {
    normalized = "/" + normalized
  }
  segments, problem := parseFileAccessor(accessor)
  if problem != "" {
    return fileLink{}, problem
  }
  return fileLink{File: normalized, Segments: segments}, ""
}

func parseFileAccessor(accessor string) ([]string, string) {
  segments := []string{}
  for len(accessor) != 0 {
    if accessor[0] == '[' {
      closing := -1
      quoted, escaped := false, false
      for index := 1; index < len(accessor); index++ {
        char := accessor[index]
        if escaped {
          escaped = false
          continue
        }
        if quoted && char == '\\' {
          escaped = true
          continue
        }
        if char == '"' {
          quoted = !quoted
        }
        if !quoted && char == ']' {
          closing = index
          break
        }
      }
      if closing < 0 {
        return nil, "close the bracket accessor and its quoted member name"
      }
      literal := accessor[1:closing]
      var segment string
      if len(literal) > 0 && literal[0] == '"' {
        if json.Unmarshal([]byte(literal), &segment) != nil {
          return nil, "a bracket accessor must contain a JSON string or an unsigned integer"
        }
      } else {
        if literal == "" || strings.Trim(literal, "0123456789") != "" || len(literal) > 1 && literal[0] == '0' {
          return nil, "a bracket accessor must contain a JSON string or an unsigned integer"
        }
        segment = literal
      }
      segments = append(segments, segment)
      accessor = accessor[closing+1:]
    } else {
      end := strings.IndexAny(accessor, ".[")
      if end < 0 {
        end = len(accessor)
      }
      segment := accessor[:end]
      if !fileAccessorIdentifier(segment) {
        return nil, "use dotted identifiers or brackets containing a JSON string for literal names"
      }
      segments = append(segments, segment)
      accessor = accessor[end:]
    }
    if accessor == "" {
      break
    }
    if accessor[0] == '.' {
      accessor = accessor[1:]
      if accessor == "" || accessor[0] == '[' {
        return nil, "a dot must be followed by an identifier"
      }
    } else if accessor[0] != '[' {
      return nil, "separate accessor segments with a dot or a bracket"
    }
  }
  if len(segments) == 0 {
    return nil, "name an exported declaration after '#'"
  }
  return segments, ""
}

func fileAccessorIdentifier(value string) bool {
  for index, char := range value {
    if char == '_' || char == '$' || unicode.IsLetter(char) || index > 0 && (unicode.IsDigit(char) || unicode.IsMark(char)) {
      continue
    }
    return false
  }
  return value != ""
}

func formatFileAccessor(segments []string) string {
  var result strings.Builder
  for index, segment := range segments {
    if fileAccessorIdentifier(segment) {
      if index > 0 {
        result.WriteByte('.')
      }
      result.WriteString(segment)
    } else {
      encoded, _ := json.Marshal(segment)
      result.WriteByte('[')
      result.Write(encoded)
      result.WriteByte(']')
    }
  }
  return result.String()
}

func encodeFileLinkPath(file string) string {
  return (&url.URL{Path: file}).EscapedPath()
}

// resolveFileLinkDeclaration selects by module and segmented public accessor.
// It never searches other files for a matching name. A review still annotates
// this citation; the existing unit ID owns coverage and content fingerprints.
func resolveFileLinkDeclaration(declaration *evidenceDeclaration, owners []claimState, loader *typeScriptLoader, index map[int]*fileLinkClaimIndex, context string) (string, string) {
  where := " '" + displayTarget(declaration.Target) + "' at " + declaration.location() + " for " + context
  if declaration.Type != artifactMarkdown && declaration.Type != artifactTypeScript {
    return "", "Unsupported file-qualified evidence target" + where + ": use this syntax on a Markdown or TypeScript claim."
  }
  link, problem := parseFileLink(declaration.Target)
  if problem != "" {
    return "", "Malformed file-qualified evidence target" + where + ": " + problem + "."
  }
  absolute := filepath.FromSlash(link.File)
  if !filepath.IsAbs(absolute) {
    absolute = filepath.Join(filepath.Dir(resolveProjectPath(loader.root, declaration.Path)), absolute)
  }
  module := loader.projectPath(filepath.ToSlash(absolute))
  identity, _ := loader.moduleIdentity(module)
  candidates := map[string]*evidenceUnit{}
  hidden := map[string]*evidenceUnit{}
  selectedModule := false
  key := scopedTargetKey{path: identity, target: encodeTypeScriptIdentity(link.Segments)}
  for _, owner := range owners {
    claim := index[owner.Spec.Index]
    if claim == nil {
      continue
    }
    selectedModule = selectedModule || claim.modules[identity]
    for id, unit := range claim.targets[key] {
      candidates[id] = unit
    }
    for id, unit := range claim.hidden[key] {
      hidden[id] = unit
    }
  }
  dynamic, withdrawn := queryFileLinkClaims(index, owners, identity, link.Segments, false)
  for id, unit := range dynamic {
    candidates[id] = unit
  }
  for id, unit := range withdrawn {
    hidden[id] = unit
  }
  if len(candidates) == 1 {
    for id := range candidates {
      return id, ""
    }
  }
  if len(candidates) > 1 {
    descriptions := []string{}
    for _, unit := range candidates {
      descriptions = append(descriptions, unit.Readable+" at "+unit.location())
    }
    sort.Strings(descriptions)
    return "", "Ambiguous file-qualified evidence target" + where + ": " + strings.Join(descriptions, "; ") + ". Select one symbol kind or an unambiguous public accessor."
  }
  if len(hidden) != 0 {
    ids := []string{}
    for id := range hidden {
      ids = append(ids, id)
    }
    sort.Strings(ids)
    return "", hiddenTargetProblem(declaration, hidden[ids[0]], context)
  }
  if !loader.exists(module) {
    return "", "Missing TypeScript evidence file" + where + ": '" + module + "' does not exist. Correct the path relative to the citing file or restore the configured file."
  }
  if !selectedModule {
    return "", "Out-of-population TypeScript evidence target" + where + ": '" + module + "' is not a module selected by this claim's TypeScript references. Configure its files and, for disk sources outside the Program, an explicit root."
  }
  if declarationResolutionUncertain(owners) {
    return "", ""
  }
  return "", diagnoseFileLinkTarget(loader, module, link.Segments, where)
}

type fileLinkClaimIndex struct {
  references map[string][]fileLinkReference
  modules    map[string]bool
  targets    map[scopedTargetKey]map[string]*evidenceUnit
  hidden     map[scopedTargetKey]map[string]*evidenceUnit
}

// Build once per evaluation. Resolution is proportional to the number of
// owning claims, not their complete populations for every citation.
func indexFileLinkClaims(states []claimState, loader *typeScriptLoader) map[int]*fileLinkClaimIndex {
  result := map[int]*fileLinkClaimIndex{}
  for _, state := range states {
    index := &fileLinkClaimIndex{modules: map[string]bool{}, targets: map[scopedTargetKey]map[string]*evidenceUnit{}, hidden: map[scopedTargetKey]map[string]*evidenceUnit{}, references: map[string][]fileLinkReference{}}
    result[state.Spec.Index] = index
    for _, reference := range state.References {
      if reference.Spec.Type != artifactTypeScript {
        continue
      }
      scopes := map[string]bool{}
      for _, scope := range reference.Scopes {
        scopes[scope.ID] = true
      }
      if reference.Code != nil {
        modules := map[string]string{}
        for _, entry := range reference.Paths {
          identity, _ := loader.moduleIdentity(entry)
          modules[identity] = entry
        }
        for _, address := range reference.Published {
          identity, _ := loader.moduleIdentity(address.Module)
          modules[identity] = address.Module
        }
        hidden := map[string]bool{}
        for _, unit := range reference.Hidden {
          hidden[unit.ID] = true
        }
        for identity, entry := range modules {
          index.references[identity] = append(index.references[identity], fileLinkReference{entry: entry, code: reference.Code, scopes: scopes, hidden: hidden})
        }
      }
      for _, entry := range reference.Paths {
        module, _ := loader.moduleIdentity(entry)
        index.modules[module] = true
      }
      for _, address := range reference.Published {
        module, _ := loader.moduleIdentity(address.Module)
        index.modules[module] = true
        key := scopedTargetKey{path: module, target: encodeTypeScriptIdentity(address.Segments)}
        target := index.targets
        if address.Unit.Hidden != "" {
          target = index.hidden
        } else if !scopes[address.Unit.ID] {
          continue
        }
        if target[key] == nil {
          target[key] = map[string]*evidenceUnit{}
        }
        target[key][address.Unit.ID] = address.Unit
      }
    }
  }
  return result
}

type fileLinkReference struct {
  entry  string
  code   *typeScriptExportResolver
  scopes map[string]bool
  hidden map[string]bool
}

// Namespace cycles have infinitely many possible spellings but a citation has
// finitely many segments. Resolve that path on demand, then apply the same
// reference membership as the finite population index.
func queryFileLinkClaims(index map[int]*fileLinkClaimIndex, owners []claimState, module string, segments []string, legacy bool) (map[string]*evidenceUnit, map[string]*evidenceUnit) {
  found, hidden := map[string]*evidenceUnit{}, map[string]*evidenceUnit{}
  for _, owner := range owners {
    claim := index[owner.Spec.Index]
    if claim == nil {
      continue
    }
    for _, reference := range claim.references[module] {
      for _, unit := range reference.code.lookup(reference.entry, segments, legacy) {
        if unit.Hidden != "" {
          if reference.hidden[unit.ID] {
            hidden[unit.ID] = unit
          }
          continue
        }
        if reference.scopes[unit.ID] {
          found[unit.ID] = unit
        }
      }
    }
  }
  return found, hidden
}
