import { Router, Request, Response } from 'express';
import { eq, or } from 'drizzle-orm';
import { db } from '../db';
import { connections, users } from '../db/schema';

const router = Router();

// PUT /api/profile
router.put('/', async (req: Request, res: Response) => {
    try {
        const { id, name, avatar } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'ID required' });
        }

        const [updatedUser] = await db.update(users)
            .set({ name, avatar })
            .where(eq(users.id, id))
            .returning();

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: updatedUser.id,
            name: updatedUser.name,
            code: updatedUser.code,
            avatar: updatedUser.avatar
        });
    } catch (error) {
        console.error('PUT profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// GET /api/profile
router.get('/', async (req: Request, res: Response) => {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'ID required' });
    }

    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, id as string),
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const connection = await db.query.connections.findFirst({
            where: or(
                eq(connections.userA, id as string),
                eq(connections.userB, id as string)
            )
        });

        let partnerInfo = {};
        if (connection) {
            const partnerId = connection.userA === id ? connection.userB : connection.userA;
            const partner = await db.query.users.findFirst({
                where: eq(users.id, partnerId)
            });
            if (partner) {
                partnerInfo = {
                    partnerId: partner.id,
                    partnerName: partner.name,
                    partnerCode: partner.code,
                    connectedAt: connection.createdAt
                };
            }
        }

        res.json({
            id: user.id,
            name: user.name,
            code: user.code,
            avatar: user.avatar,
            ...partnerInfo
        });

    } catch (error) {
        console.error('GET profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

export default router;
