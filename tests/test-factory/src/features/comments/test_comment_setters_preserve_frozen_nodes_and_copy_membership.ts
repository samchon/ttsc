import assert from "node:assert/strict";

import factory, {
  SyntaxKind,
  getSyntheticLeadingComments,
  getSyntheticTrailingComments,
  setSyntheticLeadingComments,
  setSyntheticTrailingComments,
} from "../../../../../packages/factory/src/index";
import type { SynthesizedComment } from "../../../../../packages/factory/src/index";
import { print } from "../../internal/helpers";

/**
 * Verifies comment replacement preserves frozen nodes and copies array
 * membership.
 *
 * Comment records remain shared, while changing the caller's array must not
 * replace or append stored members. Both attachment stores have that contract.
 *
 * 1. Attach leading and trailing arrays to a frozen identifier and check identity.
 * 2. Change caller array membership and one shared record, then check payloads and
 *    output.
 * 3. Clear with the complementary empty and undefined representations.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls both synthetic comment setters/getters and TsPrinter.print on a frozen identifier. Literal payloads and printed text distinguish shallow copying from retained caller arrays, deep copying, store mixing or attempted node mutation.
 * @evidence contracts/testing.md#independent-expectations The documented shallow-copy contract requires original ordered membership with the shared record's changed text. Authored payload arrays and literal comment delimiters establish the expectation without reading factory state to compute it.
 * @evidence contracts/testing.md#distinguishing-cases Both leading and trailing stores receive a singleton, caller replacement and append cannot change stored membership, record mutation remains visible, and empty leading/undefined trailing clear complement the inverse clearing inputs in comment_accessors_roundtrip.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the matching factory feature export. It calls owning source operations in one Node process without native artifacts, installation or product hosts.
 */
export const test_comment_setters_preserve_frozen_nodes_and_copy_membership =
  (): void => {
    const node = Object.freeze(factory.createIdentifier("x"));
    const leading: SynthesizedComment[] = [
      { kind: SyntaxKind.MultiLineCommentTrivia, text: " before " },
    ];
    const trailing: SynthesizedComment[] = [
      { kind: SyntaxKind.MultiLineCommentTrivia, text: " after " },
    ];
    assert.equal(setSyntheticLeadingComments(node, leading), node);
    assert.equal(setSyntheticTrailingComments(node, trailing), node);
    const leadingRecord = leading[0]!;
    const trailingRecord = trailing[0]!;
    leading[0] = {
      kind: SyntaxKind.SingleLineCommentTrivia,
      text: " replacement",
    };
    trailing.push({ kind: SyntaxKind.SingleLineCommentTrivia, text: " extra" });
    leadingRecord.text = " changed ";
    trailingRecord.text = " updated ";
    assert.deepEqual(getSyntheticLeadingComments(node), [
      { kind: SyntaxKind.MultiLineCommentTrivia, text: " changed " },
    ]);
    assert.deepEqual(getSyntheticTrailingComments(node), [
      { kind: SyntaxKind.MultiLineCommentTrivia, text: " updated " },
    ]);
    assert.equal(print(node), "/* changed */ x /* updated */");
    assert.equal(setSyntheticLeadingComments(node, []), node);
    assert.equal(setSyntheticTrailingComments(node, undefined), node);
    assert.equal(getSyntheticLeadingComments(node), undefined);
    assert.equal(getSyntheticTrailingComments(node), undefined);
    assert.equal(print(node), "x");
  };
