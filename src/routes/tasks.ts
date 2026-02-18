import { Router, Request, Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { tasks } from '../db/schema';

const router = Router();

// GET /api/tasks
router.get('/', async (req: Request, res: Response) => {
    const { profileId, userId } = req.query;
    const targetId = (profileId as string) || (userId as string);

    if (!targetId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    try {
        const result = await db.query.tasks.findMany({
            where: eq(tasks.userId, targetId),
            orderBy: [desc(tasks.createdAt)],
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body;

        if (Array.isArray(body)) {
            const userId = body[0]?.profileId || body[0]?.userId;
            if (userId) {
                await db.delete(tasks).where(eq(tasks.userId, userId));

                if (body.length > 0) {
                    const newTasks = body.map(t => ({
                        userId: t.profileId || t.userId,
                        text: t.text,
                        completed: t.completed
                    }));
                    await db.insert(tasks).values(newTasks);
                }
            }
            return res.json({ success: true });
        }

        const userId = body.profileId || body.userId;
        const [newTask] = await db.insert(tasks).values({
            userId: userId,
            text: body.text,
            completed: body.completed || false,
        }).returning();

        res.json(newTask);
    } catch (error) {
        console.error('POST task error:', error);
        res.status(500).json({ error: 'Failed to save task' });
    }
});

export default router;
