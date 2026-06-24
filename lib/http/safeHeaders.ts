const visibleAsciiPattern = /^[\x21-\x7e]+$/;

export function normalizeHeaderToken(token: string | null | undefined) {
  return (token ?? "").trim();
}

export function assertVisibleAsciiHeaderValue(name: string, value: string) {
  if (!visibleAsciiPattern.test(value)) {
    throw new Error(`${name} must contain visible ASCII characters only`);
  }
}

export function createBearerAuthHeader(token: string | null | undefined) {
  const normalizedToken = normalizeHeaderToken(token);
  assertVisibleAsciiHeaderValue("Authorization token", normalizedToken);
  return `Bearer ${normalizedToken}`;
}

export function getBearerTokenFromHeader(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = normalizeHeaderToken(authorization.slice("Bearer ".length));
  assertVisibleAsciiHeaderValue("Authorization token", token);
  return token;
}
