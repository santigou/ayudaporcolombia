export type PointType = "ayuda" | "necesita_ayuda";
export type PointCategory = "refugio" | "alimentos" | "agua" | "medico" | "otro";
export type PointStatus = "pending" | "approved" | "rejected" | "active" | "resolved";

export interface Point {
  id: string;
  type: PointType;
  title: string;
  description: string;
  lat: number;
  lng: number;
  addressText?: string | null;
  category?: PointCategory | null;
  photos: string[];
  status: PointStatus;
  createdAt: string;
  contactInfo?: string;
  verificationCode?: string | null;
  createdBy?: { id: string; name: string; email: string; contactInfo?: string | null };
}

export interface ModeratorRequestSummary {
  status: "pending" | "approved" | "rejected";
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "moderator";
  contactInfo?: string | null;
  moderatorRequest?: ModeratorRequestSummary | null;
}

export const CATEGORY_LABELS: Record<PointCategory, string> = {
  refugio: "Refugio",
  alimentos: "Alimentos",
  agua: "Agua",
  medico: "Médico",
  otro: "Otro",
};
