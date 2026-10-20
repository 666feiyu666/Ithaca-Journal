import test from "node:test";
import assert from "node:assert/strict";

import { SUPPORTED_LOCALES, translateText } from "../../src/client/app/i18n.js";

test("the locale catalog starts with Chinese and leaves room for more language packs", () => {
  assert.deepEqual(SUPPORTED_LOCALES.map(({ id }) => id), ["zh-CN", "en"]);
});

test("English translations cover fixed and parameterized interface copy", () => {
  assert.equal(translateText("设置", "en"), "Settings");
  assert.equal(translateText("打开台灯", "en"), "Turn on desk lamp");
  assert.equal(translateText("关掉走廊壁灯", "en"), "Turn off hallway lamp");
  assert.equal(translateText("第 7 天 · 回到你的房间", "en"), "Day 7 · Return to your room");
  assert.equal(translateText("1,024 个字符", "en"), "1,024 characters");
});

test("Chinese remains the fallback and unknown content is never rewritten", () => {
  assert.equal(translateText("设置", "zh-CN"), "设置");
  assert.equal(translateText("用户自己写下的句子", "en"), "用户自己写下的句子");
});
