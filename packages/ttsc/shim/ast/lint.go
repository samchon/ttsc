// Lint-oriented additions to the AST shim.
//
// This file groups the helpers and node-flag constants the `@ttsc/lint`
// plugin needs to navigate the tree.
//
// Types and constants retain the identity of `internal/ast` symbols. Thin
// wrappers delegate upstream classification, while the declaration-keyword
// predicates below inspect combined flags locally. These helpers require the
// compiler's bound declaration tree where their parent traversal applies.
package ast

import (
  innerast "github.com/microsoft/typescript-go/internal/ast"
)

// ---- Node-list / visitor primitives ----

// Visitor is the compiler's node callback. Its boolean follows the traversal
// stop protocol of the operation receiving it.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream's func(*Node) bool callback identity and traversal protocol without converting node pointers.
// @evidence contracts/common.md#clear-and-simple-design One alias exposes the callback directly rather than a wrapper closure or parallel visitor interface.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Traversal callbacks use the supported upstream type without replacing compiler traversal methods.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies callback ownership and boolean interpretation, with separated prose and tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Visitor = innerast.Visitor

// NodeFlags is the compiler's bitmask of node and declaration context. Use the
// named upstream bits; declaration flags may live on enclosing list nodes.
//
// @evidence contracts/common.md#principled-implementation Type identity preserves the upstream uint32 flag representation used by nodes and combined-flag queries.
// @evidence contracts/common.md#clear-and-simple-design The alias exposes one canonical bitmask instead of a duplicate flag schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Flag values come from upstream definitions rather than guessed numbers or fixture-specific masks.
// @evidence contracts/common.md#meaningful-documentation Native prose explains named bits and enclosing declaration flags, with paragraph and tag separation following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NodeFlags = innerast.NodeFlags

// ModifierFlags is the compiler's modifier bitmask. It represents computed
// modifier facts, not a replacement list of modifier syntax nodes.
//
// @evidence contracts/common.md#principled-implementation The alias retains the upstream uint32 modifier mask expected by compiler modifier queries.
// @evidence contracts/common.md#clear-and-simple-design One canonical mask avoids a second modifier enum or conversion layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Modifier bits retain upstream identity rather than consumer-specific access or modifier guesses.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes modifier facts from syntax lists, using separated prose and tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ModifierFlags = innerast.ModifierFlags

// ---- Statement-shaped node types ----

// Block exposes the compiler-owned statement sequence inside braces. Aliasing
// retains its node identity and methods; it does not copy its statements.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves block payloads and compiler traversal methods.
// @evidence contracts/common.md#clear-and-simple-design The alias leaves statement-list representation with upstream rather than another block container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Block structure is the actual compiler type, without synthetic fixture statements or foreign mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose states the braced-sequence role and no-copy ownership, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Block = innerast.Block

// BreakStatement exposes a break node, including its optional target label.
// A syntax node does not establish that its target is a valid enclosing
// break destination, which can also be a switch or labeled statement.
//
// @evidence contracts/common.md#principled-implementation The alias retains upstream break-node identity and optional-label representation.
// @evidence contracts/common.md#clear-and-simple-design Label and node state remain upstream-owned without another jump model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Break targets remain compiler syntax rather than guessed control-flow destinations.
// @evidence contracts/common.md#meaningful-documentation Native prose explains label optionality and the semantic-validation boundary, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type BreakStatement = innerast.BreakStatement

// CaseBlock exposes the ordered case/default clauses of a switch body.
// The alias shares the compiler's clause list and node state.
//
// @evidence contracts/common.md#principled-implementation The upstream alias preserves ordered clause payloads and traversal identity.
// @evidence contracts/common.md#clear-and-simple-design Clause-list ownership stays in the compiler case-block type without a duplicate switch index.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Clauses remain real syntax rather than precomputed matching-case results.
// @evidence contracts/common.md#meaningful-documentation Native prose states ordering and shared node ownership, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type CaseBlock = innerast.CaseBlock

// CaseOrDefaultClause is the compiler's shared switch-clause payload. Inspect
// the node kind to distinguish a case expression from the default clause.
//
// @evidence contracts/common.md#principled-implementation Aliasing retains the shared upstream representation whose node kind distinguishes case and default forms.
// @evidence contracts/common.md#clear-and-simple-design One shared clause type avoids parallel local case and default payloads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The actual node kind determines clause form rather than a guessed expression-presence rule.
// @evidence contracts/common.md#meaningful-documentation Native prose names the required kind distinction, with separated prose and tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type CaseOrDefaultClause = innerast.CaseOrDefaultClause

// CatchClause exposes a catch body and its optional exception binding.
// An absent binding represents an optional-binding catch, not a missing body.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves the catch body's required role and optional binding.
// @evidence contracts/common.md#clear-and-simple-design The compiler catch payload owns binding and body without a second exception-handler structure.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Exception bindings remain compiler syntax rather than injected error values or foreign handler changes.
// @evidence contracts/common.md#meaningful-documentation Native prose clarifies binding absence and body meaning, with paragraph separation under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type CatchClause = innerast.CatchClause

// ContinueStatement exposes a continue node and optional label. The alias does
// not resolve whether its target denotes a valid iteration statement.
//
// @evidence contracts/common.md#principled-implementation Upstream type identity preserves continue syntax and optional-label data.
// @evidence contracts/common.md#clear-and-simple-design Target syntax stays with the compiler node without a separate local jump resolver.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Labels are supplied syntax rather than expected loop destinations or patched flow analysis.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes syntax exposure from target validation, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ContinueStatement = innerast.ContinueStatement

// DebuggerStatement exposes the payload-free debugger statement form. Compiler
// node metadata remains upstream-owned even though the syntax has no operands.
//
// @evidence contracts/common.md#principled-implementation The alias preserves debugger-node identity and metadata without inventing an operand.
// @evidence contracts/common.md#clear-and-simple-design Upstream's marker node is exposed directly with no redundant local flag.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Debugger syntax is an existing compiler kind rather than a debugging-only production branch.
// @evidence contracts/common.md#meaningful-documentation Native prose explains operand absence and retained metadata, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type DebuggerStatement = innerast.DebuggerStatement

// DoStatement exposes the do/while body and condition. Its syntax order differs
// from WhileStatement; the alias preserves the compiler's dedicated node form.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains the do/while node's body and condition roles.
// @evidence contracts/common.md#clear-and-simple-design The compiler owns this loop form without a generalized local loop adapter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Loop syntax remains the dedicated upstream type rather than a guessed while-loop rewrite.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies body-before-condition syntax and the loop distinction, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type DoStatement = innerast.DoStatement

// EmptyStatement exposes a standalone semicolon statement, which is distinct
// from an absent statement or an empty braced block.
//
// @evidence contracts/common.md#principled-implementation The alias retains the upstream empty-statement identity instead of conflating it with nil or Block.
// @evidence contracts/common.md#clear-and-simple-design One marker type expresses semicolon syntax without another emptiness flag.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The semicolon form is actual syntax rather than a manufactured no-op for known fixtures.
// @evidence contracts/common.md#meaningful-documentation Native prose states the absent-node and block distinctions, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type EmptyStatement = innerast.EmptyStatement

// ExpressionStatement exposes an expression in statement position. The wrapper
// preserves its statement identity rather than aliasing the expression alone.
//
// @evidence contracts/common.md#principled-implementation Upstream type identity preserves the expression/statement boundary used by traversal and emission.
// @evidence contracts/common.md#clear-and-simple-design The compiler wrapper owns statement metadata without another local expression container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Statement position comes from real AST structure rather than a text-based fixture classification.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the statement wrapper's purpose, with paragraph and tag separation following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ExpressionStatement = innerast.ExpressionStatement

