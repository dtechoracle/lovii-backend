"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const router = (0, express_1.Router)();
// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { password, name, avatar } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = `LOVII-${randomPart}`;
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(password, salt);
        const [newUser] = await db_1.db.insert(schema_1.users).values({
            code: code,
            passwordHash: hashedPassword,
            name: name || 'Anonymous',
            avatar: avatar,
        }).returning();
        res.json({
            success: true,
            user: {
                id: newUser.id,
                code: newUser.code,
                name: newUser.name,
                avatar: newUser.avatar
            }
        });
    }
    catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});
// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { code, password } = req.body;
        if (!code || !password) {
            return res.status(400).json({ error: 'Code and Password are required' });
        }
        const user = await db_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.users.code, code)
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({
            success: true,
            user: {
                id: user.id,
                code: user.code,
                name: user.name,
                avatar: user.avatar
            }
        });
    }
    catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});
// POST /api/auth/pushtoken
router.post('/pushtoken', async (req, res) => {
    try {
        const { userId, token } = req.body;
        if (!userId || !token) {
            return res.status(400).json({ error: 'User ID and Token are required' });
        }
        await db_1.db.update(schema_1.users)
            .set({ pushToken: token })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        res.json({ success: true });
    }
    catch (error) {
        console.error('Push Token Sync Error:', error);
        res.status(500).json({ error: 'Failed to sync push token' });
    }
});
// POST /api/auth/pushtoken
router.post('/pushtoken', async (req, res) => {
    try {
        const { userId, token } = req.body;
        if (!userId || !token) {
            return res.status(400).json({ error: 'Missing userId or token' });
        }
        await db_1.db.update(schema_1.users)
            .set({ pushToken: token })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
        res.json({ success: true });
    }
    catch (error) {
        console.error('Push Token Error:', error);
        res.status(500).json({ error: 'Failed to save push token' });
    }
});
exports.default = router;
