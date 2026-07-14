package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noVar: ban `var` declarations. ESLint canonical:
// https://eslint.org/docs/latest/rules/no-var
//
// The rule registers KindVariableDeclarationList, not KindVariableStatement:
// the grammar puts a `var` declaration list either inside a VariableStatement
// or directly in a `for` / `for...in` / `for...of` header, and only the list
// node is common to all four shapes. Registering the statement kind alone
// left every loop-header `var` invisible (issue #409). Each list node occurs
// exactly once in the tree, so every shape reports exactly once and no shape
// can double-report.
type noVar struct{}

func (noVar) Name() string { return "no-var" }
func (noVar) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableDeclarationList}
}
func (noVar) Check(ctx *Context, node *shimast.Node) {
  if node.AsVariableDeclarationList() == nil || !shimast.IsVar(node) {
    return
  }
  if ctx.File != nil && ctx.File.IsDeclarationFile {
    return
  }
  owner := node.Parent
  ownedByStatement := owner != nil && owner.Kind == shimast.KindVariableStatement
  // `declare var x` describes an existing binding instead of creating one;
  // like ESLint, the rule leaves ambient declarations alone. Only a
  // VariableStatement can carry the modifier — loop headers cannot be
  // ambient outside declaration files, which returned above.
  if ownedByStatement && owner.ModifierFlags()&shimast.ModifierFlagsAmbient != 0 {
    return
  }
  const message = "Unexpected var, use let or const instead."
  start := keywordStart(ctx.File, node, "var")
  if start >= 0 && isNoVarAutoFixSafe(ctx, node) {
    ctx.ReportRangeFix(
      start,
      start+len("var"),
      message,
      TextEdit{Pos: start, End: start + len("var"), Text: "let"},
    )
    return
  }
  if ownedByStatement {
    // Fixless statement reports keep the whole-statement range (through the
    // terminating semicolon) the rule has always rendered.
    ctx.Report(owner, message)
    return
  }
  // A loop-header list has no wrapping statement of its own; the list node
  // (`var i = 0`) is the natural diagnostic range.
  ctx.Report(node, message)
}

