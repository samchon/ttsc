export default { component: Button };
export const Primary = {
  play: () => {
    // expect: storybook/use-storybook-expect error
    expect(button).toBeVisible();
  },
};
