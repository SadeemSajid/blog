import DefaultTheme from "vitepress/theme";
import "./style.css";

export default {
  ...DefaultTheme,
  enhanceApp({ app, router, siteData }) {},
  // Add the link tag for Google Fonts
  head: [
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap",
      },
    ],
  ],
};
