"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const router = (0, express_1.Router)();
// GET /api/tasks
router.get('/', async (req, res) => {
    const { profileId, userId } = req.query;
    const targetId = profileId || userId;
    if (!targetId) {
        return res.status(400).json({ error: 'User ID required' });
    }
    try {
        const result = await db_1.db.query.tasks.findMany({
            where: (0, drizzle_orm_1.eq)(schema_1.tasks.userId, targetId),
            orderBy: [(0, drizzle_orm_1.desc)(schema_1.tasks.createdAt)],
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});
// POST /api/tasks
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        if (Array.isArray(body)) {
            const userId = body[0]?.profileId || body[0]?.userId;
            if (userId) {
                await db_1.db.delete(schema_1.tasks).where((0, drizzle_orm_1.eq)(schema_1.tasks.userId, userId));
                if (body.length > 0) {
                    const newTasks = body.map(t => ({
                        userId: t.profileId || t.userId,
                        text: t.text,
                        completed: t.completed
                    }));
                    await db_1.db.insert(schema_1.tasks).values(newTasks);
                }
            }
            return res.json({ success: true });
        }
        const userId = body.profileId || body.userId;
        const [newTask] = await db_1.db.insert(schema_1.tasks).values({
            userId: userId,
            text: body.text,
            completed: body.completed || false,
        }).returning();
        res.json(newTask);
    }
    catch (error) {
        console.error('POST task error:', error);
        res.status(500).json({ error: 'Failed to save task' });
    }
});
exports.default = router;