// isNoVarAutoFixSafe reports whether rewriting a `var` declaration list's
// keyword to `let` is safe using only AST-local information (no
// scope/data-flow engine). `listNode` is the KindVariableDeclarationList the
// rule visited; its parent is a VariableStatement or a `for` / `for...in` /
// `for...of` header. It mirrors the conservative posture of
// isEqeqeqAutoFixSafe: over-declining is fine, corrupting source is not.
// Blindly turning every `var` into `let` breaks two real shapes that `var`
// hoisting tolerates but `let` does not:
//   - redeclaration (`var x=1; var x=2;`) → two `let x` is a SyntaxError;
//   - use-before-declaration (a binding referenced above its own line) →
//     `let` makes that reference a TDZ ReferenceError.
//
// Five corruption holes were patched piecemeal here before (var-vs-var,
// for-header var, function/class redeclaration, mixed destructuring sibling,
// object-literal shorthand, use-before-declaration). That whack-a-mole is
// replaced by one conservative rule with five preconditions; the fix is
// emitted only if ALL hold:
//
//  1. Single binding in the whole file. The declared name is introduced by
//     EXACTLY ONE binding position anywhere in the source — counting every
//     binding-introducing slot of that identifier: variable declarations and
//     destructuring leaves, function/class/enum/module declarations,
//     parameters and catch bindings, and import bindings. More than one such
//     position → decline. This single count subsumes every prior
//     redeclaration arm (var-vs-var, var-vs-param, var-vs-function, mixed
//     destructure siblings, for-header var, …). It over-declines harmless
//     cross-scope same-name bindings, which never corrupts.
//  2. No use-before-declaration / TDZ. The declared name is not referenced as
//     a VALUE before the list's Pos(). A non-reference occurrence of the
//     same text — a member name (`o.x`), an object-literal key (`{x:1}`), a
//     statement label (`x:`), or a type reference (`: x`) — binds no value and
//     must not force a decline; isValueReferenceIdentifier classifies these.
//  3. No block-scope escape. `var` is function/global-scoped while `let` is
//     block-scoped, so a `var` declared inside a block and read after the
//     block (`if (c) { var x = 1; } log(x);`) would stop compiling under
//     `let`. For a statement list the statement's parent must be a position
//     where a lexical declaration is legal AND which forms the `let`'s block
//     scope — a Block (plain, function-body, loop-body, …), a ModuleBlock, a
//     switch Case/DefaultClause, or the SourceFile — and every value
//     reference to the name must lie inside that parent's [Pos, End) span. A
//     non-scope parent (`if (c) var x = 1;` — a single-statement body, where
//     `let` is a SyntaxError outright) declines unconditionally. For a
//     loop-header list the loop statement itself is the scope: a header
//     `let` is always grammatically legal and scopes to the whole loop
//     (header plus body), so references must stay inside the loop's span
//     (`for (var i = 0; …) {}` followed by `log(i);` declines). Given
//     precondition 1 (one binding file-wide), positional containment is
//     exact: no other binding can shadow the name, so a reference outside
//     the span really does resolve to this binding. Using the CaseClause
//     (not the whole switch CaseBlock) as the scope over-declines cross-case
//     references, which under `let` would flip from `undefined` reads to
//     runtime TDZ throws — declining is the safe side. Mirrors ESLint
//     no-var's isUsedFromOutsideOf.
//  4. No loop-closure capture. When the declaration sits inside a loop — a
//     statement in a loop body OR the loop's own header — and the name is
//     referenced from a function or arrow nested within that loop
//     (`for (const k of keys) { var last = k; fns.push(() => last); }`,
//     `for (var i = 0; i < n; i++) { fns.push(() => i); }`), every closure
//     shares ONE `var` binding but would capture a FRESH per-iteration `let`
//     binding — the rewrite silently changes runtime results. Mirrors ESLint
//     no-var's isReferencedInClosure loop check.
//  5. Not declared under a `with` statement. `var` hoists PAST the with body
//     to the function scope, so references inside the body resolve through
//     the with object first (`o.x` shadows the var when present); `let`
//     stays inside the body's block scope, where it shadows the with object
//     instead. The rewrite can flip which binding every reference hits, so
//     any var with a WithStatement ancestor below the nearest function
//     boundary declines.
//
// Two loop-header-only grammar/TDZ hazards also decline:
//   - a `for...in` / `for...of` declarator with an initializer (Annex B
//     tolerates `for (var i = 0 in o)`; `for (let i = 0 in o)` is a
//     SyntaxError), and
//   - a value reference to the name inside the `for...in` / `for...of` head
//     expression (`for (var x of x)` reads the hoisted undefined `var`;
//     under `let` the head expression evaluates inside the binding's TDZ
//     and throws a ReferenceError).
//
// The var list being fixed must itself be a single plain identifier
// declarator so the keyword rewrite has a simple `let x` rename target; a
// destructuring var (`var {a}=o`, `for (var [a] of …)`) or a multi-binding
// list is declined here even though its names might each bind only once.
func isNoVarAutoFixSafe(ctx *Context, listNode *shimast.Node) bool {
  if ctx == nil || ctx.File == nil {
    return false
  }
  owner := listNode.Parent
  if owner == nil {
    return false
  }
  // Precondition: the var being fixed is a single plain identifier
  // declarator. identifierText returns "" for a destructuring pattern, so
  // requiring exactly one VariableDeclaration node AND a non-empty plain
  // name rejects both multi-binding lists and destructured declarators.
  list := listNode.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil || len(list.Declarations.Nodes) != 1 {
    return false
  }
  decl := list.Declarations.Nodes[0].AsVariableDeclaration()
  if decl == nil {
    return false
  }
  target := identifierText(decl.Name())
  if target == "" {
    return false
  }

  // A name `var` tolerates but `let` cannot redeclare: `let let = 1;` is a
  // SyntaxError everywhere, and `let static = 1;` is one in strict mode
  // (modules, classes) — while `var let` / `var static` parse in sloppy
  // scripts. Mirrors upstream ESLint no-var's DISALLOWED_LET_NAMES.
  if target == "let" || target == "static" {
    return false
  }

  // Precondition 3 setup: resolve the node that will delimit the rewritten
  // `let` binding's block scope, per owner shape.
  var scopeNode *shimast.Node
  switch owner.Kind {
  case shimast.KindVariableStatement:
    // The statement's parent must both allow a lexical declaration and act
    // as the `let`'s block scope. Any other parent kind is a
    // single-statement body (`if (c) var x = 1;`, `while (c) var x = 1;`,
    // `label: var x = 1;`, `with (o) var x = 1;`) where `let` is a plain
    // SyntaxError, so the fix declines before any reference is examined.
    scopeNode = owner.Parent
    if scopeNode == nil || !isBlockScopeContainer(scopeNode.Kind) {
      return false
    }
  case shimast.KindForStatement:
    scopeNode = owner
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    // Annex B parses `for (var i = 0 in o)` in sloppy scripts; the same
    // header with `let` is a SyntaxError everywhere, so any initializer on
    // a for-in/for-of declarator declines outright.
    if decl.Initializer != nil {
      return false
    }
    scopeNode = owner
  default:
    // A declaration list can only be owned by the four shapes above; an
    // unrecognized owner keeps the diagnostic but never offers a rewrite.
    return false
  }
  scopeStart, scopeEnd := scopeNode.Pos(), scopeNode.End()

  // Precondition 5: a `var` declared under a `with` statement resolves its
  // references through the with object; the block-scoped `let` would shadow
  // that object instead, so the rewrite declines outright.
  if isDeclaredInsideWithStatement(listNode) {
    return false
  }

  // Precondition 4 setup: the outermost loop enclosing the declaration
  // without an intervening function boundary. A loop-header list's first
  // ancestor IS its loop, so header declarations always run the
  // closure-capture check. nil when the declaration is not loop-local,
  // which disables the check.
  enclosingLoop := enclosingLoopWithinFunction(listNode)

  declPos := listNode.Pos()
  // The single declarator's initializer subtree. A value reference to `target`
  // inside this range is a self-reference that runs while `target` is still in
  // its temporal dead zone under `let` (`var x = typeof x;`, `var x = x;`,
  // `var x = (() => x)();`), so it must also force a decline even though its
  // Pos() is AFTER the list's start. initStart/initEnd are -1 when the
  // declarator has no initializer, which disables the range check.
  initStart, initEnd := -1, -1
  if decl.Initializer != nil {
    initStart, initEnd = decl.Initializer.Pos(), decl.Initializer.End()
  }
  // The for-in/for-of head expression evaluates while a `let` loop binding
  // is still in its TDZ, so a self-reference there (`for (var x of x)`)
  // must decline exactly like an initializer self-reference. -1 for the
  // other owner shapes, which have no head expression.
  exprStart, exprEnd := -1, -1
  if owner.Kind == shimast.KindForInStatement || owner.Kind == shimast.KindForOfStatement {
    if stmt := owner.AsForInOrOfStatement(); stmt != nil && stmt.Expression != nil {
      exprStart, exprEnd = stmt.Expression.Pos(), stmt.Expression.End()
    }
  }
  bindingCount := 0
  referencedBefore := false
  escapesScope := false
  capturedInLoop := false
  walkDescendants(ctx.File.AsNode(), func(child *shimast.Node) {
    // Binding count: every position that introduces the name `target` as a
    // binding (a declaration), not a value reference. Two or more positions
    // anywhere in the file decline the fix.
    for _, name := range bindingNamesIntroducedBy(child) {
      if name == target {
        bindingCount++
      }
    }
    // TDZ: a value reference to `target` turns into a ReferenceError under
    // `let` when it executes while `target` is still in its temporal dead
    // zone. Three cases decline:
    //   - a reference BEFORE the list's own position (`log(x); var x = 1;`);
    //   - a self-reference WITHIN the declarator's own initializer range
    //     (`var x = typeof x;`). Conservatively, any value reference inside
    //     the initializer declines — including a deferred read in a nested
    //     closure (`var f = () => f;`) that is actually safe — because the
    //     AST-local gate does not track whether that closure runs during
    //     initialization. Over-declining never corrupts source;
    //   - a self-reference within a for-in/for-of head expression
    //     (`for (var x of x)`), which evaluates inside the `let` TDZ.
    if child.Kind == shimast.KindIdentifier && identifierText(child) == target &&
      isValueReferenceIdentifier(child) {
      pos := child.Pos()
      if pos < declPos ||
        (initStart >= 0 && pos >= initStart && pos < initEnd) ||
        (exprStart >= 0 && pos >= exprStart && pos < exprEnd) {
        referencedBefore = true
      }
      // Scope escape: a value reference outside the enclosing block-scope
      // node's span stops resolving (or flips to a TDZ throw across switch
      // cases) once the binding becomes block-scoped `let`. Nested blocks
      // WITHIN the span stay fixable: containment, not clause equality.
      if pos < scopeStart || pos >= scopeEnd {
        escapesScope = true
      }
      // Loop-closure capture: a reference reached only by crossing a
      // function/arrow boundary between itself and the enclosing loop would
      // switch from one shared `var` binding to a fresh per-iteration `let`
      // binding.
      if enclosingLoop != nil && isCapturedInLoopClosure(child, enclosingLoop) {
        capturedInLoop = true
      }
    }
  })
  if referencedBefore || escapesScope || capturedInLoop {
    return false
  }
  return bindingCount == 1
}

