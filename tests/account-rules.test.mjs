import assert from "node:assert/strict";
import test from "node:test";
import { authHref, handleError, normalizeHandle, passwordError, safeReturnTo } from "../src/lib/account-rules.ts";

test("ID normalization prevents case and surrounding-space duplicates", () => {
  assert.equal(normalizeHandle("  Alice_01  "), "alice_01");
  assert.equal(handleError(" Alice_01 "), null);
  for (const id of ["ab", "a".repeat(21), "user name", "人物", "a@b", "../admin"]) assert.ok(handleError(id));
});

test("password validation counts Unicode characters and never silently truncates", () => {
  assert.ok(passwordError("short"));
  assert.equal(passwordError("🦊".repeat(8)), null);
  assert.equal(passwordError("x".repeat(64)), null);
  assert.ok(passwordError("x".repeat(65)));
});

test("return targets reject external, encoded, control-character and authentication loops", () => {
  for (const target of ["https://evil.example", "//evil.example", "/%2fevil.example", "/%5cevil.example", "/%0aevil", "/login", "/register?next=/me", "/a/../onboarding", "/%zz"]) assert.equal(safeReturnTo(target), "/", target);
  assert.equal(safeReturnTo(["/me", "/"]), "/");
});

test("safe internal destinations survive the login-register-onboarding handoff", () => {
  const target = "/posts/post-01?from=feed#discussion";
  assert.equal(safeReturnTo(target), target);
  for (const page of ["/login", "/register", "/onboarding"]) {
    const link = new URL(authHref(page, target), "https://inrole.invalid");
    assert.equal(safeReturnTo(link.searchParams.get("next")), target);
  }
  assert.equal(authHref("/login", "//evil.example"), "/login");
  assert.equal(safeReturnTo("/posts/post-01?q=a%26b"), "/posts/post-01?q=a%26b");
});
