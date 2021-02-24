module.exports = {
  configureWebpack: {
    devServer: {
      open: true
      // disableHostCheck: true
    },
    devtool: "source-map",
    resolve: {
      extensions: [".js", ".vue", ".json"]
    }
  },
  transpileDependencies: ["vuetify"]
};
