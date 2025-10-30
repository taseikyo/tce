// 默认模板和选择器
const DEFAULT_FORMAT = "- ${link}\n- ${title}";
const DEFAULT_SELECTORS = { bilibili: ".up-detail-top", douyin: ".title" };

// --- 工具函数 ---
async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(
      { format: DEFAULT_FORMAT, selectors: DEFAULT_SELECTORS },
      data => resolve(data)
    );
  });
}

async function copyToClipboard(tabId, text) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: t => navigator.clipboard.writeText(t),
    args: [text]
  });
}

async function copyFormattedText(tab, linkUrl) {
  const settings = await getSettings();
  const format = settings.format || DEFAULT_FORMAT;
  const link = linkUrl || tab.url;
  const title = tab.title || "";
  const formatted = format.replace(/\$\{link\}/g, link).replace(/\$\{title\}/g, title);
  await copyToClipboard(tab.id, formatted);
  notify("复制成功", "已复制网页标题与链接");
}

async function copyFromSelector(tabId, selector, tip, index) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel, index) => {
      const els = document.querySelectorAll(sel);
      console.log("get elements:", els);
      if (els.length === 0) return "";
      if (index >= 0 && els.length > index) {
        const el = els[index];
        return el ? el.innerText.trim() : "";
      } else if (index == -1) {
        const el = els[els.length - 1];
        return el ? el.innerText.trim() : "";
      }
      const el = els[0];
      return el ? el.innerText.trim() : "";
    },
    args: [selector, index]
  });
  const text = results[0]?.result || "";
  if (text) {
    await copyToClipboard(tabId, text);
    notify("复制成功", `${tip}: ${text}`);
  } else {
    await copyToClipboard(tabId, "");
    notify("复制失败", `未找到元素 ${selector}`);
  }
}

async function copyDouyinTitleAndLink(tabId, selector) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => {
      const els = document.querySelectorAll(sel);
      console.log("get elements:", els);
      if (els.length < 1) return "";
      const el = els[0];
      if (!el) return "";
      const awemeID = el.parentElement.parentNode.attributes["data-e2e-aweme-id"].value;
      const link = `https://www.douyin.com/video/${awemeID}`;
      const text = el.innerText.trim();
      return `- ${text}\n- ${link}`;
    },
    args: [selector]
  });
  const text = results[0]?.result || "";
  if (text) {
    await copyToClipboard(tabId, text);
    notify("复制成功", `抖音: ${text}`);
  } else {
    await copyToClipboard(tabId, "");
    notify("复制失败", `未找到元素 ${selector}`);
  }
}

async function copyBilibiliAuthorAndLink(tabId, selector) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => {
      const els = document.querySelectorAll(sel);
      console.log("get elements:", els);
      if (els.length < 0) return "";
      const el = els[0];
      if (!el) return "";
      console.log("element:", el);
      const a = el.querySelector("a.up-name");
      const link = a?.href || "";
      const text = a?.innerText.trim() || "";
      return `- ${text}\n- ${link}`;
    },
    args: [selector]
  });
  const text = results[0]?.result || "";
  if (text) {
    await copyToClipboard(tabId, text);
    notify("复制成功", `哔哩哔哩: ${text}`);
  } else {
    await copyToClipboard(tabId, "");
    notify("复制失败", `未找到元素 ${selector}`);
  }
}

// --- 通知 ---
function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "../image/icon.png",
    title,
    message
  });
}

// --- 菜单标题右侧快捷键显示 ---
function padRight(title, key) {
  const padWidth = 36;
  const padding = " ".repeat(Math.max(1, padWidth - title.length));
  return key ? `${title}${padding}${key}` : title;
}

// --- 动态菜单重建 ---
let lastDomain = null;

async function rebuildContextMenus(domain) {
  try {
    await chrome.contextMenus.removeAll();
  } catch (_) {}
  await new Promise(r => setTimeout(r, 50));

  const settings = await getSettings();
  const commands = await chrome.commands.getAll();
  const keyMap = {};
  for (const c of commands) keyMap[c.name] = c.shortcut || "";

  // 通用菜单
  chrome.contextMenus.create({
    id: "TCEcopyLinkAndTitle",
    title: padRight("复制网页标题与链接", keyMap["copy_link_and_title"]),
    contexts: ["page", "link"]
  });

  // Bilibili
  if (domain.includes("bilibili.com")) {
    chrome.contextMenus.create({
      id: "TCEbilibiliEnhance",
      title: padRight(
        `Bilibili: 复制作者与链接`,
        keyMap["copy_bilibili_author"]
      ),
      contexts: ["page"]
    });
  }

  // Douyin
  if (domain.includes("douyin.com")) {
    chrome.contextMenus.create({
      id: "TCEdouyinEnhance",
      title: padRight(
        `Douyin: 复制标题与链接`,
        keyMap["copy_douyin_body"]
      ),
      contexts: ["page"]
    });
  }
}

// --- 更新菜单 ---
async function updateMenusForActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.url) return;

  const domain = new URL(tab.url).hostname;
  if (domain !== lastDomain) {
    lastDomain = domain;
    await rebuildContextMenus(domain);
  }
}

// --- 事件监听 ---
chrome.runtime.onInstalled.addListener(updateMenusForActiveTab);
chrome.runtime.onStartup.addListener(updateMenusForActiveTab);
chrome.tabs.onActivated.addListener(updateMenusForActiveTab);
chrome.tabs.onUpdated.addListener((id, info, tab) => {
  if (info.status === "complete") updateMenusForActiveTab();
});
chrome.storage.onChanged.addListener(updateMenusForActiveTab);

// --- 快捷键 ---
chrome.commands.onCommand.addListener(async command => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) return;
  const settings = await getSettings();

  switch (command) {
    case "copy_link_and_title":
      copyFormattedText(tab);
      break;
    case "copy_bilibili_author":
      copyBilibiliAuthorAndLink(tab.id, settings.selectors.bilibili);
      break;
    case "copy_douyin_body":
      copyDouyinTitleAndLink(tab.id, settings.selectors.douyin);
      break;
  }
});

// --- 右键点击 ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  const settings = await getSettings();

  switch (info.menuItemId) {
    case "TCEcopyLinkAndTitle":
      copyFormattedText(tab, info.linkUrl);
      break;
    case "TCEbilibiliEnhance":
      copyBilibiliAuthorAndLink(tab.id, settings.selectors.bilibili);
      break;
    case "TCEdouyinEnhance":
      copyDouyinTitleAndLink(tab.id, settings.selectors.douyin);
      break;
  }
});
