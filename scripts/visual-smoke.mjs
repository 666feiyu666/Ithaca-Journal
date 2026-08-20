import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const appUrl = process.env.ITHACA_APP_URL ?? "http://127.0.0.1:8787/";
const outputDirectory = resolve(process.env.ITHACA_VISUAL_OUTPUT ?? ".artifacts/visual-review");
const browserCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const browserPath = browserCandidates.find((candidate) => existsSync(candidate));

if (!browserPath) {
  throw new Error("没有找到可用于视觉验收的 Chrome 或 Edge。可通过 CHROME_PATH 指定浏览器路径。");
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolveConnection, rejectConnection) => {
      this.webSocket.addEventListener("open", resolveConnection, { once: true });
      this.webSocket.addEventListener("error", rejectConnection, { once: true });
    });
    this.webSocket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(message.params);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCommand, rejectCommand) => {
      this.pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
      this.webSocket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() {
    this.webSocket.close();
  }
}

async function findFreePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolveClose) => server.close(resolveClose));
  if (!port) throw new Error("无法分配浏览器调试端口。");
  return port;
}

async function waitFor(callback, message, timeout = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await callback()) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
  }
  throw new Error(message);
}

async function waitForBrowser(port) {
  let version;
  await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      version = response.ok ? await response.json() : null;
      return Boolean(version);
    } catch {
      return false;
    }
  }, "浏览器没有按时启动。");
  return version;
}

async function findPage(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`无法读取验收页面：${response.status}`);
  const targets = await response.json();
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("浏览器没有提供可用的验收页面。");
  return page;
}