// ForInOrOfStatement exposes the shared for-in/for-of payload. The node kind
// determines the iteration form; the same shape does not equate their semantics.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves upstream's shared loop payload and its kind-based in/of distinction.
// @evidence contracts/common.md#clear-and-simple-design The existing shared shape avoids duplicate local iteration-loop structures.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Iteration form uses the actual node kind rather than guessing from operand text.
// @evidence contracts/common.md#meaningful-documentation Native prose names the kind distinction and semantic boundary, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ForInOrOfStatement = innerast.ForInOrOfStatement

// ForStatement exposes the classic for-loop initializer, condition, incrementor
// and body. Omitted header operands remain absent in the upstream representation.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains optional loop-header operands and their distinct roles.
// @evidence contracts/common.md#clear-and-simple-design The compiler loop node owns header/body structure without another local iteration abstraction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Absent operands remain syntax facts rather than inserted fixture-specific conditions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains optional header roles and retained absence, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ForStatement = innerast.ForStatement

// FunctionDeclaration exposes a declaration-form function with the compiler's
// signature and optional body; declarations without bodies remain representable.
//
// @evidence contracts/common.md#principled-implementation The alias retains declaration identity and upstream signature/body representation without converting to FunctionExpression.
// @evidence contracts/common.md#clear-and-simple-design Signature state remains compiler-owned instead of duplicated in a local callable schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Function syntax is the actual upstream declaration rather than a consumer-specific callable stub.
// @evidence contracts/common.md#meaningful-documentation Native prose states declaration form and optional bodies, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type FunctionDeclaration = innerast.FunctionDeclaration

// IfStatement exposes condition and branch statements. The optional else
// statement distinguishes a missing alternative from an explicitly empty one.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains condition, then branch and optional else representation.
// @evidence contracts/common.md#clear-and-simple-design Branch ownership remains in the compiler node without a duplicate local decision tree.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Branches remain syntax inputs rather than precomputed outcomes for known conditions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains optional else versus empty syntax, following the documentation guidance's prose/tag separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type IfStatement = innerast.IfStatement

// LabeledStatement exposes a label attached to a statement. This syntax payload
// does not resolve break or continue references to that label.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream label and statement identity without inferring jump targets.
// @evidence contracts/common.md#clear-and-simple-design A single compiler node owns the label attachment rather than a separate local label registry.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Label attachment is AST structure rather than guessed textual jump resolution.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies attachment and its resolution boundary, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type LabeledStatement = innerast.LabeledStatement

// ModuleDeclaration exposes namespace or module declaration syntax. Its name,
// body form and flags remain compiler-owned; it does not resolve a module path.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains module declarations and their namespace/module distinctions.
// @evidence contracts/common.md#clear-and-simple-design The compiler owns name, body and flags without another local module model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Module names remain syntax rather than hardcoded package-resolution answers.
// @evidence contracts/common.md#meaningful-documentation Native prose states the declaration role and lack of path resolution, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ModuleDeclaration = innerast.ModuleDeclaration

// ModuleBlock exposes the statements inside a module body. It remains distinct
// from Block because the compiler gives module bodies their own node identity.
//
// @evidence contracts/common.md#principled-implementation The alias preserves module-body identity and statement storage from upstream.
// @evidence contracts/common.md#clear-and-simple-design The existing module-body node avoids a parallel local namespace statement container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Module-body classification uses the compiler type rather than special package-name logic.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the Block distinction, with separated prose and tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ModuleBlock = innerast.ModuleBlock

// ReturnStatement exposes an optional return expression. A nil expression is a
// bare return, not an explicit undefined expression inserted by the shim.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves optional return-value syntax and statement metadata.
// @evidence contracts/common.md#clear-and-simple-design The compiler return node owns expression absence without a redundant local return-value flag.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Bare returns remain absent operands rather than invented expected values.
// @evidence contracts/common.md#meaningful-documentation Native prose clarifies bare-return meaning, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ReturnStatement = innerast.ReturnStatement

// SwitchStatement exposes the tested expression and its case block. Syntax
// exposure does not decide which branch will match or fall through.
//
// @evidence contracts/common.md#principled-implementation Aliasing retains upstream switch expression and case-block identity without evaluating them.
// @evidence contracts/common.md#clear-and-simple-design Case storage remains in CaseBlock rather than a duplicate local dispatch table.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Branch outcomes are not hardcoded from known switch examples.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the structural roles and evaluation boundary, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SwitchStatement = innerast.SwitchStatement

// ThrowStatement exposes the expression to be thrown. The alias neither raises
// that value nor determines its runtime exception type.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves the throw operand as syntax without evaluating it.
// @evidence contracts/common.md#clear-and-simple-design The compiler node owns failure syntax without another local exception representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Thrown values remain real operands rather than injected fixture errors.
// @evidence contracts/common.md#meaningful-documentation Native prose separates syntax exposure from runtime throwing, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ThrowStatement = innerast.ThrowStatement

// TryStatement exposes the protected body and optional catch/finally parts.
// This syntax record does not execute cleanup or establish exception coverage.
//
// @evidence contracts/common.md#principled-implementation The alias retains upstream try/catch/finally structure and node identity.
// @evidence contracts/common.md#clear-and-simple-design Optional handlers stay with the compiler try node without another recovery-policy layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Handler structure is not replaced with compensating retries or expected exception paths.
// @evidence contracts/common.md#meaningful-documentation Native prose names optional handlers and the execution boundary, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TryStatement = innerast.TryStatement

// VariableDeclaration exposes one binding and its optional type/initializer.
// Keyword flags can live on its enclosing declaration list, so classification
// should use combined flags rather than this node's flags alone.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains binding, annotation and initializer roles and their compiler parent relationships.
// @evidence contracts/common.md#clear-and-simple-design The alias exposes one declaration while list-level keyword policy stays with the compiler tree.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Keyword classification uses actual enclosing flags rather than guessed binding text.
// @evidence contracts/common.md#meaningful-documentation Native prose explains optional operands and parent-owned keyword flags, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type VariableDeclaration = innerast.VariableDeclaration

// VariableDeclarationList exposes ordered bindings and declaration-keyword
// flags. The list is shared with the compiler rather than copied by the alias.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream ordered declaration storage and list-level node flags.
// @evidence contracts/common.md#clear-and-simple-design One compiler list owns shared keyword state instead of repeating it on every local binding.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Keyword flags retain upstream values rather than fixture-specific declaration categories.
// @evidence contracts/common.md#meaningful-documentation Native prose explains list ordering, keyword ownership and no-copy semantics, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type VariableDeclarationList = innerast.VariableDeclarationList

// VariableStatement exposes a declaration list in statement position, including
// statement-level modifiers. Loop header declarations use the list directly.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves the distinction between a variable statement and its reusable declaration list.
// @evidence contracts/common.md#clear-and-simple-design The compiler wrapper owns statement modifiers while the list owns bindings and keyword state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Statement context follows AST structure rather than a special-case source-text match.
// @evidence contracts/common.md#meaningful-documentation Native prose contrasts statement and loop-header usage, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type VariableStatement = innerast.VariableStatement

// WhileStatement exposes a condition followed by a loop body. The alias keeps
// this form distinct from the body-first DoStatement.
//
// @evidence contracts/common.md#principled-implementation The upstream alias preserves condition/body roles and while-node identity.
// @evidence contracts/common.md#clear-and-simple-design The dedicated compiler form avoids a local generalized loop representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Loop classification uses real syntax rather than a compensating do/while conversion.
// @evidence contracts/common.md#meaningful-documentation Native prose states condition-first meaning and the do/while distinction, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type WhileStatement = innerast.WhileStatement

