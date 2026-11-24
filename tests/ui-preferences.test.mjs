import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_UI_PREFERENCES, parseUIPreferences } from "../src/lib/ui-preferences.ts";
import { translateUI } from "../src/lib/ui-messages.ts";

test("interface preferences recover from invalid JSON and reject unrecognized CSS, language and scale values", () => {
  assert.deepEqual(parseUIPreferences("{bad"), DEFAULT_UI_PREFERENCES);
  assert.deepEqual(parseUIPreferences("null"), DEFAULT_UI_PREFERENCES);
  assert.deepEqual(parseUIPreferences(JSON.stringify({ theme: "url(evil)", accent: "red;display:none", language: "xx", fontSize: 1000, density: "hidden", reduceMotion: "true" })), DEFAULT_UI_PREFERENCES);
  const valid = { theme: "system", accent: "blue", language: "en", fontSize: "extra", density: "compact", reduceMotion: true };
  assert.deepEqual(parseUIPreferences(JSON.stringify(valid)), valid);
  for (const legacyAccent of ["violet", "teal", "orange"]) assert.deepEqual(parseUIPreferences(JSON.stringify({ ...valid, accent: legacyAccent })), valid);
});
test("interface translation reorders interpolated labels while preserving author names and account handles", () => {
  assert.equal(translateUI("已向宙斯投出 3 通宝，流水已记录。", "en"), "Sent 3 Tongbao to 宙斯. Transaction saved.");
  assert.equal(translateUI("已向 @the_author 赠送 3 通宝，双方流水已更新。", "en"), "Sent 3 Tongbao to @the_author. Both wallets are updated.");
  assert.equal(translateUI("给贴主 @the_author 赠送通宝，已收到 3 通宝", "en"), "Gift Tongbao to @the_author; 3 received");
  assert.equal(translateUI("欢迎入戏，@my_handle。今天想用谁的口吻说话？", "en"), "Welcome, @my_handle. Whose voice will you borrow today?");
  assert.equal(translateUI("关闭写一条开场白", "en"), "Close 写一条开场白");
  assert.equal(translateUI("设置", "zh"), "设置");
  assert.equal(translateUI("设置", "en"), "Settings");
});
test("UI dictionary does not translate arbitrary post text or modify unknown text", () => {
  const original = "统一了六国，统一不了我的作息。\n建议明天开始，全国统一下午上班。";
  assert.equal(translateUI(original, "en"), original);
  assert.equal(translateUI("A user writes English. 用户也可以混合发言。", "en"), "A user writes English. 用户也可以混合发言。");
});
