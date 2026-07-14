// noRestrictedSyntax applies only the AST selectors configured by the
// project. It has no built-in denylist: a severity without selector options is
// intentionally silent, matching ESLint's official rule contract.
//
// Selectors use esquery's grammar over the TypeScript-Go AST. Native kind
// names (without the Kind prefix) are authoritative; common ESTree aliases are
// accepted where the two trees have equivalent nodes. Tree combinators follow
// TypeScript-Go's parent/ForEachChild relationships, so TypeScript-only syntax
// participates without a parallel or monkeypatched AST.
// https://eslint.org/docs/latest/rules/no-restricted-syntax
package linthost

import (
  "bytes"
  "encoding/json"
  "fmt"
  "io"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noRestrictedSyntax struct{}

type noRestrictedSyntaxOption struct {
  selector   string
  message    string
  messageSet bool
}

type noRestrictedSyntaxOptionKey struct {
  selector   string
  message    string
  messageSet bool
  structured bool
}

type compiledNoRestrictedSyntaxOption struct {
  selector *astSelector
  message  string
}

type noRestrictedSyntaxMatch struct {
  node    *shimast.Node
  message string
}

func (noRestrictedSyntax) Name() string { return "no-restricted-syntax" }
func (noRestrictedSyntax) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

// ValidateOptions is consumed by the engine's optional rule-options
// validation interface. Parsing here makes malformed selectors/configuration a
// project configuration error before any file is linted.
func (noRestrictedSyntax) ValidateOptions(raw json.RawMessage) error {
  _, err := compileNoRestrictedSyntaxOptions(raw)
  return err
}

func (noRestrictedSyntax) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || node == nil {
    return
  }
  options, err := compileNoRestrictedSyntaxOptions(ctx.Options)
  if err != nil {
    // Engine construction already records this as ConfigError. Check stays
    // side-effect-free for direct contributor calls that bypass validation.
    return
  }
  matches := make([]noRestrictedSyntaxMatch, 0)
  for _, option := range options {
    for _, restricted := range matchASTSelector(node, option.selector) {
      matches = append(matches, noRestrictedSyntaxMatch{node: restricted, message: option.message})
    }
  }
  sort.SliceStable(matches, func(left, right int) bool {
    return matches[left].node.Pos() < matches[right].node.Pos()
  })
  for _, match := range matches {
    ctx.Report(match.node, match.message)
  }
}

func compileNoRestrictedSyntaxOptions(raw json.RawMessage) ([]compiledNoRestrictedSyntaxOption, error) {
  options, err := decodeNoRestrictedSyntaxOptions(raw)
  if err != nil {
    return nil, err
  }
  compiled := make([]compiledNoRestrictedSyntaxOption, 0, len(options))
  selectorIndexes := make(map[string]int, len(options))
  for index, option := range options {
    selector, err := parseASTSelector(option.selector)
    if err != nil {
      return nil, fmt.Errorf("no-restricted-syntax option %d: invalid selector %q: %w", index+1, option.selector, err)
    }
    message := "Using '" + option.selector + "' is not allowed."
    if option.messageSet && option.message != "" {
      message = option.message
    }
    entry := compiledNoRestrictedSyntaxOption{
      selector: selector,
      message:  message,
    }
    if previous, exists := selectorIndexes[option.selector]; exists {
      // ESLint registers selector listeners in an object. Reusing a selector
      // therefore replaces its listener/message rather than reporting twice.
      compiled[previous] = entry
      continue
    }
    selectorIndexes[option.selector] = len(compiled)
    compiled = append(compiled, entry)
  }
  return compiled, nil
}

func decodeNoRestrictedSyntaxOptions(raw json.RawMessage) ([]noRestrictedSyntaxOption, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
    return nil, nil
  }
  encoded := make([]json.RawMessage, 0, 1)
  if raw[0] == '[' {
    if err := decodeStrictJSON(raw, &encoded); err != nil {
      return nil, fmt.Errorf("no-restricted-syntax options must be selector strings or {selector,message} objects: %w", err)
    }
  } else {
    encoded = append(encoded, append(json.RawMessage(nil), raw...))
  }

  options := make([]noRestrictedSyntaxOption, 0, len(encoded))
  seen := make(map[noRestrictedSyntaxOptionKey]struct{}, len(encoded))
  for index, item := range encoded {
    item = bytes.TrimSpace(item)
    if len(item) == 0 {
      return nil, fmt.Errorf("no-restricted-syntax option %d is empty", index+1)
    }
    option := noRestrictedSyntaxOption{}
    uniquenessKey := noRestrictedSyntaxOptionKey{}
    switch item[0] {
    case '"':
      if err := decodeStrictJSON(item, &option.selector); err != nil {
        return nil, fmt.Errorf("no-restricted-syntax option %d must be a selector string: %w", index+1, err)
      }
      uniquenessKey.selector = option.selector
    case '{':
      object := struct {
        Selector json.RawMessage `json:"selector"`
        Message  json.RawMessage `json:"message"`
      }{}
      if err := decodeStrictJSON(item, &object); err != nil {
        return nil, fmt.Errorf("no-restricted-syntax option %d must contain only selector and message: %w", index+1, err)
      }
      if len(object.Selector) == 0 {
        return nil, fmt.Errorf("no-restricted-syntax option %d is missing selector", index+1)
      }
      if err := decodeNoRestrictedSyntaxString(object.Selector, &option.selector); err != nil {
        return nil, fmt.Errorf("no-restricted-syntax option %d selector must be a string: %w", index+1, err)
      }
      if len(object.Message) != 0 {
        if err := decodeNoRestrictedSyntaxString(object.Message, &option.message); err != nil {
          return nil, fmt.Errorf("no-restricted-syntax option %d message must be a string: %w", index+1, err)
        }
        option.messageSet = true
      }
      uniquenessKey = noRestrictedSyntaxOptionKey{
        selector:   option.selector,
        message:    option.message,
        messageSet: option.messageSet,
        structured: true,
      }
    default:
      return nil, fmt.Errorf("no-restricted-syntax option %d must be a selector string or {selector,message} object", index+1)
    }
    if strings.TrimSpace(option.selector) == "" {
      return nil, fmt.Errorf("no-restricted-syntax option %d selector must not be empty", index+1)
    }
    if _, duplicate := seen[uniquenessKey]; duplicate {
      return nil, fmt.Errorf("no-restricted-syntax option %d duplicates an earlier option", index+1)
    }
    seen[uniquenessKey] = struct{}{}
    options = append(options, option)
  }
  return options, nil
}

func decodeNoRestrictedSyntaxString(raw json.RawMessage, out *string) error {
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) < 2 || trimmed[0] != '"' {
    return fmt.Errorf("expected JSON string")
  }
  return decodeStrictJSON(trimmed, out)
}

func decodeStrictJSON(raw json.RawMessage, out any) error {
  decoder := json.NewDecoder(bytes.NewReader(raw))
  decoder.DisallowUnknownFields()
  if err := decoder.Decode(out); err != nil {
    return err
  }
  if err := decoder.Decode(&struct{}{}); err != io.EOF {
    if err == nil {
      return fmt.Errorf("multiple JSON values")
    }
    return err
  }
  return nil
}

func init() {
  Register(noRestrictedSyntax{})
}
