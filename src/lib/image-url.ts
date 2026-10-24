export function normalizeImageUrl(value: string) {
  const normalized = value.trim();
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" && url.protocol !== "http:") return normalized;
    if (url.hostname !== "drive.google.com" && url.hostname !== "www.drive.google.com") return url.toString();

    const fileId = url.pathname.match(/^\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get("id");
    if (!fileId) return url.toString();

    const imageUrl = new URL(`https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=w1600`);
    const resourceKey = url.searchParams.get("resourcekey");
    if (resourceKey) imageUrl.searchParams.set("resourcekey", resourceKey);
    return imageUrl.toString();
  } catch {
    return normalized;
  }
}
