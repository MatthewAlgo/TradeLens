export interface SubscriptionMessage {
  action: 'subscribe' | 'unsubscribe';
  channels: string[]; // Supports multiple channels
}

export function parseSubscriptionMessage(raw: string): SubscriptionMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    
    if (parsed.action !== 'subscribe' && parsed.action !== 'unsubscribe') {
      return null;
    }

    // Support both single channel and array of channels for backward compatibility
    let channels: string[] = [];
    if (Array.isArray(parsed.channels)) {
      channels = parsed.channels.filter((c: any) => typeof c === 'string');
    } else if (typeof parsed.channel === 'string') {
      channels = [parsed.channel];
    }

    if (channels.length === 0) {
      return null;
    }

    return {
      action: parsed.action,
      channels,
    };
  } catch {
    return null;
  }
}

export function shouldDeliver(subscriptions: Set<string>, channel: string): boolean {
  if (subscriptions.has(channel)) return true;

  // Support wildcard matching (e.g., 'ticks:*' matches 'ticks:BTCUSDT')
  const parts = channel.split(':');
  if (parts.length > 1) {
    const wildcardChannel = `${parts[0]}:*`;
    if (subscriptions.has(wildcardChannel)) return true;
  }

  return false;
}
