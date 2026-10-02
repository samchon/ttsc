/**
 * An LSP position with zero-based line and UTF-16 character offsets.
 *
 * The editor protocol counts UTF-16 characters, so these values cannot be
 * read as compiler UTF-8 byte offsets.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Separate numeric line and character fields preserve the LSP's two
 *   zero-based coordinates. isProtocolPosition checks integer/nonnegative
 *   values before unknown replies enter the editor conversion path.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This coordinate record contains only the two protocol components; it
 *   leaves validation to the collector instead of adding state to each value.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc identifies zero-based lines and UTF-16 character offsets,
 *   and the type comment explains why compiler byte offsets differ. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export type ProtocolPosition = {
  /** Zero-based UTF-16 offset within the line. */
  character: number;

  /** Zero-based line number in the command's source snapshot. */
  line: number;
};

/**
 * An LSP range from an inclusive start to an exclusive end.
 *
 * A range must be ordered; this type stores the endpoints while the
 * collector validates their shape.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Start and end use the same UTF-16 position representation. The collector
 *   enforces lexicographic ordering, including an equal-endpoint insertion.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Two named endpoints expose the range directly; shared position validation
 *   avoids a second coordinate policy in the range record.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc identifies inclusive start and exclusive end; the type
 *   comment explains ordering and the collector validation boundary. Purpose,
 *   conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export type ProtocolRange = {
  /** Exclusive endpoint in the same document as start. */
  end: ProtocolPosition;

  /** Inclusive starting position. */
  start: ProtocolPosition;
};

/**
 * One replacement with its document URI, LSP range and replacement text.
 *
 * The URI remains a protocol URI so filesystem paths are not accidentally
 * interpreted as editor document identifiers.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Keeping the document URI with its ordered range and text preserves each
 *   LSP changes-map replacement when the map is flattened. Empty text remains
 *   a deletion and an equal-endpoint range remains an insertion.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One self-contained replacement record separates reply decoding from
 *   constructing VS Code edits without retaining the unknown payload.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation follows the documented consumer contract; its fields do
 *   not introduce fixture-selected variants.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc distinguishes protocol URI identity, ordered saved-source
 *   ranges and empty-text deletion; the type comment explains why native
 *   paths are not document URIs. Purpose, conditions and reasons use separate
 *   native paragraphs under the documentation skill; member comments remain
 *   beside their fields.
 */
export type NormalizedTextEdit = {
  /** Replacement text; an empty string deletes the covered range. */
  newText: string;

  /** Ordered range in the command's saved-source snapshot. */
  range: ProtocolRange;

  /** Protocol document URI, not a native filesystem path. */
  uri: string;
};

/**
 * Collect valid text replacements from a WorkspaceEdit changes map, or
 * return undefined when that map is absent or invalid.
 *
 * Malformed rows are skipped. Positions must be nonnegative integers in
 * order and newText must be a string; an empty valid map returns an empty
 * array. This normalizes the changes form only, not documentChanges or
 * resource operations.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Object.entries and array iteration decode the supported LSP changes form.
 *   Integer/order predicates validate ranges and string checks preserve
 *   replacement text.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The collector owns map iteration; small predicates own positions, range
 *   order and text decoding. Editor conversion remains outside this module.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The operation returns owned records without writing documents, parsing
 *   error messages or replacing VS Code methods.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states absent/invalid-map results, row-skipping behavior,
 *   integer/range validation and the unsupported
 *   documentChanges/resource-operation forms. Purpose, conditions and reasons
 *   use separate native paragraphs under the documentation skill; member
 *   comments remain beside their fields.
 */
export function collectWorkspaceEditChanges(
  value: unknown,
): NormalizedTextEdit[] | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const changes = (value as { changes?: unknown }).changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return undefined;
  }
  const out: NormalizedTextEdit[] = [];
  for (const [uri, edits] of Object.entries(changes)) {
    if (!Array.isArray(edits)) {
      continue;
    }
    for (const edit of edits) {
      const range = protocolRange(edit);
      const newText = protocolNewText(edit);
      if (range && newText !== undefined) {
        out.push({ newText, range, uri });
      }
    }
  }
  return out;
}

/**
 * Return whether a JSON-shaped command argument contains a URI in the
 * supplied dirty-document set.
 *
 * Recursive arrays and object values can carry document targets. Every string
 * is passed through canonicalize before the exact set lookup, so a URI that a
 * server spelled differently from the editor still names the same document;
 * the default leaves strings unchanged. Inputs are acyclic protocol data; the
 * operation does not resolve paths or change documents.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Recursive Array.some/Object.values and exact Set membership inspect the
 *   command payload rather than special-casing argument positions.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One recursive helper handles nested values, while this entry point owns
 *   only the argument list and the caller-supplied dirty URI set.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   This pure guard makes no filesystem or foreign API changes and uses no
 *   test-mode branch.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states recursive acyclic JSON-shaped input, exact matching of the
 *   canonicalized string against the dirty-URI set and the absence of writes
 *   or native path resolution. Purpose, conditions and reasons use separate
 *   native paragraphs under the documentation skill; member comments remain
 *   beside their fields.
 */
