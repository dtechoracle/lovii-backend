"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deductRoute = void 0;
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const router = (0, express_1.Router)();
const STREAK_RESTORE_COST = 5;
/** Midnight UTC for a given timestamp */
const toMidnightUTC = (ts) => {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/streak?userId=xxx
// Returns: { streak, myDays, partnerDays, restoredDays, streakJustBroke }
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId)
            return res.status(400).json({ error: 'userId required' });
        // Find partner
        const connection = await db_1.db.query.connections.findFirst({
            where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.connections.userA, userId), (0, drizzle_orm_1.eq)(schema_1.connections.userB, userId))
        });
        const partnerId = connection
            ? (connection.userA === userId ? connection.userB : connection.userA)
            : null;
        // My note timestamps (unique midnight days)
        const myNotes = await db_1.db.query.notes.findMany({
            where: (0, drizzle_orm_1.eq)(schema_1.notes.userId, userId),
            columns: { timestamp: true }
        });
        const myDays = Array.from(new Set(myNotes.map(n => toMidnightUTC(n.timestamp))));
        // Partner note timestamps
        let partnerDays = [];
        if (partnerId) {
            const partnerNotes = await db_1.db.query.notes.findMany({
                where: (0, drizzle_orm_1.eq)(schema_1.notes.userId, partnerId),
                columns: { timestamp: true }
            });
            partnerDays = Array.from(new Set(partnerNotes.map(n => toMidnightUTC(n.timestamp))));
        }
        // Restored days for this user
        const restores = await db_1.db.query.streakRestores.findMany({
            where: (0, drizzle_orm_1.eq)(schema_1.streakRestores.userId, userId),
            columns: { restoredDay: true }
        });
        const restoredDays = restores.map(r => r.restoredDay);
        // Compute streak
        const myDaySet = new Set([...myDays, ...restoredDays]);
        const partnerDaySet = new Set([...partnerDays, ...restoredDays]);
        const bothSentDays = Array.from(myDaySet)
            .filter(d => partnerDaySet.has(d))
            .sort((a, b) => b - a);
        const today = toMidnightUTC(Date.now());
        const oneDay = 86400000;
        let streak = 0;
        if (bothSentDays.length > 0 && bothSentDays[0] >= today - oneDay) {
            streak = 1;
            let expected = bothSentDays[0] - oneDay;
            for (let i = 1; i < bothSentDays.length; i++) {
                if (bothSentDays[i] === expected) {
                    streak++;
                    expected -= oneDay;
                }
                else
                    break;
            }
        }
        const streakJustBroke = streak === 0 && bothSentDays.length > 0 && bothSentDays[0] === today - oneDay;
        res.json({ streak, myDays, partnerDays, restoredDays, streakJustBroke });
    }
    catch (error) {
        console.error('[Streak GET]', error);
        res.status(500).json({ error: 'Failed to calculate streak' });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/streak/restore
// Body: { userId }
// Deducts 5 points and records a restored day for today
// ─────────────────────────────────────────────────────────────────────────────
router.post('/restore', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId)
            return res.status(400).json({ error: 'userId required' });
        const user = await db_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.users.id, userId)
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        // Check if already restored today (idempotent)
        const todayMidnight = toMidnightUTC(Date.now());
        const alreadyRestored = await db_1.db.query.streakRestores.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.streakRestores.userId, userId), (0, drizzle_orm_1.eq)(schema_1.streakRestores.restoredDay, todayMidnight))
        });
        if (alreadyRestored) {
            return res.json({ success: true, message: 'Already restored today' });
        }
        // Record the restore
        await db_1.db.insert(schema_1.streakRestores).values({
            userId,
            restoredDay: todayMidnight,
            pointsSpent: STREAK_RESTORE_COST,
        });
        res.json({ success: true, pointsSpent: STREAK_RESTORE_COST, restoredDay: todayMidnight });
    }
    catch (error) {
        console.error('[Streak Restore]', error);
        res.status(500).json({ error: 'Failed to restore streak' });
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile/deduct  (used for streak restore points sync)
// Body: { userId, amount, reason }
// ─────────────────────────────────────────────────────────────────────────────
exports.deductRoute = (0, express_1.Router)();
exports.deductRoute.post('/', async (req, res) => {
    try {
        const { userId, amount, reason } = req.body;
        if (!userId || !amount)
            return res.status(400).json({ error: 'userId and amount required' });
        // Points are stored client-side only for now — this is a no-op on the server
        // until we add a points column to the users table.
        // We just log it so we have an audit trail.
        console.log(`[Points Deduct] user=${userId} amount=${amount} reason=${reason}`);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to deduct points' });
    }
});
exports.default = router;
