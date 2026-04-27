const { buildWebviewUrl } = require("../../utils/buildUrl");

const STORAGE_KEY = "fpl_entry_id";

Page({
  data: {
    entryInput: "",
    entryId: "",
  },

  onShow() {
    const entryId = wx.getStorageSync(STORAGE_KEY) || "";
    this.setData({ entryId, entryInput: entryId || this.data.entryInput });
  },

  onEntryInput(e) {
    this.setData({ entryInput: (e.detail.value || "").trim() });
  },

  onSave() {
    const v = (this.data.entryInput || "").replace(/\D/g, "");
    if (!v) {
      wx.showToast({ title: "Enter digits only", icon: "none" });
      return;
    }
    wx.setStorageSync(STORAGE_KEY, v);
    this.setData({ entryId: v });
    wx.showToast({ title: "Saved", icon: "success" });
  },

  openWeb(e) {
    const page = e.currentTarget.dataset.page;
    if (!["chat", "dashboard", "planner"].includes(page)) return;
    const entry = this.data.entryId || wx.getStorageSync(STORAGE_KEY) || "";
    const url = buildWebviewUrl(page, entry);
    if (!url) {
      wx.showModal({
        title: "Config",
        content:
          "Set miniprogram/config.js `baseUrl` to your Vercel URL (https://...).",
        showCancel: false,
      });
      return;
    }
    const encoded = encodeURIComponent(url);
    wx.navigateTo({
      url: `/pages/webview/webview?u=${encoded}`,
    });
  },
});
