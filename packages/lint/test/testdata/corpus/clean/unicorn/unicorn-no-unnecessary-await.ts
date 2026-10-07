// @ttsc-corpus-clean: unicorn/no-unnecessary-await
async function f() { const x = await Promise.resolve(42); void x; }
