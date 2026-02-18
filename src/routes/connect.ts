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

        await db.insert(connections).values({
            userA: myId,
            userB: partner.id,
            status: 'active'
        });

        res.json({
            success: true,
            partnerId: partner.id,
            partnerName: partner.name
        });

    } catch (error) {
        console.error('Connection error:', error);
        res.status(500).json({ error: 'Connection failed' });
    }
});

export default router;
