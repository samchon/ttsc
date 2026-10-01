
new RegExp("^[a-z]+$");
// expect: security/detect-non-literal-regexp error
new RegExp(pattern);
