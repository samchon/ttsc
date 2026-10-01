declare const require: (id: string) => unknown;
import { message } from "@lib/message";
import { exact } from "@lib/exact";
import { index } from "@pkg";
export { message } from "@lib/message";
export type { MessageBox } from "@lib/message";
export type ImportedBox = import("@lib/message").MessageBox;
export const loaded = require("@lib/message");
export const value = message + ":" + exact + ":" + index;
export async function loadMessage(): Promise<string> {
  return (await import("@lib/message")).message;
}
declare module "@lib/message" {
  export const augmented: string;
}
