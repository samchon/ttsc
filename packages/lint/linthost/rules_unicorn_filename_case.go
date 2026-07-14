// unicorn/filename-case: every path segment of a source file — its
// directories and its filename — must follow one of the configured case
// styles (kebab-case by default; camelCase, camelCase-with-acronyms,
// snake_case, and PascalCase selectable via `case` / `cases`). Mixed
// conventions in one tree make files hard to locate on case-sensitive
// filesystems and turn renames into cross-platform hazards, so the rule
// pins one spelling and proposes the exact renames.
//
// Faithful port of the upstream rule and its helpers:
//   - Path segments come from the file's project-relative path (the
//     upstream `path.relative(cwd, …)` walk); files outside the current
//     directory are judged by basename alone.
//   - Word splitting mirrors `change-case@5` `split()` semantics
//     (lower/digit→upper and upper→upper+lower boundaries, non-letter
//     strips), and the case functions reproduce `camelCase`, `kebabCase`,
//     `snakeCase`, and `pascalCase` plus upstream's acronym-aware
//     wrappers byte-for-byte on the ASCII word runs the rule feeds them.
//   - The first failing check wins: ignore patterns, then directories,
//     then the default-ignored `index.*` basenames, then the filename,
//     then a lowercase-extension check on otherwise valid names. At most
//     one diagnostic is reported per file.
//
// The diagnostic anchors on the file's first statement (falling back to
// offset 0 in a statement-less file) following the `unicorn/no-empty-file`
// precedent, so `path:line:col` renderers point at real source instead of
// a synthetic 1:1 location. `ignore` patterns compile with Go's regexp
// package rather than ECMAScript's `u`-flag grammar.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/filename-case.md
package linthost

import (
  "bytes"
  "encoding/json"
  "errors"
  "fmt"
  "path/filepath"
  "regexp"
  "strings"
  "unicode"
  "unicode/utf8"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornFilenameCase struct{}

func (unicornFilenameCase) Name() string           { return "unicorn/filename-case" }
func (unicornFilenameCase) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }

// unicornFilenameCaseOrder fixes the canonical case-key order used by the
// `case` enum and the `cases` object; message wording depends on the
// configured order, so decoding preserves the user's key order instead.
var unicornFilenameCaseOrder = []string{
  "camelCase",
  "camelCaseWithAcronyms",
  "kebabCase",
  "snakeCase",
  "pascalCase",
}

// unicornFilenameCaseNames maps a case key to its human-readable message
// name, mirroring the upstream `cases` table.
var unicornFilenameCaseNames = map[string]string{
  "camelCase":             "camel case",
  "camelCaseWithAcronyms": "camel case with acronyms",
  "kebabCase":             "kebab case",
  "snakeCase":             "snake case",
  "pascalCase":            "pascal case",
}

// unicornFilenameCaseIgnoredByDefault lists the `index.*` basenames the
// upstream rule always accepts regardless of the configured case.
var unicornFilenameCaseIgnoredByDefault = map[string]bool{
  "index.js":  true,
  "index.mjs": true,
  "index.cjs": true,
  "index.ts":  true,
  "index.tsx": true,
  "index.vue": true,
}

type unicornFilenameCaseOptions struct {
  chosenCases            []string
  ignore                 []*regexp.Regexp
  multipleFileExtensions bool
  checkDirectories       bool
}

func (unicornFilenameCase) ValidateOptions(raw json.RawMessage) error {
  _, err := decodeUnicornFilenameCaseOptions(raw)
  return err
}

