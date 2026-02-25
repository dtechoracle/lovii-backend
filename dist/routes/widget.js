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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const router = (0, express_1.Router)();
// POST /api/widget
router.post('/', async (req, res) => {
    try {
        const { myId, noteId } = req.body;
        if (!myId || !noteId) {
            return res.status(400).json({ error: "Missing required fields: myId, noteId" });
        }
        const me = await db_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.users.id, myId)
        });
        if (!me)
            return res.status(404).json({ error: "User not found" });
        // Verify the note exists and belongs to user
        const savedNote = await db_1.db.query.notes.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.notes.id, noteId)
        });
        if (!savedNote) {
            return res.status(404).json({ error: "Note not found" });
        }
        const connection = await db_1.db.query.connections.findFirst({
            where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.connections.userA, myId), (0, drizzle_orm_1.eq)(schema_1.connections.userB, myId))
        });
        if (!connection) {
            return res.status(400).json({ error: "No partner connected" });
        }
        const partnerId = connection.userA === myId ? connection.userB : connection.userA;
        const partner = await db_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.users.id, partnerId)
        });
        if (!partner) {
            return res.status(404).json({ error: "Partner not found in database" });
        }
        // We already have the note, so we don't insert it again.
        // Just notify.
        // Send Push Notification to Partner
        if (partner.pushToken) {
            try {
                const { PushService } = await Promise.resolve().then(() => __importStar(require('../services/push')));
                await PushService.sendPushNotification(partner.pushToken, 'New Widget Update! 💖', 'Your partner updated their mood/status!', { type: 'WIDGET_UPDATE' });
            }
            catch (error) {
                console.error('Failed to send push notification', error);
            }
        }
        const partnerLatestNote = await db_1.db.query.notes.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.notes.userId, partnerId),
            orderBy: [(0, drizzle_orm_1.desc)(schema_1.notes.timestamp)],
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
    }
    catch (error) {
        console.error("[Widget API] Error:", error);
        res.status(500).json({ error: "Failed to send note to partner widget" });
    }
});
// GET /api/widget
router.get('/', async (req, res) => {
    try {
        const { myId } = req.query;
        if (!myId) {
            return res.status(400).json({ error: "myId required" });
        }
        const connection = await db_1.db.query.connections.findFirst({
            where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.connections.userA, myId), (0, drizzle_orm_1.eq)(schema_1.connections.userB, myId))
        });
        if (!connection) {
            return res.json({ connected: false, partner: null, widget: null });
        }
        const partnerId = connection.userA === myId ? connection.userB : connection.userA;
        const partner = await db_1.db.query.users.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.users.id, partnerId)
        });
        if (!partner) {
            return res.json({ connected: false, partner: null, widget: null });
        }
        const partnerLatestNote = await db_1.db.query.notes.findFirst({
            where: (0, drizzle_orm_1.eq)(schema_1.notes.userId, partnerId),
            orderBy: [(0, drizzle_orm_1.desc)(schema_1.notes.timestamp)],
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
    }
    catch (error) {
        console.error("[Widget API GET] Error:", error);
        res.status(500).json({ error: "Failed to fetch partner widget status" });
    }
});
exports.default = router;
