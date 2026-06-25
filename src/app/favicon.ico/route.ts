export function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="#111111"/>
    <circle cx="32" cy="32" r="20" fill="none" stroke="#8b5cf6" stroke-width="5"/>
    <path d="M23 43V21h12a10 10 0 0 1 0 20h-7" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400",
    },
  });
}
