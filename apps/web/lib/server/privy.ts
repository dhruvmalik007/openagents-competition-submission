import { PrivyClient } from '@privy-io/node';
import { env } from './env';

let privyClient: PrivyClient | null = null;

export function isPrivyConfigured(): boolean {
  return Boolean(env.privyAppId && env.privyAppSecret);
}

export function getPrivyClient(): PrivyClient {
  if (!env.privyAppId || !env.privyAppSecret) {
    throw new Error('Privy is not configured. Set PRIVY_APP_ID and PRIVY_APP_SECRET in the web environment.');
  }

  if (!privyClient) {
    privyClient = new PrivyClient({
      appId: env.privyAppId,
      appSecret: env.privyAppSecret
    });
  }

  return privyClient;
}

export async function verifyPrivyAccessToken(accessToken: string): Promise<{
  appId: string;
  userId: string;
  sessionId: string;
}> {
  const privy = getPrivyClient();
  const claims = await privy.utils().auth().verifyAccessToken(accessToken);

  return {
    appId: claims.app_id,
    userId: claims.user_id,
    sessionId: claims.session_id
  };
}
