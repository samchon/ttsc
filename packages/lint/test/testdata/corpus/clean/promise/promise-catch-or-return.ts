// @ttsc-corpus-clean: promise/catch-or-return
Promise.resolve(1).then(value => value).catch(error => console.error(error)); function f() { return Promise.resolve(1).then(value => value); }
