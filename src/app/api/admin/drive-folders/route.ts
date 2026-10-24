import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  resourceKey?: string;
};

type DriveFolderNode = {
  id: string;
  name: string;
  resourceKey?: string;
  images: Array<{ id: string; name: string; url: string }>;
  folders: DriveFolderNode[];
};

function getFolderReference(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const folderId = typeof input.folderId === "string" ? input.folderId : "";
  const folderUrl = typeof input.folderUrl === "string" ? input.folderUrl : "";
  const resourceKey = typeof input.resourceKey === "string" ? input.resourceKey : undefined;

  if (folderUrl) {
    let url: URL;
    try {
      url = new URL(folderUrl);
    } catch {
      return null;
    }
    if (!["drive.google.com", "www.drive.google.com", "docs.google.com"].includes(url.hostname)) return null;
    const id = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1] ?? url.searchParams.get("id");
    const urlResourceKey = url.searchParams.get("resourcekey") ?? undefined;
    if (!id || !/^[a-zA-Z0-9_-]{5,200}$/.test(id) ||
      (urlResourceKey && !/^[a-zA-Z0-9_-]{1,200}$/.test(urlResourceKey))) return null;
    return { folderId: id, resourceKey: urlResourceKey };
  }

  if (!/^[a-zA-Z0-9_-]{5,200}$/.test(folderId)) return null;
  if (resourceKey && !/^[a-zA-Z0-9_-]{1,200}$/.test(resourceKey)) return null;
  return { folderId, resourceKey };
}

async function driveRequest<T>(url: URL, folderId: string, resourceKey?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (resourceKey) headers["X-Goog-Drive-Resource-Keys"] = `${folderId}/${resourceKey}`;

  const response = await fetch(url, { headers, cache: "no-store" });
  const result = await response.json().catch(() => ({})) as {
    error?: { message?: string };
    files?: DriveFile[];
    nextPageToken?: string;
    id?: string;
    name?: string;
    mimeType?: string;
    resourceKey?: string;
  };
  if (!response.ok) {
    throw new Error(result.error?.message ?? `Google Drive returned HTTP ${response.status}.`);
  }
  return result as T;
}

async function getFolderContents(folderId: string, apiKey: string, resourceKey?: string) {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${DRIVE_API_URL}/files`);
    url.search = new URLSearchParams({
      key: apiKey,
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,resourceKey)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const page = await driveRequest<{ files?: DriveFile[]; nextPageToken?: string }>(url, folderId, resourceKey);
    files.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return files;
}

function imageUrl(file: DriveFile) {
  const url = new URL(`https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`);
  if (file.resourceKey) url.searchParams.set("resourcekey", file.resourceKey);
  return url.toString();
}

async function buildFolderNode(
  folderId: string,
  name: string,
  apiKey: string,
  resourceKey: string | undefined,
  depth: number,
): Promise<DriveFolderNode> {
  const files = await getFolderContents(folderId, apiKey, resourceKey);
  const folders = files.filter((file) => file.mimeType === FOLDER_MIME_TYPE);
  const images = files
    .filter((file) => file.mimeType.startsWith("image/"))
    .map((file) => ({ id: file.id, name: file.name, url: imageUrl(file) }));

  return {
    id: folderId,
    name,
    ...(resourceKey ? { resourceKey } : {}),
    images,
    folders: depth > 0
      ? await Promise.all(folders.map((folder) =>
          buildFolderNode(folder.id, folder.name, apiKey, folder.resourceKey, depth - 1),
        ))
      : folders.map((folder) => ({
          id: folder.id,
          name: folder.name,
          ...(folder.resourceKey ? { resourceKey: folder.resourceKey } : {}),
          images: [],
          folders: [],
        })),
  };
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Sign in with the store owner account to browse Drive folders." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || data.user?.app_metadata?.store_owner !== true) {
    return NextResponse.json({ error: "This account is not authorized to browse Drive folders." }, { status: 403 });
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Drive browsing is not configured on the server." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const reference = getFolderReference(body);
  if (!reference) {
    return NextResponse.json({ error: "Enter a valid Google Drive folder link or select a folder." }, { status: 400 });
  }

  try {
    const metadataUrl = new URL(`${DRIVE_API_URL}/files/${encodeURIComponent(reference.folderId)}`);
    metadataUrl.search = new URLSearchParams({
      key: apiKey,
      fields: "id,name,mimeType,resourceKey",
      supportsAllDrives: "true",
    }).toString();
    const metadata = await driveRequest<DriveFile>(metadataUrl, reference.folderId, reference.resourceKey);
    if (metadata.mimeType !== FOLDER_MIME_TYPE) {
      return NextResponse.json({ error: "The selected Google Drive link is not a folder." }, { status: 400 });
    }
    const folder = await buildFolderNode(
      metadata.id,
      metadata.name,
      apiKey,
      metadata.resourceKey ?? reference.resourceKey,
      1,
    );
    return NextResponse.json({ folder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the Google Drive folder.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
