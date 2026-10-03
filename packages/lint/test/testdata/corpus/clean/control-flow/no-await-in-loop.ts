// @ttsc-corpus-clean: no-await-in-loop
async function once() { await Promise.resolve(1); }
