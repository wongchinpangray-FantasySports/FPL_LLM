export type NotificationCategory = "news" | "message";

/** UI bucket for inbox — news & match alerts vs app / promo / system messages. */
export function notificationCategory(type: string): NotificationCategory {
  if (type === "news" || type === "match_result") return "news";
  return "message";
}

export function groupNotificationsByCategory<T extends { type: string }>(
  items: T[],
): { news: T[]; message: T[] } {
  const news: T[] = [];
  const message: T[] = [];
  for (const item of items) {
    if (notificationCategory(item.type) === "news") {
      news.push(item);
    } else {
      message.push(item);
    }
  }
  return { news, message };
}
