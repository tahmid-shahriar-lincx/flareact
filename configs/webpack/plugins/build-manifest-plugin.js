const { RawSource } = require("webpack-sources");

module.exports = class BuildManifestPlugin {
  createAssets(compilation, assets) {
    const namedChunks = compilation.namedChunks;

    const assetMap = {
      helpers: ["_buildManifest.js"],
      pages: {},
    };

    const mainJsChunk = namedChunks.get("main");
    const mainJsFiles = [...mainJsChunk.files].filter((file) =>
      file.endsWith(".js")
    );

    for (const entrypoint of compilation.entrypoints.values()) {
      let pagePath = entrypoint.name.match(/^pages[/\\](.*)$/);

      if (!pagePath) continue;

      const pageFiles = [...entrypoint.getFiles()].filter(
        (file) => file.endsWith(".css") || file.endsWith(".js")
      );

      assetMap.pages[`/${pagePath[1]}`] = [...mainJsFiles, ...pageFiles];
    }

    assets["build-manifest.json"] = new RawSource(
      JSON.stringify(assetMap, null, 2)
    );

    assets["_buildManifest.js"] = new RawSource(
      `self.__BUILD_MANIFEST = ${generateClientManifest(
        assetMap
      )};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB();`
    );

    return assets;
  }

  apply(compiler) {
    compiler.hooks.emit.tap("FlareactBuildManifest", (compilation) => {
      this.createAssets(compilation, compilation.assets);
    });
  }
};

/**
 * Take an asset map and generate a client version with just pages to be used for
 * client page routing, loading and transitions.
 *
 * @param {object} assetMap
 */
function generateClientManifest(assetMap) {
  let clientManifest = {};
  const appDependencies = new Set(assetMap.pages["/_app"]);

  Object.entries(assetMap.pages).forEach(([page, files]) => {
    if (page === "/_app") return;

    const filteredDeps = files.filter((file) => !appDependencies.has(file));

    clientManifest[page] = filteredDeps;
  });

  return JSON.stringify(clientManifest);
}
