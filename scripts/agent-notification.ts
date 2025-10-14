import { exec } from 'child_process';
import '../scripts/utils/load-env';

/**
 * Displays a macOS notification with sound
 * Usage:
 *   npx tsx scripts/agent-notification.ts
 *   npx tsx scripts/agent-notification.ts "Custom Title" "Custom Message"
 */

// Customize your message + title
const title = process.argv[2] || 'Atlas Workflow';
const message = process.argv[3] || 'Task finished successfully!';

const script = `
afplay /System/Library/Sounds/Funk.aiff;
osascript -e 'display notification "${message}" with title "${title}"'
`;

exec(script, (error) => {
  if (error) {
    console.error('Notification failed:', error);
    process.exit(1);
  }
  console.log(`✓ Notification sent: "${title}" - "${message}"`);
});
