// typescript/no-restricted-types implements typescript-eslint's configurable
// spelling policy for type syntax. The rule has no implicit restrictions: a
// type is rejected only when its whitespace-normalized source spelling is an
// enabled key in the configured `types` map.
//
// https://typescript-eslint.io/rules/no-restricted-types/
package linthost

import (
  "bytes"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "strings"
  "unicode"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noRestrictedTypes struct{}

type noRestrictedTypeConfig struct {
  enabled     bool
  message     string
  fixWith     string
  suggestions []string
}

type noRestrictedTypeObjectConfig struct {
  Message json.RawMessage `json:"message"`
  FixWith json.RawMessage `json:"fixWith"`
  Suggest json.RawMessage `json:"suggest"`
}

func (noRestrictedTypes) Name() string { return "typescript/no-restricted-types" }
func (noRestrictedTypes) Visits() []shimast.Kind {
  // Decode the options once per file, then inspect only the upstream rule's
  // supported type-syntax surfaces during one AST walk.
  return []shimast.Kind{shimast.KindSourceFile}
}

func (noRestrictedTypes) ValidateOptions(raw json.RawMessage) error {
  _, err := decodeNoRestrictedTypesOptions(raw)
  return err
}

func (noRestrictedTypes) Check(ctx *Context, node *shimast.Node) {
  configured, err := decodeNoRestrictedTypesOptions(ctx.Options)
  if err != nil || len(configured) == 0 {
    // Real config-loading paths reject malformed settings through
    // ValidateOptions. A directly constructed resolver still fails safely.
    return
  }
  walkDescendants(node, func(candidate *shimast.Node) {
    checkNoRestrictedTypeNode(ctx, candidate, configured)
  })
}

func checkNoRestrictedTypeNode(
  ctx *Context,
  node *shimast.Node,
  configured map[string]noRestrictedTypeConfig,
) {
  if node == nil {
    return
  }
  switch node.Kind {
  case shimast.KindTypeReference:
    ref := node.AsTypeReferenceNode()
    if ref == nil || ref.TypeName == nil {
      return
    }
    reportRestrictedType(ctx, ref.TypeName, configured)
    if ref.TypeArguments != nil && len(ref.TypeArguments.Nodes) != 0 {
      reportRestrictedType(ctx, node, configured)
    }
  case shimast.KindExpressionWithTypeArguments:
    if !isRestrictedTypeHeritage(node) {
      return
    }
    heritage := node.AsExpressionWithTypeArguments()
    if heritage == nil || heritage.Expression == nil {
      return
    }
    reportRestrictedType(ctx, heritage.Expression, configured)
    if heritage.TypeArguments != nil && len(heritage.TypeArguments.Nodes) != 0 {
      reportRestrictedType(ctx, node, configured)
    }
  case shimast.KindTupleType:
    tuple := node.AsTupleTypeNode()
    if tuple != nil && tuple.Elements != nil && len(tuple.Elements.Nodes) == 0 {
      reportRestrictedType(ctx, node, configured)
    }
  case shimast.KindTypeLiteral:
    literal := node.AsTypeLiteralNode()
    if literal != nil && literal.Members != nil && len(literal.Members.Nodes) == 0 {
      reportRestrictedType(ctx, node, configured)
    }
  case shimast.KindNullKeyword:
    // TypeScript-Go shares NullKeyword between the runtime literal and the
    // token wrapped by a null LiteralType. typescript-estree exposes only the
    // latter as TSNullKeyword to this rule.
    if node.Parent != nil && node.Parent.Kind == shimast.KindLiteralType {
      reportRestrictedType(ctx, node, configured)
    }
  case shimast.KindVoidKeyword:
    // Exclude the runtime `void expression` operator; only the type keyword is
    // a typescript-eslint TSVoidKeyword listener target.
    if node.Parent == nil || node.Parent.Kind != shimast.KindVoidExpression {
      reportRestrictedType(ctx, node, configured)
    }
  case shimast.KindBigIntKeyword,
    shimast.KindBooleanKeyword,
    shimast.KindNeverKeyword,
    shimast.KindNumberKeyword,
    shimast.KindObjectKeyword,
    shimast.KindStringKeyword,
    shimast.KindSymbolKeyword,
    shimast.KindUndefinedKeyword,
    shimast.KindUnknownKeyword:
    reportRestrictedType(ctx, node, configured)
  }
}

// isRestrictedTypeHeritage mirrors the two upstream listener surfaces:
// TSClassImplements and TSInterfaceHeritage. A class `extends` expression is a
// runtime value expression and is deliberately excluded, although type
// references nested in its type arguments are still visited independently.
func isRestrictedTypeHeritage(node *shimast.Node) bool {
  clauseNode := node.Parent
  if clauseNode == nil || clauseNode.Kind != shimast.KindHeritageClause {
    return false
  }
  clause := clauseNode.AsHeritageClause()
  if clause == nil {
    return false
  }
  if clause.Token == shimast.KindImplementsKeyword {
    return true
  }
  return clause.Token == shimast.KindExtendsKeyword &&
    clauseNode.Parent != nil && clauseNode.Parent.Kind == shimast.KindInterfaceDeclaration
}

func reportRestrictedType(
  ctx *Context,
  node *shimast.Node,
  configured map[string]noRestrictedTypeConfig,
) {
  name := normalizeRestrictedTypeName(nodeText(ctx.File, node))
  restriction, ok := configured[name]
  if name == "" || !ok || !restriction.enabled {
    return
  }

  message := fmt.Sprintf("Don't use `%s` as a type.", name)
  if restriction.message != "" {
    message += " " + restriction.message
  }
  pos, end := tokenRange(ctx.File, node)
  if pos < 0 {
    ctx.Report(node, message)
    return
  }

  var fix []TextEdit
  if restriction.fixWith != "" {
    fix = []TextEdit{{Pos: pos, End: end, Text: restriction.fixWith}}
  }
  suggestions := make([]Suggestion, 0, len(restriction.suggestions))
  for _, replacement := range restriction.suggestions {
    suggestions = append(suggestions, Suggestion{
      Title: fmt.Sprintf("Replace `%s` with `%s`.", name, replacement),
      Edits: []TextEdit{{Pos: pos, End: end, Text: replacement}},
    })
  }
  ctx.ReportFixSuggestions(node, message, fix, suggestions...)
}

// decodeNoRestrictedTypesOptions validates the complete public option shape
// and preserves object declaration order. Whitespace-equivalent keys collapse
// exactly as they do in the upstream Map constructor, with the later entry
// winning deterministically.
func decodeNoRestrictedTypesOptions(raw json.RawMessage) (map[string]noRestrictedTypeConfig, error) {
  configured := map[string]noRestrictedTypeConfig{}
  if len(bytes.TrimSpace(raw)) == 0 {
    return configured, nil
  }

  decoder := json.NewDecoder(bytes.NewReader(raw))
  token, err := decoder.Token()
  if err != nil {
    return nil, fmt.Errorf("options must be an object: %w", err)
  }
  if token != json.Delim('{') {
    return nil, errors.New("options must be an object")
  }

  var types json.RawMessage
  for decoder.More() {
    token, err = decoder.Token()
    if err != nil {
      return nil, err
    }
    key, ok := token.(string)
    if !ok {
      return nil, errors.New("option keys must be strings")
    }
    if key != "types" {
      return nil, fmt.Errorf("unknown option %q", key)
    }
    if err := decoder.Decode(&types); err != nil {
      return nil, fmt.Errorf("decode options.types: %w", err)
    }
  }
  if err := closeRestrictedTypesObject(decoder, "options"); err != nil {
    return nil, err
  }
  if len(types) == 0 {
    return configured, nil
  }
  return decodeRestrictedTypesMap(types)
}

func decodeRestrictedTypesMap(raw json.RawMessage) (map[string]noRestrictedTypeConfig, error) {
  configured := map[string]noRestrictedTypeConfig{}
  decoder := json.NewDecoder(bytes.NewReader(raw))
  token, err := decoder.Token()
  if err != nil {
    return nil, fmt.Errorf("options.types must be an object: %w", err)
  }
  if token != json.Delim('{') {
    return nil, errors.New("options.types must be an object")
  }
  for decoder.More() {
    token, err = decoder.Token()
    if err != nil {
      return nil, err
    }
    key, ok := token.(string)
    if !ok {
      return nil, errors.New("options.types keys must be strings")
    }
    var value json.RawMessage
    if err := decoder.Decode(&value); err != nil {
      return nil, fmt.Errorf("decode options.types[%q]: %w", key, err)
    }
    restriction, err := decodeRestrictedTypeConfig(value)
    if err != nil {
      return nil, fmt.Errorf("options.types[%q]: %w", key, err)
    }
    configured[normalizeRestrictedTypeName(key)] = restriction
  }
  if err := closeRestrictedTypesObject(decoder, "options.types"); err != nil {
    return nil, err
  }
  return configured, nil
}

func decodeRestrictedTypeConfig(raw json.RawMessage) (noRestrictedTypeConfig, error) {
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) == 0 {
    return noRestrictedTypeConfig{}, errors.New("restriction must not be empty")
  }
  if bytes.Equal(trimmed, []byte("null")) {
    return noRestrictedTypeConfig{}, nil
  }
  if bytes.Equal(trimmed, []byte("true")) || bytes.Equal(trimmed, []byte("false")) {
    return noRestrictedTypeConfig{enabled: bytes.Equal(trimmed, []byte("true"))}, nil
  }
  if trimmed[0] == '"' {
    var message string
    if err := json.Unmarshal(trimmed, &message); err != nil {
      return noRestrictedTypeConfig{}, errors.New("restriction must be a boolean, string, object, or null")
    }
    return noRestrictedTypeConfig{enabled: true, message: message}, nil
  }
  if trimmed[0] != '{' {
    return noRestrictedTypeConfig{}, errors.New("restriction must be a boolean, string, object, or null")
  }

  decoder := json.NewDecoder(bytes.NewReader(trimmed))
  decoder.DisallowUnknownFields()
  var object noRestrictedTypeObjectConfig
  if err := decoder.Decode(&object); err != nil {
    return noRestrictedTypeConfig{}, fmt.Errorf("invalid restriction object: %w", err)
  }
  if len(object.Message) == 0 {
    return noRestrictedTypeConfig{}, errors.New("restriction object requires a string message")
  }
  var restriction noRestrictedTypeConfig
  if !isRestrictedTypeJSONString(object.Message) ||
    json.Unmarshal(object.Message, &restriction.message) != nil {
    return noRestrictedTypeConfig{}, errors.New("restriction object message must be a string")
  }
  if len(object.FixWith) != 0 {
    if !isRestrictedTypeJSONString(object.FixWith) ||
      json.Unmarshal(object.FixWith, &restriction.fixWith) != nil {
      return noRestrictedTypeConfig{}, errors.New("restriction object fixWith must be a string")
    }
  }
  if len(object.Suggest) != 0 {
    if bytes.Equal(bytes.TrimSpace(object.Suggest), []byte("null")) ||
      json.Unmarshal(object.Suggest, &restriction.suggestions) != nil {
      return noRestrictedTypeConfig{}, errors.New("restriction object suggest must be a string array")
    }
  }
  restriction.enabled = true
  return restriction, nil
}

func isRestrictedTypeJSONString(raw json.RawMessage) bool {
  trimmed := bytes.TrimSpace(raw)
  return len(trimmed) >= 2 && trimmed[0] == '"'
}

func closeRestrictedTypesObject(decoder *json.Decoder, label string) error {
  token, err := decoder.Token()
  if err != nil {
    return err
  }
  if token != json.Delim('}') {
    return fmt.Errorf("%s object is not closed", label)
  }
  if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
    if err != nil {
      return err
    }
    return fmt.Errorf("%s contains trailing JSON", label)
  }
  return nil
}

func normalizeRestrictedTypeName(name string) string {
  return strings.Map(func(r rune) rune {
    if unicode.IsSpace(r) || r == '\ufeff' {
      return -1
    }
    return r
  }, name)
}

func init() {
  Register(noRestrictedTypes{})
}
