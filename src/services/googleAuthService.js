const env = require('../config/env');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// Builds the URL we send the browser to so the user can approve Acadia
// accessing their basic Google profile (name, email). Only asks for the
// non-sensitive 'openid email profile' scopes, which don't require Google's
// manual app verification process.
function getGoogleAuthUrl() {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleRedirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// Exchanges the one-time ?code=... Google sent back to our callback route
// for an access token, then uses that to fetch the user's basic profile.
async function exchangeCodeForProfile(code) {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleRedirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || 'Failed to exchange Google auth code');
  }

  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json();
  if (!profileRes.ok || !profile.email) {
    throw new Error('Failed to fetch Google profile');
  }

  return profile; // { sub, email, email_verified, name, picture, ... }
}

module.exports = { getGoogleAuthUrl, exchangeCodeForProfile };