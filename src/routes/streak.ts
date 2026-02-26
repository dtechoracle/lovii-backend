import { Router, Request, Response } from 'express';
import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { connections, notes, streakRestores, users } from '../db/schema';

const router = Router();

const STREAK_RESTORE_COST = 5;

/** Midnight UTC for a given timestamp */
const toMidnightUTC = (ts: number) => {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/streak?userId=xxx
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const connection = await db.query.connections.findFirst({
            where: or(
                eq(connections.userA, userId as string),
                eq(connections.userB, userId as string)
            )
        });

        const partnerId = connection
            ? (connection.userA === userId ? connection.userB : connection.userA)
            : null;

        const myNotes = await db.query.notes.findMany({
            where: eq(notes.userId, userId as string),
            columns: { timestamp: true }
        });
        const myDays = Array.from(new Set(myNotes.map(n => toMidnightUTC(n.timestamp))));

        let partnerDays: number[] = [];
        if (partnerId) {
            const partnerNotes = await db.query.notes.findMany({
                where: eq(notes.userId, partnerId),
                columns: { timestamp: true }
            });
            partnerDays = Array.from(new Set(partnerNotes.map(n => toMidnightUTC(n.timestamp))));
        }

        const restores = await db.query.streakRestores.findMany({
            where: partnerId
                ? or(eq(streakRestores.userId, userId as string), eq(streakRestores.userId, partnerId))
                : eq(streakRestores.userId, userId as string),
            columns: { restoredDay: true }
        });
        const restoredDays = Array.from(new Set(restores.map(r => r.restoredDay)));

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
                if (bothSentDays[i] === expected) { streak++; expected -= oneDay; } else break;
            }
        }

        const streakJustBroke = streak === 0 && bothSentDays.length > 0 && bothSentDays[0] === today - oneDay;

        res.json({ streak, myDays, partnerDays, restoredDays, streakJustBroke });
    } catch (error) {
        console.error('[Streak GET]', error);
        res.status(500).json({ error: 'Failed to calculate streak' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/streak/restore — deducts 5 points from DB, records restored day
// ─────────────────────────────────────────────────────────────────────────────
router.post('/restore', async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.points < STREAK_RESTORE_COST) {
            return res.status(400).json({
                error: `You need ${STREAK_RESTORE_COST} points to restore your streak. You have ${user.points}. 💝`
            });
        }

        const todayMidnight = toMidnightUTC(Date.now());
        const alreadyRestored = await db.query.streakRestores.findFirst({
            where: and(
                eq(streakRestores.userId, userId),
                eq(streakRestores.restoredDay, todayMidnight)
            )
        });
        if (alreadyRestored) {
            return res.json({ success: true, message: 'Already restored today', points: user.points });
        }

        // Atomically deduct points
        await db.update(users)
            .set({ points: sql`${users.points} - ${STREAK_RESTORE_COST}` })
            .where(eq(users.id, userId));

        await db.insert(streakRestores).values({
            userId,
            restoredDay: todayMidnight,
            pointsSpent: STREAK_RESTORE_COST,
        });

        res.json({
            success: true,
            pointsSpent: STREAK_RESTORE_COST,
            restoredDay: todayMidnight,
            points: user.points - STREAK_RESTORE_COST,
        });
    } catch (error) {
        console.error('[Streak Restore]', error);
        res.status(500).json({ error: 'Failed to restore streak' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile/deduct — atomically decrements users.points in the DB
// ─────────────────────────────────────────────────────────────────────────────
export const deductRoute = Router();
deductRoute.post('/', async (req: Request, res: Response) => {
    try {
        const { userId, amount, reason } = req.body;
        if (!userId || !amount) return res.status(400).json({ error: 'userId and amount required' });

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.points < amount) {
            return res.status(400).json({ error: `Insufficient points (have ${user.points}, need ${amount})` });
        }

        const [updated] = await db.update(users)
            .set({ points: sql`${users.points} - ${amount}` })
            .where(eq(users.id, userId))
            .returning({ points: users.points });

        console.log(`[Points Deduct] user=${userId} amount=${amount} reason=${reason} remaining=${updated.points}`);
        res.json({ success: true, points: updated.points });
    } catch (error) {
        console.error('[Deduct]', error);
        res.status(500).json({ error: 'Failed to deduct points' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile/add — atomically increments users.points in the DB
// ─────────────────────────────────────────────────────────────────────────────
export const addRoute = Router();
addRoute.post('/', async (req: Request, res: Response) => {
    try {
        const { userId, amount, reason } = req.body;
        if (!userId || !amount) return res.status(400).json({ error: 'userId and amount required' });

        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const [updated] = await db.update(users)
            .set({ points: sql`${users.points} + ${amount}` })
            .where(eq(users.id, userId))
            .returning({ points: users.points });

        console.log(`[Points Add] user=${userId} amount=${amount} reason=${reason || 'topup'} remaining=${updated.points}`);
        res.json({ success: true, points: updated.points });
    } catch (error) {
        console.error('[Add Points]', error);
        res.status(500).json({ error: 'Failed to add points' });
    }
});

export default router;
