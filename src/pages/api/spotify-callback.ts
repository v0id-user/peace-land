import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const reqUrl = new URL(request.url);
  const code = reqUrl.searchParams.get("code");

  if (!code) {
    return new Response(
      `Missing code. Debug: request.url=${request.url} searchParams=${reqUrl.search}`,
      { status: 400 }
    );
  }

  const clientId = import.meta.env.SPOTIFY_CLIENT_ID;
  const clientSecret = import.meta.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = "https://www.v0id.me/api/spotify-callback";

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();

  return new Response(
    `<html><body style="font-family:monospace;padding:40px">
      <h2>Spotify Auth Complete</h2>
      <p><b>Refresh Token:</b></p>
      <textarea rows="4" cols="80" readonly>${data.refresh_token || "ERROR: " + JSON.stringify(data)}</textarea>
      <p style="color:#999;margin-top:10px">Copy this token. You only need it once.<br>
      Store it as SPOTIFY_REFRESH_TOKEN in Cloudflare Workers secrets.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
};