func decodeUnicornFilenameCaseOptions(raw json.RawMessage) (unicornFilenameCaseOptions, error) {
  options := unicornFilenameCaseOptions{
    chosenCases:            []string{"kebabCase"},
    multipleFileExtensions: true,
    checkDirectories:       true,
  }
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) == 0 {
    return options, nil
  }
  if trimmed[0] != '{' {
    return options, errors.New("options must be an object")
  }
  var fields map[string]json.RawMessage
  if err := json.Unmarshal(trimmed, &fields); err != nil {
    return options, fmt.Errorf("options must be an object: %w", err)
  }
  for name := range fields {
    switch name {
    case "case", "cases", "ignore", "multipleFileExtensions", "checkDirectories":
    default:
      return options, fmt.Errorf("unknown option %q", name)
    }
  }
  // The upstream schema is an anyOf over two shapes: one with `case`, one
  // with `cases`, each rejecting the other key. Both together is invalid.
  if _, hasCase := fields["case"]; hasCase {
    if _, hasCases := fields["cases"]; hasCases {
      return options, errors.New(`options "case" and "cases" are mutually exclusive`)
    }
    var chosen string
    if err := json.Unmarshal(fields["case"], &chosen); err != nil {
      return options, fmt.Errorf(`option "case" must be a string: %w`, err)
    }
    if _, known := unicornFilenameCaseNames[chosen]; !known {
      return options, fmt.Errorf(`option "case" must be one of %s`, strings.Join(unicornFilenameCaseOrder, ", "))
    }
    options.chosenCases = []string{chosen}
  } else if value, hasCases := fields["cases"]; hasCases {
    chosen, err := decodeUnicornFilenameCaseCases(value)
    if err != nil {
      return options, err
    }
    if len(chosen) > 0 {
      options.chosenCases = chosen
    }
  }
  if value, has := fields["multipleFileExtensions"]; has {
    enabled, err := decodeUnicornFilenameCaseBool("multipleFileExtensions", value)
    if err != nil {
      return options, err
    }
    options.multipleFileExtensions = enabled
  }
  if value, has := fields["checkDirectories"]; has {
    enabled, err := decodeUnicornFilenameCaseBool("checkDirectories", value)
    if err != nil {
      return options, err
    }
    options.checkDirectories = enabled
  }
  if value, has := fields["ignore"]; has {
    patterns := []string{}
    if err := json.Unmarshal(value, &patterns); err != nil {
      return options, fmt.Errorf(`option "ignore" must be an array of pattern strings: %w`, err)
    }
    seen := map[string]bool{}
    for _, pattern := range patterns {
      if seen[pattern] {
        return options, fmt.Errorf(`option "ignore" has a duplicate pattern %q`, pattern)
      }
      seen[pattern] = true
      expression, err := regexp.Compile(pattern)
      if err != nil {
        return options, fmt.Errorf(`option "ignore" pattern %q: %w`, pattern, err)
      }
      options.ignore = append(options.ignore, expression)
    }
  }
  return options, nil
}

// decodeUnicornFilenameCaseCases reads the `cases` object with a token
// decoder so the enabled case keys keep their configured order — the
// order decides both the message's case-name list and the rename samples.
func decodeUnicornFilenameCaseCases(raw json.RawMessage) ([]string, error) {
  decoder := json.NewDecoder(bytes.NewReader(raw))
  open, err := decoder.Token()
  if err != nil || open != json.Delim('{') {
    return nil, errors.New(`option "cases" must be an object of case-name booleans`)
  }
  order := []string{}
  enabled := map[string]bool{}
  for decoder.More() {
    token, err := decoder.Token()
    if err != nil {
      return nil, fmt.Errorf(`option "cases" must be an object of case-name booleans: %w`, err)
    }
    key, ok := token.(string)
    if !ok {
      return nil, errors.New(`option "cases" must be an object of case-name booleans`)
    }
    if _, known := unicornFilenameCaseNames[key]; !known {
      return nil, fmt.Errorf(`option "cases" has an unknown case %q`, key)
    }
    var value bool
    if err := decoder.Decode(&value); err != nil {
      return nil, fmt.Errorf(`option "cases" value for %q must be a boolean`, key)
    }
    if _, seen := enabled[key]; !seen {
      order = append(order, key)
    }
    enabled[key] = value
  }
  if _, err := decoder.Token(); err != nil {
    return nil, fmt.Errorf(`option "cases" must be an object of case-name booleans: %w`, err)
  }
  chosen := []string{}
  for _, key := range order {
    if enabled[key] {
      chosen = append(chosen, key)
    }
  }
  return chosen, nil
}

