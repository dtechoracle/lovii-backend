"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const router = (0, express_1.Router)();
// PUT /api/profile
router.put('/', async (req, res) => {
    try {
        const { id, name } = req.body;
        let { avatar } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'ID required' });
        }
        // Handle Base64 Avatar Upload
        if (avatar && avatar.startsWith('data:image')) {
            try {
                const uploadResponse = await cloudinary_1.default.uploader.upload(avatar, {
                    folder: 'lovii_avatars',
                    resource_type: 'image',
                    public_id: `avatar_${id}`, // Overwrite existing avatar for this user
                    overwrite: true,
                    transformation: [{ width: 400, height: 400, crop: 'fill' }] // Optimize size
                });
                avatar = uploadResponse.secure_url;
            }
            catch (uploadError) {
                console.error('Avatar upload failed:', uploadError);
                // Fallback: Don't update avatar if upload fails? Or continue?
                // Let's return error to client
                return res.status(500).json({ error: 'Failed to upload avatar image' });
            }
        }
        const [updatedUser] = await db_1.db.update(schema_1.users)
            .set({ name, avatar })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))
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
    }
    catch (error) {
        console.error('PUT profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
// GET /api/profile
router.get('/', async (req, res) => {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'ID required' });
    }
    try {
        const user = await db_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.users.id, id),
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const connection = await db_1.db.query.connections.findFirst({
            where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.connections.userA, id), (0, drizzle_orm_1.eq)(schema_1.connections.userB, id))
        });
        let partnerInfo = {};
        if (connection) {
            const partnerId = connection.userA === id ? connection.userB : connection.userA;
            const partner = await db_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.users.id, partnerId)
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
            ...partnerInfo
        });
    }
    catch (error) {
        console.error('GET profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
exports.default = router;
