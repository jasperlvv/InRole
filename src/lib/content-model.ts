import { normalizeEncyclopediaUrl, normalizePoll, validateAttachments, type MediaAttachment, type PollDraft, type PostPoll } from "./post-rules.ts";
export type Person = { id: string; name: string; glyph: string; tone: string; label: string; bio: string; avatarUrl?: string };
export type Topic = { id: string; name: string; description: string; glyph: string; tone: string };
export type DemoPost = { id: string; personId: string; handle: string; body: string; topicIds: string[]; createdAt: number; featured?: boolean; attachments?: MediaAttachment[]; poll?: PostPoll; quotePostId?: string };
export type PollVote = { postId: string; optionId: string; handle: string; createdAt: number };
export type CharacterRequest = { id: string; handle: string; name: string; bio: string; sourceUrl: string; status: "pending"; createdAt: number };
export type DemoComment = { id: string; postId: string; personId: string; handle: string; body: string; createdAt: number };
export type DemoLike = { postId: string; handle: string; createdAt: number };
export type DemoReview = { id: string; personId: string; handle: string; score: number; body: string; updatedAt: number };
export type CoinTransaction = { id: string; handle: string; kind: "grant" | "tip" | "gift"; amount: number; personId?: string; recipientHandle?: string; postId?: string; day: string; createdAt: number; requestKey?: string };
export type DemoReport = { id: string; handle: string; kind: "post" | "comment" | "review"; targetId: string; reason: string; createdAt: number };
export type ContentState = {
  version: 1;
  demoSeedRevision?: number;
  posts: DemoPost[];
  comments: DemoComment[];
  likes: DemoLike[];
  recentPeople: Record<string, string[]>;
  requests: Record<string, string>;
  reviews: DemoReview[];
  transactions: CoinTransaction[];
  reports: DemoReport[];
  pollVotes: PollVote[];
  characterRequests: CharacterRequest[];
};
export type Draft = { personId: string; body: string; topicIds: string[]; attachments?: MediaAttachment[]; poll?: PollDraft; quotePostId?: string };
export const EMPTY_DRAFT: Draft = { personId: "", body: "", topicIds: [] };
export const DAY = 86_400_000;

export const people: Person[] = [
  { id: "qin", name: "秦始皇", glyph: "秦", tone: "orange", label: "中国历史", bio: "六国统一了，生活里的小事还在研究。" },
  { id: "libai", name: "李白", glyph: "白", tone: "blue", label: "文学诗词", bio: "把生活酿成酒，把想到的写成诗。" },
  { id: "wukong", name: "孙悟空", glyph: "悟", tone: "green", label: "神话传说", bio: "今天也有七十二种可能。" },
  { id: "zeus", name: "宙斯", glyph: "宙", tone: "purple", label: "神话传说", bio: "掌管雷电，也研究人间的充电接口。" },
  { id: "athena", name: "雅典娜", glyph: "雅", tone: "purple", label: "神话传说", bio: "智慧之外，也需要一点幽默。" },
  { id: "socrates", name: "苏格拉底", glyph: "苏", tone: "yellow", label: "哲学思辨", bio: "比答案更有趣的，是再问一个问题。" },
  { id: "newton", name: "牛顿", glyph: "牛", tone: "pink", label: "科学脑洞", bio: "万物都有引力，周一的床尤其如此。" },
  { id: "confucius", name: "孔子", glyph: "孔", tone: "green", label: "中国历史", bio: "三人行，也许会组一个聊天群。" },
  { id: "dufu", name: "杜甫", glyph: "杜", tone: "blue", label: "文学诗词", bio: "关心天下事，也关心今天的天气。" },
  { id: "cleopatra", name: "克娄巴特拉", glyph: "克", tone: "orange", label: "世界历史", bio: "尼罗河畔，新的故事正在发生。" },
  { id: "einstein", name: "爱因斯坦", glyph: "爱", tone: "yellow", label: "科学脑洞", bio: "时间是相对的，等回复的时候尤其漫长。" },
  { id: "nezha", name: "哪吒", glyph: "吒", tone: "pink", label: "神话传说", bio: "风火轮在脚下，脑洞也不设限。" },
  { id: "sushi", name: "苏轼", glyph: "苏", tone: "orange", label: "文学诗词", bio: "晴雨都能写成诗，路过的美食也不能错过。" },
  { id: "caocao", name: "曹操", glyph: "曹", tone: "blue", label: "中国历史", bio: "求贤若渴，也想找人分担一下工作群。" },
  { id: "zhugeliang", name: "诸葛亮", glyph: "诸", tone: "green", label: "中国历史", bio: "锦囊可以批发，周报请认真填写。" },
  { id: "wuzetian", name: "武则天", glyph: "武", tone: "purple", label: "中国历史", bio: "自己的剧本，当然要亲自执笔。" },
  { id: "liqingzhao", name: "李清照", glyph: "李", tone: "pink", label: "文学诗词", bio: "把细小的心事，酿成值得重读的一句。" },
  { id: "davinci", name: "达·芬奇", glyph: "达", tone: "yellow", label: "世界历史", bio: "画画只是开始，今天还想拆点东西研究。" },
  { id: "shakespeare", name: "莎士比亚", glyph: "莎", tone: "blue", label: "文学诗词", bio: "生活处处是舞台，群聊也能写成五幕剧。" },
  { id: "beethoven", name: "贝多芬", glyph: "贝", tone: "orange", label: "世界历史", bio: "给平常的一天，写一段不平常的旋律。" },
  { id: "darwin", name: "达尔文", glyph: "达", tone: "green", label: "科学脑洞", bio: "先观察，再记录，偶尔也研究一下通勤。" },
  { id: "curie", name: "居里夫人", glyph: "居", tone: "purple", label: "科学脑洞", bio: "好奇心常亮，实验记录也要按时备份。" },
];
export const topics: Topic[] = [
  { id: "history-work", name: "历史人物也要上班", description: "古今打工人，终于相遇。如果他们也要打卡、开会、写周报，会说些什么？", glyph: "班", tone: "orange" },
  { id: "gods-work", name: "神仙也打工", description: "神通广大，也有周一。天庭、奥林匹斯和花果山的同事们，来聊聊日常。", glyph: "神", tone: "green" },
  { id: "ancient-moments", name: "古人的朋友圈", description: "假如古人有了手机，他们会发怎样的动态？写下你想象中的开场白。", glyph: "圈", tone: "blue" },
  { id: "daily-troubles", name: "大人物的小烦恼", description: "再响亮的名字，也有平凡的烦恼。那些让我们会心一笑的小事，都可以聊。", glyph: "事", tone: "pink" },
  { id: "philosophy-life", name: "思想家的日常", description: "把大问题放进小生活。认真思考，也可以轻松一点。", glyph: "思", tone: "yellow" },
];
export function findPerson(id: string) { return people.find((person) => person.id === id); }
export function findTopic(id: string) { return topics.find((topic) => topic.id === id); }
export function characterCount(body: string) { return Array.from(body).length; }

