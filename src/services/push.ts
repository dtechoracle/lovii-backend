import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export const PushService = {
    async sendPushNotification(pushToken: string, title: string, body: string, data: any = {}) {
        if (!Expo.isExpoPushToken(pushToken)) {
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
                } catch (error) {
                    console.error('Error sending chunk:', error);
                }
            }
        } catch (error) {
            console.error('Error in sendPushNotification:', error);
        }
    }
};
