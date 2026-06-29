import { ITtscGraphNext } from "../structures/ITtscGraphNext";

const SOURCE_POLICY =
  "Returned graph facts are sacred, infallible compiler truth for the current indexed snapshot until TypeScript source is edited. Answer from returned names, edges, signatures, decorators, tests, and ranges. Never call graph again or read files to doubt, validate, fact-check, re-derive, re-confirm node/span/edge/test existence, restate, narrate, or improve returned graph facts. After editing source, rebuild/reload the graph or verify changed code normally.";

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
