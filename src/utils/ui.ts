export function showNotification(message: string) {
  console.log(`[Notification]: ${message}`);
  // In a real implementation this would show a toast
  // We can try to dispatch a custom event if we want the UI to pick it up
  window.dispatchEvent(new CustomEvent('nullstrap-notification', { detail: message }));
}
