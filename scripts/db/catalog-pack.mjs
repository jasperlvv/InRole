import { createHash } from "node:crypto";

// 公共目录数据包（catalog pack）的纯校验逻辑。不访问数据库，便于单元测试。
export const PACK_VERSION = 1;
export const LIMITS = { people: 500, aliasesPerPerson: 6, name: 60, alias: 40, bio: 280, description: 280, interests: 60 };

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const AVATAR_PATTERN = /^\/people\/[a-z0-9-]+\.(webp|png|jpg)$/;
const HTTPS_PATTERN = /^https:\/\/[^\s]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function string(value) {
  return typeof value === "string" ? value.trim() : "";
}
function key(value) {
  return string(value).normalize("NFKC").toLocaleLowerCase();
}
export function packDigest(pack) {
  return createHash("sha256").update(JSON.stringify(pack)).digest("hex");
}

// sources: 可选的外部署名表（按 id 匹配），用于兼容现有 prisma/catalog.json 与 portrait-sources.ts 分离的布局。
export function validatePack(raw, { sources = [], requireReview = false } = {}) {
  const errors = [], warnings = [];
  const result = { ok: false, errors, warnings, digest: packDigest(raw ?? null), pack: { version: PACK_VERSION, reviewedAt: "", reviewedBy: "", interests: [], topics: [], people: [] } };
  const error = (code, message, index) => errors.push({ code, message, index });
  const warn = (code, message, index) => warnings.push({ code, message, index });

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    error("shape", "数据包必须是 JSON 对象。");
    return result;
  }

  const version = raw.version ?? PACK_VERSION;
  if (version !== PACK_VERSION) error("version", `不支持的数据包版本 ${String(version)}，当前版本 ${PACK_VERSION}。`);
  const reviewedAt = string(raw.reviewedAt), reviewedBy = string(raw.reviewedBy);
  if (reviewedAt && !DATE_PATTERN.test(reviewedAt)) error("review.date", "reviewedAt 应为 YYYY-MM-DD。");
  if (requireReview) {
    if (!reviewedAt) error("review.missing", "导入正式库需要 reviewedAt（审核日期）。");
    if (!reviewedBy) error("review.missing", "导入正式库需要 reviewedBy（审核人）。");
  } else if (!reviewedAt) warn("review.unconfirmed", "数据包没有 reviewedAt；正式导入前必须有人审核。");

  // 兴趣标签
  const interests = [];
  const interestIds = new Set(), interestNames = new Set();
  if (raw.interests !== undefined && !Array.isArray(raw.interests)) error("interests.shape", "interests 必须是数组。");
  for (const [index, item] of (Array.isArray(raw.interests) ? raw.interests : []).entries()) {
    const id = string(item?.id), name = string(item?.name);
    if (!ID_PATTERN.test(id)) { error("interest.id", `兴趣标识不合法：${id || "(空)"}`, index); continue; }
    if (interestIds.has(id)) { error("interest.duplicate", `兴趣标识重复：${id}`, index); continue; }
    if (!name) { error("interest.name", `兴趣缺少名称：${id}`, index); continue; }
    if (name.length > LIMITS.name) error("interest.name", `兴趣名称过长：${id}`, index);
    if (interestNames.has(key(name))) warn("interest.name.duplicate", `兴趣名称重复：${name}`, index);
    interestIds.add(id); interestNames.add(key(name));
    interests.push({ id, name });
  }
  if (interests.length > LIMITS.interests) error("interest.count", `兴趣数量超过 ${LIMITS.interests} 个。`);

  // 话题
  const topics = [];
  const topicIds = new Set(), topicNames = new Set(), unverifiedInterests = new Set();
  if (raw.topics !== undefined && !Array.isArray(raw.topics)) error("topics.shape", "topics 必须是数组。");
  for (const [index, item] of (Array.isArray(raw.topics) ? raw.topics : []).entries()) {
    const id = string(item?.id), name = string(item?.name), description = string(item?.description), interestId = string(item?.interestId);
    if (!ID_PATTERN.test(id)) { error("topic.id", `话题标识不合法：${id || "(空)"}`, index); continue; }
    if (topicIds.has(id)) { error("topic.duplicate", `话题标识重复：${id}`, index); continue; }
    if (!name) { error("topic.name", `话题缺少名称：${id}`, index); continue; }
    if (name.length > LIMITS.name) error("topic.name", `话题名称过长：${id}`, index);
    if (topicNames.has(key(name))) warn("topic.name.duplicate", `话题名称重复：${name}`, index);
    if (!description) error("topic.description", `话题缺少描述：${id}`, index);
    else if (description.length > LIMITS.description) error("topic.description", `话题描述过长：${id}`, index);
    if (!ID_PATTERN.test(interestId)) error("topic.interest", `话题兴趣标识不合法：${id}`, index);
    else if (interests.length && !interestIds.has(interestId)) error("topic.interest", `话题引用了数据包中不存在的兴趣：${id} → ${interestId}`, index);
    else if (!interests.length) unverifiedInterests.add(interestId);
    topicIds.add(id); topicNames.add(key(name));
    topics.push({ id, name, description, interestId });
  }

  // 人物
  const people = [];
  const personIds = new Set(), personNames = new Map();
  if (!Array.isArray(raw.people)) {
    error("people.shape", "people 必须是数组。");
    return finish();
  }
  if (!raw.people.length) error("people.empty", "数据包没有任何人物。");
  if (raw.people.length > LIMITS.people) error("people.count", `人物数量超过 ${LIMITS.people} 位。`);

  for (const [index, item] of raw.people.entries()) {
    const id = string(item?.id), label = id || `#${index}`;
    if (!ID_PATTERN.test(id)) { error("person.id", `人物标识不合法：${label}`, index); continue; }
    if (personIds.has(id)) { error("person.duplicate", `人物标识重复：${id}`, index); continue; }
    personIds.add(id);

    const name = string(item?.name);
    if (!name) error("person.name", `人物缺少名称：${label}`, index);
    else if (name.length > LIMITS.name) error("person.name", `人物名称过长：${label}`, index);
    else if (personNames.has(key(name))) error("person.name.duplicate", `人物名称重复：${name}（${personNames.get(key(name))}）`, index);
    else personNames.set(key(name), id);

    const bio = string(item?.bio);
    if (!bio) error("person.bio", `人物缺少简介：${label}`, index);
    else if (bio.length > LIMITS.bio) error("person.bio", `简介超过 ${LIMITS.bio} 字：${label}`, index);

    const aliases = [];
    if (item?.aliases !== undefined && !Array.isArray(item.aliases)) error("person.aliases", `别名必须是数组：${label}`, index);
    for (const alias of Array.isArray(item.aliases) ? item.aliases : []) {
      const aliasValue = string(alias);
      if (!aliasValue) { error("person.alias", `别名为空：${label}`, index); continue; }
      if (aliasValue.length > LIMITS.alias) error("person.alias", `别名过长：${label}`, index);
      if (aliases.some(existing => key(existing) === key(aliasValue))) { warn("person.alias.duplicate", `别名重复：${label} → ${aliasValue}`, index); continue; }
      aliases.push(aliasValue);
    }
    if (aliases.length > LIMITS.aliasesPerPerson) error("person.alias.count", `别名超过 ${LIMITS.aliasesPerPerson} 个：${label}`, index);

    const primaryInterestId = string(item?.primaryInterestId);
    if (!ID_PATTERN.test(primaryInterestId)) error("person.interest", `主兴趣标识不合法：${label}`, index);
    else if (interests.length && !interestIds.has(primaryInterestId)) error("person.interest", `人物引用了数据包中不存在的兴趣：${label} → ${primaryInterestId}`, index);
    else if (!interests.length) unverifiedInterests.add(primaryInterestId);

    const extraInterestIds = [];
    if (item?.interestIds !== undefined && !Array.isArray(item.interestIds)) error("person.interests", `interestIds 必须是数组：${label}`, index);
    for (const value of Array.isArray(item.interestIds) ? item.interestIds : []) {
      const interestId = string(value);
      if (!ID_PATTERN.test(interestId)) { error("person.interests", `附加兴趣标识不合法：${label}`, index); continue; }
      if (interestId === primaryInterestId || extraInterestIds.includes(interestId)) continue;
      if (interests.length && !interestIds.has(interestId)) { error("person.interests", `人物引用了数据包中不存在的兴趣：${label} → ${interestId}`, index); continue; }
      if (!interests.length) unverifiedInterests.add(interestId);
      extraInterestIds.push(interestId);
    }

    const legacyAvatarPath = item?.legacyAvatarPath === null || item?.legacyAvatarPath === undefined ? null : string(item.legacyAvatarPath);
    if (legacyAvatarPath !== null && !AVATAR_PATTERN.test(legacyAvatarPath)) error("person.avatar", `头像路径必须形如 /people/xxx.webp：${label}`, index);
    else if (legacyAvatarPath === null && item?.avatarMediaId === undefined) warn("person.avatar.missing", `人物没有头像，将显示首字占位：${label}`, index);

    const merged = item?.source ?? sources.find(source => source?.id === id) ?? null;
    const source = validateSource(merged, label, index, error, warn);

    people.push({ id, name, aliases, bio, primaryInterestId, interestIds: extraInterestIds, legacyAvatarPath, source });
  }

  // 名称与别名交叉重复只提示，不阻断：真实人物可能有相同简称。
  const seenAliases = new Map();
  for (const person of people) {
    for (const alias of person.aliases) {
      const normalized = key(alias);
      if (personNames.has(normalized) && personNames.get(normalized) !== person.id) warn("alias.collision", `别名与他人姓名相同：${person.id} → ${alias}`);
      if (seenAliases.has(normalized) && seenAliases.get(normalized) !== person.id) warn("alias.collision", `别名被多个人物使用：${alias}`);
      seenAliases.set(normalized, person.id);
    }
  }
  if (unverifiedInterests.size) warn("interest.unverified", `数据包未包含 interests，${unverifiedInterests.size} 个兴趣引用需要在目标库中校验。`);

  return finish();

  function finish() {
    result.pack = { version: PACK_VERSION, reviewedAt, reviewedBy, interests, topics, people };
    result.ok = errors.length === 0;
    return result;
  }
}

function validateSource(source, label, index, error, warn) {
  if (!source) { error("person.source", `缺少头像/素材来源署名：${label}`, index); return null; }
  const title = string(source.title);
  const sourcePage = string(source.sourcePage ?? source.sourceUrl);
  const author = string(source.author);
  const license = string(source.license);
  const licenseUrl = string(source.licenseUrl);
  const changes = string(source.changes ?? source.modifications);
  if (!title) error("source.title", `来源缺少作品名：${label}`, index);
  if (!HTTPS_PATTERN.test(sourcePage)) error("source.url", `来源页必须是 https 地址：${label}`, index);
  if (!author) error("source.author", `来源缺少作者：${label}`, index);
  if (!license) error("source.license", `来源缺少许可证：${label}`, index);
  if (!HTTPS_PATTERN.test(licenseUrl)) error("source.licenseUrl", `许可证链接必须是 https 地址：${label}`, index);
  if (!changes) warn("source.changes", `建议补充素材处理说明（裁剪、格式转换）：${label}`, index);
  return { title, sourcePage, author, license, licenseUrl, changes: changes || null };
}
