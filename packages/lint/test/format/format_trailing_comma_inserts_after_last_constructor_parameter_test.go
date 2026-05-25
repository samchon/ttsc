package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastConstructorParameter verifies the rule
// reaches multi-line parameter lists on class constructors.
//
// Constructors carry their own `KindConstructor` AST node and
// `AsConstructorDeclaration()` extractor, distinct from MethodDeclaration even
// though they share the parameter shape. Constructors also frequently use
// parameter-property syntax (`public a: number`); the underlying parameter list
// still ends at the last parameter's terminal token, so `last.End()` works for
// both plain and parameter-property forms. Pinning the constructor arm keeps
// the dispatch peer regression-safe.
//
//  1. Parse a source file with one class whose constructor parameter list spans
//     multiple lines.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the last parameter.
func TestFormatTrailingCommaInsertsAfterLastConstructorParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "class Point {\n  constructor(\n    public x: number,\n    public y: number\n  ) {}\n}\nPoint;\n",
    "class Point {\n  constructor(\n    public x: number,\n    public y: number,\n  ) {}\n}\nPoint;\n",
  )
}
