// @ttsc-corpus-clean: storybook/await-interactions
export default { component: Button }; export const Primary = { play: async () => { await userEvent.click(button); } };
