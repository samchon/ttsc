// @ttsc-corpus-clean: storybook/context-in-play-function
export default { component: Button }; export const Primary = {}; export const Secondary = { play: async context => { await Primary.play(context); } };
