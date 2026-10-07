export default { component: Button };
export const Primary = {
  play: async () => {
    // expect: storybook/await-interactions error
    userEvent.click(button);
  },
};
