/**
 * The operation a request expects a reply for. The host answers a transform
 * request (`{"file":...}`) with `{"typescript":...,"found":...}` and an update
 * request (`{"update":...,"content":...}`) with `{"updated":...}`. The client
 * knows which it sent, so it validates the reply's shape against the operation
 * before handing it back — a well-formed JSON object of the wrong operation
 * shape is a protocol error, not a valid negative result.
 */
export type ResidentReplyKind = "transform" | "update";