// WithStatement exposes an object expression and its nested statement. This
// AST representation does not endorse the construct's use or change lookup.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves with-statement syntax without emulating its runtime scope behavior.
// @evidence contracts/common.md#clear-and-simple-design Object and body remain compiler payloads rather than another local scope adapter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign scope or property lookup is patched to simulate the construct.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes syntax representation from runtime lookup, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type WithStatement = innerast.WithStatement

// ---- Class / module / enum shapes ----

// ClassDeclaration exposes declaration-form class syntax and compiler-owned
// members. It retains declaration identity rather than converting to an expression.
//
// @evidence contracts/common.md#principled-implementation Upstream alias identity preserves class declaration metadata and member structure.
// @evidence contracts/common.md#clear-and-simple-design Class members remain in the compiler representation without a duplicate local class schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The shim exposes real class nodes rather than consumer-specific class substitutes.
// @evidence contracts/common.md#meaningful-documentation Native prose states declaration form and member ownership, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ClassDeclaration = innerast.ClassDeclaration

// ClassExpression exposes a class used as an expression, including an optional
// name. Its identity remains distinct from declaration-form classes.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream class-expression shape and optional naming.
// @evidence contracts/common.md#clear-and-simple-design Expression identity stays in the compiler type without a second class-form switch.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Class form follows actual AST identity rather than guessed naming conventions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains expression form and optional naming, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ClassExpression = innerast.ClassExpression

// ClassStaticBlockDeclaration exposes a class's static initialization block.
// Its body is syntax; exposing the alias does not execute initialization.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves the static-block declaration and its body.
// @evidence contracts/common.md#clear-and-simple-design The dedicated compiler member owns initialization syntax without a local lifecycle abstraction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Static bodies remain real AST data rather than injected initialization hooks.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies static initialization and the execution boundary, using separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ClassStaticBlockDeclaration = innerast.ClassStaticBlockDeclaration

// ConstructorDeclaration exposes constructor parameters and optional body.
// Compiler ownership preserves overload declarations that have no implementation.
//
// @evidence contracts/common.md#principled-implementation The alias retains constructor identity and upstream signature/body distinctions.
// @evidence contracts/common.md#clear-and-simple-design Constructor state remains with the compiler declaration without a local callable wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No known-class constructor or synthetic implementation substitutes for the upstream node.
// @evidence contracts/common.md#meaningful-documentation Native prose explains parameters and body absence, with paragraph separation following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ConstructorDeclaration = innerast.ConstructorDeclaration

// EnumDeclaration exposes named enum syntax and its member sequence. The alias
// does not evaluate member values or manufacture the emitted runtime object.
//
// @evidence contracts/common.md#principled-implementation Upstream type identity preserves enum name, modifiers and members without evaluation.
// @evidence contracts/common.md#clear-and-simple-design Members stay in the canonical compiler declaration rather than a duplicate value table.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Enum values are not replaced with precomputed fixture answers.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes syntax from value evaluation and emission, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type EnumDeclaration = innerast.EnumDeclaration

// EnumMember exposes an enum member name and optional initializer. An absent
// initializer remains syntax absence; its computed value belongs to the checker.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves member naming and initializer optionality.
// @evidence contracts/common.md#clear-and-simple-design The member node owns syntax without a second inferred-value representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing initializers are not filled with guessed enum values.
// @evidence contracts/common.md#meaningful-documentation Native prose names the computed-value boundary, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type EnumMember = innerast.EnumMember

// GetAccessorDeclaration exposes getter syntax with the compiler's signature
// and body representation. It does not execute a property read.
//
// @evidence contracts/common.md#principled-implementation The alias retains upstream getter declaration identity and methods.
// @evidence contracts/common.md#clear-and-simple-design Getter structure stays compiler-owned rather than a generic local property adapter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign getter is replaced to expose this syntax type.
// @evidence contracts/common.md#meaningful-documentation Native prose states the getter role and execution boundary, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type GetAccessorDeclaration = innerast.GetAccessorDeclaration

// SetAccessorDeclaration exposes setter syntax and its parameter/body data.
// Aliasing the node does not perform a property write or alter a setter.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains setter declaration payload and compiler methods.
// @evidence contracts/common.md#clear-and-simple-design Setter syntax remains in its canonical type without a duplicate assignment mechanism.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign setter replacement is used to expose setter nodes.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes declaration access from property writes, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SetAccessorDeclaration = innerast.SetAccessorDeclaration

// HeritageClause exposes an extends or implements clause. Inspect its token to
// distinguish those forms; exposing syntax does not establish assignability.
//
// @evidence contracts/common.md#principled-implementation Upstream identity preserves heritage token and target-type sequence.
// @evidence contracts/common.md#clear-and-simple-design One compiler clause owns both forms without parallel local inheritance records.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Clause meaning follows its actual token rather than a guessed target-name rule.
// @evidence contracts/common.md#meaningful-documentation Native prose states the token distinction and semantic boundary, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type HeritageClause = innerast.HeritageClause

// PropertyDeclaration exposes class property syntax, including optional type
// and initializer. It remains distinct from object-literal PropertyAssignment.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream property declaration identity and optional operands.
// @evidence contracts/common.md#clear-and-simple-design Class-member syntax remains in the compiler declaration without a duplicate property schema.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Properties are real declaration nodes rather than known-object fixture fields.
// @evidence contracts/common.md#meaningful-documentation Native prose explains class-member role and the assignment distinction, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PropertyDeclaration = innerast.PropertyDeclaration

// ---- Module syntax ----

// ImportDeclaration exposes an import statement's bindings and module syntax.
// The alias preserves optional side-effect-only bindings without resolving modules.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains import-clause optionality and module operands.
// @evidence contracts/common.md#clear-and-simple-design Import syntax remains compiler-owned without another local loader model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Module operands are real AST inputs rather than hardcoded resolution answers.
// @evidence contracts/common.md#meaningful-documentation Native prose names side-effect-only imports and the resolution boundary, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ImportDeclaration = innerast.ImportDeclaration

// ImportSpecifier exposes one named import and any original/local name
// distinction. The node's type-only marker remains the compiler's representation.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves upstream import-name and type-only distinctions without renaming bindings.
// @evidence contracts/common.md#clear-and-simple-design One specifier owns binding syntax without a duplicate local import map.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Binding names are actual syntax rather than consumer-specific alias rewrites.
// @evidence contracts/common.md#meaningful-documentation Native prose explains original/local naming and type-only state, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ImportSpecifier = innerast.ImportSpecifier

// ImportEqualsDeclaration exposes an import-equals binding and its module
// reference. Internal entity references and external module forms remain distinct.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves import-equals naming and reference forms.
// @evidence contracts/common.md#clear-and-simple-design The compiler declaration owns reference syntax without a separate local require adapter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No module-name special case converts the upstream reference payload.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies reference-form distinctions, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ImportEqualsDeclaration = innerast.ImportEqualsDeclaration

// ExternalModuleReference exposes the require-style reference operand used by
// import-equals syntax. The alias neither loads nor resolves that module.
//
// @evidence contracts/common.md#principled-implementation Upstream type identity retains the external-reference wrapper and its operand.
// @evidence contracts/common.md#clear-and-simple-design The compiler owns the reference boundary without another local module loader.
// @evidence contracts/common.md#prohibited-implementation-shortcuts External references are not guessed paths or patched require handlers.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes syntax from loading and resolution, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ExternalModuleReference = innerast.ExternalModuleReference

