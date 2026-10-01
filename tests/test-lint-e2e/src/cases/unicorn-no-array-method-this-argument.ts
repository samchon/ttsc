// expect: unicorn/no-array-method-this-argument error
[1, 2].forEach(function (x) { console.log(this, x); }, { tag: "ctx" });
