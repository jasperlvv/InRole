import assert from "node:assert/strict";
import test from "node:test";
import { PACK_VERSION, packDigest, validatePack } from "../scripts/db/catalog-pack.mjs";

const source = { title: "File:Portrait.jpg", sourcePage: "https://commons.wikimedia.org/wiki/File:Portrait.jpg", author: "Unknown author", license: "Public domain", licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/", changes: "Square crop and resize." };
const person = (id = "libai", overrides = {}) => ({ id, name: `人物${id.toUpperCase()}`, bio: "一段可公开的简介。", primaryInterestId: "literature", legacyAvatarPath: `/people/${id}.webp`, source: { ...source }, ...overrides });
const pack = (overrides = {}) => ({
  version: PACK_VERSION, reviewedAt: "2026-11-26", reviewedBy: "tester",
  interests: [{ id: "literature", name: "文学诗词" }],
  topics: [{ id: "poetry", name: "诗词接龙", description: "用一句诗接上故事。", interestId: "literature" }],
  people: [person()], ...overrides,
});
const codes = result => result.errors.map(issue => issue.code);

test("a reviewed pack with attribution and known interests validates", () => {
  const result = validatePack(pack(), { requireReview: true });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.pack.people.length, 1);
  assert.equal(result.pack.people[0].source.title, source.title);
  assert.equal(result.pack.topics[0].interestId, "literature");
  assert.match(result.digest, /^[a-f0-9]{64}$/);
});

test("the digest changes when reviewed content changes", () => {
  assert.notEqual(packDigest(pack()), packDigest(pack({ people: [person("libai", { bio: "另一段简介。" })] })));
});

test("production import requires an explicit review record", () => {
  const result = validatePack(pack({ reviewedAt: "", reviewedBy: "" }), { requireReview: true });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes("review.missing"));
  const draft = validatePack(pack({ reviewedAt: "", reviewedBy: "" }));
  assert.equal(draft.ok, true, "演练模式只提示，不阻断");
  assert.ok(draft.warnings.some(issue => issue.code === "review.unconfirmed"));
});

test("missing attribution is rejected unless an external source table supplies it", () => {
  const withoutSource = pack({ people: [{ ...person(), source: undefined }] });
  const rejected = validatePack(withoutSource);
  assert.equal(rejected.ok, false);
  assert.ok(codes(rejected).includes("person.source"));
  const supplied = validatePack(withoutSource, { sources: [{ id: "libai", ...source }] });
  assert.equal(supplied.ok, true, JSON.stringify(supplied.errors));
  assert.equal(supplied.pack.people[0].source.changes, source.changes);
});

test("source pages and licences must be https and complete", () => {
  const result = validatePack(pack({ people: [person("libai", { source: { ...source, sourcePage: "http://example.com/x", license: "", licenseUrl: "" } })] }));
  assert.equal(result.ok, false);
  for (const code of ["source.url", "source.license", "source.licenseUrl"]) assert.ok(codes(result).includes(code), code);
});

test("duplicate identifiers, names and unknown interest references are rejected", () => {
  const duplicateId = validatePack(pack({ people: [person(), person()] }));
  assert.ok(codes(duplicateId).includes("person.duplicate"));
  const duplicateName = validatePack(pack({ people: [person("libai", { name: "同名" }), person("dufu", { name: "同名" })] }));
  assert.ok(codes(duplicateName).includes("person.name.duplicate"));
  const unknownInterest = validatePack(pack({ people: [person("libai", { primaryInterestId: "not-real" })] }));
  assert.ok(codes(unknownInterest).includes("person.interest"));
  const unknownTopicInterest = validatePack(pack({ topics: [{ id: "poetry", name: "诗词接龙", description: "描述", interestId: "not-real" }] }));
  assert.ok(codes(unknownTopicInterest).includes("topic.interest"));
});

test("empty biographies, invalid identifiers and non-pack avatar paths are rejected", () => {
  assert.ok(codes(validatePack(pack({ people: [person("libai", { bio: "   " })] }))).includes("person.bio"));
  assert.ok(codes(validatePack(pack({ people: [person("Libai")] }))).includes("person.id"));
  assert.ok(codes(validatePack(pack({ people: [person("libai", { legacyAvatarPath: "/people/../etc/passwd" })] }))).includes("person.avatar"));
  assert.ok(codes(validatePack(pack({ people: [person("libai", { name: "" })] }))).includes("person.name"));
});

test("pack-level shape problems fail fast instead of throwing", () => {
  for (const input of [null, [], "pack", 42]) {
    const result = validatePack(input);
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
  }
  const wrongVersion = validatePack(pack({ version: 99 }));
  assert.ok(codes(wrongVersion).includes("version"));
  const empty = validatePack(pack({ people: [] }));
  assert.ok(codes(empty).includes("people.empty"));
});

test("aliases stay within limits and collisions are warnings, not blockers", () => {
  const tooMany = validatePack(pack({ people: [person("libai", { aliases: ["a", "b", "c", "d", "e", "f", "g"] })] }));
  assert.ok(codes(tooMany).includes("person.alias.count"));
  const collision = validatePack(pack({ people: [person("libai", { aliases: ["杜甫"] }), person("dufu", { name: "杜甫" })] }));
  assert.equal(collision.ok, true);
  assert.ok(collision.warnings.some(issue => issue.code === "alias.collision"));
});

test("a pack without interests defers interest references to the target database with a warning", () => {
  const result = validatePack(pack({ interests: [], topics: [] }));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some(issue => issue.code === "interest.unverified"));
});
