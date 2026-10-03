// expect: unicorn/no-object-as-default-parameter error
function f(opts = { tag: "default" }) { void opts; }
