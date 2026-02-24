import { Router, Request, Response } from 'express';
import { eq, or } from 'drizzle-orm';
import { db } from '../db';
import { connections, users } from '../db/schema';
import cloudinary from '../config/cloudinary';

const router = Router();

// PUT /api/profile
router.put('/', async (req: Request, res: Response) => {
    try {
        const { id, name } = req.body;
        let { avatar } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'ID required' });
        }

        // Handle Base64 Avatar Upload
        if (avatar && avatar.startsWith('data:image')) {
            try {
                const uploadResponse = await cloudinary.uploader.upload(avatar, {
                    folder: 'lovii_avatars',
                    resource_type: 'image',
                    public_id: `avatar_${id}`, // Overwrite existing avatar for this user
                    overwrite: true,
                    transformation: [{ width: 400, height: 400, crop: 'fill' }] // Optimize size
                });
                avatar = uploadResponse.secure_url;
            } catch (uploadError) {
                console.error('Avatar upload failed:', uploadError);
                // Fallback: Don't update avatar if upload fails? Or continue?
                // Let's return error to client
                return res.status(500).json({ error: 'Failed to upload avatar image' });
            }
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

        const allConnections = await db.query.connections.findMany({
            where: or(
                eq(connections.userA, id as string),
                eq(connections.userB, id as string)
            )
        });

        const partnersList = await Promise.all(allConnections.map(async (conn) => {
            const partnerId = conn.userA === id ? conn.userB : conn.userA;
            const partner = await db.query.users.findFirst({
                where: eq(users.id, partnerId)
            });
            if (partner) {
                return {
                    id: partner.id,
                    name: partner.name,
                    code: partner.code,
                    avatar: partner.avatar,
                    connectedAt: conn.createdAt ? new Date(conn.createdAt).getTime() : undefined
                };
            }
            return null;
        }));

        const activePartners = partnersList.filter(p => p !== null);

        res.json({
            id: user.id,
            name: user.name,
            code: user.code,
            avatar: user.avatar,
            points: user.points,
            maxPoints: user.maxPoints,
            partners: activePartners,
            // Keep legacy for compatibility
            partnerId: activePartners[0]?.id,
            partnerName: activePartners[0]?.name,
            partnerCode: activePartners[0]?.code,
            connectedAt: activePartners[0]?.connectedAt
        });

    } catch (error) {
        console.error('GET profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// POST /api/profile/topup (Temporary for testing)
router.post('/topup', async (req: Request, res: Response) => {
    try {
        const { id, points } = req.body;
        if (!id || points === undefined) return res.status(400).json({ error: 'ID and points required' });

        const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const [updated] = await db.update(users)
            .set({ points: user.points + points })
            .where(eq(users.id, id))
            .returning();

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Top up failed' });
    }
});

export default router;
