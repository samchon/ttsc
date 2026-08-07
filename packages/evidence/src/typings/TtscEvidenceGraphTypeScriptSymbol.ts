/**
 * A public TypeScript contract kind that can become an evidence unit or a
 * selected host for ownership evidence.
 *
 * The selector is intentionally semantic rather than a list of AST node names:
 * `"function"` includes the common ways a project exports callable behavior,
 * and qualified identities keep nested contracts addressable without adding a
 * file path to every target.
 *
 * - `"type"` selects exported interfaces, type aliases, and namespaces. Classes
 *   and enums do not become type units.
 * - `"function"` selects exported function declarations, exported `const`
 *   variables initialized with an arrow function or function expression
 *   (including parentheses and type-only expression wrappers), public instance
 *   and static methods of exported classes, function-valued public class fields
 *   (an arrow/function initializer or direct function type), and the same
 *   callable forms exported from namespaces. Constructors and accessors are not
 *   selected.
 * - `"property"` selects property signatures declared directly by exported
 *   interfaces and object-shaped type aliases, plus exported `const`, `let`,
 *   and `var` declarations at module or namespace scope. A `const` initialized
 *   with an arrow or function expression remains a function; every other
 *   variable, including a function-typed declaration or function-valued `let`
 *   or `var`, is a property. Every exported leaf in an object or array binding
 *   pattern is a property. Class fields and methods are not property units.
 *
 * TypeScript units form containment scopes. An interface or object-shaped type
 * alias contains its selected properties. A namespace contains every selected
 * public unit nested below it, including nested namespaces. An `@evidence`
 * target, unless its reference sets `noAggregateEvidence`, and an
 * `@evidenceExclude` target allowed by its reference policy acknowledge the
 * selected node and every selected descendant. A reference selector defines the
 * obligation kinds while their unselected type ancestors remain addressable as
 * aggregate scopes.
 *
 * Top-level identities use the public export name, and namespace members
 * prepend their namespace, such as `Orders.create`. A namespace itself uses its
 * qualified name, such as `Orders` or `Outer.Inner`. A local declaration
 * exposed as `export { Local as Public }` therefore uses `Public`. A named
 * default declaration keeps its declaration name; anonymous and default-only
 * aliases have no stable target and are not selected. Members of an ambient
 * namespace are public without their own `export` modifier. A type-only
 * namespace alias exposes the namespace, its public type-space descendants, and
 * their type properties without exposing data, functions, or class callables.
 * Type properties use `TypeName.property`. Static class callables use
 * `ClassName.method`; instance callables use `ClassName.prototype.method`.
 * Computed names are not selected, even when their expression is a literal.
 * Literal names must be whitespace-free because a declaration target is one
 * whitespace-delimited token. A dot inside a literal name is rendered
 * unchanged; if that spelling collides with qualification, the target is
 * ambiguous.
 *
 * These targets deliberately omit file paths. If selected files expose the same
 * qualified target, a declaration using that target is ambiguous; rename or
 * further qualify the public symbols. A re-export whose declaration lives in
 * another file does not create a second unit in the barrel file. TypeScript
 * target characters are matched exactly; Markdown path-separator normalization
 * does not rewrite literal symbol names.
 *
 * Every supported public declaration described here may carry
 * `@evidenceExclude` when its file belongs to a claim, even when that claim's
 * selector omits its kind. The selector still controls `@evidence`; an
 * unsupported or unexported declaration carries neither form.
 */
export type TtscEvidenceGraphTypeScriptSymbol =
  | "type"
  | "function"
  | "property";
