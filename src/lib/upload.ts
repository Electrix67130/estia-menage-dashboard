const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "change-me-in-production";

import imageCompression from "browser-image-compression";
import { getAccessToken } from "./api";

export interface UploadResult {
  url: string;
  original_name: string;
  file_size: number;
  mime_type: string;
}

// Aligné sur l'optimisation mobile (estia-menage-ui/src/utils/optimizeImage.ts) :
// on redimensionne à 1920px sur le plus grand côté + recompression, ce qui fait
// typiquement passer une photo de 5-15 Mo à quelques centaines de Ko. Le serveur
// ré-optimise ensuite de toute façon (resize 2000px, strip EXIF).
const MAX_DIMENSION_PX = 1920;
const MAX_SIZE_MB = 1;
const MAX_429_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Délai d'attente sur 429 : respecte l'en-tête `Retry-After` (en secondes),
 * sinon backoff exponentiel plafonné (1s, 2s, 4s…).
 */
function retryDelayMs(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds) && seconds >= 0) return seconds * 1000;
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

/**
 * Compresse/redimensionne une image côté navigateur avant l'upload.
 * Les fichiers non-image (ou un échec de compression) sont renvoyés tels quels.
 */
async function compressIfImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    return await imageCompression(file, {
      maxSizeMB: MAX_SIZE_MB,
      maxWidthOrHeight: MAX_DIMENSION_PX,
      useWebWorker: true,
      // Conserve le format d'origine (jpeg/png/webp) ; le serveur recompresse.
    });
  } catch {
    // En cas d'échec, on tombe sur le fichier brut : le serveur sait l'optimiser.
    return file;
  }
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const token = getAccessToken();
  const optimized = await compressIfImage(file);

  const form = new FormData();
  form.append("file", optimized, file.name);

  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  };

  let response = await fetch(`${API_URL}/upload`, requestInit);

  // Retry sur 429 (rate-limit) : on attend (Retry-After ou backoff) puis on
  // retente, pour absorber les pics d'envoi groupé sans faire échouer l'upload.
  for (let attempt = 0; response.status === 429 && attempt < MAX_429_RETRIES; attempt++) {
    await sleep(retryDelayMs(response, attempt));
    response = await fetch(`${API_URL}/upload`, requestInit);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Upload failed");
  }

  return response.json();
}
