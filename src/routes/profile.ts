import { Router, Request, Response } from 'express';
import { eq, or } from 'drizzle-orm';
import { db } from '../db';
import { connections, users } from '../db/schema';
import cloudinary from '../config/cloudinary';

const router = Router();

// PUT /api/profile
router.put('/', async (req: Request, res: Response) => {
    try {
        const { id, name, avatar: rawAvatar } = req.body;
        let avatar = rawAvatar;

        if (!id) {
            return res.status(400).json({ error: 'ID required' });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;

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
                return res.status(500).json({ error: 'Failed to upload avatar image' });
            }
        }

        // Only update avatar if it was provided (either still same URL or new Cloudinary URL)
        // This prevents overwriting with undefined if the field is missing in request
        if (avatar !== undefined) {
            // If it's a local path (starts with file:), do NOT save it to DB
            if (typeof avatar === 'string' && avatar.startsWith('file:')) {
                console.warn('Blocked local image path from being saved to DB:', avatar);
            } else {
                updateData.avatar = avatar;
            }
        }

        const [updatedUser] = await db.update(users)
            .set(updateData)
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
            points: user.points,
            ...partnerInfo
        });

    } catch (error) {
        console.error('GET profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

export default router;
