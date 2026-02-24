import { Router, Request, Response } from 'express';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { connections, users } from '../db/schema';

const router = Router();

// POST /api/connect
router.post('/', async (req: Request, res: Response) => {
    try {
        const { myId, partnerCode } = req.body;

        if (!myId || !partnerCode) {
            return res.status(400).json({ error: 'Missing ID or Partner Code' });
        }

        const me = await db.query.users.findFirst({
            where: eq(users.id, myId)
        });
        if (!me) return res.status(404).json({ error: 'Your account not found' });

        const partner = await db.query.users.findFirst({
            where: eq(users.code, partnerCode),
        });

        if (!partner) {
            return res.status(404).json({ error: 'Partner code not found' });
        }

        if (partner.id === myId) {
            return res.status(400).json({ error: 'You cannot connect to yourself 💔' });
        }

        const existing = await db.query.connections.findFirst({
            where: or(
                and(eq(connections.userA, myId), eq(connections.userB, partner.id)),
                and(eq(connections.userA, partner.id), eq(connections.userB, myId))
            )
        });

        if (existing) {
            return res.json({
                success: true,
                message: 'Already connected',
                partnerId: partner.id,
                partnerName: partner.name
            });
        }

        // Check for existing active connections to determine cost
        const myActiveConnections = await db.query.connections.findMany({
            where: or(
                eq(connections.userA, myId),
                eq(connections.userB, myId)
            )
        });

        const PARTNER_COST = 5;
        if (myActiveConnections.length >= 1) {
            if (me.points < PARTNER_COST) {
                return res.status(403).json({ error: `Connection fails. You need ${PARTNER_COST} points to add another partner. 💝` });
            }

            // Deduct points
            await db.update(users)
                .set({ points: me.points - PARTNER_COST })
                .where(eq(users.id, myId));
        }

        await db.insert(connections).values({
            userA: myId,
            userB: partner.id,
            status: 'active'
        });

        res.json({
            success: true,
            partnerId: partner.id,
            partnerName: partner.name,
            partnerCode: partner.code,
            pointsDeducted: myActiveConnections.length >= 1 ? PARTNER_COST : 0
        });

    } catch (error) {
        console.error('Connection error:', error);
        res.status(500).json({ error: 'Connection failed' });
    }
});

// DELETE /api/connect
router.delete('/', async (req: Request, res: Response) => {
    try {
        const { myId, partnerId } = req.body;

        if (!myId || !partnerId) {
            return res.status(400).json({ error: 'Missing IDs' });
        }

        await db.delete(connections).where(
            or(
                and(eq(connections.userA, myId), eq(connections.userB, partnerId)),
                and(eq(connections.userA, partnerId), eq(connections.userB, myId))
            )
        );

        res.json({ success: true, message: 'Disconnected successfully' });
    } catch (error) {
        console.error('Disconnect error:', error);
        res.status(500).json({ error: 'Disconnect failed' });
    }
});

export default router;
