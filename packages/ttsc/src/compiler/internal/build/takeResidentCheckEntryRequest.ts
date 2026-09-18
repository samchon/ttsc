import { type ResidentCheckRequest } from "../ResidentCheckRequest";

/** Consume exactly one configured entry's buffered request. */
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