// isBlockScopeContainer reports whether a node kind is a legal parent for a
// lexical (`let`) declaration statement AND the node that delimits the
// resulting binding's block scope: a Block (plain, function body, loop body,
// try/catch/finally, labeled block, class static block body — all
// KindBlock), a namespace's ModuleBlock, a switch clause, or the SourceFile
// itself. Every other statement position (an unbraced if/else/loop/with body
// or a directly-labeled statement) rejects lexical declarations at the
// grammar level, so the keyword rewrite is never legal there.
//
// A CaseClause/DefaultClause is used as the scope rather than the enclosing
// CaseBlock even though `let` technically hoists to the whole switch block:
// a reference in a LATER clause compiles under `let` but changes an
// `undefined` read into a runtime TDZ ReferenceError when the declaring
// clause did not execute first. Bounding the scope at the clause declines
// that shape; over-declining never corrupts.
func isBlockScopeContainer(kind shimast.Kind) bool {
  switch kind {
  case shimast.KindBlock,
    shimast.KindModuleBlock,
    shimast.KindCaseClause,
    shimast.KindDefaultClause,
    shimast.KindSourceFile:
    return true
  }
  return false
}

// isFunctionCaptureBoundary reports whether a node creates a new function
// scope whose body captures outer bindings by closure: function
// declarations/expressions, arrows, methods, constructors, accessors, class
// static blocks, and class property declarations (an instance field
// initializer runs at construction time and closes over the class
// definition's environment exactly like a method body; escope models it as
// its own variable scope). A PropertyDeclaration's computed NAME evaluates
// immediately rather than deferred, so classifying the whole declaration
// over-declines that rare shape — which never corrupts. Used both to stop
// the enclosing-loop walk (a `var` inside a function nested in a loop is
// per-call regardless of the loop) and to detect references that reach the
// loop only through deferred code.
func isFunctionCaptureBoundary(node *shimast.Node) bool {
  switch node.Kind {
  case shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindConstructor,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindClassStaticBlockDeclaration,
    shimast.KindPropertyDeclaration:
    return true
  }
  return false
}

// isDeclaredInsideWithStatement reports whether the declaration (a
// statement's or loop header's `var` list) has a WithStatement ancestor
// below the nearest function boundary. Under `var`
// the binding hoists past the with body to the function scope, so a
// same-name property on the with target intercepts every reference; under
// `let` the binding lives inside the body's block and shadows the with
// object instead. A function boundary resets the risk: a `var` inside a
// function nested in the with body binds tighter than the with object
// either way.
func isDeclaredInsideWithStatement(node *shimast.Node) bool {
  for ancestor := node.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if isFunctionCaptureBoundary(ancestor) {
      return false
    }
    if ancestor.Kind == shimast.KindWithStatement {
      return true
    }
  }
  return false
}

