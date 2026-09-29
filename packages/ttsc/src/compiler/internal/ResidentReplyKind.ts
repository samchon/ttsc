/**
 * The operation a request expects a reply for. The host answers a transform
 * request (`{"file":...}`) with `{"typescript":...,"found":...}` and an update
 * request (`{"update":...,"content":...}`) with `{"updated":...}`. The client
 * knows which it sent, so it validates the reply's shape against the operation
 * before handing it back — a well-formed JSON object of the wrong operation
 * shape is a protocol error, not a valid negative result.
 *
 * @evidence contracts/common.md#principled-implementation The two literal operations identify their distinct reply schemas, allowing a negative domain answer to remain distinguishable from an invalid operation-shaped reply.
 * @evidence contracts/common.md#clear-and-simple-design A closed discriminant union carries the operation needed for validation without storing a second mutable request object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Operation discriminants are protocol-defined values, not hardcoded consumer identities or expected results.
 * @evidence contracts/common.md#meaningful-documentation The native paragraph gives both wire forms and explains why shape validation matters, following the documentation skill.
 */
export type ResidentReplyKind = "transform" | "update";
