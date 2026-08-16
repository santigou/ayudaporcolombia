const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      message = data.error ?? message;
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  method: "PUT";
  headers?: Record<string, string>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body ?? {}),
    }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    }),
  // Pide una URL pre-firmada para subir una foto directo al almacenamiento.
  presignUpload: (filename: string, mime: string) =>
    request<PresignResult>("/uploads/presign", {
      method: "POST",
      body: JSON.stringify({ filename, mime }),
    }),
};

// Sube un fichero directamente al almacenamiento (SeaweedFS vía presigned PUT o
// disco local). No pasa por /api: va a la uploadUrl devuelta por api.presignUpload.
// `headers` son las cabeceras que exige la URL pre-firmada (p. ej. Content-Type).
export async function uploadFile(
  uploadUrl: string,
  file: File,
  headers?: Record<string, string>,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { ...(headers ?? {}) },
    credentials: "omit",
  });
  if (!res.ok) {
    throw new Error(`No se pudo subir la foto (HTTP ${res.status})`);
  }
}
