export default { component: Button };
export const Primary = {};
export const Secondary = {
  play: async (context) => {
    // expect: storybook/context-in-play-function error
    Primary.play();
  },
};
