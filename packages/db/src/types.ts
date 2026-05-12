/**
 * Tipos de la base de datos.
 *
 * ⚠️ Este archivo es un STUB inicial. Regenerá con tipos reales corriendo:
 *
 *     pnpm db:types
 *
 * (requiere supabase CLI logueada y vinculada al proyecto, o supabase local
 * corriendo). Cuando se regenera queda actualizado con cualquier cambio de
 * schema. No editar a mano una vez que tengas Supabase conectado.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ChannelType =
  | "google_ads" | "meta_ads" | "tiktok_ads" | "linkedin_ads" | "youtube_ads"
  | "programmatic" | "tv" | "radio" | "ooh" | "print" | "influencer" | "email" | "other";

export type MetricType =
  | "impressions" | "clicks" | "sessions" | "conversions" | "leads"
  | "sales" | "revenue" | "cpa" | "cpc" | "ctr" | "roas";

export type PlatformType =
  | "google_ads" | "meta_ads" | "tiktok_ads" | "linkedin_ads"
  | "youtube_ads" | "ga4" | "other";

export type SocialPlatform =
  | "instagram" | "facebook" | "tiktok" | "youtube" | "twitter" | "linkedin" | "other";

export type NotifChannel = "email" | "slack" | "webhook" | "in_app";

export interface Database {
  public: {
    Tables: {
      planning: {
        Row: {
          id: string;
          fecha: string;
          canal: ChannelType;
          campania: string;
          inversion_plan: number;
          kpi_target: number;
          metric_type: MetricType;
          notas: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["planning"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["planning"]["Row"]>;
      };
      ads_performance: {
        Row: {
          id: string;
          fecha: string;
          plataforma: PlatformType;
          campania_id: string;
          campania_nombre: string;
          adset_id: string | null;
          adset_nombre: string | null;
          ad_id: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_term: string | null;
          impresiones: number;
          clicks: number;
          costo: number;
          conversiones: number;
          valor_conversion: number;
          raw: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ads_performance"]["Row"]> & {
          fecha: string;
          plataforma: PlatformType;
          campania_id: string;
          campania_nombre: string;
        };
        Update: Partial<Database["public"]["Tables"]["ads_performance"]["Row"]>;
      };
      web_traffic: {
        Row: {
          id: string;
          fecha: string;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_term: string | null;
          landing_page: string | null;
          sesiones: number;
          usuarios: number;
          usuarios_nuevos: number;
          conversiones: number;
          eventos_clave: number;
          bounce_rate: number | null;
          avg_session_duration: number | null;
          pageviews: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["web_traffic"]["Row"]> & { fecha: string };
        Update: Partial<Database["public"]["Tables"]["web_traffic"]["Row"]>;
      };
      competitor_web: {
        Row: {
          id: string;
          fecha: string;
          competidor: string;
          dominio: string;
          visitas_estimadas: number | null;
          visitantes_unicos: number | null;
          bounce_rate: number | null;
          pages_per_visit: number | null;
          avg_visit_duration: number | null;
          fuentes_trafico: Json | null;
          paginas_top: Json | null;
          paises_top: Json | null;
          keywords_top: Json | null;
          source: string;
          raw: Json | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["competitor_web"]["Row"]> & {
          fecha: string;
          competidor: string;
          dominio: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitor_web"]["Row"]>;
      };
      social_metrics: {
        Row: {
          id: string;
          fecha: string;
          plataforma: SocialPlatform;
          cuenta: string;
          es_competidor: boolean;
          seguidores: number;
          engagement_rate: number | null;
          posts: number;
          alcance: number | null;
          impresiones: number | null;
          interacciones: number | null;
          source: string;
          raw: Json | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["social_metrics"]["Row"]> & {
          fecha: string;
          plataforma: SocialPlatform;
          cuenta: string;
        };
        Update: Partial<Database["public"]["Tables"]["social_metrics"]["Row"]>;
      };
      social_competitor: {
        Row: {
          id: string;
          fecha_post: string;
          plataforma: SocialPlatform;
          cuenta: string;
          post_id: string;
          post_url: string | null;
          contenido: string | null;
          likes: number | null;
          comentarios: number | null;
          shares: number | null;
          vistas: number | null;
          comentarios_json: Json | null;
          raw: Json | null;
          source: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["social_competitor"]["Row"]> & {
          fecha_post: string;
          plataforma: SocialPlatform;
          cuenta: string;
          post_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["social_competitor"]["Row"]>;
      };
      alerts_config: {
        Row: {
          id: string;
          nombre: string;
          kpi: MetricType;
          canal: ChannelType | null;
          campania: string | null;
          threshold_pct: number;
          comparison: "below" | "above" | "either";
          canal_notif: NotifChannel;
          destino_notif: string | null;
          activa: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["alerts_config"]["Row"]> & {
          nombre: string;
          kpi: MetricType;
          threshold_pct: number;
          comparison: "below" | "above" | "either";
        };
        Update: Partial<Database["public"]["Tables"]["alerts_config"]["Row"]>;
      };
      alerts_log: {
        Row: {
          id: string;
          alert_id: string;
          fecha: string;
          kpi: MetricType;
          valor_plan: number | null;
          valor_actual: number | null;
          desvio_pct: number | null;
          mensaje: string | null;
          notificado: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["alerts_log"]["Row"]> & {
          alert_id: string;
          fecha: string;
          kpi: MetricType;
        };
        Update: Partial<Database["public"]["Tables"]["alerts_log"]["Row"]>;
      };
    };
    Views: {
      vw_funnel_diario: {
        Row: {
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
        };
      };
      vw_cumplimiento_planning: {
        Row: {
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
        };
      };
    };
    Functions: Record<string, never>;
    Enums: {
      channel_type: ChannelType;
      metric_type: MetricType;
      platform_type: PlatformType;
      social_platform: SocialPlatform;
      notif_channel: NotifChannel;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
