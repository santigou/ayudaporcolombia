// Cliente HTTP para el PORTAL DE PARTNERS. Distinto del `api` normal: no usa
// cookies/JWT sino la API key del partner (header X-API-Key), guardada en
// localStorage bajo partner_api_key cuando el partner "entra" al dashboard.

const BASE = "/api";

export const PARTNER_KEY_STORAGE = "partner_api_key";

export function getPartnerKey(): string | null {
  try {
    return localStorage.getItem(PARTNER_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setPartnerKey(key: string | null) {
  try {
    if (key) localStorage.setItem(PARTNER_KEY_STORAGE, key);
    else localStorage.removeItem(PARTNER_KEY_STORAGE);
  } catch {
    // localStorage no disponible (modo privado): la key solo vive en memoria
    // de la sesión actual.
  }
}

export class PartnerApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const key = getPartnerKey();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "X-API-Key": key } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      message = data.error ?? data.message ?? message;
    } catch {
      // sin cuerpo JSON
    }
    throw new PartnerApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

// --- Tipos del portal ---

export interface PartnerView {
  id: string;
  slug: string;
  name: string;
  contactEmail: string | null;
  approvedAt: string | null;
  trusted: boolean;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  sendOnCreated: boolean;
  sendOnUpdated: boolean;
  outboundUrl: string | null;
  authType: "api_key" | "login";
  outboundHeaderName: string | null;
  outboundApiKey: string | null; // máscara ••••1234
  loginUrl: string | null;
  loginEmail: string | null; // máscara
  hasLoginPassword: boolean;
  tokenJsonPath: string | null;
  tokenHeader: string | null;
  createdAt: string;
}

export interface PartnerApiKeyView {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PartnerMappingView {
  id: string;
  direction: "inbound" | "outbound";
  version: number;
  definition: unknown;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface DeliveryView {
  id: string;
  event: string;
  status: string;
  httpStatus: number | null;
  lastError: string | null;
  attempts: number;
  deliveredAt: string | null;
  createdAt: string;
  point: { code: string; title: string } | null;
}

export interface DryRunResult {
  ok: boolean;
  error?: string;
  result: unknown;
  canonicalCheck: { valid: boolean; error?: string } | null;
}

export const partnerApi = {
  // Público: registro desde el portal (sin key). Devuelve la key UNA vez.
  register: (body: { slug: string; name: string; contactEmail: string }) =>
    request<{ partner: PartnerView; apiKey: string; message: string }>("/partners/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  whoami: () => request<PartnerView>("/integrations/v1/whoami"),

  createKey: () =>
    request<{ id: string; name: string; prefix: string; key: string }>("/integrations/v1/keys", {
      method: "POST",
    }),

  listKeys: () => request<PartnerApiKeyView[]>("/integrations/v1/keys"),

  revokeKey: (keyId: string) =>
    request<{ id: string; revoked: boolean }>(`/integrations/v1/keys/${keyId}`, { method: "DELETE" }),

  mappings: (direction?: "inbound" | "outbound") =>
    request<PartnerMappingView[]>(`/integrations/v1/mappings${direction ? `?direction=${direction}` : ""}`),

  createMapping: (body: { direction: "inbound" | "outbound"; definition: unknown; notes?: string; activate?: boolean }) =>
    request<PartnerMappingView>("/integrations/v1/mappings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  activateMapping: (id: string) =>
    request<PartnerMappingView>(`/integrations/v1/mappings/${id}/activate`, { method: "POST" }),

  dryRun: (body: { direction: "inbound" | "outbound"; definition?: unknown; sampleInput: unknown }) =>
    request<DryRunResult>("/integrations/v1/mappings/dry-run", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deliveries: (limit = 30) => request<DeliveryView[]>(`/integrations/v1/deliveries?limit=${limit}`),
};
