/*
SvelteKit SSR can break Phaser due to browser-only globals (window, document).
Force client-side rendering for this route tree.
*/
export const ssr = false;
