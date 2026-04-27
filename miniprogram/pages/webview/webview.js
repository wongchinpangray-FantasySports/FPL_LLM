Page({
  data: {
    src: "",
  },

  onLoad(query) {
    const raw = query.u || query.url;
    if (!raw) {
      this.setData({ src: "" });
      return;
    }
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded.indexOf("http://") === 0 || decoded.indexOf("https://") === 0) {
        this.setData({ src: decoded });
      } else {
        this.setData({ src: "" });
      }
    } catch {
      this.setData({ src: "" });
    }
  },
});
