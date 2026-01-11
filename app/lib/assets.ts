export function assetUrl(path?: string | null) {
  if (!path) return null;

  const base = process.env.NEXT_PUBLIC_ASSET_BASE_URL;

  if (!base) return null;

  return `${base}/${path.replace(/^\//, "")}`;
}
