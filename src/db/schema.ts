import { bigint, boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(), // e.g. "LOVII-1234"
    passwordHash: text('password_hash').notNull(),
    name: text('name'),
    avatar: text('avatar'),
    pushToken: text('push_token'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const connections = pgTable('connections', {
    id: uuid('id').defaultRandom().primaryKey(),
    userA: uuid('user_a').references(() => users.id).notNull(),
    userB: uuid('user_b').references(() => users.id).notNull(),
    status: text('status', { enum: ['pending', 'active'] }).default('pending'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const notes = pgTable('notes', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    type: text('type', { enum: ['text', 'drawing', 'collage'] }).notNull(),
    content: text('content').notNull(),
    color: text('color'),
    images: jsonb('images').$type<string[]>(),
    fontFamily: text('font_family'),
    fontWeight: text('font_weight'),
    fontStyle: text('font_style'),
    textDecorationLine: text('text_decoration_line'),
    pinned: boolean('pinned').default(false),
    bookmarked: boolean('bookmarked').default(false),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    musicTrack: jsonb('music_track').$type<{
        title: string;
        artist: string;
        coverUrl: string;
        previewUrl?: string;
        externalUrl?: string;
    }>(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const tasks = pgTable('tasks', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    text: text('text').notNull(),
    completed: boolean('completed').default(false),
    createdAt: timestamp('created_at').defaultNow(),
});
