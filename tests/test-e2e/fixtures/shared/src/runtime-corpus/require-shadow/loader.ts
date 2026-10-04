declare function require(id: string): { message: string };
export const loaded = require("@lib/message").message;
