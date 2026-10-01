// @ttsc-corpus-filename: src\paths\windows-separators.ts
// expect: no-var error
var legacy = 1;
const current = 2;
JSON.stringify([legacy, current]);