// NamedImports exposes the ordered named-binding list of an import clause.
// The alias shares compiler storage rather than copying or sorting specifiers.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves named-import ordering and child nodes.
// @evidence contracts/common.md#clear-and-simple-design One canonical list avoids a duplicate binding collection or name index.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Specifier order is retained rather than normalized for known fixtures.
// @evidence contracts/common.md#meaningful-documentation Native prose states ordering and no-copy semantics, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NamedImports = innerast.NamedImports

// NamespaceImport exposes the local name of an import namespace binding.
// The syntax node does not construct a runtime namespace object.
//
// @evidence contracts/common.md#principled-implementation The alias retains the upstream namespace-binding name and node identity.
// @evidence contracts/common.md#clear-and-simple-design Namespace binding syntax remains in one compiler node without a local module-object wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Namespace names are supplied syntax rather than fabricated module objects.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies local binding and runtime boundary, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NamespaceImport = innerast.NamespaceImport

// ExportDeclaration exposes export-clause and optional module syntax. Star and
// named exports retain the compiler's clause distinctions without target resolution.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves export forms and optional module references.
// @evidence contracts/common.md#clear-and-simple-design The compiler clause owns export structure without another local export registry.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Export targets are not replaced by consumer-specific public-name guesses.
// @evidence contracts/common.md#meaningful-documentation Native prose states form distinctions and unresolved targets, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ExportDeclaration = innerast.ExportDeclaration

// ExportSpecifier exposes one named export and any local/exported-name
// distinction. Type-only state remains the compiler node's own marker.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves upstream exported-name and type-only representation.
// @evidence contracts/common.md#clear-and-simple-design One specifier owns its names without a duplicate local export mapping.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Public names remain actual syntax rather than hardcoded downstream exports.
// @evidence contracts/common.md#meaningful-documentation Native prose explains naming and type-only state, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ExportSpecifier = innerast.ExportSpecifier

// ExportAssignment exposes an export-equals or default-export expression.
// The upstream node's form marker distinguishes those two assignments.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains export form and assigned expression syntax.
// @evidence contracts/common.md#clear-and-simple-design The shared compiler node owns both forms without another local export switch.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Assignment form uses upstream state rather than consumer-specific module conventions.
// @evidence contracts/common.md#meaningful-documentation Native prose names export-equals/default distinctions, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ExportAssignment = innerast.ExportAssignment

// ImportTypeNode exposes import-based type syntax, including qualifier and
// generic arguments. It remains a type node rather than an executable module load.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream import-type operands and type-query distinctions.
// @evidence contracts/common.md#clear-and-simple-design Type-import structure stays in the compiler type rather than a parallel module-resolution model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Import types are actual syntax, not precomputed module types or patched loaders.
// @evidence contracts/common.md#meaningful-documentation Native prose explains type syntax versus execution, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ImportTypeNode = innerast.ImportTypeNode

// ---- Binding patterns ----

// BindingElement exposes one destructuring binding, including optional source
// property, rest marker and initializer. Its parent pattern remains compiler-owned.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains destructuring operand and parent relationships.
// @evidence contracts/common.md#clear-and-simple-design One element owns binding syntax without a second flattened local binding map.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Destructuring is actual AST structure rather than guessed property-name substitution.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies optional operands and pattern ownership, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type BindingElement = innerast.BindingElement

// BindingPattern exposes the shared array/object destructuring shape. Inspect
// the node kind to distinguish those patterns rather than inferring from names.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream's kind-discriminated pattern and element representation.
// @evidence contracts/common.md#clear-and-simple-design The compiler shared shape avoids separate local array/object binding containers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Pattern form comes from the actual kind rather than fixture-specific naming rules.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the required array/object kind distinction, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type BindingPattern = innerast.BindingPattern

// ---- Expressions ----

// ArrayLiteralExpression exposes ordered array elements, including spread and
// omitted-element nodes. The alias does not evaluate or copy their values.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains element ordering and compiler literal metadata.
// @evidence contracts/common.md#clear-and-simple-design The canonical element list avoids a duplicate local array-value model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Array elements remain syntax rather than precomputed fixture arrays.
// @evidence contracts/common.md#meaningful-documentation Native prose explains ordering, holes and evaluation boundaries, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ArrayLiteralExpression = innerast.ArrayLiteralExpression

// ArrowFunction exposes arrow syntax with its parameters and expression or
// block body. The body form remains explicit in the compiler AST.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves arrow identity and expression/block-body distinctions.
// @evidence contracts/common.md#clear-and-simple-design The compiler callable node owns body and signature without a local function conversion.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Arrow bodies are real syntax rather than rewritten known callbacks.
// @evidence contracts/common.md#meaningful-documentation Native prose names both body forms, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ArrowFunction = innerast.ArrowFunction

// AsExpression exposes the operand and type of an `as` assertion. This syntax
// alias does not cast a Go value or establish TypeScript assignability.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains assertion expression/type roles without semantic conversion.
// @evidence contracts/common.md#clear-and-simple-design The existing assertion node avoids another local cast representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed type result or foreign checker override implements the alias.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes assertion syntax from conversion and checking, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type AsExpression = innerast.AsExpression

// AwaitExpression exposes an awaited operand. Its presence records syntax,
// not suspension or validation of the enclosing async context.
//
// @evidence contracts/common.md#principled-implementation Upstream type identity preserves the await operand and node metadata.
// @evidence contracts/common.md#clear-and-simple-design Await syntax stays in the compiler expression without another coroutine wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias introduces no retry or patched scheduling behavior.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the syntax and async-validation boundary, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type AwaitExpression = innerast.AwaitExpression

// BinaryExpression exposes left/right operands and the operator token. The
// token determines the operation; the alias does not evaluate either operand.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains operand order and operator-token distinctions.
// @evidence contracts/common.md#clear-and-simple-design One compiler binary node owns syntax without a local operation dispatch table.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Operators are actual AST tokens rather than fixture-specific computed answers.
// @evidence contracts/common.md#meaningful-documentation Native prose explains operator ownership and evaluation boundaries, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type BinaryExpression = innerast.BinaryExpression

// ConditionalExpression exposes condition, true operand and false operand.
// It retains expression identity rather than an if statement or chosen result.
//
// @evidence contracts/common.md#principled-implementation The alias preserves upstream ternary operand roles and expression metadata.
// @evidence contracts/common.md#clear-and-simple-design Three expression roles stay in the compiler node without a parallel local decision structure.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Conditional results are not substituted for known conditions.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies expression/statement/result distinctions, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ConditionalExpression = innerast.ConditionalExpression

// DeleteExpression exposes deletion syntax and its operand. Aliasing this node
// does not remove a property or determine whether deletion is permitted.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains the delete operand without executing it.
// @evidence contracts/common.md#clear-and-simple-design The compiler unary node owns syntax without another property-mutation layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign property or deletion method is changed by the alias.
// @evidence contracts/common.md#meaningful-documentation Native prose states execution and permission boundaries, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type DeleteExpression = innerast.DeleteExpression

// ElementAccessExpression exposes a receiver and bracketed index expression.
// Optional-chain state remains the compiler's node data rather than evaluated access.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves receiver/index ordering and upstream optional-access representation.
// @evidence contracts/common.md#clear-and-simple-design Bracket access remains a dedicated compiler expression without a local lookup wrapper.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Indices are actual syntax rather than hardcoded property results.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies bracket operands and optional-chain ownership, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ElementAccessExpression = innerast.ElementAccessExpression

