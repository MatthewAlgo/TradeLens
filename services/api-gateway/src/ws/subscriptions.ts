export interface SubscriptionMessage {
  action: 'subscribe' | 'unsubscribe';
  channel: string;
}

export function parseSubscriptionMessage(raw: string): SubscriptionMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if ((parsed.action !== 'subscribe' && parsed.action !== 'unsubscribe') || typeof parsed.channel !== 'string') {
      return null;
    }
    return {
      action: parsed.action,
      channel: parsed.channel,
    };
  } catch {
    return null;
  }
}

export function shouldDeliver(subscriptions: Set<string>, channel: string): boolean {
  return subscriptions.has(channel);
}
