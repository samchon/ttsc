// @ttsc-corpus-skip: rule requires a sibling `package.json` so it can compare addon imports against installed packages; the corpus runner does not synthesize one. Go corpus coverage lives at packages/lint/test/rules/storybook/no_uninstalled_addons_test.go.
export default {
  addons: [
    "@storybook/addon-links",
    // expect: storybook/no-uninstalled-addons error
    "@storybook/addon-essentials",
  ],
};
