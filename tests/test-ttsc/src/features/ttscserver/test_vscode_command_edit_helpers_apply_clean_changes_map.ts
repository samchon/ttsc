import assert from "node:assert/strict";
import * as mod from "../../../../../packages/vscode/src/commandEdits";

/**
 * Verifies VS Code command edit helpers recognize clean changes-map edits.
 *
 * Custom plugin commands registered by `vscode-languageclient` return raw LSP
 * `WorkspaceEdit` JSON. The extension's middleware must convert valid `changes`
 * entries and suppress application when either command arguments or returned
 * edit targets are dirty.
 *
 * 1. Call the authored command edit helper directly.
 * 2. Convert a `changes`-map result with valid and invalid edits.
 * 3. Check a null result and a result whose `changes` is an array are ignored.
 * 4. Assert dirty command arguments, dirty edit targets and command-prefix
 *    authorization (matching, foreign and empty prefix) are decided correctly.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls collectWorkspaceEditChanges, commandArgumentsContainDirtyURI, workspaceEditChangesTouchDirtyURI and shouldApplyCommandWorkspaceEdit and asserts the four collected edits (same-line, insertion, multiline, dirty-file) plus the boolean decisions.
 * @evidence contracts/testing.md#independent-expectations The input WorkspaceEdit is authored LSP JSON and the expected edit list, the undefined results and the booleans are literal values derived from the LSP range ordering rules and the dirty-set/prefix semantics, not computed by the helpers.
 * @evidence contracts/testing.md#distinguishing-cases Valid same-line, zero-width insertion and multiline edits are kept, while a range missing `character`, a negative line, a reversed multi-line range, a reversed same-line range and a non-array entry are dropped; null and `{changes: []}` give undefined; a nested dirty URI versus a clean URI, a changes list with and without the dirty file, and matching, foreign and empty command prefixes each give opposite answers.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttscserver; it calls the pure commandEdits functions directly on authored data, round-tripping the result through JSON before asserting, with no editor host, language client or child process.
 */
export async function test_vscode_command_edit_helpers_apply_clean_changes_map() {
  const cleanUri = "file:///clean.ts";
  const dirtyUri = "file:///dirty.ts";
  const actual = JSON.parse(JSON.stringify(await (async () => {
    const edit = {
      changes: {
        [cleanUri]: [
          {
            range: {
              start: { line: 0, character: 1 },
              end: { line: 0, character: 4 },
            },
            newText: "ok",
          },
          {
            range: { start: { line: 0 }, end: { line: 0, character: 4 } },
            newText: "skip",
          },
          {
            range: {
              start: { line: 2, character: 0 },
              end: { line: 2, character: 0 },
            },
            newText: "zero",
          },
          {
            range: {
              start: { line: 3, character: 1 },
              end: { line: 4, character: 0 },
            },
            newText: "multi",
          },
          {
            range: {
              start: { line: 5, character: 4 },
              end: { line: 5, character: 1 },
            },
            newText: "skip-same-line-reversed",
          },
        ],
        [dirtyUri]: [
          {
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 1 },
            },
            newText: "dirty",
          },
        ],
        "file:///ignored.ts": "not-an-array",
        "file:///negative.ts": [
          {
            range: {
              start: { line: -1, character: 0 },
              end: { line: 0, character: 1 },
            },
            newText: "skip-negative",
          },
        ],
        "file:///reversed.ts": [
          {
            range: {
              start: { line: 2, character: 0 },
              end: { line: 1, character: 0 },
            },
            newText: "skip-reversed",
          },
        ],
      },
    };
    const changes = mod.collectWorkspaceEditChanges(edit);
    assert.notEqual(changes, undefined);
    if (changes === undefined) throw new Error("Valid authored edits were not collected");
    return {
      changes,
      nullResult: mod.collectWorkspaceEditChanges(null),
      invalidResult: mod.collectWorkspaceEditChanges({ changes: [] }),
      dirtyArg: mod.commandArgumentsContainDirtyURI([
        { nested: [dirtyUri] },
      ], new Set([dirtyUri])),
      cleanArg: mod.commandArgumentsContainDirtyURI([
        cleanUri,
      ], new Set([dirtyUri])),
      dirtyEdit: mod.workspaceEditChangesTouchDirtyURI(
        changes,
        new Set([dirtyUri]),
      ),
      cleanEdit: mod.workspaceEditChangesTouchDirtyURI(
        changes.filter((entry) => entry.uri !== dirtyUri),
        new Set([dirtyUri]),
      ),
      prefixedCommand: mod.shouldApplyCommandWorkspaceEdit(
        "ttsc.vscode.root.ttsc.custom.fix",
        "ttsc.vscode.root.",
      ),
      unprefixedCommand: mod.shouldApplyCommandWorkspaceEdit(
        "tsgo.refactor.extract",
        "ttsc.vscode.root.",
      ),
      emptyPrefixCommand: mod.shouldApplyCommandWorkspaceEdit(
        "ttsc.vscode.root.ttsc.custom.fix",
        "",
      ),
    };
  })())) as {
    changes: Array<{
      newText: string;
      range: {
        end: { character: number; line: number };
        start: { character: number; line: number };
      };
      uri: string;
    }>;
    cleanArg: boolean;
    cleanEdit: boolean;
    dirtyArg: boolean;
    dirtyEdit: boolean;
    emptyPrefixCommand: boolean;
    invalidResult?: unknown;
    nullResult?: unknown;
    prefixedCommand: boolean;
    unprefixedCommand: boolean;
  };
  assert.deepEqual(actual.changes, [
    {
      newText: "ok",
      range: {
        end: { character: 4, line: 0 },
        start: { character: 1, line: 0 },
      },
      uri: cleanUri,
    },
    {
      newText: "zero",
      range: {
        end: { character: 0, line: 2 },
        start: { character: 0, line: 2 },
      },
      uri: cleanUri,
    },
    {
      newText: "multi",
      range: {
        end: { character: 0, line: 4 },
        start: { character: 1, line: 3 },
      },
      uri: cleanUri,
    },
    {
      newText: "dirty",
      range: {
        end: { character: 1, line: 1 },
        start: { character: 0, line: 1 },
      },
      uri: dirtyUri,
    },
  ]);
  assert.equal(actual.nullResult, undefined);
  assert.equal(actual.invalidResult, undefined);
  assert.equal(actual.dirtyArg, true);
  assert.equal(actual.cleanArg, false);
  assert.equal(actual.dirtyEdit, true);
  assert.equal(actual.cleanEdit, false);
  assert.equal(actual.prefixedCommand, true);
  assert.equal(actual.unprefixedCommand, false);
  assert.equal(actual.emptyPrefixCommand, false);
}