export function createInitialContent(now: number): ContentState {
  const initialPosts: DemoPost[] = [
    { id: "post-01", personId: "qin", handle: "xiaowang", createdAt: now - 12 * 60_000, body: "统一了六国，统一不了我的作息。\n\n建议明天开始，全国统一下午上班。", topicIds: ["history-work"], featured: true },
    { id: "post-02", personId: "libai", handle: "moonlight", createdAt: now - 2 * DAY, body: "床前明月光，手机快没电。\n举头望明月，低头找插线。\n\n新作，先发朋友圈。", topicIds: ["ancient-moments"] },
    { id: "post-03", personId: "wukong", handle: "daydreamer", createdAt: now - 5 * 60_000, body: "筋斗云不限行，但是公司非让我打卡。\n\n一个跟头十万八千里，迟到一分钟扣五十。", topicIds: ["gods-work", "history-work"] },
    { id: "post-04", personId: "socrates", handle: "why_not", createdAt: now - 5 * DAY, body: "未经审视的人生不值得过。\n\n所以我又审视了一遍购物车，然后选择了再想想。", topicIds: ["philosophy-life"] },
    { id: "post-05", personId: "athena", handle: "olive_tree", createdAt: now - 2 * 3_600_000, body: "作为智慧女神，我承认：\n决定今天吃什么，是一道超纲题。", topicIds: ["gods-work", "daily-troubles"] },
    { id: "post-06", personId: "newton", handle: "apple_today", createdAt: now - 3 * DAY, body: "苹果落下来的时候，我发现了万有引力。\n闹钟响起来的时候，我选择了继续睡。", topicIds: ["daily-troubles"] },
    { id: "post-07", personId: "sushi", handle: "dongpo_kitchen", createdAt: now - 18 * 60_000, body: "今天认真研究了两件事：如何把日子过好，以及红烧肉为什么还没熟。\n\n结论：人生可以慢慢来，锅盖不要一直掀。", topicIds: ["ancient-moments", "daily-troubles"], featured: true },
    { id: "post-08", personId: "caocao", handle: "moonlit_recruiter", createdAt: now - 42 * 60_000, body: "求贤若渴是真的，面试排到晚上也是真的。\n\n有没有会写周报的军师？要求不高，别每次只交四个字：臣有一计。", topicIds: ["history-work"] },
    { id: "post-09", personId: "zhugeliang", handle: "kongming_online", createdAt: now - 7 * 60_000, body: "锦囊发出去了，群里却没人点「收到」。\n\n下次出发之前，先统一培训一下：重要军情不要设置消息免打扰。", topicIds: ["history-work", "ancient-moments"] },
    { id: "post-10", personId: "wuzetian", handle: "royal_agenda", createdAt: now - 85 * 60_000, body: "早朝有人说，这个方案一直都是这么做的。\n\n朕听完，给会议纪要加了一条：「一直如此」不算理由，请带着新方案再来。", topicIds: ["history-work"] },
    { id: "post-11", personId: "liqingzhao", handle: "yian_notebook", createdAt: now - 26 * 60_000, body: "新建了一个文件夹，叫《最终版词稿》。\n\n里面已经有了《最终版2》《真的最终版》和《这次真不改了》。创作的尽头，原来是文件管理。", topicIds: ["ancient-moments", "daily-troubles"] },
    { id: "post-12", personId: "davinci", handle: "unfinished_sketch", createdAt: now - 2 * 3_600_000, body: "客户说：简单改一下就行。\n\n我说好的，然后顺手画了三张机械草图、研究了翅膀，差点忘记他原来只是想换个背景。", topicIds: ["daily-troubles"] },
    { id: "post-13", personId: "shakespeare", handle: "five_act_groupchat", createdAt: now - 53 * 60_000, body: "朋友发来一句「在吗」，然后就不说话了。\n\n我盯着对话框，已经写出了五幕独白。最后一幕叫：你倒是把事情一起说完啊。", topicIds: ["daily-troubles", "philosophy-life"] },
    { id: "post-14", personId: "beethoven", handle: "symphony_nextdoor", createdAt: now - 3 * 3_600_000, body: "楼上装修的节奏不太稳定，忍不住帮他记了谱。\n\n第一乐章：电钻。第二乐章：搬椅子。终章还没写，物业终于来敲门了。", topicIds: ["daily-troubles"] },
    { id: "post-15", personId: "darwin", handle: "beagle_fieldnotes", createdAt: now - 12 * 60_000, body: "连续观察食堂三周，发现最适应午餐环境的同学有一个共同特征：\n\n提前看菜单，下课不犹豫。我决定从明天开始，先学这一点。", topicIds: ["daily-troubles", "philosophy-life"] },
    { id: "post-16", personId: "curie", handle: "lab_after_hours", createdAt: now - 64 * 60_000, body: "实验记录写了八页，今天最重要的生活发现是：\n\n咖啡放凉以后，不会因为你盯着它就重新变热。明天先带保温杯，再谈伟大发现。", topicIds: ["history-work", "daily-troubles"] },
  ];
  const replies = [
    ["wukong", "daydreamer", "别急，我也有五百年没起床。"],
    ["zeus", "cloud_reader", "这个提议，奥林匹斯也想加入。"],
    ["dufu", "poetry_daily", "路过，忍不住也想写两句。"],
  ];
  const extraReplies: Record<string, string[][]> = {
    "post-07": [["libai", "moonlight", "肉熟了叫我，酒已经备好了。"], ["liqingzhao", "yian_notebook", "建议先把菜谱另存为最终版。"]],
    "post-08": [["zhugeliang", "kongming_online", "周报可以写，远程办公能谈吗？"], ["socrates", "why_not", "在求贤之前，我们是不是应该先定义一下什么叫贤？"]],
    "post-09": [["wukong", "daydreamer", "收到。刚从云上下来，信号不太好。"], ["caocao", "moonlit_recruiter", "这套培训课件，能不能共享一份？"]],
    "post-10": [["qin", "xiaowang", "同意。统一格式以后，也得允许内容更新。"], ["athena", "olive_tree", "这条会议纪要，值得贴在所有会议室门口。"]],
    "post-11": [["dufu", "poetry_daily", "我还有一个文件夹，叫旧稿不能删。"], ["davinci", "unfinished_sketch", "我的最终版，目前还在草图阶段。"]],
    "post-12": [["newton", "apple_today", "换背景之前，可以先研究一下透视。很快，又是一天。"], ["wuzetian", "royal_agenda", "先交初稿，研究计划单独立项。"]],
    "post-13": [["sushi", "dongpo_kitchen", "我一般直接回复：吃了吗？"], ["confucius", "study_together", "己所不欲，勿只发在吗。"]],
    "post-14": [["zeus", "cloud_reader", "雷声这段要不要合作？我可以提供素材。"], ["liqingzhao", "yian_notebook", "最期待的是终章之后的休止符。"]],
    "post-15": [["curie", "lab_after_hours", "已加入明日实验计划：提前点餐。"], ["nezha", "windfire_commute", "风火轮停在食堂门口，算不算额外优势？"]],
    "post-16": [["einstein", "relative_time", "等咖啡变热的时间，确实显得特别漫长。"], ["sushi", "dongpo_kitchen", "实验之余也要好好吃饭。保温杯可以顺便带汤。"]],
  };
  const comments: DemoComment[] = initialPosts.flatMap((post, index) => (extraReplies[post.id] ?? replies.slice(0, index % 2 ? 2 : 3)).map((reply, replyIndex) => ({
    id: `seed-comment-${index}-${replyIndex}`, postId: post.id, personId: reply[0], handle: reply[1], body: reply[2],
    createdAt: post.createdAt + (now - post.createdAt) * (replyIndex + 1) / 4,
  })));
  const popularity = [128, 246, 89, 167, 203, 112, 34, 67, 52, 92, 41, 58, 76, 29, 63, 47];
  const likes = initialPosts.flatMap((post, postIndex) => Array.from({ length: popularity[postIndex] }, (_, index) => ({
    postId: post.id, handle: `audience_${index}`,
    createdAt: now - 1_000 - ((index + 1) / (popularity[postIndex] + 1)) * Math.min(now - post.createdAt - 2_000, 6 * DAY),
  })));
  return { version: 1, demoSeedRevision: 2, posts: initialPosts, comments, likes, recentPeople: {}, requests: {}, reviews: createSeedReviews(now), transactions: createSeedTransactions(now), reports: [], pollVotes: [], characterRequests: [] };
}