// FunctionExpression exposes expression-form functions and optional naming.
// Signature and body nodes remain shared with the compiler, not compiled callables.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves function-expression form and signature/body state.
// @evidence contracts/common.md#clear-and-simple-design The canonical compiler callable avoids a second local function container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No expected callback implementation substitutes for the compiler expression.
// @evidence contracts/common.md#meaningful-documentation Native prose explains expression form and compiler ownership, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type FunctionExpression = innerast.FunctionExpression

// NewExpression exposes a constructor operand, generic arguments and optional
// argument list. An absent argument list retains the form without parentheses.
//
// @evidence contracts/common.md#principled-implementation Upstream identity preserves constructor and argument-list distinctions without instantiating a value.
// @evidence contracts/common.md#clear-and-simple-design The compiler new-expression type owns constructor syntax without a local object factory.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Constructor operands remain syntax rather than known-class object substitutes.
// @evidence contracts/common.md#meaningful-documentation Native prose clarifies argument-list absence, with separated tags following the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NewExpression = innerast.NewExpression

// NonNullExpression exposes the postfix non-null assertion operand. The alias
// records annotation syntax without establishing that a runtime value is non-null.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains the assertion wrapper and operand.
// @evidence contracts/common.md#clear-and-simple-design The dedicated compiler assertion avoids another local nullability flag.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed successful null check replaces the actual operand.
// @evidence contracts/common.md#meaningful-documentation Native prose separates syntax from runtime null guarantees, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type NonNullExpression = innerast.NonNullExpression

// ObjectLiteralExpression exposes ordered property/method members. The alias
// shares syntax nodes and does not materialize a runtime object or property map.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves the upstream member sequence and object-literal identity.
// @evidence contracts/common.md#clear-and-simple-design The canonical syntax collection avoids a duplicate local object representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Members remain real AST inputs rather than known-fixture object shapes.
// @evidence contracts/common.md#meaningful-documentation Native prose explains ordering and runtime boundaries, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ObjectLiteralExpression = innerast.ObjectLiteralExpression

// ParenthesizedExpression exposes an explicit grouping wrapper. Keeping the
// wrapper preserves syntax even when its child could be printed without it.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves explicit parenthesis nodes and their child.
// @evidence contracts/common.md#clear-and-simple-design Grouping stays in the compiler wrapper without a duplicate precedence model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Parentheses are actual syntax rather than fixture-specific formatting compensation.
// @evidence contracts/common.md#meaningful-documentation Native prose explains why explicit grouping remains represented, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ParenthesizedExpression = innerast.ParenthesizedExpression

// PostfixUnaryExpression exposes a postfix increment/decrement operand and
// operator. It remains distinct from prefix syntax and does not mutate a value.
//
// @evidence contracts/common.md#principled-implementation Upstream identity retains postfix operator and operand roles.
// @evidence contracts/common.md#clear-and-simple-design The compiler postfix form avoids a local placement switch or mutation adapter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Operators are syntax tokens rather than injected known-value updates.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes postfix form from execution, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PostfixUnaryExpression = innerast.PostfixUnaryExpression

// PropertyAccessExpression exposes a receiver and dotted member name. Optional
// chaining remains upstream syntax state, without resolving the member's value.
//
// @evidence contracts/common.md#principled-implementation The alias preserves receiver/name identity and optional-chain representation.
// @evidence contracts/common.md#clear-and-simple-design The compiler access node owns member syntax without another local property lookup.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Member names are real operands rather than hardcoded foreign property values.
// @evidence contracts/common.md#meaningful-documentation Native prose states dotted access and unresolved-value meaning, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PropertyAccessExpression = innerast.PropertyAccessExpression

// PropertyAssignment exposes a named object-literal member and initializer.
// It is distinct from a class property declaration and a shorthand member.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves object-member name and initializer roles.
// @evidence contracts/common.md#clear-and-simple-design The compiler assignment form avoids a duplicate generic property container.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Object members remain actual syntax rather than known-shape substitutions.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies declaration and shorthand distinctions, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type PropertyAssignment = innerast.PropertyAssignment

// ShorthandPropertyAssignment exposes a binding-name shorthand in an object
// literal and its optional assignment initializer. The value is not resolved here.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves shorthand identity and optional initializer data without inventing a separate key/value pair.
// @evidence contracts/common.md#clear-and-simple-design The dedicated compiler shorthand type avoids flattening syntax into another member model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Binding values are not guessed from known variable names.
// @evidence contracts/common.md#meaningful-documentation Native prose states shorthand and initializer roles, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ShorthandPropertyAssignment = innerast.ShorthandPropertyAssignment

// SpreadAssignment exposes an object-literal spread operand. It is distinct
// from SpreadElement used in array or argument positions.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves object-spread node kind and operand.
// @evidence contracts/common.md#clear-and-simple-design Object-member context stays in the compiler type without another spread-context option.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No known-object property expansion replaces the supplied syntax.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the SpreadElement context distinction, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SpreadAssignment = innerast.SpreadAssignment

// SpreadElement exposes a spread operand in arrays or argument lists. The alias
// does not expand an iterable or infer its resulting elements.
//
// @evidence contracts/common.md#principled-implementation Upstream identity retains spread-element syntax and its operand.
// @evidence contracts/common.md#clear-and-simple-design The canonical element wrapper avoids a local iterable-expansion layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Spread results are not precomputed for known iterable fixtures.
// @evidence contracts/common.md#meaningful-documentation Native prose names element contexts and the evaluation boundary, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SpreadElement = innerast.SpreadElement

// TaggedTemplateExpression exposes a tag expression and its template operand.
// The alias does not invoke the tag or evaluate template substitutions.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves tag/template operand relationships.
// @evidence contracts/common.md#clear-and-simple-design The compiler template-call form avoids another local interpolation adapter.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No known-tag result or patched template function replaces the AST.
// @evidence contracts/common.md#meaningful-documentation Native prose states tag ownership and evaluation boundaries, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TaggedTemplateExpression = innerast.TaggedTemplateExpression

// TemplateExpression exposes a template head and ordered substitution spans.
// Literal text and expressions remain separate compiler nodes without interpolation.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves upstream head/span ordering and syntax distinctions.
// @evidence contracts/common.md#clear-and-simple-design The compiler sequence owns template structure rather than a duplicate flattened string.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Interpolated values are not replaced by fixture-specific completed text.
// @evidence contracts/common.md#meaningful-documentation Native prose explains separated literals and substitutions, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TemplateExpression = innerast.TemplateExpression

// TemplateSpan exposes a substitution expression and the literal segment that
// follows it. Spans preserve ordering through their containing template.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity retains expression/following-literal pair semantics.
// @evidence contracts/common.md#clear-and-simple-design One compiler span owns the pair without another interpolation-state object.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Literal segments remain actual syntax rather than guessed rendered substitutions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains which literal follows each expression, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TemplateSpan = innerast.TemplateSpan

// TypeAssertion exposes angle-bracket assertion syntax and its type/operand.
// It remains distinct from AsExpression and does not convert a runtime value.
//
// @evidence contracts/common.md#principled-implementation Upstream identity retains assertion form and type/expression roles.
// @evidence contracts/common.md#clear-and-simple-design The dedicated compiler form avoids another local cast representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed cast result or foreign checker patch supplies assertion semantics.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies form and runtime-conversion boundaries, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeAssertion = innerast.TypeAssertion

// TypeOperatorNode exposes a type operator and its operand. Inspect the operator
// token to distinguish forms such as keyof, readonly and unique.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves operator-token and type-operand distinctions.
// @evidence contracts/common.md#clear-and-simple-design The shared compiler type operator avoids parallel local per-operator schemas.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Operator meaning comes from actual tokens rather than name-based type guesses.
// @evidence contracts/common.md#meaningful-documentation Native prose names token-dependent distinctions, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeOperatorNode = innerast.TypeOperatorNode

