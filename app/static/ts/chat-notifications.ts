import { escapeHtml } from './chat-ui.js';

export function showNotification(
  message: string,
  type: "info" | "success" | "error" = "info",
): void {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  let icon = "fas fa-info-circle";
  let bgColor = "#6D28D9";

  if (type === "success") {
    icon = "fas fa-check-circle";
    bgColor = "#10b981";
  } else if (type === "error") {
    icon = "fas fa-exclamation-circle";
    bgColor = "#ef4444";
  }

  notification.innerHTML = `
        <i class="${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

  notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: ${bgColor}; color: white; padding: 1rem 1.5rem;
        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex; align-items: center; gap: 0.5rem;
        font-weight: 500; max-width: 400px;
    `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}
