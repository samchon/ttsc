// @ttsc-corpus-clean: promise/always-return
Promise.resolve(1).then(() => { if (ok) { return 1; } else { return 2; } });
