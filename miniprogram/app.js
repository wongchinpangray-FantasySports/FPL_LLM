const config = require("./config");

App({
  onLaunch() {
    this.globalData.baseUrl = (config.baseUrl || "").replace(/\/$/, "");
  },
  globalData: {
    baseUrl: "",
  },
});