func decodeUnicornFilenameCaseBool(name string, raw json.RawMessage) (bool, error) {
  var value bool
  if err := json.Unmarshal(raw, &value); err != nil {
    return false, fmt.Errorf("option %q must be a boolean: %w", name, err)
  }
  return value, nil
}

func (unicornFilenameCase) Check(ctx *Context, _ *shimast.Node) {
  if ctx.File == nil {
    return
  }
  fileName := ctx.File.FileName()
  if fileName == "" || fileName == "<input>" || fileName == "<text>" {
    return
  }
  options, err := decodeUnicornFilenameCaseOptions(ctx.Options)
  if err != nil {
    return
  }
  caseFunctions := make([]func(string) string, 0, len(options.chosenCases))
  for _, chosen := range options.chosenCases {
    caseFunctions = append(caseFunctions, unicornFilenameCaseFunction(chosen))
  }

  segments := unicornFilenameCasePathSegments(ctx.CurrentDirectory, fileName)
  for _, segment := range segments {
    for _, pattern := range options.ignore {
      if pattern.MatchString(segment) {
        return
      }
    }
  }

  if options.checkDirectories {
    for _, directory := range segments[:len(segments)-1] {
      if strings.HasPrefix(directory, "$") {
        continue
      }
      leading, words := unicornFilenameCaseSplitName(directory)
      if unicornFilenameCaseIsValidName(words, caseFunctions) {
        continue
      }
      renamed := unicornFilenameCaseFixName(words, caseFunctions, leading, "")
      unicornFilenameCaseReport(ctx, fmt.Sprintf(
        "Directory name `%s` is not in %s. Rename it to %s.",
        directory,
        unicornFilenameCaseCaseNames(options.chosenCases),
        unicornFilenameCaseJoinBackticked(renamed),
      ))
      return
    }
  }

  basenameWithExtension := segments[len(segments)-1]
  if unicornFilenameCaseIgnoredByDefault[basenameWithExtension] {
    return
  }
  filename, middle, extension := unicornFilenameCaseFilenameParts(
    basenameWithExtension,
    options.multipleFileExtensions,
  )
  leading, words := unicornFilenameCaseSplitName(filename)
  if strings.HasPrefix(filename, "$") || unicornFilenameCaseIsValidName(words, caseFunctions) {
    if extension != strings.ToLower(extension) {
      unicornFilenameCaseReport(ctx, fmt.Sprintf(
        "File extension `%s` is not in lowercase. Rename it to `%s`.",
        extension,
        filename+middle+strings.ToLower(extension),
      ))
    }
    return
  }
  renamed := unicornFilenameCaseFixName(words, caseFunctions, leading, middle+strings.ToLower(extension))
  unicornFilenameCaseReport(ctx, fmt.Sprintf(
    "Filename is not in %s. Rename it to %s.",
    unicornFilenameCaseCaseNames(options.chosenCases),
    unicornFilenameCaseJoinBackticked(renamed),
  ))
}

// unicornFilenameCaseReport anchors the file-level diagnostic on the first
// statement when one exists (so renderers point at a real source line) and
// falls back to offset 0 for statement-less files, mirroring the
// unicorn/no-empty-file anchor policy.
func unicornFilenameCaseReport(ctx *Context, message string) {
  statements := ctx.File.Statements
  if statements != nil && len(statements.Nodes) > 0 {
    ctx.Report(statements.Nodes[0], message)
    return
  }
  ctx.ReportRange(0, 0, message)
}

