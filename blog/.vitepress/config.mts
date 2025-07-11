import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Sadeem Sajid",
  description: "Writings on technology, software, philosophy, and Islam.",
  lang: "en-US",

  // SEO
  head: [
    ["meta", { name: "author", content: "Sadeem Sajid" }],
    ["link", { rel: "icon", href: "/favicon.png" }],
  ],

  // THEME

  appearance: false,

  themeConfig: {
    // logo: "/favicon.png", // Enable if you want a logo

    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Technology", link: "/tech" },
      { text: "Philosophy", link: "/philosophy" },
      { text: "Islam", link: "/islam" },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/SadeemSajid" },
      { icon: "linkedin", link: "https://www.linkedin.com/in/sadeem-sajid/" },
    ],
    search: {
      provider: "local",
    },
  },

  // Custom Config
  cleanUrls: true,
});