export function expandDemoSeedContent(state: ContentState, now: number): ContentState {
  if ((state.demoSeedRevision ?? 1) >= 2) return state;
  const seed = createInitialContent(now);
  const additions = seed.posts.filter((post) => Number(post.id.slice(5)) >= 7 && !state.posts.some((existing) => existing.id === post.id));
  const addedIds = new Set(additions.map((post) => post.id));
  return { ...state, demoSeedRevision: 2, posts: [...state.posts, ...additions], comments: [...state.comments, ...seed.comments.filter((comment) => addedIds.has(comment.postId))], likes: [...state.likes, ...seed.likes.filter((like) => addedIds.has(like.postId))] };
}

export function chinaDay(now: number) { return new Date(now + 8 * 3_600_000).toISOString().slice(0, 10); }
function createSeedReviews(now: number): DemoReview[] {
  const bodies = ["这个人物的故事，总能让人想到新的角度。", "严肃的名字，也可以有轻松的一面。", "很适合用这个身份接一句有趣的话。", "历史与想象交汇的地方，很有意思。", "期待看到更多不同的演绎。"];
  return people.slice(0, 8).flatMap((person, personIndex) => bodies.map((body, index) => ({ id: `seed-review-${person.id}-${index}`, personId: person.id, handle: `critic_${index}`, score: 3 + ((personIndex + index) % 3), body, updatedAt: now - (index + 1) * 3_600_000 })));
}
function createSeedTransactions(now: number): CoinTransaction[] {
  return Array.from({ length: 30 }, (_, index) => { const handle = `supporter_${index}`; const time = now - (index % 3) * DAY - 60_000; return [
    { id: `seed-grant-${index}`, handle, kind: "grant" as const, amount: 10, day: chinaDay(time), createdAt: time },
    { id: `seed-tip-${index}`, handle, kind: "tip" as const, amount: 1 + index % 5, personId: people[index % people.length].id, day: chinaDay(time + 1_000), createdAt: time + 1_000, requestKey: `seed-${index}` },
  ]; }).flat();
}