// unicornFilenameCasePathSegments mirrors the upstream `getPathSegments`:
// the file's path relative to the project directory, split into segments;
// a file outside the project directory contributes only its basename.
func unicornFilenameCasePathSegments(currentDirectory, fileName string) []string {
  resolved := fileName
  // Rooted-but-driveless names (tsgo's virtual `/…` spellings on Windows)
  // stay as-is: joining them under the project directory would invent a
  // project-relative identity the file does not have.
  if !filepath.IsAbs(resolved) && !strings.HasPrefix(filepath.ToSlash(resolved), "/") {
    resolved = filepath.Join(currentDirectory, resolved)
  }
  relative, err := filepath.Rel(currentDirectory, resolved)
  if err != nil {
    return []string{unicornFilenameCaseBasename(fileName)}
  }
  relative = filepath.ToSlash(relative)
  if relative == "" || relative == "." || relative == ".." || strings.HasPrefix(relative, "../") {
    return []string{unicornFilenameCaseBasename(fileName)}
  }
  parts := strings.Split(relative, "/")
  segments := make([]string, 0, len(parts))
  for _, segment := range parts {
    if segment != "." && segment != "" {
      segments = append(segments, segment)
    }
  }
  if len(segments) == 0 {
    return []string{unicornFilenameCaseBasename(fileName)}
  }
  return segments
}

func unicornFilenameCaseBasename(fileName string) string {
  slashed := strings.TrimRight(filepath.ToSlash(fileName), "/")
  if index := strings.LastIndexByte(slashed, '/'); index >= 0 {
    return slashed[index+1:]
  }
  return slashed
}

// unicornFilenameCaseFilenameParts splits a basename into the checked stem,
// the untouched middle (extra dot-separated parts when
// `multipleFileExtensions` is on), and the primary extension using Node's
// `path.extname` semantics — a lone leading dot marks a hidden file, not
// an extension.
func unicornFilenameCaseFilenameParts(basenameWithExtension string, multipleFileExtensions bool) (filename, middle, extension string) {
  extension = unicornFilenameCaseExtname(basenameWithExtension)
  filename = basenameWithExtension[:len(basenameWithExtension)-len(extension)]
  if multipleFileExtensions {
    firstPart := filename
    if index := strings.IndexByte(filename, '.'); index >= 0 {
      firstPart = filename[:index]
    }
    middle = filename[len(firstPart):]
    filename = firstPart
  }
  return filename, middle, extension
}

// unicornFilenameCaseExtname ports Node's `path.extname` state machine for
// basenames: the extension starts at the last dot, except when the only
// content before it is dots at the start of the name (`.gitignore`, `..`).
func unicornFilenameCaseExtname(basename string) string {
  startDot := -1
  end := -1
  preDotState := 0
  for index := len(basename) - 1; index >= 0; index-- {
    if end == -1 {
      end = index + 1
    }
    if basename[index] == '.' {
      if startDot == -1 {
        startDot = index
      } else if preDotState != 1 {
        preDotState = 1
      }
    } else if startDot != -1 {
      preDotState = -1
    }
  }
  if startDot == -1 || end == -1 ||
    preDotState == 0 ||
    (preDotState == 1 && startDot == end-1 && startDot == 1) {
    return ""
  }
  return basename[startDot:end]
}

type unicornFilenameCaseWord struct {
  word    string
  ignored bool
}

// unicornFilenameCaseSplitName mirrors upstream `splitName`: strip leading
// underscores, then group the rest into alternating runs of word characters
// (`[A-Za-z0-9_-]`, the checked runs) and ignored characters (everything
// else — brackets, `$`, dots, and any non-ASCII rune pass through verbatim).
func unicornFilenameCaseSplitName(name string) (string, []unicornFilenameCaseWord) {
  leading := ""
  tailing := name
  if strings.HasPrefix(name, "_") {
    count := 0
    for count < len(name) && name[count] == '_' {
      count++
    }
    // The upstream `^(_+)(.*)$` regex only captures when `.*` can reach the
    // end of the string; JavaScript's `.` matches neither newlines nor the
    // Unicode line separators.
    if !strings.ContainsAny(name[count:], "\n\r  ") {
      leading = name[:count]
      tailing = name[count:]
    }
  }
  words := []unicornFilenameCaseWord{}
  for _, char := range tailing {
    ignored := !unicornFilenameCaseIsWordRune(char)
    if len(words) > 0 && words[len(words)-1].ignored == ignored {
      words[len(words)-1].word += string(char)
      continue
    }
    words = append(words, unicornFilenameCaseWord{word: string(char), ignored: ignored})
  }
  return leading, words
}

