export default function(eleventyConfig) {
  eleventyConfig.setUseGitIgnore(false);

  return {
    dir: {
      input: "_site_src",
      output: "_site"
    },
    htmlTemplateEngine: false,
    markdownTemplateEngine: false
  };
};
