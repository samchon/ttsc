// @ttsc-corpus-clean: promise/no-multiple-resolved
new Promise((resolve, reject) => { resolve(1); }); new Promise((resolve, reject) => {});