func unicornFilenameCaseIsWordRune(char rune) bool {
  return char == '_' || char == '-' ||
    (char >= '0' && char <= '9') ||
    (char >= 'a' && char <= 'z') ||
    (char >= 'A' && char <= 'Z')
}

func unicornFilenameCaseIsValidName(words []unicornFilenameCaseWord, caseFunctions []func(string) string) bool {
  for _, word := range words {
    if word.ignored {
      continue
    }
    matched := false
    for _, caseFunction := range caseFunctions {
      if caseFunction(word.word) == word.word {
        matched = true
        break
      }
    }
    if !matched {
      return false
    }
  }
  return true
}

// unicornFilenameCaseFixName enumerates upstream `fixName`'s cartesian
// product of per-word case conversions (last word varying fastest) and
// deduplicates the joined names in first-occurrence order. Per-word
// duplicates collapse up front; that preserves both the resulting set and
// its order while keeping the enumeration small.
func unicornFilenameCaseFixName(
  words []unicornFilenameCaseWord,
  caseFunctions []func(string) string,
  leading string,
  trailing string,
) []string {
  replacements := make([][]string, 0, len(words))
  for _, word := range words {
    if word.ignored {
      replacements = append(replacements, []string{word.word})
      continue
    }
    variants := make([]string, 0, len(caseFunctions))
    seen := map[string]bool{}
    for _, caseFunction := range caseFunctions {
      variant := caseFunction(word.word)
      if !seen[variant] {
        seen[variant] = true
        variants = append(variants, variant)
      }
    }
    replacements = append(replacements, variants)
  }

  names := []string{}
  seen := map[string]bool{}
  indexes := make([]int, len(replacements))
  for {
    var builder strings.Builder
    builder.WriteString(leading)
    for position, index := range indexes {
      builder.WriteString(replacements[position][index])
    }
    builder.WriteString(trailing)
    name := builder.String()
    if !seen[name] {
      seen[name] = true
      names = append(names, name)
    }
    position := len(indexes) - 1
    for position >= 0 {
      indexes[position]++
      if indexes[position] < len(replacements[position]) {
        break
      }
      indexes[position] = 0
      position--
    }
    if position < 0 {
      return names
    }
  }
}

func unicornFilenameCaseCaseNames(chosenCases []string) string {
  names := make([]string, 0, len(chosenCases))
  for _, chosen := range chosenCases {
    names = append(names, unicornFilenameCaseNames[chosen])
  }
  return unicornFilenameCaseJoinDisjunction(names)
}

func unicornFilenameCaseJoinBackticked(names []string) string {
  wrapped := make([]string, 0, len(names))
  for _, name := range names {
    wrapped = append(wrapped, "`"+name+"`")
  }
  return unicornFilenameCaseJoinDisjunction(wrapped)
}

// unicornFilenameCaseJoinDisjunction reproduces `Intl.ListFormat("en-US",
// {type: "disjunction"})`: "a", "a or b", "a, b, or c".
func unicornFilenameCaseJoinDisjunction(items []string) string {
  switch len(items) {
  case 0:
    return ""
  case 1:
    return items[0]
  case 2:
    return items[0] + " or " + items[1]
  default:
    return strings.Join(items[:len(items)-1], ", ") + ", or " + items[len(items)-1]
  }
}

func unicornFilenameCaseFunction(name string) func(string) string {
  switch name {
  case "camelCase":
    return unicornFilenameCaseCamel
  case "camelCaseWithAcronyms":
    return unicornFilenameCaseCamelWithAcronyms
  case "kebabCase":
    return unicornFilenameCaseKebab
  case "snakeCase":
    return unicornFilenameCaseSnake
  default: // "pascalCase"
    return unicornFilenameCasePascalWithLeadingAcronym
  }
}

