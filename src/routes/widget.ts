import { Router, Request, Response } from 'express';
import { desc, eq, or } from 'drizzle-orm';
import { db } from '../db';
import { connections, notes, users } from '../db/schema';

const router = Router();

// POST /api/widget
router.post('/', async (req: Request, res: Response) => {
    try {
        const { myId, note } = req.body;

        if (!myId || !note) {
            return res.status(400).json({ error: "Missing required fields: myId, note" });
        }

        const me = await db.query.users.findFirst({
            where: eq(users.id, myId)
        });
        if (!me) return res.status(404).json({ error: "User not found" });

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

        const [savedNote] = await db
            .insert(notes)
            .values({
                userId: myId,
                type: note.type,
                content: note.content,
                color: note.color,
                images: note.images,
                timestamp: note.timestamp,
                pinned: note.pinned || false,
                bookmarked: note.bookmarked || false,
            })
            .returning();

        // Send Push Notification to Partner
        if (partner.pushToken) {
            fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: partner.pushToken,
                    sound: 'default',
                    title: 'New Note!',
                    body: 'Your partner sent you a new note.',
                    data: { type: 'WIDGET_UPDATE' },
                }),
            }).catch(e => console.error('Failed to send push notification', e));
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
