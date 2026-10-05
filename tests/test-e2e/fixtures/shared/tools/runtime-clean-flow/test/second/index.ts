declare function require(id: string): any;
const invalid: string = 123;
require("node:fs").writeFileSync((globalThis as any).process.env.TTSC_E2E_REGISTER_MARKER, invalid);
export {};