// TypeOfExpression exposes the runtime typeof operator's operand. It is distinct
// from a type-position query and does not evaluate the operand in the shim.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves runtime-expression identity rather than conflating it with TypeQuery syntax.
// @evidence contracts/common.md#clear-and-simple-design The compiler unary node owns runtime syntax without another local type-inference layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No expected typeof result substitutes for the compiler operand.
// @evidence contracts/common.md#meaningful-documentation Native prose explains runtime/type-query distinctions, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type TypeOfExpression = innerast.TypeOfExpression

// VoidExpression exposes the void operator and its operand. The alias records
// syntax without evaluating side effects or returning a JavaScript value.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves the void expression and operand metadata.
// @evidence contracts/common.md#clear-and-simple-design The compiler unary type avoids another local discard-operation abstraction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fabricated undefined value replaces the actual syntax operand.
// @evidence contracts/common.md#meaningful-documentation Native prose states evaluation and value boundaries, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type VoidExpression = innerast.VoidExpression

// YieldExpression exposes an optional yielded operand and delegation marker.
// Bare yield and yield-star remain distinct compiler syntax states.
//
// @evidence contracts/common.md#principled-implementation Upstream identity retains optional operand and delegation distinctions without running a generator.
// @evidence contracts/common.md#clear-and-simple-design The canonical yield node owns both forms without another local generator protocol.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Generator results are not substituted for known yielded fixtures.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies bare and delegated yield forms, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type YieldExpression = innerast.YieldExpression

// RegularExpressionLiteral exposes regexp literal syntax as held by the
// compiler. The alias does not compile a Go regexp or match input text.
//
// @evidence contracts/common.md#principled-implementation Exact upstream identity preserves regexp-literal text and node metadata.
// @evidence contracts/common.md#clear-and-simple-design Literal storage stays compiler-owned instead of another local regexp engine.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No known-input match result or foreign regexp override supplies this syntax type.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes syntax exposure from regexp compilation, with separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type RegularExpressionLiteral = innerast.RegularExpressionLiteral

// SatisfiesExpression exposes an expression and its satisfaction target type.
// This syntax alias does not perform the check or coerce the expression's value.
//
// @evidence contracts/common.md#principled-implementation Aliasing preserves upstream expression/type roles and satisfies-node identity.
// @evidence contracts/common.md#clear-and-simple-design The compiler expression owns the annotation boundary without a duplicate assignability result.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No fabricated successful check replaces the actual expression and target nodes.
// @evidence contracts/common.md#meaningful-documentation Native prose states checking and coercion boundaries, following the documentation guidance's paragraph separation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SatisfiesExpression = innerast.SatisfiesExpression

// ---- Comment directives (banTsComment) ----

// CommentDirective records a compiler-recognized suppression comment's source
// range and directive kind. It describes the comment, not whether suppression
// succeeds for a diagnostic.
//
// @evidence contracts/common.md#principled-implementation The exact upstream alias preserves the source range and directive discriminant used by compiler diagnostics.
// @evidence contracts/common.md#clear-and-simple-design One compiler record associates directive classification with its location without a second suppression model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Directive metadata is exposed unchanged rather than translated into rule-specific expected diagnostics.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes recognized metadata from successful suppression, with acknowledgment tags separated as the documentation skill requires.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type CommentDirective = innerast.CommentDirective

// CommentDirectiveKind identifies the compiler's suppression directive
// category. Re-exported constants retain upstream values; consumers must not
// infer them from directive spelling or declaration order.
//
// @evidence contracts/common.md#principled-implementation Upstream enum identity preserves the discriminator carried by CommentDirective records.
// @evidence contracts/common.md#clear-and-simple-design The compiler category is shared directly instead of maintained as a separate shim enum.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Directive constants derive from the pinned compiler rather than guessed numeric encodings.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the category's association and constant provenance; a blank comment line separates the tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type CommentDirectiveKind = innerast.CommentDirectiveKind

// ---- Source file parse options ----

// SourceFileParseOptions supplies file identity and external-module detection
// options to compiler parsing. FileName and Path retain their upstream roles;
// this alias does not normalize or reconcile caller-provided paths.
//
// @evidence contracts/common.md#principled-implementation Exact compiler identity retains both filename and canonical path fields alongside module-detection options.
// @evidence contracts/common.md#clear-and-simple-design Parsing configuration stays in the compiler's single options record without a shim-specific conversion layer.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The alias adds no platform-specific path rewrite or filename-based fixture exception.
// @evidence contracts/common.md#meaningful-documentation Native prose describes configuration purpose and the path-normalization boundary, with the documentation skill's separated acknowledgment block.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type SourceFileParseOptions = innerast.SourceFileParseOptions

// ExternalModuleIndicatorOptions configures additional external-module
// detection for source files. JSX enables JSX-based detection and Force marks
// eligible non-declaration source files as modules; explicit module syntax is
// still recognized by the compiler independently of these options.
//
// @evidence contracts/common.md#principled-implementation The upstream options distinguish JSX-based detection from forced module treatment while preserving compiler eligibility rules.
// @evidence contracts/common.md#clear-and-simple-design Two independent detection choices remain the compiler's two fields rather than a shim policy engine.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Module detection is configured through upstream options without replacing foreign classification or singling out consumers.
// @evidence contracts/common.md#meaningful-documentation Native prose explains each option and declaration-file eligibility, followed by a separate tag block using the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ExternalModuleIndicatorOptions = innerast.ExternalModuleIndicatorOptions

// ---- Node-flag constants ----

const (
  NodeFlagsNone         = innerast.NodeFlagsNone
  NodeFlagsSynthesized  = innerast.NodeFlagsSynthesized
  NodeFlagsLet          = innerast.NodeFlagsLet
  NodeFlagsConst        = innerast.NodeFlagsConst
  NodeFlagsBlockScoped  = innerast.NodeFlagsBlockScoped
  NodeFlagsAwaitContext = innerast.NodeFlagsAwaitContext
)

// ---- Modifier-flag constants ----

const (
  ModifierFlagsAmbient = innerast.ModifierFlagsAmbient
)

// ---- Statement / declaration / expression kinds ----

