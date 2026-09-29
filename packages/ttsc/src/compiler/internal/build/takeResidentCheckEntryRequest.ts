import { type ResidentCheckRequest } from "../ResidentCheckRequest";

/**
 * Transfer one entry's pending request out of the session buffer. A missing
 * slot throws rather than pretending the entry has no changes; requests for
 * other configured positions remain pending.
 *
 * @evidence contracts/common.md#principled-implementation Lookup followed by deletion transfers exactly the indexed request and rejects missing delivery state.
 * @evidence contracts/common.md#clear-and-simple-design One operation owns consumption so callers cannot read a request and forget to remove its buffer entry.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing state remains an error instead of being masked by an invented empty request.
 * @evidence contracts/common.md#meaningful-documentation Native prose specifies ownership transfer, missing-state failure and preservation of other positions.
 * @evidence contracts/performance.md#efficient-algorithms One map lookup and deletion consume the entry without traversing unrelated pending requests.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation transfers pending data and does not establish equivalence for shared computation.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Deletion releases the map's ownership before the request is returned; remaining slots stay owned by the session until their own consumption or reset.
 */
export function takeResidentCheckEntryRequest(
  pending: Map<number, ResidentCheckRequest>,
  entryIndex: number,
): ResidentCheckRequest {
  const request = pending.get(entryIndex);
  if (request === undefined) {
    throw new Error(
      `ttsc: resident check entry ${String(entryIndex)} has no buffered request`,
    );
  }
  pending.delete(entryIndex);
  return request;
}
