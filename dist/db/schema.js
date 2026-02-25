"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streakRestores = exports.tasks = exports.notes = exports.connections = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    code: (0, pg_core_1.text)('code').notNull().unique(), // e.g. "LOVII-1234"
    passwordHash: (0, pg_core_1.text)('password_hash').notNull(),
    name: (0, pg_core_1.text)('name'),
    avatar: (0, pg_core_1.text)('avatar'),
    pushToken: (0, pg_core_1.text)('push_token'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.connections = (0, pg_core_1.pgTable)('connections', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userA: (0, pg_core_1.uuid)('user_a').references(() => exports.users.id).notNull(),
    userB: (0, pg_core_1.uuid)('user_b').references(() => exports.users.id).notNull(),
    status: (0, pg_core_1.text)('status', { enum: ['pending', 'active'] }).default('pending'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.notes = (0, pg_core_1.pgTable)('notes', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    type: (0, pg_core_1.text)('type', { enum: ['text', 'drawing', 'collage', 'music', 'tasks'] }).notNull(),
    content: (0, pg_core_1.text)('content').notNull(),
    color: (0, pg_core_1.text)('color'),
    images: (0, pg_core_1.jsonb)('images').$type(),
    fontFamily: (0, pg_core_1.text)('font_family'),
    fontWeight: (0, pg_core_1.text)('font_weight'),
    fontStyle: (0, pg_core_1.text)('font_style'),
    textDecorationLine: (0, pg_core_1.text)('text_decoration_line'),
    pinned: (0, pg_core_1.boolean)('pinned').default(false),
    bookmarked: (0, pg_core_1.boolean)('bookmarked').default(false),
    timestamp: (0, pg_core_1.bigint)('timestamp', { mode: 'number' }).notNull(),
    musicTrack: (0, pg_core_1.jsonb)('music_track').$type(),
    tasks: (0, pg_core_1.jsonb)('tasks').$type(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.tasks = (0, pg_core_1.pgTable)('tasks', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    text: (0, pg_core_1.text)('text').notNull(),
    completed: (0, pg_core_1.boolean)('completed').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
// Tracks days where a user paid to restore their streak
// Each row = one restored calendar day (midnight UTC timestamp)
exports.streakRestores = (0, pg_core_1.pgTable)('streak_restores', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    restoredDay: (0, pg_core_1.bigint)('restored_day', { mode: 'number' }).notNull(), // midnight UTC timestamp
    pointsSpent: (0, pg_core_1.integer)('points_spent').default(5).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
