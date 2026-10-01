// @ttsc-corpus-clean: promise/prefer-await-to-then
async function f() { await Promise.resolve(1); }
