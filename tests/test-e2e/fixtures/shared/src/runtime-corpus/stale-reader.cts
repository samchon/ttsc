declare const require: (id: string) => { tool: string };
export const observed = require("root-pkg/stale.ts").tool;
