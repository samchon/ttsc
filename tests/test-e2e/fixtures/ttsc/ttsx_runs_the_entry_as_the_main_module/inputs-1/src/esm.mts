import { helperMain } from "./helper.mjs";
const main: unknown = (import.meta as { main?: unknown }).main;
console.log(JSON.stringify({ main, helperMain }));