function requireActor(handle: string | null): asserts handle is string {
  if (!handle || !/^[a-z0-9_]{3,20}$/.test(handle)) throw new Error("请先登录演示账号，再参与互动。");
}
function validateBody(body: string) {
  const value = body.trim();
  if (!value || characterCount(value) > 500) throw new Error("正文需为 1～500 个字符，不能只有空白。");
  return value;
}
function validatePerson(personId: string) {
  if (!findPerson(personId)) throw new Error("请先选择本次扮演的人物。");
}
function remember(state: ContentState, handle: string, personId: string) {
  const previous = Object.hasOwn(state.recentPeople, handle) ? state.recentPeople[handle] : [];
  return { ...state.recentPeople, [handle]: [personId, ...previous.filter((id) => id !== personId)].slice(0, 4) };
}

export function publishPost(state: ContentState, handle: string | null, draft: Draft, requestId: string, now: number) {
  requireActor(handle);
  const key = `${handle}:post:${requestId}`;
  if (state.requests[key]) {
    if (!state.posts.some((post) => post.id === state.requests[key])) throw new Error("这次发布对应的内容已删除，请重新编辑后发布。");
    return { state, id: state.requests[key] };
  }
  validatePerson(draft.personId);
  const body = draft.body.trim();
  const attachments = validateAttachments(draft.attachments);
  const pollDraft = draft.poll ? normalizePoll(draft.poll) : undefined;
  if (characterCount(body) > 500 || (!body && !attachments.length && !pollDraft && !draft.quotePostId)) throw new Error("写点正文，或添加图片、视频、投票、引用；正文最多 500 字。");
  if (draft.quotePostId && !state.posts.some((post) => post.id === draft.quotePostId)) throw new Error("引用的帖子已不存在，请移除引用后再发布。");
  const topicIds = [...new Set(draft.topicIds)];
  if (topicIds.length > 3 || topicIds.some((id) => !findTopic(id))) throw new Error("请选择最多 3 个有效话题。");
  const id = `local-post-${handle}-${requestId}`;
  const post: DemoPost = { id, personId: draft.personId, handle, body, topicIds, createdAt: now,
    ...(attachments.length ? { attachments } : {}), ...(draft.quotePostId ? { quotePostId: draft.quotePostId } : {}),
    ...(pollDraft ? { poll: { question: pollDraft.question, options: pollDraft.options.map((text, index) => ({ id: `${id}-o${index}`, text })), endsAt: now + pollDraft.durationHours * 3_600_000 } } : {}),
  };
  return { id, state: { ...state, posts: [post, ...state.posts], recentPeople: remember(state, handle, draft.personId), requests: { ...state.requests, [key]: id } } };
}