async function run() {
  await mkdir(outputDirectory, { recursive: true });
  const profileDirectory = await mkdtemp(join(tmpdir(), "ithaca-visual-"));
  const port = await findFreePort();
  const browserProcess = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-sandbox",
      "--no-first-run",
      `--remote-debugging-port=${port}`,
      "--remote-allow-origins=*",
      `--user-data-dir=${profileDirectory}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  let client;
  const consoleErrors = [];
  const screenshots = [];

  try {
    await waitForBrowser(port);
    const page = await findPage(port);
    client = new CdpClient(page.webSocketDebuggerUrl);
    await client.connect();
    client.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
      consoleErrors.push(exceptionDetails.exception?.description ?? exceptionDetails.text);
    });
    client.on("Runtime.consoleAPICalled", ({ type, args }) => {
      if (type === "error") {
        consoleErrors.push(args.map((argument) => argument.value ?? argument.description).join(" "));
      }
    });
    await Promise.all([client.send("Page.enable"), client.send("Runtime.enable")]);

    const evaluate = async (expression) => {
      const response = await client.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
      }
      return response.result.value;
    };

    const setViewport = async (width, height) => {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
    };

    const screenshot = async (name) => {
      const result = await client.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      const path = join(outputDirectory, `${name}.png`);
      await writeFile(path, Buffer.from(result.data, "base64"));
      screenshots.push(path);
    };

    const click = (selector) => evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error("Missing element: ${selector}");
      element.click();
      return true;
    })()`);

    const fill = (selector, value) => evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error("Missing element: ${selector}");
      element.value = ${JSON.stringify(value)};
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);

    const isVisible = (selector) => evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      return Boolean(element && !element.hidden && element.getClientRects().length);
    })()`);

    const assertNoHorizontalOverflow = async (label) => {
      const dimensions = await evaluate(`({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth
      })`);
      if (dimensions.document > dimensions.viewport + 1 || dimensions.body > dimensions.viewport + 1) {
        throw new Error(`${label} 存在横向溢出：${JSON.stringify(dimensions)}`);
      }
    };

    const assertTopBarVisible = async (label, selector) => {
      const position = await evaluate(`(() => {
        const element = document.querySelector(${JSON.stringify(selector)});
        const rect = element?.getBoundingClientRect();
        return { top: rect?.top ?? -9999, bottom: rect?.bottom ?? -9999, scrollY: window.scrollY };
      })()`);
      if (position.top < -1 || position.bottom <= 0 || position.scrollY > 1) {
        throw new Error(`${label} 的顶栏不在视口内：${JSON.stringify(position)}`);
      }
    };

    await setViewport(1440, 900);
    await client.send("Page.navigate", { url: appUrl });
    await waitFor(() => isVisible("#title-view"), "标题界面没有按时出现。");
    await assertNoHorizontalOverflow("标题界面");
    const initialFocus = await evaluate("document.activeElement?.id ?? ''");
    if (initialFocus !== "journey-action") {
      throw new Error(`标题界面的初始焦点不正确：${initialFocus || "无"}`);
    }
    await screenshot("01-title-1440x900");

    if (await isVisible("#title-account-button")) {
      await click("#title-account-button");
      await waitFor(
        () => evaluate("document.querySelector('#delete-account-dialog')?.open === true"),
        "本地重新体验确认框没有打开。",
      );
      const resetDialog = await evaluate(`({
        title: document.querySelector('#delete-account-title')?.textContent?.trim(),
        label: document.querySelector('#delete-account-label')?.textContent?.trim(),
        action: document.querySelector('#confirm-delete-account')?.textContent?.trim()
      })`);
      if (
        resetDialog.title !== "重新体验完整流程？" ||
        !resetDialog.label.includes("RESET") ||
        resetDialog.action !== "清除并重新开始"
      ) {
        throw new Error(`本地重新体验确认框文案不完整：${JSON.stringify(resetDialog)}`);
      }
      await screenshot("01-reset-local-1440x900");
      await click("#cancel-delete-account");
      await waitFor(
        () => evaluate("document.querySelector('#delete-account-dialog')?.open !== true"),
        "本地重新体验确认框没有关闭。",
      );
    }

    await evaluate(`(async () => {
      const synthetic = (title) => /^验收(?:碎片|主题|成书) \\d+$/.test(title);
      const removeMatches = async (path, key) => {
        const response = await fetch(path, { headers: { Accept: 'application/json' } });
        const data = await response.json();
        for (const item of data[key].filter((record) => synthetic(record.title))) {
          await fetch(path + '/' + item.id, { method: 'DELETE' });
        }
      };
      await removeMatches('/api/books', 'books');
      await removeMatches('/api/topics', 'topics');
      await removeMatches('/api/entries', 'entries');
      return true;
    })()`);

    await click("#journey-action");
    await waitFor(
      async () => (await isVisible("#intro-view")) || (await isVisible("#room-view")),
      "开始旅程后没有进入序章或房间。",
    );

    if (await isVisible("#intro-view")) {
      await assertNoHorizontalOverflow("序章");
      await screenshot("02-intro-1440x900");
      for (let index = 0; index < 6 && !(await isVisible("#room-view")); index += 1) {
        const previousLine = await evaluate("document.querySelector('#intro-line')?.textContent ?? ''");
        await click("#intro-next");
        await waitFor(
          async () =>
            (await isVisible("#room-view")) ||
            (await evaluate("document.querySelector('#intro-line')?.textContent ?? ''")) !== previousLine,
          "序章没有继续到下一句。",
        );
      }
    }

    await waitFor(() => isVisible("#room-view"), "序章结束后没有进入房间。");
    await evaluate("document.querySelector('#bookshelf-hotspot').focus(); true");
    await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab" });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab" });
    let focusedHotspot = await evaluate("document.activeElement?.id ?? ''");
    if (focusedHotspot !== "desk-hotspot") {
      throw new Error(`房间热点键盘顺序错误：书架后应为书桌，实际为 ${focusedHotspot || "无焦点"}`);
    }
    await client.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab" });
    await client.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab" });
    focusedHotspot = await evaluate("document.activeElement?.id ?? ''");
    if (focusedHotspot !== "letter-hotspot") {
      throw new Error(`房间热点键盘顺序错误：书桌后应为来信，实际为 ${focusedHotspot || "无焦点"}`);
    }
    for (const [width, height] of [[1024, 720], [1440, 900], [1920, 1080]]) {
      await setViewport(width, height);
      await assertNoHorizontalOverflow(`房间 ${width}x${height}`);
      const roomLayout = await evaluate(`(() => {
        const frame = document.querySelector('.room-frame').getBoundingClientRect();
        const image = document.querySelector('.room-frame img');
        const hotspots = [...document.querySelectorAll('.room-hotspot')].map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            id: element.id,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
          };
        });
        return {
          imageReady: image.complete && image.naturalWidth > 0,
          frame: { left: frame.left, right: frame.right, top: frame.top, bottom: frame.bottom },
          hotspots,
        };
      })()`);
      if (!roomLayout.imageReady) throw new Error("房间占位图没有加载完成。");
      for (const hotspot of roomLayout.hotspots) {
        if (
          hotspot.centerX < roomLayout.frame.left ||
          hotspot.centerX > roomLayout.frame.right ||
          hotspot.centerY < roomLayout.frame.top ||
          hotspot.centerY > roomLayout.frame.bottom
        ) {
          throw new Error(`${hotspot.id} 超出了房间画面。`);
        }
      }
      await screenshot(`03-room-${width}x${height}`);
    }

    await setViewport(1440, 900);
    await click("#letter-hotspot");
    await waitFor(
      () => evaluate("document.querySelector('#letter-dialog')?.open === true"),
      "逐日来信没有打开。",
    );
    await screenshot("04-letter-1440x900");
    await evaluate("document.querySelector('#letter-dialog').close(); true");

    await click("#desk-hotspot");
    await waitFor(() => isVisible("#app-view"), "书桌没有打开写作台。");
    await setViewport(1024, 720);
    await assertNoHorizontalOverflow("写作台 1024x720");
    await assertTopBarVisible("写作台 1024x720", "#app-view .app-header");
    await screenshot("05-workbench-1024x720");
    await setViewport(1440, 900);
    await assertNoHorizontalOverflow("写作台 1440x900");
    await screenshot("05-workbench-1440x900");

    const runId = Date.now();
    const fragmentTitle = `验收碎片 ${runId}`;
    const topicTitle = `验收主题 ${runId}`;
    const bookTitle = `验收成书 ${runId}`;

    await click("#new-entry-button");
    await fill("#entry-title", fragmentTitle);
    await fill("#entry-body", "夜里抵达陌生城市时，我仍在口袋里摸到旧住处的钥匙。");
    await click("#save-button");
    await waitFor(
      () => evaluate("document.querySelector('#save-state')?.textContent === '已保存'"),
      "碎片笔记没有保存成功。",
    );
    await screenshot("06-fragment-saved-1440x900");

    await click("#topic-tab");
    await waitFor(
      () => evaluate(`(() => {
        const tab = document.querySelector('#topic-tab');
        const button = document.querySelector('#new-topic-button');
        return tab?.getAttribute('aria-pressed') === 'true' && button && !button.hidden && !button.disabled;
      })()`),
      "无法切换到主题笔记。",
    );
    await click("#new-topic-button");
    await waitFor(
      () => evaluate("document.querySelector('#topic-dialog')?.open === true"),
      "主题整理表单没有打开。",
    );
    await fill("#topic-title-input", topicTitle);
    await fill("#topic-body-input", "抵达并不会自动切断过去；旧钥匙让两个住处同时存在于同一刻。");
    await evaluate(`(() => {
      const option = document.querySelector('#topic-fragment-options input[value]');
      if (!option) throw new Error('没有可选择的碎片');
      option.click();
      return true;
    })()`);
    await click("#save-topic");
    await waitFor(
      async () =>
        !(await evaluate("document.querySelector('#topic-dialog')?.open === true")) &&
        (await isVisible("#topic-panel")),
      "主题笔记没有保存成功。",
    );
    await screenshot("07-topic-organized-1440x900");
    await setViewport(1024, 720);
    await assertNoHorizontalOverflow("主题笔记 1024x720");
    await assertTopBarVisible("主题笔记 1024x720", "#app-view .app-header");
    await screenshot("07-topic-organized-1024x720");
    await setViewport(1440, 900);

    await click("#return-room-button");
    await waitFor(() => isVisible("#room-view"), "写作台无法返回房间。");
    await click("#bookshelf-hotspot");
    await waitFor(() => isVisible("#books-view"), "书架没有打开。");
    await assertNoHorizontalOverflow("书架 1440x900");
    await screenshot("08-bookshelf-1440x900");
    await setViewport(1024, 720);
    await assertNoHorizontalOverflow("书架 1024x720");
    await assertTopBarVisible("书架 1024x720", "#books-view .app-header");
    await screenshot("08-bookshelf-1024x720");
    await setViewport(1440, 900);

    await click("#compile-book-button");
    await waitFor(
      () => evaluate("document.querySelector('#compile-book-dialog')?.open === true"),
      "编纂表单没有打开。",
    );
    await fill("#book-title-input", bookTitle);
    await fill("#book-preface-input", "把一次抵达装订成可以返回的叙事。");
    await evaluate(`(() => {
      const option = document.querySelector('#book-topic-options input[value]');
      if (!option) throw new Error('没有可选择的主题');
      option.click();
      return true;
    })()`);
    await click("#confirm-compile-book");
    await waitFor(
      async () =>
        !(await evaluate("document.querySelector('#compile-book-dialog')?.open === true")) &&
        (await isVisible("#book-reader")),
      "书籍没有编纂成功。",
    );
    await screenshot("09-book-compiled-1440x900");
    await setViewport(1024, 720);
    await assertNoHorizontalOverflow("成书阅读 1024x720");
    await assertTopBarVisible("成书阅读 1024x720", "#books-view .app-header");
    await screenshot("09-book-compiled-1024x720");
    await setViewport(1440, 900);
    await click("#books-return-room-button");
    await waitFor(() => isVisible("#room-view"), "书架无法返回房间。");

    await evaluate(`(async () => {
      const findByTitle = async (path, key, title) => {
        const response = await fetch(path, { headers: { Accept: 'application/json' } });
        const data = await response.json();
        return data[key].find((item) => item.title === title)?.id;
      };
      const bookId = await findByTitle('/api/books', 'books', ${JSON.stringify(bookTitle)});
      const topicId = await findByTitle('/api/topics', 'topics', ${JSON.stringify(topicTitle)});
      const fragmentId = await findByTitle('/api/entries', 'entries', ${JSON.stringify(fragmentTitle)});
      if (bookId) await fetch('/api/books/' + bookId, { method: 'DELETE' });
      if (topicId) await fetch('/api/topics/' + topicId, { method: 'DELETE' });
      if (fragmentId) await fetch('/api/entries/' + fragmentId, { method: 'DELETE' });
      return true;
    })()`);

    if (consoleErrors.length) {
      throw new Error(`浏览器控制台出现错误：${consoleErrors.join(" | ")}`);
    }

    const summary = {
      status: "passed",
      appUrl,
      browserPath,
      viewports: ["1024x720", "1440x900", "1920x1080"],
      states: [
        "标题",
        "序章或既有存档继续",
        "房间",
        "逐日来信",
        "碎片保存",
        "主题整理",
        "书架",
        "编纂成书",
        "返回房间",
      ],
      screenshots,
      consoleErrors,
    };
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    client?.close();
    browserProcess.kill();
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    await rm(profileDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

await run();
