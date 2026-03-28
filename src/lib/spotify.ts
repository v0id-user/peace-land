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

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
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
