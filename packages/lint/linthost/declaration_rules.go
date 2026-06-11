// Declaration-file dispatch policy.
//
// The engine skips rules on `.d.ts` (and other declaration) sources unless
// the rule is known to produce legitimate findings there. Declaration files
// carry no executable code, so most value-level rules can never fire on one;
// walking them anyway is pure dispatch overhead on declaration-heavy
// projects (see issue #177).
//
// Three ways a rule participates in declaration files:
//
//   - FormatRule markers: every format rule visits declaration files —
//     `ttsc format` / `ttsc fix` must keep formatting hand-written `.d.ts`
//     on the same boundary as other sources.
//   - declarationFileRule: the optional interface a rule (built-in or
//     contributor adapter) implements to answer for itself.
//   - declarationFileRuleNames: the curated allowlist below for built-in
//     rules, kept in one place so the whole audit stays reviewable.
//
// Audit principle for the allowlist: a rule is listed when its grammar
// shape occurs in declaration files under normal usage — type syntax,
// signatures, import/export forms, enums and their constant initializers,
// comments/JSDoc, identifier naming, or per-file metrics. Rules that need
// executable statements, expressions outside ambient-legal constant
// expressions, or runtime semantics (promises, DOM, JSX, test frameworks)
// are deliberately absent. When in doubt the rule is listed: a wrongly
// listed rule only costs dispatch time, while a wrongly skipped rule
// silently loses findings.
package linthost

// declarationFileRule marks rules that want to fire on declaration-file
// (`.d.ts`, `.d.mts`, `.d.cts`) inputs. Rules that neither implement this
// interface (returning true) nor appear in declarationFileRuleNames nor
// carry the FormatRule marker are skipped on every
// `file.IsDeclarationFile == true` source.
type declarationFileRule interface {
  VisitsDeclarationFiles() bool
}

// ruleVisitsDeclarationFiles reports whether the engine dispatches `r` on
// declaration-file sources.
func ruleVisitsDeclarationFiles(r Rule) bool {
  if isFormatRule(r) {
    return true
  }
  if dr, ok := r.(declarationFileRule); ok {
    return dr.VisitsDeclarationFiles()
  }
  return declarationFileRuleNames[r.Name()]
}

// declarationFileRuleNames is the audited allowlist of built-in rules whose
// grammar shapes occur in declaration files. Grouped by namespace; each
// group states the shape that justifies it. A name listed here must exist
// in the registry — the registry-parity test pins that.
var declarationFileRuleNames = map[string]bool{
  // JSDoc lives on declarations; declaration files are its prime habitat.
  "jsdoc/check-tag-names":              true,
  "jsdoc/check-values":                 true,
  "jsdoc/empty-tags":                   true,
  "jsdoc/no-types":                     true,
  "jsdoc/reject-any-type":              true,
  "jsdoc/reject-function-type":         true,
  "jsdoc/require-description":          true,
  "jsdoc/require-param-description":    true,
  "jsdoc/require-param-name":           true,
  "jsdoc/require-property-description": true,
  "jsdoc/require-property-name":        true,
  "jsdoc/require-returns-description":  true,
  "jsdoc/tsdoc-syntax":                 true,

  // Import-graph boundaries: declaration files import and re-export, and
  // an architectural boundary holds for hand-written `.d.ts` too.
  "boundaries/dependencies":  true,
  "boundaries/element-types": true,
  "boundaries/entry-point":   true,
  "boundaries/external":      true,
  "boundaries/no-private":    true,
  "boundaries/no-unknown":    true,

  // Core rules over shapes a declaration file contains: identifier
  // naming, import/export forms, accessor and class-member signatures,
  // per-file metrics, user-configured selectors, and the constant
  // expressions enum initializers allow (bitwise flags, numeric
  // literals).
  "camelcase":                 true,
  "grouped-accessor-pairs":    true,
  "id-length":                 true,
  "max-classes-per-file":      true,
  "max-lines":                 true,
  "max-params":                true,
  "no-bitwise":                true,
  "no-dupe-class-members":     true,
  "no-duplicate-imports":      true,
  "no-empty-named-blocks":     true,
  "no-irregular-whitespace":   true,
  "no-loss-of-precision":      true,
  "no-magic-numbers":          true,
  "no-mixed-operators":        true,
  "no-redeclare":              true,
  "no-restricted-imports":     true,
  "no-restricted-syntax":      true,
  "no-shadow":                 true,
  "no-shadow-restricted-names": true,
  "no-useless-computed-key":   true,
  "no-useless-rename":         true,
  "sort-imports":              true,

  // typescript/* rules over type syntax, signatures, enums, import/export
  // type forms, comments, and declaration merging.
  "typescript/adjacent-overload-signatures":      true,
  "typescript/array-type":                        true,
  "typescript/ban-ts-comment":                    true,
  "typescript/ban-tslint-comment":                true,
  "typescript/class-literal-property-style":      true,
  "typescript/consistent-indexed-object-style":   true,
  "typescript/consistent-type-definitions":       true,
  "typescript/consistent-type-exports":           true,
  "typescript/consistent-type-imports":           true,
  "typescript/explicit-function-return-type":     true,
  "typescript/explicit-member-accessibility":     true,
  "typescript/method-signature-style":            true,
  "typescript/no-deprecated":                     true,
  "typescript/no-duplicate-enum-values":          true,
  "typescript/no-empty-interface":                true,
  "typescript/no-empty-object-type":              true,
  "typescript/no-explicit-any":                   true,
  "typescript/no-extraneous-class":               true,
  "typescript/no-import-type-side-effects":       true,
  "typescript/no-invalid-void-type":              true,
  "typescript/no-magic-numbers":                  true,
  "typescript/no-misused-new":                    true,
  "typescript/no-mixed-enums":                    true,
  "typescript/no-redundant-type-constituents":    true,
  "typescript/no-require-imports":                true,
  "typescript/no-restricted-types":               true,
  "typescript/no-unnecessary-qualifier":          true,
  "typescript/no-unnecessary-template-expression": true,
  "typescript/no-unnecessary-type-arguments":     true,
  "typescript/no-unnecessary-type-constraint":    true,
  "typescript/no-unsafe-declaration-merging":     true,
  "typescript/no-unsafe-function-type":           true,
  "typescript/no-wrapper-object-types":           true,
  "typescript/prefer-enum-initializers":          true,
  "typescript/prefer-function-type":              true,
  "typescript/prefer-literal-enum-member":        true,
  "typescript/prefer-namespace-keyword":          true,
  "typescript/prefer-return-this-type":           true,
  "typescript/related-getter-setter-pairs":       true,
  "typescript/sort-type-constituents":            true,
  "typescript/triple-slash-reference":            true,

  // functional/* rules that police type shapes (not statements).
  "functional/no-mixed-types":               true,
  "functional/no-return-void":               true,
  "functional/prefer-immutable-types":       true,
  "functional/prefer-property-signatures":   true,
  "functional/prefer-readonly-type":         true,
  "functional/readonly-type":                true,
  "functional/type-declaration-immutability": true,

  // unicorn/* rules over file names, comments, identifier naming, and
  // the numeric literals that appear in enum initializers and literal
  // types.
  "unicorn/empty-brace-spaces":          true,
  "unicorn/expiring-todo-comments":      true,
  "unicorn/filename-case":               true,
  "unicorn/no-abusive-eslint-disable":   true,
  "unicorn/no-empty-file":               true,
  "unicorn/no-keyword-prefix":           true,
  "unicorn/number-literal-case":         true,
  "unicorn/numeric-separators-style":    true,
  "unicorn/prevent-abbreviations":       true,
}