// enclosingLoopWithinFunction returns the OUTERMOST loop statement enclosing
// `node` without an intervening function boundary, or nil when no such loop
// exists. The walk stops at the nearest function-like ancestor because a
// `var` declared inside a function nested in a loop already gets a fresh
// binding per call — the loop outside the function cannot make `var` and
// `let` capture semantics diverge for it.
func enclosingLoopWithinFunction(node *shimast.Node) *shimast.Node {
  var loop *shimast.Node
  for ancestor := node.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if isFunctionCaptureBoundary(ancestor) {
      break
    }
    switch ancestor.Kind {
    case shimast.KindForStatement,
      shimast.KindForInStatement,
      shimast.KindForOfStatement,
      shimast.KindWhileStatement,
      shimast.KindDoStatement:
      loop = ancestor
    }
  }
  return loop
}

// isCapturedInLoopClosure reports whether a value-reference identifier
// reaches `loop` on its ancestor chain only after crossing a function
// boundary — i.e. the reference lives in a closure created inside the loop.
// Under `var` every iteration's closure shares one binding; under `let` each
// iteration captures a fresh binding, so such a reference makes the keyword
// rewrite change observable behavior. A reference whose chain never meets
// `loop` lies outside the loop entirely and is left to the scope-containment
// check.
func isCapturedInLoopClosure(ref, loop *shimast.Node) bool {
  crossedFunction := false
  for ancestor := ref.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if ancestor == loop {
      return crossedFunction
    }
    if isFunctionCaptureBoundary(ancestor) {
      crossedFunction = true
    }
  }
  return false
}

// bindingNamesIntroducedBy returns every plain identifier name that `node`
// introduces as a binding in its OWN slot — never the names bound by its
// descendants, which the file-wide walk visits independently. The classifier
// is by AST kind and slot so a value reference, member name, object-literal
// key, label, or type reference of the same text is excluded; only genuine
// declarations contribute.
//
// A destructuring declarator (`var { a } = o`, `function f([a]) {}`) is NOT
// flattened here: its leaf names belong to the BindingElement descendants,
// which the walk visits on their own, so each leaf is counted exactly once at
// its own position. Declaration nodes therefore contribute only when their
// own name slot is a plain identifier.
//
// Returns nil for any node that introduces no binding in its own slot. Type
// aliases and interfaces are intentionally absent: they live in the type
// namespace and merge with a same-name value binding without a `let`
// duplicate-declaration error.
func bindingNamesIntroducedBy(node *shimast.Node) []string {
  if node == nil {
    return nil
  }
  switch node.Kind {
  case shimast.KindVariableDeclaration:
    if decl := node.AsVariableDeclaration(); decl != nil {
      if name := identifierText(decl.Name()); name != "" {
        return []string{name}
      }
    }
  case shimast.KindParameter:
    if decl := node.AsParameterDeclaration(); decl != nil {
      if name := identifierText(decl.Name()); name != "" {
        return []string{name}
      }
    }
  case shimast.KindBindingElement:
    // A leaf of a destructuring pattern (`{ a }`, `[a]`, `{ k: a }`,
    // `...rest`). Only the element's own bound name counts; nested patterns
    // are their own BindingElement descendants, and the default-value
    // initializer is a value reference, not a binding.
    if elem := node.AsBindingElement(); elem != nil {
      if name := identifierText(elem.Name()); name != "" {
        return []string{name}
      }
    }
  case shimast.KindFunctionDeclaration:
    if decl := node.AsFunctionDeclaration(); decl != nil && decl.Body != nil {
      if name := identifierText(decl.Name()); name != "" {
        return []string{name}
      }
    }
  case shimast.KindClassDeclaration:
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindEnumDeclaration, shimast.KindModuleDeclaration:
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindCatchClause:
    // `catch (e)` — the catch binding. A destructured catch binding
    // (`catch ({ e })`) has its leaves counted via the BindingElement
    // descendants, so only a plain identifier binding counts here.
    if catch := node.AsCatchClause(); catch != nil && catch.VariableDeclaration != nil {
      if name := identifierText(catch.VariableDeclaration.Name()); name != "" {
        return []string{name}
      }
    }
  case shimast.KindImportClause:
    // `import foo from "m"` — the default import binding. Named and
    // namespace bindings are their own ImportSpecifier / NamespaceImport
    // descendants, visited separately.
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindNamespaceImport:
    // `import * as ns from "m"`.
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindImportSpecifier:
    // `import { a } from "m"` / `import { a as b } from "m"` — the local
    // binding is the specifier's Name(), not the PropertyName.
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  case shimast.KindImportEqualsDeclaration:
    // `import x = require("m")` / `import x = A.B`.
    if name := identifierText(node.Name()); name != "" {
      return []string{name}
    }
  }
  return nil
}

