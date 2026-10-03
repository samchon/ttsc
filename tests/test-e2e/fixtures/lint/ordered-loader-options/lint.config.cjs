module.exports = {
  rules: {
    "unicorn/string-content": ["error", {
      patterns: { "foo$": "first", "foo": "second" },
    }],
  },
};
