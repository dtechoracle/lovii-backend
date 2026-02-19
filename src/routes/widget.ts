import { Router, Request, Response } from 'express';
import { desc, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { connections, notes, users } from '../db/schema';

const router = Router();

// POST /api/widget
router.post('/', async (req: Request, res: Response) => {
    try {
        const { myId, noteId } = req.body;

        if (!myId || !noteId) {
            return res.status(400).json({ error: "Missing required fields: myId, noteId" });
        }

        const me = await db.query.users.findFirst({
            where: eq(users.id, myId)
        });
        if (!me) return res.status(404).json({ error: "User not found" });

        // Verify the note exists and belongs to user
        const savedNote = await db.query.notes.findFirst({
            where: eq(notes.id, noteId)
        });

        if (!savedNote) {
            return res.status(404).json({ error: "Note not found" });
        }

        const connection = await db.query.connections.findFirst({
            where: or(
                eq(connections.userA, myId),
                eq(connections.userB, myId)
            )
        });

        if (!connection) {
            return res.status(400).json({ error: "No partner connected" });
        }

        const partnerId = connection.userA === myId ? connection.userB : connection.userA;
        const partner = await db.query.users.findFirst({
            where: eq(users.id, partnerId)
        });

        if (!partner) {
            return res.status(404).json({ error: "Partner not found in database" });
        }

        // We already have the note, so we don't insert it again.
        // Just notify.

        // Send Push Notification to Partner
        if (partner.pushToken) {
            try {
                const { PushService } = await import('../services/push');
                await PushService.sendPushNotification(
                    partner.pushToken,
                    'New Widget Update! 💖',
                    'Your partner updated their mood/status!',
                    { type: 'WIDGET_UPDATE' }
                );
            } catch (error) {
                console.error('Failed to send push notification', error);
            }
        }

        const partnerLatestNote = await db.query.notes.findFirst({
            where: eq(notes.userId, partnerId),
            orderBy: [desc(notes.timestamp)],
        });

        res.json({
            success: true,
            note: savedNote,
            partner: {
                id: partner.id,
                name: partner.name,
                code: partner.code,
                connected: true,
            },
            partnerWidget: {
                hasNote: !!partnerLatestNote,
                lastNote: partnerLatestNote
                    ? {
                        type: partnerLatestNote.type,
                        content: partnerLatestNote.content,
                        timestamp: partnerLatestNote.timestamp,
                        color: partnerLatestNote.color,
                    }
                    : null,
            },
        });
    } catch (error) {
        console.error("[Widget API] Error:", error);
        res.status(500).json({ error: "Failed to send note to partner widget" });
    }
});

// GET /api/widget
router.get('/', async (req: Request, res: Response) => {
    try {
        const { myId } = req.query;

        if (!myId) {
            return res.status(400).json({ error: "myId required" });
        }

        const connection = await db.query.connections.findFirst({
            where: or(
                eq(connections.userA, myId as string),
                eq(connections.userB, myId as string)
            )
        });

        if (!connection) {
            return res.json({ connected: false, partner: null, widget: null });
        }

        const partnerId = connection.userA === myId ? connection.userB : connection.userA;
        const partner = await db.query.users.findFirst({
            where: eq(users.id, partnerId)
        });

        if (!partner) {
            return res.json({ connected: false, partner: null, widget: null });
        }

        const partnerLatestNote = await db.query.notes.findFirst({
            where: eq(notes.userId, partnerId),
            orderBy: [desc(notes.timestamp)],
        });

        res.json({
            connected: true,
            partner: {
                id: partner.id,
                name: partner.name,
                code: partner.code,
            },
            widget: {
                hasNote: !!partnerLatestNote,
                lastNote: partnerLatestNote
                    ? {
                        type: partnerLatestNote.type,
                        content: partnerLatestNote.content,
                        timestamp: partnerLatestNote.timestamp,
                        color: partnerLatestNote.color,
                    }
                    : null,
            },
        });
    } catch (error) {
        console.error("[Widget API GET] Error:", error);
        res.status(500).json({ error: "Failed to fetch partner widget status" });
    }
});

export default router;
