BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "inrole";

-- CreateEnum
CREATE TYPE "inrole"."UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "inrole"."UserStatus" AS ENUM ('ACTIVE', 'BANNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "inrole"."Visibility" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "inrole"."MediaPurpose" AS ENUM ('POST_IMAGE', 'POST_VIDEO', 'PERSON_AVATAR');

-- CreateEnum
CREATE TYPE "inrole"."MediaStatus" AS ENUM ('PENDING', 'UPLOADED', 'READY', 'HIDDEN', 'DELETED');

-- CreateEnum
CREATE TYPE "inrole"."CharacterRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "inrole"."ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "inrole"."CoinOperationKind" AS ENUM ('DAILY_GRANT', 'PERSON_TIP', 'POST_GIFT');

-- CreateEnum
CREATE TYPE "inrole"."WriteRequestStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "inrole"."app_users" (
    "id" UUID NOT NULL,
    "handle" VARCHAR(20) NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "role" "inrole"."UserRole" NOT NULL DEFAULT 'USER',
    "status" "inrole"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "authVersion" INTEGER NOT NULL DEFAULT 1,
    "onboardingCompletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."password_credentials" (
    "userId" UUID NOT NULL,
    "passwordHash" VARCHAR(512) NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_credentials_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "inrole"."auth_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."recovery_codes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMPTZ(3),

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."rate_limit_buckets" (
    "scope" VARCHAR(64) NOT NULL,
    "keyHash" CHAR(64) NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("scope","keyHash","windowStart")
);

-- CreateTable
CREATE TABLE "inrole"."interest_tags" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "interest_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."user_interests" (
    "userId" UUID NOT NULL,
    "interestId" VARCHAR(64) NOT NULL,

    CONSTRAINT "user_interests_pkey" PRIMARY KEY ("userId","interestId")
);

-- CreateTable
CREATE TABLE "inrole"."people" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT NOT NULL,
    "primaryInterestId" VARCHAR(64) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "legacyAvatarPath" VARCHAR(255),
    "avatarMediaId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."person_sources" (
    "id" UUID NOT NULL,
    "personId" VARCHAR(64) NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "author" TEXT,
    "license" TEXT,
    "licenseUrl" TEXT,
    "modifications" TEXT,

    CONSTRAINT "person_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."person_interests" (
    "personId" VARCHAR(64) NOT NULL,
    "interestId" VARCHAR(64) NOT NULL,

    CONSTRAINT "person_interests_pkey" PRIMARY KEY ("personId","interestId")
);

-- CreateTable
CREATE TABLE "inrole"."user_recent_people" (
    "userId" UUID NOT NULL,
    "personId" VARCHAR(64) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_recent_people_pkey" PRIMARY KEY ("userId","personId")
);

-- CreateTable
CREATE TABLE "inrole"."topics" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."topic_interests" (
    "topicId" VARCHAR(64) NOT NULL,
    "interestId" VARCHAR(64) NOT NULL,

    CONSTRAINT "topic_interests_pkey" PRIMARY KEY ("topicId","interestId")
);

-- CreateTable
CREATE TABLE "inrole"."posts" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "personId" VARCHAR(64) NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "quotePostId" UUID,
    "visibility" "inrole"."Visibility" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."post_topics" (
    "postId" UUID NOT NULL,
    "topicId" VARCHAR(64) NOT NULL,

    CONSTRAINT "post_topics_pkey" PRIMARY KEY ("postId","topicId")
);

