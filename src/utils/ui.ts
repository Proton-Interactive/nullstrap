export function showNotification(message: string) {
  console.log(`[Notification]: ${message}`);
  window.dispatchEvent(new CustomEvent('nullstrap-notification', { detail: message }));
}
