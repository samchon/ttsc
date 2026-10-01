// @ttsc-corpus-clean: unicorn/no-array-method-this-argument
[1, 2].forEach(function (x) { console.log(this, x); });
