import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { password, name, avatar } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = `LOVII-${randomPart}`;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [newUser] = await db.insert(users).values({
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
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { code, password } = req.body;

        if (!code || !password) {
            return res.status(400).json({ error: 'Code and Password are required' });
        }

        const user = await db.query.users.findFirst({
            where: eq(users.code, code)
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

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
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// POST /api/auth/pushtoken
router.post('/pushtoken', async (req: Request, res: Response) => {
    try {
        const { userId, token } = req.body;

        if (!userId || !token) {
            return res.status(400).json({ error: 'User ID and Token are required' });
        }

        await db.update(users)
            .set({ pushToken: token })
            .where(eq(users.id, userId));

        res.json({ success: true });
    } catch (error) {
        console.error('Push Token Sync Error:', error);
        res.status(500).json({ error: 'Failed to sync push token' });
    }
});

// POST /api/auth/pushtoken
router.post('/pushtoken', async (req: Request, res: Response) => {
    try {
        const { userId, token } = req.body;

        if (!userId || !token) {
            return res.status(400).json({ error: 'Missing userId or token' });
        }

        await db.update(users)
            .set({ pushToken: token })
            .where(eq(users.id, userId));

        res.json({ success: true });
    } catch (error) {
        console.error('Push Token Error:', error);
        res.status(500).json({ error: 'Failed to save push token' });
    }
});

export default router;
