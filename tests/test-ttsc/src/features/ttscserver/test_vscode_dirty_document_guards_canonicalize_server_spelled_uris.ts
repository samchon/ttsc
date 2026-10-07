import assert from "node:assert/strict";

import {
  type NormalizedTextEdit,
  commandArgumentsContainDirtyURI,
  workspaceEditChangesTouchDirtyURI,
} from "../../../../../packages/vscode/src/commandEdits";

/**
 * Verifies the dirty-document guards compare a URI after the supplied
 * canonicalizer, so a server's spelling of a document and the editor's spelling
 * name the same dirty document, and that without a canonicalizer the spelling
 * is compared exactly as written.
 *
 * A language server writes `file:///C:/x` where VS Code spells the same file
 * `file:///c%3A/x`. A guard that compared the raw strings would let a command
 * overwrite unsaved text, so the extension passes a canonicalizer that spells a
 * URI the way the editor does. The guards themselves stay pure: the default
 * leaves every string unchanged, and the callback is applied to every string of
 * a command argument, not only to ones that look like URIs.
 *
 * 1. Build a dirty set holding the editor spelling and the server spelling of a
 *    document, in a command argument and in a replacement list.
 * 2. Run both guards with no canonicalizer and with a drive-letter one.
 * 3. Run them against a clean document that only shares a prefix.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls commandArgumentsContainDirtyURI and workspaceEditChangesTouchDirtyURI on nested arguments and replacement records with and without a canonicalizer and asserts the boolean each returns, so a guard that skipped the callback or applied it only at the top level fails.
 * @evidence contracts/testing.md#independent-expectations The two spellings `file:///C:/x` and `file:///c%3A/x` and the VS Code rule that a drive letter is lowercased with its colon percent-encoded are literals written from the editor's documented URI form, and the in-test canonicalizer is authored from that rule, not taken from the extension.
 * @evidence contracts/testing.md#distinguishing-cases The server spelling matches only with the canonicalizer and not by default; the editor spelling matches both ways; a different document and a spelling that merely shares the prefix never match; a nested argument and a replacement list are both covered.
 * @evidence contracts/testing.md#execution-ownership Pure unit over the exported guards with authored data in the test-ttsc runner; no VS Code host, language client or process runs. The extension's own canonicalizer (`Uri.parse(...).toString()`) needs the editor API and is not exercised here.
 */
export function test_vscode_dirty_document_guards_canonicalize_server_spelled_uris(): void {
  const editor = "file:///c%3A/x";
  const server = "file:///C:/x";
  const dirty = new Set([editor]);
  const drive = (uri: string): string =>
    uri.replace(
      /^file:\/\/\/([A-Za-z]):/,
      (_match, letter: string) => `file:///${letter.toLowerCase()}%3A`,
    );

  const argumentsOf = (uri: string) => [{ nested: [{ target: uri }] }, 7];
  assert.equal(
    commandArgumentsContainDirtyURI(argumentsOf(editor), dirty),
    true,
    "the editor spelling matches without a canonicalizer",
  );
  assert.equal(
    commandArgumentsContainDirtyURI(argumentsOf(server), dirty),
    false,
    "by default the server spelling is compared as written",
  );
  assert.equal(
    commandArgumentsContainDirtyURI(argumentsOf(server), dirty, drive),
    true,
    "a canonicalizer makes the server spelling the same document",
  );
  assert.equal(
    commandArgumentsContainDirtyURI(argumentsOf("file:///C:/y"), dirty, drive),
    false,
    "a different document stays clean after canonicalization",
  );
  assert.equal(
    commandArgumentsContainDirtyURI(argumentsOf("file:///C:/xy"), dirty, drive),
    false,
    "a spelling that merely shares a prefix stays clean",
  );

  const edit = (uri: string): NormalizedTextEdit => ({
    newText: "t",
    range: {
      end: { character: 1, line: 0 },
      start: { character: 0, line: 0 },
    },
    uri,
  });
  assert.equal(workspaceEditChangesTouchDirtyURI([edit(editor)], dirty), true);
  assert.equal(
    workspaceEditChangesTouchDirtyURI([edit(server)], dirty),
    false,
    "by default a replacement under the server spelling is compared as written",
  );
  assert.equal(
    workspaceEditChangesTouchDirtyURI(
      [edit("file:///C:/y"), edit(server)],
      dirty,
      drive,
    ),
    true,
    "a canonicalizer exposes a replacement hidden by the server spelling",
  );
  assert.equal(
    workspaceEditChangesTouchDirtyURI([edit("file:///C:/y")], dirty, drive),
    false,
  );
  assert.equal(workspaceEditChangesTouchDirtyURI([], dirty, drive), false);
}
