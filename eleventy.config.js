export default function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("**/*.css");
  eleventyConfig.addPassthroughCopy("**/*.js");

  return {
    dir: {
      input: "_site_src",
      output: "_site"
    }
  };
};
