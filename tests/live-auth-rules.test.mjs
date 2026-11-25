import assert from "node:assert/strict";
import { test } from "node:test";
import { liveReturnTo } from "../src/lib/live-auth-rules.ts";
test("real authentication return targets stay in real pages without login loops", () => {
  for (const target of [undefined, ["/live/me"], "https://evil.test", "//evil.test", "/login", "/me", "/demo", "/live/login", "/live/%72egister", "/live/onboarding", "/live/people%5c..%5clogin"]) assert.equal(liveReturnTo(target), "/live/people");
});
test("real return targets preserve safe account and people query destinations", () => {
  assert.equal(liveReturnTo("/live/me"), "/live/me");
  assert.equal(liveReturnTo("/live/people?q=test#directory"), "/live/people?q=test#directory");
});
