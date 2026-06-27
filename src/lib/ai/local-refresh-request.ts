function isLoopbackHost(host: string) {
  let hostname = host.toLowerCase();
  try {
    hostname = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    hostname = host.split(":")[0]?.replace(/^\[|\]$/g, "").toLowerCase();
  }
  const normalized = hostname.replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function sameOrigin(request: Request) {
  const host = request.headers.get("host");
  if (!host || !isLoopbackHost(host)) return false;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      return parsed.host === host && isLoopbackHost(parsed.host);
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const parsed = new URL(referer);
      return parsed.host === host && isLoopbackHost(parsed.host);
    } catch {
      return false;
    }
  }
  return false;
}

export function allowsLocalRefresh(request: Request) {
  const explicitHeader = request.headers.get("x-panely-local-update") === "1";
  const fetchSite = request.headers.get("sec-fetch-site");
  const browserSameSite = fetchSite === "same-origin" || fetchSite === "none";
  return explicitHeader && browserSameSite && sameOrigin(request);
}
