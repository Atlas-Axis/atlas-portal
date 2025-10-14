import { exec } from 'child_process';
import '../scripts/utils/load-env';

/**
 * Displays a macOS notification with sound
 * Usage:
 *   npx tsx scripts/agent-notification.ts
 *   npx tsx scripts/agent-notification.ts "Custom Title" "Custom Message"
 */

// Customize your message + title
const title = process.argv[2] || 'Cursor finished';
const pushcutWebhookUrl =
  process.env.PUSHCUT_WEBHOOK_URL || 'https://api.pushcut.io/2bPya0Cr3P_UT9SYqs9Ds/notifications/Cursor%20finished';

const script = `
afplay /System/Library/Sounds/Funk.aiff;
osascript -e 'display notification "" with title "${title}"'
`;

exec(script, (error) => {
  if (error) {
    console.error('Notification failed:', error);
    process.exit(1);
  }
  console.log(`✓ Notification sent: "${title}"`);

  // Send webhook
  fetch(pushcutWebhookUrl, {
    method: 'POST',
  });
});