export function publishComment(state: ContentState, handle: string | null, postId: string, draft: Draft, requestId: string, now: number) {
  requireActor(handle);
  if (!state.posts.some((post) => post.id === postId)) throw new Error("这条帖子已不存在，无法继续评论。");
  const key = `${handle}:comment:${postId}:${requestId}`;
  if (state.requests[key]) {
    if (!state.comments.some((comment) => comment.id === state.requests[key])) throw new Error("这次评论已删除，请重新编辑后发布。");
    return { state, id: state.requests[key] };
  }
  validatePerson(draft.personId);
  const comment: DemoComment = { id: `local-comment-${handle}-${postId}-${requestId}`, postId, personId: draft.personId, handle, body: validateBody(draft.body), createdAt: now };
  return { id: comment.id, state: { ...state, comments: [...state.comments, comment], recentPeople: remember(state, handle, draft.personId), requests: { ...state.requests, [key]: comment.id } } };
}

export function setPostLike(state: ContentState, handle: string | null, postId: string, liked: boolean, now: number): ContentState {
  requireActor(handle);
  if (!state.posts.some((post) => post.id === postId)) throw new Error("这条帖子已不存在。");
  const exists = state.likes.some((like) => like.postId === postId && like.handle === handle);
  if (liked === exists) return state;
  return { ...state, likes: liked ? [...state.likes, { handle, postId, createdAt: now }] : state.likes.filter((like) => like.postId !== postId || like.handle !== handle) };
}

export function removePost(state: ContentState, handle: string | null, postId: string): ContentState {
  requireActor(handle);
  const post = state.posts.find((item) => item.id === postId);
  if (!post || post.handle !== handle) throw new Error("只能删除自己发布的帖子。");
  return { ...state, posts: state.posts.filter((item) => item.id !== postId), comments: state.comments.filter((item) => item.postId !== postId), likes: state.likes.filter((item) => item.postId !== postId), pollVotes: state.pollVotes.filter((item) => item.postId !== postId) };
}
export function removeComment(state: ContentState, handle: string | null, commentId: string): ContentState {
  requireActor(handle);
  if (!state.comments.some((item) => item.id === commentId && item.handle === handle)) throw new Error("只能删除自己发布的评论。");
  return { ...state, comments: state.comments.filter((item) => item.id !== commentId) };
}