-- CreateTable
CREATE TABLE "inrole"."comments" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "personId" VARCHAR(64) NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "inrole"."Visibility" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."post_likes" (
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_likes_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "inrole"."person_reviews" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "personId" VARCHAR(64) NOT NULL,
    "score" SMALLINT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "visibility" "inrole"."Visibility" NOT NULL DEFAULT 'VISIBLE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "person_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."media_assets" (
    "id" UUID NOT NULL,
    "ownerId" UUID,
    "purpose" "inrole"."MediaPurpose" NOT NULL,
    "status" "inrole"."MediaStatus" NOT NULL DEFAULT 'PENDING',
    "bucket" VARCHAR(100) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mime" VARCHAR(100) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "sourceUrl" TEXT,
    "sourceAuthor" TEXT,
    "license" TEXT,
    "licenseUrl" TEXT,
    "attribution" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."post_media" (
    "postId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("postId","mediaId")
);

-- CreateTable
CREATE TABLE "inrole"."polls" (
    "postId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "inrole"."poll_options" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."poll_votes" (
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "inrole"."character_requests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT,
    "dedupeKey" CHAR(64) NOT NULL,
    "status" "inrole"."CharacterRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" UUID,
    "approvedPersonId" VARCHAR(64),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ(3),

    CONSTRAINT "character_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."content_reports" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "postId" UUID,
    "commentId" UUID,
    "reviewId" UUID,
    "reason" TEXT NOT NULL,
    "status" "inrole"."ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."moderation_actions" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "targetType" VARCHAR(64) NOT NULL,
    "targetId" VARCHAR(100) NOT NULL,
    "reason" TEXT NOT NULL,
    "previousState" JSONB,
    "nextState" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."write_requests" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "scope" VARCHAR(64) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "status" "inrole"."WriteRequestStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "resultType" VARCHAR(64),
    "resultId" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "write_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."wallets" (
    "userId" UUID NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "inrole"."coin_operations" (
    "id" UUID NOT NULL,
    "kind" "inrole"."CoinOperationKind" NOT NULL,
    "actorId" UUID NOT NULL,
    "recipientId" UUID,
    "personId" VARCHAR(64),
    "postId" UUID,
    "amount" BIGINT NOT NULL,
    "grantDay" DATE,
    "requestId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."coin_entries" (
    "id" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "delta" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inrole"."feed_events" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "postId" UUID NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "algorithmVersion" VARCHAR(64) NOT NULL,
    "requestId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_users_handle_key" ON "inrole"."app_users"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_tokenHash_key" ON "inrole"."auth_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_revokedAt_expiresAt_idx" ON "inrole"."auth_sessions"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "auth_sessions_expiresAt_idx" ON "inrole"."auth_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_codes_codeHash_key" ON "inrole"."recovery_codes"("codeHash");

-- CreateIndex
CREATE INDEX "recovery_codes_userId_usedAt_idx" ON "inrole"."recovery_codes"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expiresAt_idx" ON "inrole"."rate_limit_buckets"("expiresAt");

-- CreateIndex
CREATE INDEX "user_interests_interestId_idx" ON "inrole"."user_interests"("interestId");

-- CreateIndex
CREATE INDEX "people_active_name_id_idx" ON "inrole"."people"("active", "name", "id");

-- CreateIndex
CREATE INDEX "people_primaryInterestId_active_idx" ON "inrole"."people"("primaryInterestId", "active");

-- CreateIndex
CREATE INDEX "person_sources_personId_idx" ON "inrole"."person_sources"("personId");

-- CreateIndex
CREATE INDEX "person_interests_interestId_idx" ON "inrole"."person_interests"("interestId");

-- CreateIndex
CREATE INDEX "user_recent_people_userId_lastUsedAt_idx" ON "inrole"."user_recent_people"("userId", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "topics_name_key" ON "inrole"."topics"("name");

-- CreateIndex
CREATE INDEX "topic_interests_interestId_idx" ON "inrole"."topic_interests"("interestId");

-- CreateIndex
CREATE INDEX "posts_visibility_createdAt_id_idx" ON "inrole"."posts"("visibility", "createdAt", "id");

-- CreateIndex
CREATE INDEX "posts_authorId_visibility_createdAt_id_idx" ON "inrole"."posts"("authorId", "visibility", "createdAt", "id");

-- CreateIndex
CREATE INDEX "posts_personId_visibility_createdAt_id_idx" ON "inrole"."posts"("personId", "visibility", "createdAt", "id");

-- CreateIndex
CREATE INDEX "posts_quotePostId_idx" ON "inrole"."posts"("quotePostId");

-- CreateIndex
CREATE INDEX "post_topics_topicId_postId_idx" ON "inrole"."post_topics"("topicId", "postId");

-- CreateIndex
CREATE INDEX "comments_postId_visibility_createdAt_id_idx" ON "inrole"."comments"("postId", "visibility", "createdAt", "id");

-- CreateIndex
CREATE INDEX "comments_authorId_createdAt_id_idx" ON "inrole"."comments"("authorId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "post_likes_postId_createdAt_idx" ON "inrole"."post_likes"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "person_reviews_personId_visibility_updatedAt_id_idx" ON "inrole"."person_reviews"("personId", "visibility", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "person_reviews_userId_personId_key" ON "inrole"."person_reviews"("userId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "inrole"."media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "media_assets_ownerId_status_createdAt_idx" ON "inrole"."media_assets"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "media_assets_status_createdAt_idx" ON "inrole"."media_assets"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_mediaId_key" ON "inrole"."post_media"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "post_media_postId_position_key" ON "inrole"."post_media"("postId", "position");

-- CreateIndex
CREATE INDEX "polls_endsAt_idx" ON "inrole"."polls"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "poll_options_id_postId_key" ON "inrole"."poll_options"("id", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_options_postId_position_key" ON "inrole"."poll_options"("postId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "poll_options_postId_normalizedText_key" ON "inrole"."poll_options"("postId", "normalizedText");

-- CreateIndex
CREATE INDEX "poll_votes_optionId_postId_idx" ON "inrole"."poll_votes"("optionId", "postId");

-- CreateIndex
CREATE INDEX "character_requests_status_createdAt_id_idx" ON "inrole"."character_requests"("status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "character_requests_userId_dedupeKey_key" ON "inrole"."character_requests"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "content_reports_status_createdAt_id_idx" ON "inrole"."content_reports"("status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_reporterId_postId_key" ON "inrole"."content_reports"("reporterId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_reporterId_commentId_key" ON "inrole"."content_reports"("reporterId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_reporterId_reviewId_key" ON "inrole"."content_reports"("reporterId", "reviewId");

-- CreateIndex
CREATE INDEX "moderation_actions_targetType_targetId_createdAt_idx" ON "inrole"."moderation_actions"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "moderation_actions_actorId_createdAt_idx" ON "inrole"."moderation_actions"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "write_requests_expiresAt_idx" ON "inrole"."write_requests"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "write_requests_userId_scope_key_key" ON "inrole"."write_requests"("userId", "scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "coin_operations_requestId_key" ON "inrole"."coin_operations"("requestId");

-- CreateIndex
CREATE INDEX "coin_operations_personId_createdAt_id_idx" ON "inrole"."coin_operations"("personId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "coin_operations_postId_createdAt_id_idx" ON "inrole"."coin_operations"("postId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "coin_operations_actorId_createdAt_id_idx" ON "inrole"."coin_operations"("actorId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "coin_operations_recipientId_createdAt_id_idx" ON "inrole"."coin_operations"("recipientId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "coin_operations_actorId_grantDay_key" ON "inrole"."coin_operations"("actorId", "grantDay");

-- CreateIndex
CREATE INDEX "coin_entries_userId_createdAt_id_idx" ON "inrole"."coin_entries"("userId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "coin_entries_operationId_userId_key" ON "inrole"."coin_entries"("operationId", "userId");

-- CreateIndex
CREATE INDEX "feed_events_userId_createdAt_idx" ON "inrole"."feed_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "feed_events_createdAt_idx" ON "inrole"."feed_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "feed_events_requestId_postId_kind_key" ON "inrole"."feed_events"("requestId", "postId", "kind");

-- AddForeignKey
ALTER TABLE "inrole"."password_credentials" ADD CONSTRAINT "password_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."recovery_codes" ADD CONSTRAINT "recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."user_interests" ADD CONSTRAINT "user_interests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."user_interests" ADD CONSTRAINT "user_interests_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "inrole"."interest_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."people" ADD CONSTRAINT "people_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "inrole"."media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."people" ADD CONSTRAINT "people_primaryInterestId_fkey" FOREIGN KEY ("primaryInterestId") REFERENCES "inrole"."interest_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."person_sources" ADD CONSTRAINT "person_sources_personId_fkey" FOREIGN KEY ("personId") REFERENCES "inrole"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."person_interests" ADD CONSTRAINT "person_interests_personId_fkey" FOREIGN KEY ("personId") REFERENCES "inrole"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."person_interests" ADD CONSTRAINT "person_interests_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "inrole"."interest_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."user_recent_people" ADD CONSTRAINT "user_recent_people_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."user_recent_people" ADD CONSTRAINT "user_recent_people_personId_fkey" FOREIGN KEY ("personId") REFERENCES "inrole"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."topic_interests" ADD CONSTRAINT "topic_interests_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "inrole"."topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."topic_interests" ADD CONSTRAINT "topic_interests_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "inrole"."interest_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."posts" ADD CONSTRAINT "posts_personId_fkey" FOREIGN KEY ("personId") REFERENCES "inrole"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."posts" ADD CONSTRAINT "posts_quotePostId_fkey" FOREIGN KEY ("quotePostId") REFERENCES "inrole"."posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."post_topics" ADD CONSTRAINT "post_topics_postId_fkey" FOREIGN KEY ("postId") REFERENCES "inrole"."posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."post_topics" ADD CONSTRAINT "post_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "inrole"."topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."comments" ADD CONSTRAINT "comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "inrole"."posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."comments" ADD CONSTRAINT "comments_personId_fkey" FOREIGN KEY ("personId") REFERENCES "inrole"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."post_likes" ADD CONSTRAINT "post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."post_likes" ADD CONSTRAINT "post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "inrole"."posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."person_reviews" ADD CONSTRAINT "person_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."person_reviews" ADD CONSTRAINT "person_reviews_personId_fkey" FOREIGN KEY ("personId") REFERENCES "inrole"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."media_assets" ADD CONSTRAINT "media_assets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."post_media" ADD CONSTRAINT "post_media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "inrole"."posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."post_media" ADD CONSTRAINT "post_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "inrole"."media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."polls" ADD CONSTRAINT "polls_postId_fkey" FOREIGN KEY ("postId") REFERENCES "inrole"."posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."poll_options" ADD CONSTRAINT "poll_options_postId_fkey" FOREIGN KEY ("postId") REFERENCES "inrole"."polls"("postId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."poll_votes" ADD CONSTRAINT "poll_votes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "inrole"."polls"("postId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."poll_votes" ADD CONSTRAINT "poll_votes_optionId_postId_fkey" FOREIGN KEY ("optionId", "postId") REFERENCES "inrole"."poll_options"("id", "postId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."character_requests" ADD CONSTRAINT "character_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."character_requests" ADD CONSTRAINT "character_requests_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."character_requests" ADD CONSTRAINT "character_requests_approvedPersonId_fkey" FOREIGN KEY ("approvedPersonId") REFERENCES "inrole"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."content_reports" ADD CONSTRAINT "content_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "inrole"."posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."content_reports" ADD CONSTRAINT "content_reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "inrole"."comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."content_reports" ADD CONSTRAINT "content_reports_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "inrole"."person_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."moderation_actions" ADD CONSTRAINT "moderation_actions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."write_requests" ADD CONSTRAINT "write_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."coin_operations" ADD CONSTRAINT "coin_operations_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."coin_operations" ADD CONSTRAINT "coin_operations_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."coin_operations" ADD CONSTRAINT "coin_operations_personId_fkey" FOREIGN KEY ("personId") REFERENCES "inrole"."people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."coin_operations" ADD CONSTRAINT "coin_operations_postId_fkey" FOREIGN KEY ("postId") REFERENCES "inrole"."posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."coin_operations" ADD CONSTRAINT "coin_operations_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "inrole"."write_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."coin_entries" ADD CONSTRAINT "coin_entries_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "inrole"."coin_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."coin_entries" ADD CONSTRAINT "coin_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."wallets"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."feed_events" ADD CONSTRAINT "feed_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "inrole"."app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inrole"."feed_events" ADD CONSTRAINT "feed_events_postId_fkey" FOREIGN KEY ("postId") REFERENCES "inrole"."posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