const (
  KindSourceFile = innerast.KindSourceFile

  // Statements
  KindBlock                   = innerast.KindBlock
  KindBreakStatement          = innerast.KindBreakStatement
  KindCaseBlock               = innerast.KindCaseBlock
  KindCaseClause              = innerast.KindCaseClause
  KindCatchClause             = innerast.KindCatchClause
  KindContinueStatement       = innerast.KindContinueStatement
  KindDebuggerStatement       = innerast.KindDebuggerStatement
  KindDefaultClause           = innerast.KindDefaultClause
  KindDoStatement             = innerast.KindDoStatement
  KindEmptyStatement          = innerast.KindEmptyStatement
  KindExpressionStatement     = innerast.KindExpressionStatement
  KindForInStatement          = innerast.KindForInStatement
  KindForOfStatement          = innerast.KindForOfStatement
  KindForStatement            = innerast.KindForStatement
  KindIfStatement             = innerast.KindIfStatement
  KindLabeledStatement        = innerast.KindLabeledStatement
  KindReturnStatement         = innerast.KindReturnStatement
  KindSwitchStatement         = innerast.KindSwitchStatement
  KindThrowStatement          = innerast.KindThrowStatement
  KindTryStatement            = innerast.KindTryStatement
  KindVariableDeclaration     = innerast.KindVariableDeclaration
  KindVariableDeclarationList = innerast.KindVariableDeclarationList
  KindVariableStatement       = innerast.KindVariableStatement
  KindWhileStatement          = innerast.KindWhileStatement
  KindWithStatement           = innerast.KindWithStatement

  // Class / enum / module
  KindClassDeclaration    = innerast.KindClassDeclaration
  KindClassExpression     = innerast.KindClassExpression
  KindConstructor         = innerast.KindConstructor
  KindEnumDeclaration     = innerast.KindEnumDeclaration
  KindEnumMember          = innerast.KindEnumMember
  KindGetAccessor         = innerast.KindGetAccessor
  KindSetAccessor         = innerast.KindSetAccessor
  KindHeritageClause      = innerast.KindHeritageClause
  KindPropertyDeclaration = innerast.KindPropertyDeclaration

  // Module syntax
  KindExportAssignment        = innerast.KindExportAssignment
  KindExportDeclaration       = innerast.KindExportDeclaration
  KindImportEqualsDeclaration = innerast.KindImportEqualsDeclaration
  KindExternalModuleReference = innerast.KindExternalModuleReference
  KindImportType              = innerast.KindImportType
  KindImportKeyword           = innerast.KindImportKeyword

  // Binding
  KindBindingElement       = innerast.KindBindingElement
  KindObjectBindingPattern = innerast.KindObjectBindingPattern
  KindArrayBindingPattern  = innerast.KindArrayBindingPattern
  KindOmittedExpression    = innerast.KindOmittedExpression

  // Expressions
  KindArrayLiteralExpression      = innerast.KindArrayLiteralExpression
  KindArrowFunction               = innerast.KindArrowFunction
  KindAsExpression                = innerast.KindAsExpression
  KindAwaitExpression             = innerast.KindAwaitExpression
  KindBinaryExpression            = innerast.KindBinaryExpression
  KindConditionalExpression       = innerast.KindConditionalExpression
  KindDeleteExpression            = innerast.KindDeleteExpression
  KindElementAccessExpression     = innerast.KindElementAccessExpression
  KindFunctionExpression          = innerast.KindFunctionExpression
  KindNewExpression               = innerast.KindNewExpression
  KindNonNullExpression           = innerast.KindNonNullExpression
  KindObjectLiteralExpression     = innerast.KindObjectLiteralExpression
  KindParenthesizedExpression     = innerast.KindParenthesizedExpression
  KindPostfixUnaryExpression      = innerast.KindPostfixUnaryExpression
  KindPropertyAssignment          = innerast.KindPropertyAssignment
  KindShorthandPropertyAssignment = innerast.KindShorthandPropertyAssignment
  KindSpreadAssignment            = innerast.KindSpreadAssignment
  KindSpreadElement               = innerast.KindSpreadElement
  KindTaggedTemplateExpression    = innerast.KindTaggedTemplateExpression
  KindTemplateExpression          = innerast.KindTemplateExpression
  KindTemplateSpan                = innerast.KindTemplateSpan
  KindTypeAssertionExpression     = innerast.KindTypeAssertionExpression
  KindTypeOfExpression            = innerast.KindTypeOfExpression
  KindVoidExpression              = innerast.KindVoidExpression
  KindYieldExpression             = innerast.KindYieldExpression
  KindRegularExpressionLiteral    = innerast.KindRegularExpressionLiteral
  KindSatisfiesExpression         = innerast.KindSatisfiesExpression

  // Keywords / tokens used by rules
  KindThisKeyword                  = innerast.KindThisKeyword
  KindSuperKeyword                 = innerast.KindSuperKeyword
  KindEqualsToken                  = innerast.KindEqualsToken
  KindEqualsEqualsToken            = innerast.KindEqualsEqualsToken
  KindEqualsEqualsEqualsToken      = innerast.KindEqualsEqualsEqualsToken
  KindExclamationEqualsToken       = innerast.KindExclamationEqualsToken
  KindExclamationEqualsEqualsToken = innerast.KindExclamationEqualsEqualsToken
  KindLessThanToken                = innerast.KindLessThanToken
  KindGreaterThanToken             = innerast.KindGreaterThanToken
  KindLessThanEqualsToken          = innerast.KindLessThanEqualsToken
  KindGreaterThanEqualsToken       = innerast.KindGreaterThanEqualsToken
  KindPlusToken                    = innerast.KindPlusToken
  KindPlusEqualsToken              = innerast.KindPlusEqualsToken
  KindMinusEqualsToken             = innerast.KindMinusEqualsToken
  KindAsteriskToken                = innerast.KindAsteriskToken
  KindSlashToken                   = innerast.KindSlashToken
  KindAmpersandAmpersandToken      = innerast.KindAmpersandAmpersandToken
  KindBarBarToken                  = innerast.KindBarBarToken
  KindQuestionQuestionToken        = innerast.KindQuestionQuestionToken
  KindExclamationToken             = innerast.KindExclamationToken
  KindTildeToken                   = innerast.KindTildeToken
  KindInKeyword                    = innerast.KindInKeyword
  KindInstanceOfKeyword            = innerast.KindInstanceOfKeyword
  KindAsKeyword                    = innerast.KindAsKeyword
  KindPlusPlusToken                = innerast.KindPlusPlusToken
  KindMinusMinusToken              = innerast.KindMinusMinusToken
  KindDotToken                     = innerast.KindDotToken

  // Bitwise / shift / exponent operator tokens — needed by
  // no-bitwise, prefer-exponentiation-operator, etc.
  KindAmpersandToken                               = innerast.KindAmpersandToken
  KindBarToken                                     = innerast.KindBarToken
  KindCaretToken                                   = innerast.KindCaretToken
  KindLessThanLessThanToken                        = innerast.KindLessThanLessThanToken
  KindGreaterThanGreaterThanToken                  = innerast.KindGreaterThanGreaterThanToken
  KindGreaterThanGreaterThanGreaterThanToken       = innerast.KindGreaterThanGreaterThanGreaterThanToken
  KindAsteriskAsteriskToken                        = innerast.KindAsteriskAsteriskToken
  KindAmpersandAmpersandEqualsToken                = innerast.KindAmpersandAmpersandEqualsToken
  KindBarBarEqualsToken                            = innerast.KindBarBarEqualsToken
  KindQuestionQuestionEqualsToken                  = innerast.KindQuestionQuestionEqualsToken
  KindAsteriskEqualsToken                          = innerast.KindAsteriskEqualsToken
  KindSlashEqualsToken                             = innerast.KindSlashEqualsToken
  KindPercentEqualsToken                           = innerast.KindPercentEqualsToken
  KindAsteriskAsteriskEqualsToken                  = innerast.KindAsteriskAsteriskEqualsToken
  KindAmpersandEqualsToken                         = innerast.KindAmpersandEqualsToken
  KindBarEqualsToken                               = innerast.KindBarEqualsToken
  KindCaretEqualsToken                             = innerast.KindCaretEqualsToken
  KindLessThanLessThanEqualsToken                  = innerast.KindLessThanLessThanEqualsToken
  KindGreaterThanGreaterThanEqualsToken            = innerast.KindGreaterThanGreaterThanEqualsToken
  KindGreaterThanGreaterThanGreaterThanEqualsToken = innerast.KindGreaterThanGreaterThanGreaterThanEqualsToken
  KindCommaToken                                   = innerast.KindCommaToken
  KindQuestionToken                                = innerast.KindQuestionToken

  // Metaprogramming / privacy / async syntax
  KindMetaProperty                = innerast.KindMetaProperty
  KindPrivateIdentifier           = innerast.KindPrivateIdentifier
  KindClassStaticBlockDeclaration = innerast.KindClassStaticBlockDeclaration

  // Misc syntax used by suggestion rules
  KindSymbolKeyword = innerast.KindSymbolKeyword
  KindObjectKeyword = innerast.KindObjectKeyword

  // Modifier-style keywords
  KindAsyncKeyword    = innerast.KindAsyncKeyword
  KindAwaitKeyword    = innerast.KindAwaitKeyword
  KindReadonlyKeyword = innerast.KindReadonlyKeyword
  KindStaticKeyword   = innerast.KindStaticKeyword
  KindAbstractKeyword = innerast.KindAbstractKeyword
  KindExportKeyword   = innerast.KindExportKeyword
  KindDeclareKeyword  = innerast.KindDeclareKeyword
  KindModuleKeyword   = innerast.KindModuleKeyword
  KindTypeKeyword     = innerast.KindTypeKeyword

  // TypeScript-specific kinds used by ts rules
  KindCallSignature      = innerast.KindCallSignature
  KindConstructSignature = innerast.KindConstructSignature
  KindTypeQuery          = innerast.KindTypeQuery
  KindTypeOperator       = innerast.KindTypeOperator
)