export function commandArgumentsContainDirtyURI(
  args: readonly unknown[],
  dirtyURIs: ReadonlySet<string>,
  canonicalize: (uri: string) => string = keepSpelling,
): boolean {
  return args.some((value) =>
    valueContainsDirtyURI(value, dirtyURIs, canonicalize),
  );
}

/**
 * Return whether any collected replacement targets a supplied dirty-document
 * URI.
 *
 * Disk-backed command output must not overwrite unsaved editor text. Each
 * replacement URI is passed through canonicalize before the exact set lookup,
 * so a server spelling that differs from the editor spelling cannot hide a
 * dirty target; the default leaves URIs unchanged. This guard performs no
 * write.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Array.some implements existential membership in the exact dirty-URI set.
 *   It returns true as soon as a replacement could overwrite unsaved text.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This predicate checks normalized targets only. Argument decoding and
 *   editor writes remain separate so it has no hidden document side effects.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Decision values come from the documented inputs and product protocol
 *   rather than expected test answers. No compensating path is introduced to
 *   make a known example pass.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains canonicalized exact dirty-URI matching and why disk-backed
 *   replies must not overwrite unsaved text; it does not promise a versioned
 *   write.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export function workspaceEditChangesTouchDirtyURI(
  edits: readonly NormalizedTextEdit[],
  dirtyURIs: ReadonlySet<string>,
  canonicalize: (uri: string) => string = keepSpelling,
): boolean {
  return edits.some((edit) => dirtyURIs.has(canonicalize(edit.uri)));
}

/**
 * Return whether a command has this client root's nonempty command prefix.
 *
 * Server command namespaces isolate the replies this middleware applies; an
 * empty prefix never authorizes an edit.
 *
 * @evidence contracts/common.md#principled-implementation
 *   String.startsWith uses the server-announced root command namespace.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Prefix authorization is one pure predicate shared by middleware; command
 *   dispatch and edit application remain with their respective owners.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A nonempty-prefix guard prevents blanket application; this pure predicate
 *   does not patch command dispatch or special-case a fixture.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states nonempty root-prefix matching and explains client command
 *   isolation, including why an empty prefix cannot authorize application.
 *   Purpose, conditions and reasons use separate native paragraphs under the
 *   documentation skill; member comments remain beside their fields.
 */
export function shouldApplyCommandWorkspaceEdit(
  command: string,
  commandPrefix: string,
): boolean {
  return commandPrefix !== "" && command.startsWith(commandPrefix);
}

function keepSpelling(uri: string): string {
  return uri;
}

function valueContainsDirtyURI(
  value: unknown,
  dirtyURIs: ReadonlySet<string>,
  canonicalize: (uri: string) => string,
): boolean {
  if (typeof value === "string") {
    return dirtyURIs.has(canonicalize(value));
  }
  if (Array.isArray(value)) {
    return value.some((item) =>
      valueContainsDirtyURI(item, dirtyURIs, canonicalize),
    );
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) =>
      valueContainsDirtyURI(item, dirtyURIs, canonicalize),
    );
  }
  return false;
}

function protocolRange(value: unknown): ProtocolRange | undefined {
  const range = (value as { range?: unknown } | undefined)?.range;
  if (!range || typeof range !== "object") {
    return undefined;
  }
  const start = (range as { start?: unknown }).start;
  const end = (range as { end?: unknown }).end;
  if (!isProtocolPosition(start) || !isProtocolPosition(end)) {
    return undefined;
  }
  if (!isOrderedRange(start, end)) {
    return undefined;
  }
  return { end, start };
}

function protocolNewText(value: unknown): string | undefined {
  const newText = (value as { newText?: unknown } | undefined)?.newText;
  return typeof newText === "string" ? newText : undefined;
}

function isProtocolPosition(value: unknown): value is ProtocolPosition {
  return (
    !!value &&
    typeof value === "object" &&
    Number.isInteger((value as { line?: unknown }).line) &&
    Number.isInteger((value as { character?: unknown }).character) &&
    (value as ProtocolPosition).line >= 0 &&
    (value as ProtocolPosition).character >= 0
  );
}

function isOrderedRange(
  start: ProtocolPosition,
  end: ProtocolPosition,
): boolean {
  return (
    start.line < end.line ||
    (start.line === end.line && start.character <= end.character)
  );
}
