// expect: no-extra-bind error
const f = (() => 1).bind({});
JSON.stringify(f);