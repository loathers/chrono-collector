export default function (api) {
  api.cache(true);
  return {
    exclude: [],
    presets: [
      "@babel/preset-typescript",
      "@babel/preset-react",
      [
        "@babel/preset-env",
        {
          targets: { rhino: "1.7.13" },
        },
      ],
    ],
  };
}
