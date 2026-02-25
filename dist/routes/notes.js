"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const router = (0, express_1.Router)();
// GET /api/notes
router.get('/', async (req, res) => {
    const { profileId, userId } = req.query;
    const targetId = profileId || userId;
    if (!targetId) {
        return res.status(400).json({ error: 'User ID required' });
    }
    try {
        const result = await db_1.db.query.notes.findMany({
            where: (0, drizzle_orm_1.eq)(schema_1.notes.userId, targetId),
            orderBy: [(0, drizzle_orm_1.desc)(schema_1.notes.timestamp)],
        });
        res.json(result);
    }
    catch (error) {
        console.error('GET notes error:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
// ... (existing imports)
// POST /api/notes
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        const userId = body.profileId || body.userId;
        // Process Images (Upload to Cloudinary)
        if (body.images && Array.isArray(body.images) && body.images.length > 0) {
            try {
                const uploadPromises = body.images.map(async (image) => {
                    // Check if it's a base64 string (starts with data:image)
                    if (image.startsWith('data:image')) {
                        const uploadResponse = await cloudinary_1.default.uploader.upload(image, {
                            folder: 'lovii_notes', // Optional: organize in a folder
                            resource_type: 'image',
                        });
                        return uploadResponse.secure_url;
                    }
                    return image; // specific case: if it's already a URL, leave it alone
                });
                const imageUrls = await Promise.all(uploadPromises);
                body.images = imageUrls; // Replace Base64 with URLs
            }
            catch (uploadError) {
                console.error('Cloudinary upload failed:', uploadError);
                return res.status(500).json({ error: 'Failed to upload images' });
            }
        }
        const [newNote] = await db_1.db.insert(schema_1.notes).values({
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
            musicTrack: body.musicTrack,
        }).returning();
        res.json(newNote);
        // Send Push Notification to Partner
        try {
            // Find partner
            const connection = await db_1.db.query.connections.findFirst({
                where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.connections.userA, userId), (0, drizzle_orm_1.eq)(schema_1.connections.userB, userId))
            });
            if (connection) {
                const partnerId = connection.userA === userId ? connection.userB : connection.userA;
                const partner = await db_1.db.query.users.findFirst({
                    where: (0, drizzle_orm_1.eq)(schema_1.users.id, partnerId)
                });
                if (partner && partner.pushToken) {
                    const { PushService } = await Promise.resolve().then(() => __importStar(require('../services/push')));
                    await PushService.sendPushNotification(partner.pushToken, 'New Note! 💌', 'Your partner sent you a new note!', {
                        type: 'NOTE_RECEIVED',
                        noteId: newNote.id,
                        note: newNote // Send full data for "Webhook" style instant update
                    });
                }
            }
        }
        catch (pushError) {
            console.error('Push notification failed:', pushError);
            // Don't fail the request
        }
    }
    catch (error) {
        console.error('POST note error:', error);
        res.status(500).json({ error: 'Failed to save note' });
    }
});
// PATCH /api/notes
router.patch('/', async (req, res) => {
    try {
        const { id, ...updates } = req.body;
        if (!id)
            return res.status(400).json({ error: 'ID required' });
        const [updated] = await db_1.db.update(schema_1.notes)
            .set(updates)
            .where((0, drizzle_orm_1.eq)(schema_1.notes.id, id))
            .returning();
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});
// DELETE /api/notes
router.delete('/', async (req, res) => {
    const { id } = req.query;
    if (!id)
        return res.status(400).json({ error: 'ID required' });
    try {
        await db_1.db.delete(schema_1.notes).where((0, drizzle_orm_1.eq)(schema_1.notes.id, id));
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Delete failed' });
    }
});
exports.default = router;
