"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
const expo_server_sdk_1 = require("expo-server-sdk");
const expo = new expo_server_sdk_1.Expo();
exports.PushService = {
    async sendPushNotification(pushToken, title, body, data = {}) {
        if (!expo_server_sdk_1.Expo.isExpoPushToken(pushToken)) {
            console.error(`Push token ${pushToken} is not a valid Expo push token`);
            return;
        }
        const messages = [{
                to: pushToken,
                sound: 'default',
                title: title,
                body: body,
                data: data,
            }];
        try {
            const chunks = expo.chunkPushNotifications(messages);
            for (const chunk of chunks) {
                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    console.log('Push Notification Sent:', ticketChunk);
                }
                catch (error) {
                    console.error('Error sending chunk:', error);
                }
            }
        }
        catch (error) {
            console.error('Error in sendPushNotification:', error);
        }
    }
};
