"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const router = (0, express_1.Router)();
// POST /api/connect
router.post('/', async (req, res) => {
    try {
        const { myId, partnerCode } = req.body;
        if (!myId || !partnerCode) {
            return res.status(400).json({ error: 'Missing ID or Partner Code' });
        }
        const me = await db_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.users.id, myId)
        });
        if (!me)
            return res.status(404).json({ error: 'Your account not found' });
        const partner = await db_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.users.code, partnerCode),
        });
        if (!partner) {
            return res.status(404).json({ error: 'Partner code not found' });
        }
        if (partner.id === myId) {
            return res.status(400).json({ error: 'You cannot connect to yourself 💔' });
        }
        const existing = await db_1.db.query.connections.findFirst({
            where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.connections.userA, myId), (0, drizzle_orm_1.eq)(schema_1.connections.userB, partner.id)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.connections.userA, partner.id), (0, drizzle_orm_1.eq)(schema_1.connections.userB, myId)))
        });
        if (existing) {
            return res.json({
                success: true,
                message: 'Already connected',
                partnerId: partner.id,
                partnerName: partner.name
            });
        }
        await db_1.db.insert(schema_1.connections).values({
            userA: myId,
            userB: partner.id,
            status: 'active'
        });
        res.json({
            success: true,
            partnerId: partner.id,
            partnerName: partner.name,
            partnerCode: partner.code
        });
    }
    catch (error) {
        console.error('Connection error:', error);
        res.status(500).json({ error: 'Connection failed' });
    }
});
exports.default = router;