export function postStats(state: ContentState, postId: string, handle?: string | null) {
  const gifts = state.transactions.filter((item) => item.kind === "gift" && item.postId === postId);
  return { likes: state.likes.filter((like) => like.postId === postId).length, comments: state.comments.filter((comment) => comment.postId === postId).length, liked: Boolean(handle && state.likes.some((like) => like.postId === postId && like.handle === handle)), gifts: gifts.reduce((sum, item) => sum + item.amount, 0), gifted: Boolean(handle && gifts.some((item) => item.handle === handle)) };
}
export function rankPosts(state: ContentState, days: 1 | 7, now: number) {
  const since = now - days * DAY;
  return state.posts.map((post) => {
    const likes = state.likes.filter((like) => like.postId === post.id && like.handle !== post.handle && like.createdAt >= since && like.createdAt <= now);
    const comments = state.comments.filter((comment) => comment.postId === post.id && comment.handle !== post.handle && comment.createdAt >= since && comment.createdAt <= now);
    const score = new Set(likes.map((like) => like.handle)).size + 3 * new Set(comments.map((comment) => comment.handle)).size;
    return { post, score, activityAt: Math.max(post.createdAt, ...likes.map((like) => like.createdAt), ...comments.map((comment) => comment.createdAt)) };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || b.activityAt - a.activityAt || a.post.id.localeCompare(b.post.id));
}
export function rankTopics(state: ContentState, days: 1 | 7, now: number) {
  const since = now - days * DAY;
  return topics.map((topic) => {
    const relevant = state.posts.filter((post) => post.topicIds.includes(topic.id));
    const map = new Map(relevant.map((post) => [post.id, post]));
    const authors = new Set(relevant.filter((post) => post.createdAt >= since && post.createdAt <= now).map((post) => post.handle));
    const likes = new Set(state.likes.filter((like) => { const post = map.get(like.postId); return post && post.handle !== like.handle && like.createdAt >= since && like.createdAt <= now; }).map((like) => like.handle));
    const commenters = new Set(state.comments.filter((comment) => { const post = map.get(comment.postId); return post && post.handle !== comment.handle && comment.createdAt >= since && comment.createdAt <= now; }).map((comment) => comment.handle));
    const score = 2 * authors.size + likes.size + 3 * commenters.size;
    return { topic, score, posts: relevant.length, participants: new Set([...authors, ...likes, ...commenters]).size };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.topic.id.localeCompare(b.topic.id));
}

export function formatPostTime(createdAt: number, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - createdAt) / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} 天前`;
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric" }).format(createdAt);
}

export function saveReview(state: ContentState, handle: string | null, personId: string, score: number, body: string, now: number): ContentState {
  requireActor(handle); validatePerson(personId);
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error("请选择 1～5 分。");
  if (characterCount(body.trim()) > 500) throw new Error("评价不能超过 500 个字符。");
  const existing = state.reviews.find((review) => review.personId === personId && review.handle === handle);
  const review: DemoReview = { id: existing?.id ?? `review-${handle}-${personId}`, handle, personId, score, body: body.trim(), updatedAt: now };
  return { ...state, reviews: [review, ...state.reviews.filter((item) => item.id !== review.id)] };
}
export function removeReview(state: ContentState, handle: string | null, reviewId: string): ContentState {
  requireActor(handle);
  if (!state.reviews.some((review) => review.id === reviewId && review.handle === handle)) throw new Error("只能删除自己的评价。");
  return { ...state, reviews: state.reviews.filter((review) => review.id !== reviewId) };
}
export function transactionDelta(item: CoinTransaction, handle: string) {
  if (item.kind === "gift" && item.recipientHandle === handle) return item.amount;
  if (item.handle !== handle) return 0;
  return item.kind === "grant" ? item.amount : -item.amount;
}
export function walletBalance(state: ContentState, handle: string) { return state.transactions.reduce((sum, item) => sum + transactionDelta(item, handle), 0); }
export function grantDailyCoins(state: ContentState, handle: string | null, now: number): ContentState {
  requireActor(handle); const day = chinaDay(now);
  if (state.transactions.some((item) => item.handle === handle && item.kind === "grant" && item.day === day)) return state;
  return { ...state, transactions: [...state.transactions, { id: `grant-${handle}-${day}`, handle, kind: "grant", amount: 10, day, createdAt: now }] };
}
export function tipPerson(state: ContentState, handle: string | null, personId: string, amount: number, requestKey: string, now: number): ContentState {
  requireActor(handle); validatePerson(personId);
  const previous = state.transactions.find((item) => item.handle === handle && item.kind === "tip" && item.requestKey === requestKey);
  if (previous) { if (previous.personId !== personId || previous.amount !== amount) throw new Error("这次投币请求已处理，请重新确认数量。"); return state; }
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("投币数量必须是正整数。");
  if (amount > walletBalance(state, handle)) throw new Error("通宝余额不足，投币尚未发生。");
  return { ...state, transactions: [...state.transactions, { id: `tip-${handle}-${requestKey}`, handle, personId, kind: "tip", amount, day: chinaDay(now), createdAt: now, requestKey }] };
}
export function giftPostAuthor(state: ContentState, handle: string | null, postId: string, amount: number, requestKey: string, now: number): ContentState {
  requireActor(handle);
  if (typeof requestKey !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(requestKey)) throw new Error("赠送请求无效，请重新打开赠送窗口。");
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error("赠送数量必须是正整数。");
  const previous = state.transactions.find((item) => item.handle === handle && item.kind === "gift" && item.requestKey === requestKey);
  if (previous) { if (previous.postId !== postId || previous.amount !== amount) throw new Error("这次赠送已处理，请重新确认。"); return state; }
  const post = state.posts.find((item) => item.id === postId);
  if (!post) throw new Error("帖子已不存在，无法赠送。");
  if (post.handle === handle) throw new Error("不能给自己的帖子赠送通宝。");
  if (!Number.isFinite(now) || now < post.createdAt || now <= 0) throw new Error("赠送时间无效，请刷新后重试。");
  if (amount > walletBalance(state, handle)) throw new Error("通宝余额不足，赠送尚未发生。");
  if (!Number.isSafeInteger(walletBalance(state, post.handle) + amount)) throw new Error("收款账号余额已达上限，赠送尚未发生。");
  return { ...state, transactions: [...state.transactions, { id: `gift-${handle}-${requestKey}`, handle, kind: "gift", amount, recipientHandle: post.handle, postId, day: chinaDay(now), createdAt: now, requestKey }] };
}
export function personStats(state: ContentState, personId: string, now: number) {
  const reviews = state.reviews.filter((review) => review.personId === personId);
  const tips = state.transactions.filter((item) => item.kind === "tip" && item.personId === personId);
  return { count: reviews.length, average: reviews.length ? reviews.reduce((sum, item) => sum + item.score, 0) / reviews.length : null, total: tips.reduce((sum, item) => sum + item.amount, 0), today: tips.filter((item) => item.day === chinaDay(now)).reduce((sum, item) => sum + item.amount, 0) };
}
export function rankPeople(state: ContentState, mode: "rating" | "today" | "total", now: number) {
  return people.map((person) => { const stats = personStats(state, person.id, now); return { person, ...stats, score: mode === "rating" ? stats.average ?? 0 : stats[mode] }; })
    .filter((item) => mode === "rating" ? item.count >= 5 : item.score > 0)
    .sort((a, b) => b.score - a.score || b.count - a.count || a.person.id.localeCompare(b.person.id));
}
export function reportContent(state: ContentState, handle: string | null, kind: DemoReport["kind"], targetId: string, reason: string, now: number): ContentState {
  requireActor(handle);
  const entries = kind === "post" ? state.posts : kind === "comment" ? state.comments : state.reviews;
  if (!entries.some((item) => item.id === targetId)) throw new Error("内容已不存在。");
  if (!["冒充或误导", "人身攻击", "垃圾广告", "其他"].includes(reason)) throw new Error("请选择举报原因。");
  if (state.reports.some((item) => item.handle === handle && item.kind === kind && item.targetId === targetId)) return state;
  return { ...state, reports: [...state.reports, { id: `report-${handle}-${kind}-${targetId}`, handle, kind, targetId, reason, createdAt: now }] };
}

export function voteInPoll(state: ContentState, handle: string | null, postId: string, optionId: string, now: number): ContentState {
  requireActor(handle);
  const poll = state.posts.find((post) => post.id === postId)?.poll;
  if (!poll || !poll.options.some((option) => option.id === optionId)) throw new Error("投票或选项已不存在。");
  const previous = state.pollVotes.find((vote) => vote.handle === handle && vote.postId === postId);
  if (previous) { if (previous.optionId === optionId) return state; throw new Error("每个账号只能投一次，不能通过更换人物重复投票。"); }
  if (now >= poll.endsAt) throw new Error("这场投票已经结束。");
  return { ...state, pollVotes: [...state.pollVotes, { postId, optionId, handle, createdAt: now }] };
}
export function requestCharacter(state: ContentState, handle: string | null, input: { name: string; bio: string; sourceUrl: string }, requestId: string, now: number) {
  requireActor(handle);
  const name = input.name.trim(); const bio = input.bio.trim(); const sourceUrl = normalizeEncyclopediaUrl(input.sourceUrl);
  if (characterCount(name) > 60 || characterCount(bio) > 1000 || (!sourceUrl && (!name || !bio))) throw new Error("请填写人物名称和基本信息，或粘贴百科词条链接。名称最多 60 字，介绍最多 1000 字。");
  if (name && people.some((person) => person.name.toLowerCase() === name.toLowerCase())) throw new Error("这位人物已在公共库中，可直接搜索使用。");
  const existing = state.characterRequests.find((item) => item.handle === handle && (item.id === `character-request-${handle}-${requestId}` || (sourceUrl && item.sourceUrl === sourceUrl) || (name && item.name.toLowerCase() === name.toLowerCase())));
  if (existing) return { state, id: existing.id };
  const entry: CharacterRequest = { id: `character-request-${handle}-${requestId}`, handle, name, bio, sourceUrl, status: "pending", createdAt: now };
  return { state: { ...state, characterRequests: [...state.characterRequests, entry] }, id: entry.id };
}

export function deserializeContent(raw: string): ContentState {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("本地内容格式无效。");
  const state = value as ContentState;
  if (state.demoSeedRevision !== undefined && (!Number.isInteger(state.demoSeedRevision) || state.demoSeedRevision < 1 || state.demoSeedRevision > 2)) throw new Error("本机示例内容版本无效。");
  if (state.reviews === undefined) state.reviews = createSeedReviews(Date.now());
  if (state.transactions === undefined) state.transactions = createSeedTransactions(Date.now());
  if (state.reports === undefined) state.reports = [];
  if (state.pollVotes === undefined) state.pollVotes = [];
  if (state.characterRequests === undefined) state.characterRequests = [];
  const validHandle = (handle: unknown) => typeof handle === "string" && /^[a-z0-9_]{3,20}$/.test(handle);
  const validTime = (time: unknown) => typeof time === "number" && Number.isFinite(time) && time > 0;
  if (state.version !== 1 || !Array.isArray(state.posts) || !Array.isArray(state.comments) || !Array.isArray(state.likes) || !state.recentPeople || typeof state.recentPeople !== "object" || !state.requests || typeof state.requests !== "object") throw new Error("本地内容版本或格式无效。");
  const ids = new Set<string>();
  for (const post of state.posts) {
    if (!post || typeof post.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(post.id) || ids.has(post.id) || !validHandle(post.handle) || !findPerson(post.personId) || typeof post.body !== "string" || (!post.body.trim() && !post.attachments?.length && !post.poll && !post.quotePostId) || characterCount(post.body) > 500 || !validTime(post.createdAt) || !Array.isArray(post.topicIds) || post.topicIds.length > 3 || post.topicIds.some((id) => !findTopic(id))) throw new Error("本地帖子数据无效。");
    validateAttachments(post.attachments);
    if (post.quotePostId !== undefined && (typeof post.quotePostId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(post.quotePostId) || post.quotePostId === post.id)) throw new Error("引用信息无效。");
    if (post.poll) {
      const poll = post.poll;
      if (!Array.isArray(poll.options) || !validTime(poll.endsAt) || poll.endsAt <= post.createdAt || poll.options.some((option, index) => !option || option.id !== `${post.id}-o${index}`)) throw new Error("投票信息无效。");
      normalizePoll({ question: poll.question, options: poll.options.map((option) => option.text), durationHours: 24 });
    }
    ids.add(post.id);
  }
  for (const comment of state.comments) if (!comment || typeof comment.id !== "string" || !ids.has(comment.postId) || !validHandle(comment.handle) || !findPerson(comment.personId) || typeof comment.body !== "string" || !comment.body.trim() || characterCount(comment.body) > 500 || !validTime(comment.createdAt)) throw new Error("本地评论数据无效。");
  const uniqueLikes = new Set<string>();
  for (const like of state.likes) {
    const key = `${like?.postId}:${like?.handle}`;
    if (!like || !ids.has(like.postId) || !validHandle(like.handle) || !validTime(like.createdAt) || uniqueLikes.has(key)) throw new Error("本地点赞数据无效。");
    uniqueLikes.add(key);
  }
  for (const [handle, list] of Object.entries(state.recentPeople)) if (!validHandle(handle) || !Array.isArray(list) || list.some((id) => !findPerson(id))) throw new Error("最近人物记录无效。");
  if (Object.values(state.requests).some((id) => typeof id !== "string")) throw new Error("本地发布记录无效。");
  if (!Array.isArray(state.reviews) || !Array.isArray(state.transactions) || !Array.isArray(state.reports)) throw new Error("本机人物互动数据无效。");
  const reviewPairs = new Set<string>();
  for (const review of state.reviews) { const pair = `${review?.handle}:${review?.personId}`; if (!review || typeof review.id !== "string" || !validHandle(review.handle) || !findPerson(review.personId) || !Number.isInteger(review.score) || review.score < 1 || review.score > 5 || typeof review.body !== "string" || characterCount(review.body) > 500 || !validTime(review.updatedAt) || reviewPairs.has(pair)) throw new Error("本机评分数据无效。"); reviewPairs.add(pair); }
  const transactionIds = new Set<string>(); const grants = new Set<string>(); const tipRequests = new Set<string>(); const giftRequests = new Set<string>();
  for (const item of state.transactions) {
    if (!item || typeof item.id !== "string" || transactionIds.has(item.id) || !validHandle(item.handle) || !validTime(item.createdAt) || !Number.isSafeInteger(item.amount) || item.amount <= 0 || item.day !== chinaDay(item.createdAt) || !["grant", "tip", "gift"].includes(item.kind)) throw new Error("本机通宝流水无效。");
    transactionIds.add(item.id);
    if (item.kind !== "gift" && (item.recipientHandle !== undefined || item.postId !== undefined)) throw new Error("本机通宝流水类型无效。");
    if (item.kind === "grant") { const pair = `${item.handle}:${item.day}`; if (item.amount !== 10 || grants.has(pair)) throw new Error("本机每日领取记录无效。"); grants.add(pair); }
    else if (item.kind === "tip") { const pair = `${item.handle}:${item.requestKey}`; if (!item.personId || !findPerson(item.personId) || typeof item.requestKey !== "string" || tipRequests.has(pair)) throw new Error("本机投币记录无效。"); tipRequests.add(pair); }
    else {
      const pair = `${item.handle}:${item.requestKey}`; const post = state.posts.find((post) => post.id === item.postId);
      if (!validHandle(item.recipientHandle) || item.recipientHandle === item.handle || typeof item.postId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(item.postId) || item.personId !== undefined || typeof item.requestKey !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.requestKey) || item.id !== `gift-${item.handle}-${item.requestKey}` || giftRequests.has(pair) || (post && (post.handle !== item.recipientHandle || item.createdAt < post.createdAt))) throw new Error("本机赠送记录无效。");
      giftRequests.add(pair);
    }
  }
  for (const handle of new Set(state.transactions.flatMap((item) => item.kind === "gift" ? [item.handle, item.recipientHandle!] : [item.handle]))) { const balance = walletBalance(state, handle); if (!Number.isSafeInteger(balance) || balance < 0) throw new Error("本机通宝余额无效。"); }
  for (const item of state.reports) if (!item || !validHandle(item.handle) || typeof item.targetId !== "string" || !["post", "comment", "review"].includes(item.kind) || typeof item.reason !== "string" || !validTime(item.createdAt)) throw new Error("本机举报记录无效。");
  if (!Array.isArray(state.pollVotes) || !Array.isArray(state.characterRequests)) throw new Error("投票或人物申请数据无效。");
  const voters = new Set<string>();
  for (const vote of state.pollVotes) {
    const poll = state.posts.find((post) => post.id === vote?.postId)?.poll; const key = `${vote?.postId}:${vote?.handle}`;
    if (!vote || !poll || !validHandle(vote.handle) || !validTime(vote.createdAt) || vote.createdAt >= poll.endsAt || !poll.options.some((option) => option.id === vote.optionId) || voters.has(key)) throw new Error("投票记录无效。");
    voters.add(key);
  }
  const requestIds = new Set<string>();
  for (const item of state.characterRequests) {
    if (!item || typeof item.id !== "string" || requestIds.has(item.id) || !validHandle(item.handle) || item.status !== "pending" || !validTime(item.createdAt) || typeof item.name !== "string" || typeof item.bio !== "string" || typeof item.sourceUrl !== "string" || characterCount(item.name) > 60 || characterCount(item.bio) > 1000 || (!item.sourceUrl && (!item.name.trim() || !item.bio.trim())) || normalizeEncyclopediaUrl(item.sourceUrl) !== item.sourceUrl) throw new Error("人物申请记录无效。");
    requestIds.add(item.id);
  }
  return state;
}
