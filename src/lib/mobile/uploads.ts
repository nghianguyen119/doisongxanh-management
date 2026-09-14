import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Report-photo storage for the mobile API. Photos land in
 * `public/uploads/mobile/<taskId>/` and are served by Next.js at
 * `/uploads/mobile/...`.
 *
 * Local disk is fine for a self-hosted/dev deployment; it is *not* durable on
 * serverless platforms. Keep all filesystem access here so swapping in S3/R2
 * later touches one file.
 */

const MAX_FILES_PER_REQUEST = 20;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Structural subset of the Web `File` so we do not depend on DOM lib types. */
export interface UploadFile {
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export class UploadError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

export function isUploadFile(value: unknown): value is UploadFile {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as UploadFile).arrayBuffer === "function" &&
    typeof (value as UploadFile).size === "number"
  );
}

/**
 * Persist uploaded images and return their public paths (relative to the
 * site origin, so emulator/LAN hosts resolve against the same base URL the
 * app already uses).
 */
export async function saveTaskUploads(
  taskId: string,
  files: UploadFile[],
): Promise<string[]> {
  if (files.length === 0) return [];
  if (files.length > MAX_FILES_PER_REQUEST) {
    throw new UploadError(
      413,
      `Chỉ gửi được tối đa ${MAX_FILES_PER_REQUEST} ảnh mỗi lần.`,
    );
  }

  // taskId comes from the authenticated route as a UUID; re-check so a
  // crafted value cannot escape the uploads directory.
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) {
    throw new UploadError(400, "Mã công việc không hợp lệ.");
  }

  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "mobile",
    taskId,
  );
  await mkdir(dir, { recursive: true });

  const urls: string[] = [];
  for (const file of files) {
    const ext = MIME_EXT[file.type.toLowerCase()];
    if (!ext) {
      throw new UploadError(
        415,
        "Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc HEIC.",
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new UploadError(413, "Ảnh vượt quá 15MB. Vui lòng chọn ảnh nhỏ hơn.");
    }
    const name = `${randomUUID()}.${ext}`;
    await writeFile(
      path.join(dir, name),
      Buffer.from(await file.arrayBuffer()),
    );
    urls.push(`/uploads/mobile/${taskId}/${name}`);
  }
  return urls;
}
