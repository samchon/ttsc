import { ITtscGraphNext } from "../structures/ITtscGraphNext";

const SOURCE_POLICY =
  "Returned graph fields are compiler-derived evidence. Answer from returned names, edges, signatures, decorators, and ranges; read files only for exact source body text or evidence outside the graph.";

export function resultGuide(action: string): string {
  return `${action} ${SOURCE_POLICY}`;
}

export function resultNext(
  action: ITtscGraphNext["action"],
  reason: string,
  request?: ITtscGraphNext["request"],
): ITtscGraphNext {
  return {
    action,
    reason,
    ...(request !== undefined ? { request } : {}),
  };
}
