document.addEventListener("DOMContentLoaded", async () => {
    const formatInput = document.getElementById("formatTemplate");
    const bilibiliInput = document.getElementById("bilibiliSelector");
    const douyinInput = document.getElementById("douyinSelector");
    const status = document.getElementById("status");
  
    chrome.storage.sync.get(
      { format: "- ${link}\n- ${title}", selectors: { bilibili: ".author", douyin: ".body" } },
      data => {
        formatInput.value = data.format;
        bilibiliInput.value = data.selectors.bilibili;
        douyinInput.value = data.selectors.douyin;
      }
    );
  
    document.getElementById("saveBtn").addEventListener("click", () => {
      const format = formatInput.value.trim() || "- ${link}\n- ${title}";
      const selectors = {
        bilibili: bilibiliInput.value.trim() || ".author",
        douyin: douyinInput.value.trim() || ".body"
      };
      chrome.storage.sync.set({ format, selectors }, () => {
        status.textContent = "✅ 设置已保存";
        setTimeout(() => (status.textContent = ""), 1500);
      });
    });
  });
  