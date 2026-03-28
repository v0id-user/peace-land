import type { APIRoute } from "astro";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_ENDPOINT = "https://api.spotify.com/v1/me/player/currently-playing";

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const response = await fetch(TOKEN_ENDPOINT, {
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
  const data = await response.json();
  return data.access_token;
}

export const GET: APIRoute = async () => {
  const clientId = import.meta.env.SPOTIFY_CLIENT_ID;
  const clientSecret = import.meta.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = import.meta.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return Response.json({ is_playing: false, error: "missing_config" });
  }

  try {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    const response = await fetch(NOW_PLAYING_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 204 = nothing playing
    if (response.status === 204) {
      return Response.json({ is_playing: false });
    }

    const data = await response.json();

    if (!data.item) {
      return Response.json({ is_playing: false });
    }

    return Response.json({
      is_playing: data.is_playing,
      title: data.item.name,
      artist: data.item.artists.map((a: any) => a.name).join(", "),
      album: data.item.album?.name,
      album_art: data.item.album?.images?.[2]?.url || data.item.album?.images?.[0]?.url,
      url: data.item.external_urls?.spotify,
      progress_ms: data.progress_ms,
      duration_ms: data.item.duration_ms,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=30, max-age=30",
      },
    });
  } catch {
    return Response.json({ is_playing: false, error: "fetch_failed" });
  }
};
