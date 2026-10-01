import { message } from "@lib/message";
export type ImportedMessage = import("@lib/message").Message;
export const value = message;