// isValueReferenceIdentifier reports whether an Identifier node occupies a
// value-reference position rather than a non-reference role that merely
// reuses the same text. The use-before-declaration gate in
// isNoVarAutoFixSafe matches identifiers by text alone, so it would
// otherwise decline on positions that bind no value:
//
//   - the `name` of a property access (`o.x`) or qualified name (`A.x`);
//   - an object-literal property key (`{ x: 1 }`) or shorthand key;
//   - a statement label (`x:` / `break x`);
//   - a type reference (`: x`) whose `TypeName` is the identifier.
//
// Classification is by the identifier's parent node kind and slot, never
// by text. Any unrecognized parent is treated as a value reference
// (safety first: an unclassified position keeps declining).
func isValueReferenceIdentifier(node *shimast.Node) bool {
  parent := node.Parent
  if parent == nil {
    return true
  }
  switch parent.Kind {
  case shimast.KindPropertyAccessExpression:
    // `o.x`: only the object expression is a reference; the member name
    // is a property, not a binding.
    access := parent.AsPropertyAccessExpression()
    return access == nil || access.Name() != node
  case shimast.KindQualifiedName:
    // `A.x` in type position: the right side is a property name.
    qn := parent.AsQualifiedName()
    return qn == nil || qn.Right != node
  case shimast.KindPropertyAssignment:
    // `{ x: target }`: the key is not a reference; the value is.
    assign := parent.AsPropertyAssignment()
    return assign == nil || assign.Name() != node
  // `{ x }`: an object-literal shorthand is a VALUE READ of binding `x`
  // (object destructuring parses as KindBindingElement and is handled
  // elsewhere). It falls through to the default `true` so the
  // use-before-declaration gate sees the forward reference and declines.
  case shimast.KindLabeledStatement:
    // `x:` label — a statement label shares no namespace with values.
    lbl := parent.AsLabeledStatement()
    return lbl == nil || lbl.Label != node
  case shimast.KindBreakStatement:
    brk := parent.AsBreakStatement()
    return brk == nil || brk.Label != node
  case shimast.KindContinueStatement:
    cont := parent.AsContinueStatement()
    return cont == nil || cont.Label != node
  case shimast.KindTypeReference:
    // `: x` — a type reference lives in the type namespace.
    ref := parent.AsTypeReferenceNode()
    return ref == nil || ref.TypeName != node
  }
  return true
}

// preferConst follows ESLint's binding semantics rather than comparing
// identifier text. TypeScript's checker resolves every declaration and write
// target to its lexical symbol, so same-spelled bindings in sibling, nested,
// and shadowing scopes remain independent. The rule records the declaration's
// initialization plus subsequent writes, then reports bindings with exactly
// one effective initialization.
//
// Declaration-only bindings are diagnostic-only. Rewriting `let value;` plus
// a later `value = expression` requires moving comments and changing statement
// structure, so the existing keyword edit stays limited to an initialized,
// single-declarator list. ESLint canonical:
// https://eslint.org/docs/latest/rules/prefer-const
type preferConst struct{}

type preferConstOptions struct {
  Destructuring          string `json:"destructuring"`
  IgnoreReadBeforeAssign bool   `json:"ignoreReadBeforeAssign"`
}

type preferConstWriteKind uint8

const (
  preferConstSimpleAssignment preferConstWriteKind = iota
  preferConstReassignment
)

type preferConstWrite struct {
  target     *shimast.Node
  assignment *shimast.Node
  kind       preferConstWriteKind
}

type preferConstCandidate struct {
  symbol           *shimast.Symbol
  nameNode         *shimast.Node
  declaration      *shimast.Node
  listNode         *shimast.Node
  scope            *shimast.Node
  declarationGroup *shimast.Node
  initialized      bool
  readBeforeAssign bool
  invalid          bool
  writes           []preferConstWrite
}

