import { Router, Request, Response } from 'express';
import { desc, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { connections, notes, users } from '../db/schema';

const router = Router();

// GET /api/notes
router.get('/', async (req: Request, res: Response) => {
    const { profileId, userId } = req.query;
    const targetId = (profileId as string) || (userId as string);

    if (!targetId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    try {
        const result = await db.query.notes.findMany({
            where: eq(notes.userId, targetId),
            orderBy: [desc(notes.timestamp)],
        });

        res.json(result);
    } catch (error) {
        console.error('GET notes error:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// POST /api/notes
router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const userId = body.profileId || body.userId;

        const [newNote] = await db.insert(notes).values({
            id: body.id, // Use provided ID if available
            userId: userId,
            type: body.type,
            content: body.content,
            color: body.color,
            images: body.images,
            fontFamily: body.fontFamily,
            fontWeight: body.fontWeight,
            fontStyle: body.fontStyle,
            textDecorationLine: body.textDecorationLine,
            timestamp: body.timestamp,
            pinned: body.pinned || false,
            bookmarked: body.bookmarked || false,
        }).returning();


        res.json(newNote);

        // Send Push Notification to Partner
        try {
            // Find partner
            const connection = await db.query.connections.findFirst({
                where: or(
                    eq(connections.userA, userId),
                    eq(connections.userB, userId)
                )
            });

            if (connection) {
                const partnerId = connection.userA === userId ? connection.userB : connection.userA;
                const partner = await db.query.users.findFirst({
                    where: eq(users.id, partnerId)
                });

                if (partner && partner.pushToken) {
                    const { PushService } = await import('../services/push');
                    await PushService.sendPushNotification(
                        partner.pushToken,
                        'New Note! 💌',
                        'Your partner sent you a new note!',
                        {
                            type: 'NOTE_RECEIVED',
                            noteId: newNote.id,
                            note: newNote // Send full data for "Webhook" style instant update
                        }
                    );
                }
            }
        } catch (pushError) {
            console.error('Push notification failed:', pushError);
            // Don't fail the request
        }


    } catch (error) {
        console.error('POST note error:', error);
        res.status(500).json({ error: 'Failed to save note' });
    }
});

// PATCH /api/notes
router.patch('/', async (req: Request, res: Response) => {
    try {
        const { id, ...updates } = req.body;

        if (!id) return res.status(400).json({ error: 'ID required' });

        const [updated] = await db.update(notes)
            .set(updates)
            .where(eq(notes.id, id))
            .returning();

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// DELETE /api/notes
router.delete('/', async (req: Request, res: Response) => {
    const { id } = req.query;

    if (!id) return res.status(400).json({ error: 'ID required' });

    try {
        await db.delete(notes).where(eq(notes.id, id as string));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

export default router;
