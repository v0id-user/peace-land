const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_ENDPOINT = "https://api.spotify.com/v1/me/player/currently-playing";

export interface NowPlaying {
  is_playing: boolean;
  title?: string;
  artist?: string;
  progress_ms?: number;
  duration_ms?: number;
  url?: string;
}

// Access tokens live for an hour. Keep one per isolate so a request only pays for
// the now-playing call, not a token refresh before it.
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    // Refresh a minute early so a token never expires between check and use.
    tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  }
  return data.access_token;
}

export async function getNowPlaying(env: any): Promise<NowPlaying> {
  const clientId = env.SPOTIFY_CLIENT_ID;
  const clientSecret = env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return { is_playing: false };
  }

  try {
    const token = await getAccessToken(clientId, clientSecret, refreshToken);
    const res = await fetch(NOW_PLAYING_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) tokenCache = null;
    if (res.status === 204) return { is_playing: false };

    const data = await res.json();
    if (!data.item) return { is_playing: false };

    return {
      is_playing: data.is_playing,
      title: data.item.name,
      artist: data.item.artists.map((a: any) => a.name).join(", "),
      progress_ms: data.progress_ms,
      duration_ms: data.item.duration_ms,
      url: data.item.external_urls?.spotify,
    };
  } catch {
    return { is_playing: false };
  }
}
