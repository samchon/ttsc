import data from "../data.json" with { type: "json" };
let disposal: Disposable | undefined;
void disposal;
if (false) {
  // @ts-expect-error The explicitly selected ESNext library contains no DOM.
  document.title = "forbidden";
}
export const proposalValue = data.answer;
export const startupMarkers = ["ran", "entry-ran", "ENTRY", "explicit-runner-project"];
export function mainMessage(): string { const value: string = "value"; return "main:" + value; }
export function optional(value?: { answer: number }): number | undefined { return value?.answer; }
export const optionalChainPreserved = optional.toString().includes("?.");