// unicornFilenameCaseSplitWords ports `change-case@5`'s `split()`: break
// between a lowercase-or-digit rune and an uppercase rune, break between
// an uppercase rune and an uppercase-then-lowercase pair, then treat every
// non-letter, non-ASCII-digit run as a separator.
func unicornFilenameCaseSplitWords(value string) []string {
  runes := []rune(strings.TrimSpace(value))
  breakAfter := make([]bool, len(runes))
  for index := 0; index+1 < len(runes); index++ {
    if (unicode.IsLower(runes[index]) || unicornFilenameCaseIsASCIIDigitRune(runes[index])) &&
      unicode.IsUpper(runes[index+1]) {
      breakAfter[index] = true
    }
  }
  for index := 0; index+2 < len(runes); index++ {
    if unicode.IsUpper(runes[index]) && unicode.IsUpper(runes[index+1]) && unicode.IsLower(runes[index+2]) {
      breakAfter[index] = true
    }
  }
  words := []string{}
  var current []rune
  flush := func() {
    if len(current) > 0 {
      words = append(words, string(current))
      current = current[:0]
    }
  }
  for index, char := range runes {
    if unicode.IsLetter(char) || unicornFilenameCaseIsASCIIDigitRune(char) {
      current = append(current, char)
    } else {
      flush()
    }
    if breakAfter[index] {
      flush()
    }
  }
  flush()
  return words
}

func unicornFilenameCaseIsASCIIDigitRune(char rune) bool {
  return char >= '0' && char <= '9'
}

// unicornFilenameCasePascalTransform is `change-case`'s pascal transform:
// uppercase the first rune and lowercase the rest, except that a non-first
// word starting with an ASCII digit keeps the digit behind a `_` separator.
func unicornFilenameCasePascalTransform(word string, index int) string {
  first, size := utf8.DecodeRuneInString(word)
  rest := strings.ToLower(word[size:])
  if index > 0 && first >= '0' && first <= '9' {
    return "_" + string(first) + rest
  }
  return strings.ToUpper(string(first)) + rest
}

func unicornFilenameCaseCamel(value string) string {
  words := unicornFilenameCaseSplitWords(value)
  var builder strings.Builder
  for index, word := range words {
    if index == 0 {
      builder.WriteString(strings.ToLower(word))
      continue
    }
    builder.WriteString(unicornFilenameCasePascalTransform(word, index))
  }
  return builder.String()
}

func unicornFilenameCasePascal(value string) string {
  words := unicornFilenameCaseSplitWords(value)
  var builder strings.Builder
  for index, word := range words {
    builder.WriteString(unicornFilenameCasePascalTransform(word, index))
  }
  return builder.String()
}

func unicornFilenameCaseDelimited(value, delimiter string) string {
  words := unicornFilenameCaseSplitWords(value)
  for index, word := range words {
    words[index] = strings.ToLower(word)
  }
  return strings.Join(words, delimiter)
}

func unicornFilenameCaseKebab(value string) string {
  return unicornFilenameCaseDelimited(value, "-")
}

func unicornFilenameCaseSnake(value string) string {
  return unicornFilenameCaseDelimited(value, "_")
}

// unicornFilenameCaseCamelWithAcronyms accepts camelCase words whose
// uppercase runs form acronyms (`innerHTML`, `getDOMRangeRect`) and
// converts everything else with plain camelCase.
func unicornFilenameCaseCamelWithAcronyms(value string) string {
  if unicornFilenameCaseIsCamelWithAcronyms(value) {
    return value
  }
  return unicornFilenameCaseCamel(value)
}

