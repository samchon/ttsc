export type ProtocolPosition = {
  character: number;
  line: number;
};

export type ProtocolRange = {
  end: ProtocolPosition;
  start: ProtocolPosition;
};

export type NormalizedTextEdit = {
  newText: string;
  range: ProtocolRange;
  uri: string;
};

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

export function commandArgumentsContainDirtyURI(
  args: readonly unknown[],
  dirtyURIs: ReadonlySet<string>,
): boolean {
  return args.some((value) => valueContainsDirtyURI(value, dirtyURIs));
}

export function workspaceEditChangesTouchDirtyURI(
  edits: readonly NormalizedTextEdit[],
  dirtyURIs: ReadonlySet<string>,
): boolean {
  return edits.some((edit) => dirtyURIs.has(edit.uri));
}

export function shouldApplyCommandWorkspaceEdit(
  command: string,
  commandPrefix: string,
): boolean {
  return commandPrefix !== "" && command.startsWith(commandPrefix);
}

function valueContainsDirtyURI(
  value: unknown,
  dirtyURIs: ReadonlySet<string>,
): boolean {
  if (typeof value === "string") {
    return dirtyURIs.has(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => valueContainsDirtyURI(item, dirtyURIs));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) =>
      valueContainsDirtyURI(item, dirtyURIs),
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
