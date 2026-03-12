import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Extract domain from AUTH0_ISSUER_BASE_URL if AUTH0_DOMAIN is not set
function getDomain(): string | undefined {
  if (process.env.AUTH0_DOMAIN) {
    return process.env.AUTH0_DOMAIN;
  }
  if (process.env.AUTH0_ISSUER_BASE_URL) {
    try {
      const url = new URL(process.env.AUTH0_ISSUER_BASE_URL);
      return url.hostname;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export const auth0 = new Auth0Client({
  domain: getDomain(),
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  appBaseUrl: process.env.AUTH0_BASE_URL,
  authorizationParameters: {
    audience: process.env.AUTH0_AUDIENCE,
    scope: process.env.AUTH0_SCOPE || "openid profile email",
  },
  signInReturnToPath: "/dashboard",
  routes: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    callback: "/api/auth/callback",
  },
});