func (preferConst) Name() string { return "prefer-const" }
func (preferConst) NeedsTypeChecker() bool {
  return true
}
func (preferConst) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (preferConst) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }

  options := preferConstOptions{Destructuring: "any"}
  _ = ctx.DecodeOptions(&options)
  if options.Destructuring != "all" {
    options.Destructuring = "any"
  }

  candidates := make([]*preferConstCandidate, 0)
  bySymbol := make(map[*shimast.Symbol]*preferConstCandidate)
  declarationNames := make(map[*shimast.Node]struct{})
  candidateNames := make(map[string]struct{})
  groups := make(map[*shimast.Node][]*preferConstCandidate)

  walkDescendants(node, func(child *shimast.Node) {
    if child.Kind != shimast.KindVariableDeclaration {
      return
    }
    decl := child.AsVariableDeclaration()
    if decl == nil || child.Parent == nil || child.Parent.Kind != shimast.KindVariableDeclarationList {
      return
    }
    listNode := child.Parent
    if !shimast.IsLet(listNode) || preferConstIsForStatementInitializer(listNode) {
      return
    }

    names := bindingIdentifierNodes(decl.Name())
    if len(names) == 0 {
      return
    }
    initialized := decl.Initializer != nil || preferConstIsForInOrOfInitializer(listNode)
    destructuring := decl.Name() != nil && decl.Name().Kind != shimast.KindIdentifier
    for _, nameNode := range names {
      symbol := ctx.Checker.GetSymbolAtLocation(nameNode)
      candidate := &preferConstCandidate{
        symbol:      symbol,
        nameNode:    nameNode,
        declaration: child,
        listNode:    listNode,
        scope:       preferConstLexicalScope(nameNode),
        initialized: initialized,
      }
      if destructuring {
        candidate.declarationGroup = child
        groups[child] = append(groups[child], candidate)
      }
      candidates = append(candidates, candidate)
      declarationNames[nameNode] = struct{}{}
      if name := identifierText(nameNode); name != "" {
        candidateNames[name] = struct{}{}
      }
      if symbol == nil {
        candidate.invalid = true
        continue
      }
      if prior := bySymbol[symbol]; prior != nil {
        // Duplicate lexical declarations are already a TypeScript error. Do
        // not add a secondary const suggestion to either declaration.
        prior.invalid = true
        candidate.invalid = true
        continue
      }
      bySymbol[symbol] = candidate
    }
  })

  writeTargets := make(map[*shimast.Node]struct{})
  walkDescendants(node, func(child *shimast.Node) {
    switch child.Kind {
    case shimast.KindBinaryExpression:
      expr := child.AsBinaryExpression()
      if expr == nil || expr.OperatorToken == nil || !isAssignmentOperator(expr.OperatorToken.Kind) ||
        preferConstIsDestructuringDefaultAssignment(child) {
        return
      }
      kind := preferConstReassignment
      if expr.OperatorToken.Kind == shimast.KindEqualsToken {
        kind = preferConstSimpleAssignment
      }
      targets := assignmentTargetIdentifiers(expr.Left)
      for _, target := range targets {
        preferConstRecordWrite(ctx, bySymbol, writeTargets, target, child, kind)
      }
      if kind == preferConstSimpleAssignment && len(targets) > 1 {
        for _, target := range targets {
          symbol := valueSymbolAtIdentifier(ctx, target)
          if candidate := bySymbol[symbol]; candidate != nil {
            groups[child] = appendPreferConstCandidate(groups[child], candidate)
          }
        }
      }
    case shimast.KindPrefixUnaryExpression:
      expr := child.AsPrefixUnaryExpression()
      if expr != nil && (expr.Operator == shimast.KindPlusPlusToken || expr.Operator == shimast.KindMinusMinusToken) {
        for _, target := range assignmentTargetIdentifiers(expr.Operand) {
          preferConstRecordWrite(ctx, bySymbol, writeTargets, target, nil, preferConstReassignment)
        }
      }
    case shimast.KindPostfixUnaryExpression:
      expr := child.AsPostfixUnaryExpression()
      if expr != nil && (expr.Operator == shimast.KindPlusPlusToken || expr.Operator == shimast.KindMinusMinusToken) {
        for _, target := range assignmentTargetIdentifiers(expr.Operand) {
          preferConstRecordWrite(ctx, bySymbol, writeTargets, target, nil, preferConstReassignment)
        }
      }
    case shimast.KindForOfStatement, shimast.KindForInStatement:
      stmt := child.AsForInOrOfStatement()
      if stmt == nil || stmt.Initializer == nil || stmt.Initializer.Kind == shimast.KindVariableDeclarationList {
        return
      }
      for _, target := range assignmentTargetIdentifiers(stmt.Initializer) {
        preferConstRecordWrite(ctx, bySymbol, writeTargets, target, nil, preferConstReassignment)
      }
    }
  })

  // Only declaration-only candidates need read history. A read preceding the
  // sole assignment changes the diagnostic location under the default option,
  // and suppresses the diagnostic when ignoreReadBeforeAssign is enabled.
  walkDescendants(node, func(child *shimast.Node) {
    if child.Kind != shimast.KindIdentifier {
      return
    }
    if _, ok := declarationNames[child]; ok {
      return
    }
    if _, ok := writeTargets[child]; ok {
      return
    }
    if _, ok := candidateNames[identifierText(child)]; !ok {
      return
    }
    symbol := valueSymbolAtIdentifier(ctx, child)
    candidate := bySymbol[symbol]
    if candidate == nil || candidate.initialized || len(candidate.writes) != 1 {
      return
    }
    if child.Pos() < candidate.writes[0].target.Pos() {
      candidate.readBeforeAssign = true
    }
  })

  eligible := make(map[*preferConstCandidate]bool, len(candidates))
  for _, candidate := range candidates {
    eligible[candidate] = preferConstCandidateIsEligible(ctx, candidate, bySymbol, options)
  }

  for _, candidate := range candidates {
    if !eligible[candidate] {
      continue
    }
    group := candidate.declarationGroup
    if group == nil && !candidate.initialized && len(candidate.writes) == 1 {
      assignment := candidate.writes[0].assignment
      if len(groups[assignment]) > 1 {
        group = assignment
      }
    }
    if options.Destructuring == "all" && group != nil && !preferConstGroupIsEligible(groups[group], eligible) {
      continue
    }

    reportNode := candidate.nameNode
    if !candidate.initialized && !candidate.readBeforeAssign && len(candidate.writes) == 1 {
      reportNode = candidate.writes[0].target
    }

    start := -1
    if candidate.initialized && isSingleDeclarationList(candidate.listNode) {
      declarationGroup := groups[candidate.declaration]
      if len(declarationGroup) == 0 || preferConstGroupIsEligible(declarationGroup, eligible) {
        start = keywordStart(ctx.File, candidate.listNode, "let")
      }
    }
    if start >= 0 {
      ctx.ReportFix(
        reportNode,
        "Use const instead of let.",
        TextEdit{Pos: start, End: start + len("let"), Text: "const"},
      )
    } else {
      ctx.Report(reportNode, "Use const instead of let.")
    }
  }
}

func preferConstRecordWrite(
  ctx *Context,
  bySymbol map[*shimast.Symbol]*preferConstCandidate,
  writeTargets map[*shimast.Node]struct{},
  target *shimast.Node,
  assignment *shimast.Node,
  kind preferConstWriteKind,
) {
  if target == nil || target.Kind != shimast.KindIdentifier {
    return
  }
  symbol := valueSymbolAtIdentifier(ctx, target)
  candidate := bySymbol[symbol]
  if candidate == nil {
    return
  }
  candidate.writes = append(candidate.writes, preferConstWrite{
    target:     target,
    assignment: assignment,
    kind:       kind,
  })
  writeTargets[target] = struct{}{}
}

func preferConstCandidateIsEligible(
  ctx *Context,
  candidate *preferConstCandidate,
  bySymbol map[*shimast.Symbol]*preferConstCandidate,
  options preferConstOptions,
) bool {
  if candidate == nil || candidate.invalid || candidate.symbol == nil {
    return false
  }
  if candidate.initialized {
    return len(candidate.writes) == 0
  }
  if len(candidate.writes) != 1 || candidate.writes[0].kind != preferConstSimpleAssignment {
    return false
  }
  if options.IgnoreReadBeforeAssign && candidate.readBeforeAssign {
    return false
  }
  return preferConstAssignmentCanInitialize(ctx, candidate, candidate.writes[0], bySymbol)
}

