export const THEME_KEY = "reachdle:theme";

// Runs before first paint (layout.tsx) so a dark page never flashes white: a saved choice, else the system setting.
export const themeScript = `(function(){var t;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}
if(t!=="dark"&&t!=="light")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
document.documentElement.dataset.theme=t})()`;
