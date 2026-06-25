export function extractSemver(value?: string) {
  return value?.match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/)?.[0];
}

function numericParts(version?: string) {
  const semver = extractSemver(version);
  if (!semver) return null;
  return semver
    .split(/[+-]/)[0]
    .split(".")
    .map((part) => Number(part));
}

export function compareSemverLike(current?: string, latest?: string) {
  const currentParts = numericParts(current);
  const latestParts = numericParts(latest);
  if (!currentParts || !latestParts) return null;

  for (let index = 0; index < Math.max(currentParts.length, latestParts.length); index += 1) {
    const currentPart = currentParts[index] ?? 0;
    const latestPart = latestParts[index] ?? 0;
    if (currentPart < latestPart) return -1;
    if (currentPart > latestPart) return 1;
  }

  return 0;
}

export function isVersionOutdated(current?: string, latest?: string) {
  const comparison = compareSemverLike(current, latest);
  return comparison === null ? undefined : comparison < 0;
}