func preferConstAssignmentCanInitialize(
  ctx *Context,
  candidate *preferConstCandidate,
  write preferConstWrite,
  bySymbol map[*shimast.Symbol]*preferConstCandidate,
) bool {
  assignment := write.assignment
  if assignment == nil || assignment.Kind != shimast.KindBinaryExpression ||
    candidate.scope == nil || candidate.scope != preferConstLexicalScope(write.target) {
    return false
  }
  expr := assignment.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil || expr.OperatorToken.Kind != shimast.KindEqualsToken {
    return false
  }

  statementOwner := assignment
  for statementOwner.Parent != nil && statementOwner.Parent.Kind == shimast.KindParenthesizedExpression {
    statementOwner = statementOwner.Parent
  }
  if statementOwner.Parent == nil || statementOwner.Parent.Kind != shimast.KindExpressionStatement {
    return false
  }
  container := statementOwner.Parent.Parent
  if container == nil {
    return false
  }
  switch container.Kind {
  case shimast.KindSourceFile,
    shimast.KindBlock,
    shimast.KindModuleBlock,
    shimast.KindCaseClause,
    shimast.KindDefaultClause:
  default:
    return false
  }

  if preferConstAssignmentTargetHasMember(expr.Left) {
    return false
  }
  targets := assignmentTargetIdentifiers(expr.Left)
  if len(targets) == 0 {
    return false
  }
  for _, target := range targets {
    symbol := valueSymbolAtIdentifier(ctx, target)
    grouped := bySymbol[symbol]
    if symbol == nil || !preferConstSymbolIsLocalToScope(symbol, candidate.scope) ||
      (grouped != nil && grouped.invalid) {
      return false
    }
  }
  return true
}

func preferConstSymbolIsLocalToScope(symbol *shimast.Symbol, scope *shimast.Node) bool {
  if symbol == nil || scope == nil {
    return false
  }
  for _, declaration := range symbol.Declarations {
    if preferConstDeclarationScope(declaration) == scope {
      return true
    }
  }
  return false
}

// preferConstDeclarationScope returns the scope that owns a sibling target in
// a destructuring assignment. Parameters cannot be folded into a declaration,
// and `var` declarations hoist past ordinary blocks to their function-like
// owner; every other declaration uses lexical scope.
func preferConstDeclarationScope(declaration *shimast.Node) *shimast.Node {
  if declaration == nil {
    return nil
  }
  for ancestor := declaration; ancestor != nil; ancestor = ancestor.Parent {
    if ancestor.Kind == shimast.KindParameter {
      return nil
    }
    if isFunctionLikeKind(ancestor) {
      break
    }
  }
  for ancestor := declaration.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if ancestor.Kind != shimast.KindVariableDeclarationList {
      continue
    }
    if !shimast.IsVar(ancestor) {
      break
    }
    for scope := ancestor.Parent; scope != nil; scope = scope.Parent {
      if scope.Kind == shimast.KindSourceFile || scope.Kind == shimast.KindModuleBlock ||
        scope.Kind == shimast.KindClassStaticBlockDeclaration || isFunctionLikeKind(scope) {
        return scope
      }
    }
    return nil
  }
  return preferConstLexicalScope(declaration)
}

func preferConstAssignmentTargetHasMember(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindPropertyAccessExpression, shimast.KindElementAccessExpression:
    return true
  case shimast.KindParenthesizedExpression:
    return preferConstAssignmentTargetHasMember(stripParens(node))
  case shimast.KindNonNullExpression:
    if expression := node.AsNonNullExpression(); expression != nil {
      return preferConstAssignmentTargetHasMember(expression.Expression)
    }
  case shimast.KindAsExpression:
    if expression := node.AsAsExpression(); expression != nil {
      return preferConstAssignmentTargetHasMember(expression.Expression)
    }
  case shimast.KindTypeAssertionExpression:
    if expression := node.AsTypeAssertion(); expression != nil {
      return preferConstAssignmentTargetHasMember(expression.Expression)
    }
  case shimast.KindSatisfiesExpression:
    if expression := node.AsSatisfiesExpression(); expression != nil {
      return preferConstAssignmentTargetHasMember(expression.Expression)
    }
  case shimast.KindArrayLiteralExpression:
    if array := node.AsArrayLiteralExpression(); array != nil && array.Elements != nil {
      for _, element := range array.Elements.Nodes {
        if preferConstAssignmentTargetHasMember(element) {
          return true
        }
      }
    }
  case shimast.KindObjectLiteralExpression:
    if object := node.AsObjectLiteralExpression(); object != nil && object.Properties != nil {
      for _, property := range object.Properties.Nodes {
        if preferConstAssignmentTargetHasMember(property) {
          return true
        }
      }
    }
  case shimast.KindSpreadElement:
    if spread := node.AsSpreadElement(); spread != nil {
      return preferConstAssignmentTargetHasMember(spread.Expression)
    }
  case shimast.KindSpreadAssignment:
    if spread := node.AsSpreadAssignment(); spread != nil {
      return preferConstAssignmentTargetHasMember(spread.Expression)
    }
  case shimast.KindPropertyAssignment:
    if property := node.AsPropertyAssignment(); property != nil {
      return preferConstAssignmentTargetHasMember(property.Initializer)
    }
  case shimast.KindBinaryExpression:
    if expression := node.AsBinaryExpression(); expression != nil && expression.OperatorToken != nil &&
      expression.OperatorToken.Kind == shimast.KindEqualsToken {
      return preferConstAssignmentTargetHasMember(expression.Left)
    }
  // A shorthand property assignment writes its name. Its optional object
  // assignment initializer is a default-value read, so member access there
  // does not make the destructuring target unsafe.
  case shimast.KindShorthandPropertyAssignment, shimast.KindIdentifier:
    return false
  }
  return false
}

