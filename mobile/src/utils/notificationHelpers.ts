/**
 * notificationHelpers.ts
 *
 * Engine de agrupamento de notificações:
 * - Agrupa por tipo + postId (ex: 5 curtidas no mesmo post → 1 grupo)
 * - Agrupa follows recentes em um único grupo
 * - Ordena grupos por data da notificação mais recente
 * - Remove notificações com mais de 7 dias
 */

export type NotifType = "like" | "comment" | "follow" | "mention";

export interface RawNotification {
  id:        string;
  type:      NotifType;
  isRead:    boolean;
  createdAt: string;
  actor?: {
    id:          string;
    username:    string;
    displayName?: string;
    avatarUrl?:  string;
  };
  post?: {
    id:       string;
    caption?: string;
    mediaUrls?: string[];
  };
}

export interface NotificationGroup {
  key:          string;           // chave única do grupo
  type:         NotifType;
  notifications: RawNotification[];
  // Metadados do grupo
  leadActor:    RawNotification["actor"];   // primeiro ator
  post?:        RawNotification["post"];
  latestAt:     string;           // data da mais recente do grupo
  hasUnread:    boolean;
  // Texto gerado
  summary:      string;           // "Felipe e mais 3 curtiram seu post"
}

// ─── Configuração por tipo ────────────────────────────────────────────────────
export const NOTIF_CONFIG: Record<NotifType, {
  icon:    string;
  color:   string;
  label:   string;       // singular
  labelN:  string;       // plural com {n}
  groupLabel: string;    // "e mais {n} pessoas"
}> = {
  like:    {
    icon: "heart",       color: "#F43F5E",
    label: "curtiu seu post",
    labelN: "curtiram seu post",
    groupLabel: "e mais {n} pessoas curtiram",
  },
  comment: {
    icon: "chatbubble",  color: "#7C3AED",
    label: "comentou no seu post",
    labelN: "comentaram no seu post",
    groupLabel: "e mais {n} pessoas comentaram",
  },
  follow:  {
    icon: "person-add",  color: "#06B6D4",
    label: "começou a seguir você",
    labelN: "começaram a seguir você",
    groupLabel: "e mais {n} pessoas seguiram",
  },
  mention: {
    icon: "at-circle",   color: "#F59E0B",
    label: "mencionou você",
    labelN: "mencionaram você",
    groupLabel: "e mais {n} pessoas mencionaram",
  },
};

// ─── Filtrar notificações antigas (> 7 dias) ──────────────────────────────────
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function filterOld(notifications: RawNotification[]): RawNotification[] {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return notifications.filter(n => new Date(n.createdAt).getTime() > cutoff);
}

// ─── Gerar chave de grupo ─────────────────────────────────────────────────────
// Mesmo tipo + mesmo post → mesmo grupo
// Follows sem post → todos num grupo "follows"
function groupKey(n: RawNotification): string {
  if (n.type === "follow") return "follow";
  return `${n.type}__${n.post?.id || "no-post"}`;
}

// ─── Engine principal ─────────────────────────────────────────────────────────
export function groupNotifications(raw: RawNotification[]): NotificationGroup[] {
  const filtered = filterOld(raw);
  const map = new Map<string, RawNotification[]>();

  for (const n of filtered) {
    const key = groupKey(n);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }

  const groups: NotificationGroup[] = [];

  for (const [key, items] of map.entries()) {
    // Ordenar items por data decrescente
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const lead    = items[0];
    const cfg     = NOTIF_CONFIG[lead.type] || NOTIF_CONFIG.like;
    const n       = items.length;
    const actorName = lead.actor?.displayName || lead.actor?.username || "Alguém";

    let summary: string;
    if (n === 1) {
      summary = `${actorName} ${cfg.label}`;
    } else if (n === 2) {
      const second = items[1].actor?.displayName || items[1].actor?.username || "outro";
      summary = `${actorName} e ${second} ${cfg.labelN}`;
    } else {
      summary = `${actorName} ${cfg.groupLabel.replace("{n}", String(n - 1))}`;
    }

    groups.push({
      key,
      type:          lead.type,
      notifications: items,
      leadActor:     lead.actor,
      post:          lead.post,
      latestAt:      lead.createdAt,
      hasUnread:     items.some(i => !i.isRead),
      summary,
    });
  }

  // Ordenar grupos: não lidos primeiro, depois por data
  groups.sort((a, b) => {
    if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
    return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
  });

  return groups;
}