// unicornFilenameCaseIsCamelWithAcronyms ports upstream
// `isCamelCaseWithAcronyms` including its index rewinds: an uppercase run
// either ends the word (optionally through digits), hands off to a
// lowercase tail by giving back its last letter, or must be followed by
// another uppercase letter.
func unicornFilenameCaseIsCamelWithAcronyms(value string) bool {
  if len(value) == 0 || !unicornFilenameCaseIsASCIILower(value[0]) {
    return false
  }
  for index := 1; index < len(value); index++ {
    char := value[index]
    if unicornFilenameCaseIsASCIILower(char) || unicornFilenameCaseIsASCIIDigit(char) {
      continue
    }
    if !unicornFilenameCaseIsASCIIUpper(char) {
      return false
    }
    uppercaseStartIndex := index
    for index+1 < len(value) && unicornFilenameCaseIsASCIIUpper(value[index+1]) {
      index++
    }
    if index == uppercaseStartIndex {
      continue
    }
    if index+1 < len(value) && unicornFilenameCaseIsASCIILower(value[index+1]) {
      index--
      continue
    }
    for index+1 < len(value) && unicornFilenameCaseIsASCIIDigit(value[index+1]) {
      index++
    }
    if index == len(value)-1 {
      return true
    }
    if !unicornFilenameCaseIsASCIIUpper(value[index+1]) {
      return false
    }
  }
  return true
}

var unicornFilenameCaseASCIIAlphanumeric = regexp.MustCompile(`^[0-9A-Za-z]+$`)

// unicornFilenameCasePascalWithLeadingAcronym keeps a PascalCase word whose
// leading three-or-more-letter acronym is followed by an otherwise valid
// PascalCase tail (`FAQPage`, `URL2Path`), and pascal-cases everything else.
func unicornFilenameCasePascalWithLeadingAcronym(value string) string {
  if unicornFilenameCaseASCIIAlphanumeric.MatchString(value) {
    if acronym := unicornFilenameCaseLeadingAcronym(value); acronym != "" {
      suffix := value[len(acronym):]
      if suffix != "" && unicornFilenameCasePascal(suffix) == suffix {
        return value
      }
    }
  }
  return unicornFilenameCasePascal(value)
}

// unicornFilenameCaseLeadingAcronym matches upstream
// `/^[A-Z]{3,}(?=\d*[A-Z](?:[a-z]|\d+[a-z]))/`: the longest uppercase
// prefix of at least three letters whose remainder starts a new cased word.
func unicornFilenameCaseLeadingAcronym(value string) string {
  run := 0
  for run < len(value) && unicornFilenameCaseIsASCIIUpper(value[run]) {
    run++
  }
  for length := run; length >= 3; length-- {
    if unicornFilenameCaseLeadingAcronymLookahead(value[length:]) {
      return value[:length]
    }
  }
  return ""
}

// unicornFilenameCaseLeadingAcronymLookahead evaluates the lookahead
// `\d*[A-Z](?:[a-z]|\d+[a-z])`. The greedy digit runs never need
// backtracking because neither `[A-Z]` nor `[a-z]` can match a digit.
func unicornFilenameCaseLeadingAcronymLookahead(rest string) bool {
  index := 0
  for index < len(rest) && unicornFilenameCaseIsASCIIDigit(rest[index]) {
    index++
  }
  if index >= len(rest) || !unicornFilenameCaseIsASCIIUpper(rest[index]) {
    return false
  }
  index++
  if index < len(rest) && unicornFilenameCaseIsASCIILower(rest[index]) {
    return true
  }
  digits := index
  for digits < len(rest) && unicornFilenameCaseIsASCIIDigit(rest[digits]) {
    digits++
  }
  return digits > index && digits < len(rest) && unicornFilenameCaseIsASCIILower(rest[digits])
}

func unicornFilenameCaseIsASCIILower(char byte) bool { return char >= 'a' && char <= 'z' }
func unicornFilenameCaseIsASCIIUpper(char byte) bool { return char >= 'A' && char <= 'Z' }
func unicornFilenameCaseIsASCIIDigit(char byte) bool { return char >= '0' && char <= '9' }

func init() {
  Register(unicornFilenameCase{})
}