// ---- Comment-directive kind constants ----

const (
  CommentDirectiveKindIgnore      = innerast.CommentDirectiveKindIgnore
  CommentDirectiveKindExpectError = innerast.CommentDirectiveKindExpectError
)

// ---- Helpers ----

// GetCombinedNodeFlags gathers declaration flags using the compiler's root
// declaration and parent-list traversal. Pass a non-nil declaration from a
// parent-linked compiler tree so enclosing variable flags can be included.
//
// @evidence contracts/common.md#principled-implementation Delegation preserves upstream root-declaration traversal and flag combination instead of classifying a variable by its own flags alone.
// @evidence contracts/common.md#clear-and-simple-design One forwarding call exposes the compiler's combined flags without duplicating declaration traversal in lint consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The helper uses the pinned compiler implementation without synthetic parent repair or consumer-specific flag overrides.
// @evidence contracts/common.md#meaningful-documentation Native prose states non-nil input and parent-link requirements; the tag block follows a blank comment line under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetCombinedNodeFlags acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim selects no independent traversal strategy. Upstream walks H enclosing binding elements, then combines at most three declaration/list/statement flag values; the call costs O(H) and creates no traversal collection.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This forwarding call coordinates no cache or in-flight work; compiler-tree owners determine when node flags and parent links may be reused.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetCombinedNodeFlags computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func GetCombinedNodeFlags(node *Node) NodeFlags {
  return innerast.GetCombinedNodeFlags(node)
}

// IsConstAssertion recognizes an `as const` or `<const>` assertion by its
// syntax. Pass a non-nil compiler node; recognition does not validate whether
// the asserted expression is permitted in a const assertion.
//
// @evidence contracts/common.md#principled-implementation Upstream classification requires an assertion expression whose type is a const reference without type arguments, preserving syntactic recognition rather than asserting semantic validity.
// @evidence contracts/common.md#clear-and-simple-design A single forwarding predicate keeps const-assertion syntax classification with the compiler that owns it.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler node classification replaces textual matching and supplies no fixture-specific or semantic-validation bypass.
// @evidence contracts/common.md#meaningful-documentation Native prose states syntax-only recognition and the non-nil input condition, with prose and tags separated following the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsConstAssertion acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsConstAssertion performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsConstAssertion computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsConstAssertion computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsConstAssertion(node *Node) bool { return innerast.IsConstAssertion(node) }

// IsPartOfTypeNode applies the compiler's context-sensitive type-node
// classifier. Pass a non-nil node with compiler parent links. Type-query
// operands and class extends expressions are distinguished from ordinary
// type positions; this is not a recursive test for any type-related ancestor.
//
// @evidence contracts/common.md#principled-implementation Upstream kind and parent-position checks preserve distinctions between type positions, type-query operands and value-bearing class heritage expressions.
// @evidence contracts/common.md#clear-and-simple-design A forwarding predicate centralizes context classification without a separate recursive shim ancestry rule.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The wrapper retains compiler position semantics rather than broadening recognition to silence rule reports.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies parent-link requirements and important classification boundaries, using a separated tag block as the documentation skill requires.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsPartOfTypeNode acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsPartOfTypeNode performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsPartOfTypeNode computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsPartOfTypeNode computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsPartOfTypeNode(node *Node) bool { return innerast.IsPartOfTypeNode(node) }

// IsLet reports whether a declaration's combined flags contain the let bit.
// Pass a non-nil declaration from a parent-linked compiler tree. A plain
// using declaration carries a different bit and does not satisfy this test.
//
// @evidence contracts/common.md#principled-implementation Testing the compiler's Let bit after combined declaration traversal recognizes let declarations without equating resource declarations with let.
// @evidence contracts/common.md#clear-and-simple-design The helper expresses one declaration-keyword predicate through the shared flag combiner and one mask.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The mask is the upstream Let constant, with no name-based declaration exception or compensating flag mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose states input provenance and the using distinction, followed by separated tags under the documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsLet acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsLet performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsLet computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsLet computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsLet(node *Node) bool { return GetCombinedNodeFlags(node)&NodeFlagsLet != 0 }

// IsConst reports whether a declaration's combined flags contain the const
// bit. Pass a non-nil declaration from a parent-linked compiler tree. The
// pinned compiler also sets this bit for await using, but not plain using;
// this predicate therefore does not mean every immutable declaration.
//
// @evidence contracts/common.md#principled-implementation The combined-flags Const mask preserves the pinned compiler encoding, including await using while excluding plain using.
// @evidence contracts/common.md#clear-and-simple-design One mask answers the existing const-bit question without introducing a competing resource-declaration classifier.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The helper reads the upstream Const bit without widening its result through consumer-specific exceptions or altered foreign flags.
// @evidence contracts/common.md#meaningful-documentation Native prose makes the const-bit versus immutable-declaration distinction explicit and states tree requirements, with a separate tag block following documentation guidance.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsConst acquires no handle, buffer or cache and retains nothing after it returns.
// @evidence contracts/performance.md#efficient-algorithms One Const-bit test follows the shared combined-flags helper. Its upstream root search follows H binding parents and then reads at most three declaration/list/statement flag values, costing O(H) time and O(1) temporary space without collecting ancestors.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This mask query owns no completed-result cache or in-flight coordination; compiler-tree owners determine whether declaration flags and parent links remain valid across calls.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsConst computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsConst(node *Node) bool { return GetCombinedNodeFlags(node)&NodeFlagsConst != 0 }

// IsVar recognizes a var declaration by absence of combined block-scoped
// bits, including let, const and using bits. Pass a non-nil variable
// declaration from a parent-linked compiler tree; an arbitrary unflagged
// syntax node is not a valid declaration input to this predicate.
//
// @evidence contracts/common.md#principled-implementation For variable declarations, the upstream BlockScoped mask distinguishes var from all compiler block-scoped declaration encodings after parent flags are combined.
// @evidence contracts/common.md#clear-and-simple-design A single complement-mask test shares parent traversal with the other declaration predicates.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The compiler BlockScoped mask covers resource declarations without invented keyword strings or fixture-specific fallback classification.
// @evidence contracts/common.md#meaningful-documentation Native prose states the variable-declaration precondition and why unrelated unflagged nodes are unsuitable, followed by tags separated under the documentation skill.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IsVar acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms IsVar performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IsVar computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IsVar computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func IsVar(node *Node) bool { return GetCombinedNodeFlags(node)&NodeFlagsBlockScoped == 0 }
