// @ttsc-corpus-clean: promise/prefer-catch
Promise.resolve(1).then(value => value).catch(error => console.error(error));
