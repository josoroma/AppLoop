import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getProjectRepository } from "@/lib/projects/store";
import { projectAccessErrorResponse, requireProjectAccess } from "@/lib/security/authorization";
import { getProjectScreenshotsDir } from "@/lib/security/paths";

export const dynamic = "force-dynamic";

const ALLOWED_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_SCREENSHOTS_PER_PROJECT = 50;
const MAGIC_BYTES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  "image/bmp": [0x42, 0x4d],
};

type ScreenshotsRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(request: Request, { params }: ScreenshotsRouteProps) {
  const { projectId } = await params;
  const access = await requireProjectAccess(getProjectRepository(), projectId).catch(projectAccessErrorResponse);

  if (access instanceof Response) {
    return access;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return new Response("Invalid form data.", { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return new Response("Missing file field.", { status: 400 });
  }

  const mediaType = resolveMediaType(file.type, file.name);

  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return new Response(`Unsupported media type: ${mediaType}`, { status: 415 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return new Response(`File exceeds ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB limit.`, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!verifyMagicBytes(buffer, mediaType)) {
    return new Response("File content does not match declared media type.", { status: 400 });
  }

  const screenshotId = randomUUID();
  const extension = mediaType === "image/jpeg" ? ".jpg" : ".png";
  const filename = `${screenshotId}${extension}`;
  const targetDir = getProjectScreenshotsDir(projectId);

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, filename), buffer);

  const selectorRaw = formData.get("selector");
  const selector = typeof selectorRaw === "string" && selectorRaw.length > 0 ? selectorRaw : null;
  const sourceRaw = formData.get("source");
  const source = typeof sourceRaw === "string" ? sourceRaw : "inspector";
  const normalizedSource = source === "clipboard" ? "clipboard" : "inspector";

  // Evict oldest if over limit
  await enforceScreenshotLimit(projectId);

  await getProjectRepository().createScreenshot({
    id: screenshotId,
    projectId,
    filename,
    mediaType,
    sizeBytes: file.size,
    selector: selector ?? null,
    source: normalizedSource,
    width: null,
    height: null,
  });

  const url = `/api/projects/${encodeURIComponent(projectId)}/screenshots/${encodeURIComponent(screenshotId)}`;

  return Response.json({ screenshotId, url }, { status: 201 });
}

export async function GET(request: Request, { params }: ScreenshotsRouteProps) {
  const { projectId } = await params;
  const segments = new URL(request.url).pathname.split("/");
  const lastSegment = segments[segments.length - 1];

  // Route: GET /api/projects/:projectId/screenshots/:screenshotId
  if (lastSegment && lastSegment !== "screenshots" && lastSegment !== projectId) {
    const screenshotId = lastSegment;
    const access = await requireProjectAccess(getProjectRepository(), projectId).catch(projectAccessErrorResponse);

    if (access instanceof Response) {
      return access;
    }

    const screenshot = await getProjectRepository().findScreenshotById(screenshotId);

    if (!screenshot || screenshot.projectId !== projectId) {
      return new Response("Screenshot not found.", { status: 404 });
    }

    const filePath = path.join(getProjectScreenshotsDir(projectId), screenshot.filename);
    let fileBuffer: Buffer;

    try {
      fileBuffer = await fs.readFile(filePath);
    } catch {
      return new Response("Screenshot file not found on disk.", { status: 404 });
    }

    return new Response(fileBuffer as unknown as BodyInit, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": screenshot.mediaType,
        "Content-Length": String(screenshot.sizeBytes),
      },
    });
  }

  // Route: GET /api/projects/:projectId/screenshots (list)
  const access = await requireProjectAccess(getProjectRepository(), projectId).catch(projectAccessErrorResponse);

  if (access instanceof Response) {
    return access;
  }

  const screenshots = await getProjectRepository().listProjectScreenshots(projectId, 50);

  return Response.json({ screenshots });
}

function resolveMediaType(declaredType: string, filename: string): string {
  if (ALLOWED_MEDIA_TYPES.has(declaredType)) {
    return declaredType;
  }

  const ext = path.extname(filename).toLowerCase();

  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".bmp") return "image/bmp";

  return declaredType || "application/octet-stream";
}

function verifyMagicBytes(buffer: Buffer, mediaType: string): boolean {
  const expected = MAGIC_BYTES[mediaType];

  if (!expected) {
    return true; // Unknown type, skip magic byte check
  }

  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) {
      return false;
    }
  }

  return true;
}

async function enforceScreenshotLimit(projectId: string) {
  const screenshots = await getProjectRepository().listProjectScreenshots(projectId, MAX_SCREENSHOTS_PER_PROJECT + 1);

  if (screenshots.length <= MAX_SCREENSHOTS_PER_PROJECT) {
    return;
  }

  const toDelete = screenshots.slice(MAX_SCREENSHOTS_PER_PROJECT);
  const dir = getProjectScreenshotsDir(projectId);

  for (const screenshot of toDelete) {
    try {
      await fs.unlink(path.join(dir, screenshot.filename));
    } catch {
      // File may already be gone
    }

    await getProjectRepository().deleteScreenshot(screenshot.id);
  }
}