func preferConstGroupIsEligible(group []*preferConstCandidate, eligible map[*preferConstCandidate]bool) bool {
  if len(group) == 0 {
    return false
  }
  for _, candidate := range group {
    if !eligible[candidate] {
      return false
    }
  }
  return true
}

func appendPreferConstCandidate(group []*preferConstCandidate, candidate *preferConstCandidate) []*preferConstCandidate {
  for _, existing := range group {
    if existing == candidate {
      return group
    }
  }
  return append(group, candidate)
}

func bindingIdentifierNodes(node *shimast.Node) []*shimast.Node {
  if node == nil {
    return nil
  }
  if node.Kind == shimast.KindIdentifier {
    return []*shimast.Node{node}
  }
  pattern := node.AsBindingPattern()
  if pattern == nil || pattern.Elements == nil {
    return nil
  }
  var identifiers []*shimast.Node
  for _, elementNode := range pattern.Elements.Nodes {
    element := elementNode.AsBindingElement()
    if element != nil {
      identifiers = append(identifiers, bindingIdentifierNodes(element.Name())...)
    }
  }
  return identifiers
}

func preferConstIsForStatementInitializer(listNode *shimast.Node) bool {
  return listNode != nil && listNode.Parent != nil && listNode.Parent.Kind == shimast.KindForStatement
}

func preferConstIsForInOrOfInitializer(listNode *shimast.Node) bool {
  if listNode == nil || listNode.Parent == nil {
    return false
  }
  return listNode.Parent.Kind == shimast.KindForInStatement || listNode.Parent.Kind == shimast.KindForOfStatement
}

// preferConstIsDestructuringDefaultAssignment distinguishes the `a = 1`
// syntax inside `[a = 1]` or `{a = 1}` from a second assignment. The default
// node sits on the outer assignment's left-hand pattern path. A real assignment
// inside the default expression's right side leaves that path and is counted.
func preferConstIsDestructuringDefaultAssignment(node *shimast.Node) bool {
  current := node
  for parent := node.Parent; parent != nil; parent = parent.Parent {
    switch parent.Kind {
    case shimast.KindParenthesizedExpression,
      shimast.KindArrayLiteralExpression,
      shimast.KindObjectLiteralExpression,
      shimast.KindPropertyAssignment,
      shimast.KindSpreadElement,
      shimast.KindSpreadAssignment:
      current = parent
      continue
    case shimast.KindShorthandPropertyAssignment:
      // A shorthand's optional initializer is a read expression rather than
      // part of the assignment target. Any binary expression nested there is
      // a real write and must not inherit the outer destructuring assignment.
      return false
    case shimast.KindBinaryExpression:
      expr := parent.AsBinaryExpression()
      return expr != nil && expr.OperatorToken != nil && isAssignmentOperator(expr.OperatorToken.Kind) &&
        current.Pos() >= expr.Left.Pos() && current.End() <= expr.Left.End()
    default:
      return false
    }
  }
  return false
}

func preferConstLexicalScope(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  for ancestor := node.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if isFunctionLikeKind(ancestor) {
      return ancestor
    }
    switch ancestor.Kind {
    case shimast.KindSourceFile,
      shimast.KindModuleBlock,
      shimast.KindCaseBlock,
      shimast.KindForStatement,
      shimast.KindForInStatement,
      shimast.KindForOfStatement,
      shimast.KindCatchClause,
      shimast.KindClassStaticBlockDeclaration,
      shimast.KindPropertyDeclaration:
      return ancestor
    case shimast.KindBlock:
      if ancestor.Parent != nil && (isFunctionLikeKind(ancestor.Parent) ||
        ancestor.Parent.Kind == shimast.KindClassStaticBlockDeclaration) {
        return ancestor.Parent
      }
      return ancestor
    }
  }
  return nil
}

// isSingleDeclarationList reports whether the VariableDeclarationList contains
// exactly one declarator. Multiple comma-separated declarators share one
// keyword, so replacing it for only one declarator is not valid. One
// destructuring declarator may still contain several bindings; preferConst
// separately requires every affected binding to be eligible before fixing it.
func isSingleDeclarationList(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  list := node.AsVariableDeclarationList()
  return list != nil && list.Declarations != nil && len(list.Declarations.Nodes) == 1
}

// noUndefInit: forbid `let x = undefined` and `var x = undefined`.
// ESLint canonical: https://eslint.org/docs/latest/rules/no-undef-init
type noUndefInit struct{}

func (noUndefInit) Name() string           { return "no-undef-init" }
func (noUndefInit) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableDeclaration} }
func (noUndefInit) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsVariableDeclaration()
  if decl == nil || decl.Initializer == nil {
    return
  }
  if identifierText(decl.Initializer) == "undefined" {
    ctx.Report(decl.Initializer, "It's not necessary to initialize \"undefined\".")
  }
}

func init() {
  Register(noVar{})
  Register(preferConst{})
  Register(noUndefInit{})
}
