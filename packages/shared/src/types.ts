export type ChannelType =
  | "google_ads"
  | "meta_ads"
  | "tiktok_ads"
  | "linkedin_ads"
  | "youtube_ads"
  | "programmatic"
  | "tv"
  | "radio"
  | "ooh"
  | "print"
  | "influencer"
  | "email"
  | "other";

export type PlatformType =
  | "google_ads"
  | "meta_ads"
  | "tiktok_ads"
  | "linkedin_ads"
  | "youtube_ads"
  | "ga4"
  | "other";

export type MetricType =
  | "impressions"
  | "clicks"
  | "sessions"
  | "conversions"
  | "leads"
  | "sales"
  | "revenue"
  | "cpa"
  | "cpc"
  | "ctr"
  | "roas";

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "linkedin"
  | "other";

export type NotifChannel = "email" | "slack" | "webhook" | "in_app";

export interface FunnelRow {
  fecha: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  impresiones: number;
  clicks: number;
  costo: number;
  sesiones: number;
  usuarios: number;
  conversiones: number;
  valor_conversion: number;
  ctr_pct: number | null;
  click_to_session_pct: number | null;
  cvr_pct: number | null;
}

export interface PlanningCompliance {
  planning_id: string;
  fecha: string;
  canal: ChannelType;
  campania: string;
  metric_type: MetricType;
  inversion_plan: number;
  kpi_target: number;
  inversion_real: number;
  kpi_actual: number;
  cumplimiento_inversion_pct: number | null;
  cumplimiento_kpi_pct: number | null;
}

export const CHANNEL_LABEL: Record<ChannelType, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
  linkedin_ads: "LinkedIn Ads",
  youtube_ads: "YouTube Ads",
  programmatic: "Programmatic",
  tv: "TV",
  radio: "Radio",
  ooh: "Vía pública",
  print: "Print",
  influencer: "Influencer",
  email: "Email",
  other: "Otro",
};

export const METRIC_LABEL: Record<MetricType, string> = {
  impressions: "Impresiones",
  clicks: "Clicks",
  sessions: "Sesiones",
  conversions: "Conversiones",
  leads: "Leads",
  sales: "Ventas",
  revenue: "Revenue",
  cpa: "CPA",
  cpc: "CPC",
  ctr: "CTR",
  roas: "ROAS",
};
