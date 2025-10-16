const pushcutWebhookUrl =
  process.env.PUSHCUT_WEBHOOK_URL || 'https://api.pushcut.io/2bPya0Cr3P_UT9SYqs9Ds/notifications/Cursor%20finished';

// Send webhook
async function sendNotification() {
  try {
    const response = await fetch(pushcutWebhookUrl, {
      method: 'POST',
    });
    if (!response.ok) {
      console.error(`Failed to send notification: ${response.status} ${response.statusText}`);
    } else {
      console.log('Notification sent successfully.');
    }
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

sendNotification();
