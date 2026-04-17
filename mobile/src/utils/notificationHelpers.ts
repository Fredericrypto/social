/**
 * notificationHelpers.ts v2
 *
 * Algoritmo de agrupamento corrigido:
 * - MESMA PESSOA fazendo N ações no mesmo post → "Felipe curtiu 3 dos seus posts"
 * - PESSOAS DIFERENTES curtindo o mesmo post → "Felipe, Ana e mais 2 curtiram"
 * - Nunca "Felipe e Felipe" (mesmo userId deduplicado)
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
    id:        string;
    caption?:  string;
    mediaUrls?: string[];
  };
}

export interface NotificationGroup {
  key:            string;
  type:           NotifType;
  notifications:  RawNotification[];
  leadActor:      RawNotification["actor"];
  post?:          RawNotification["post"];
  latestAt:       string;
  hasUnread:      boolean;
  summary:        string;
  // Atores únicos (deduplicados por userId)
  uniqueActors:   RawNotification["actor"][];
  // Posts únicos (quando mesmo usuário curtiu vários)
  uniquePosts:    RawNotification["post"][];
}

export const NOTIF_CONFIG: Record<NotifType, {
  icon: string; color: string;
  label: string; labelN: string; sameUserN: string;
}> = {
  like:    { icon: "heart",       color: "#F43F5E", label: "curtiu seu post",        labelN: "curtiram seu post",        sameUserN: "curtiu {n} dos seus posts"    },
  comment: { icon: "chatbubble",  color: "#7C3AED", label: "comentou no seu post",   labelN: "comentaram no seu post",   sameUserN: "comentou em {n} dos seus posts" },
  follow:  { icon: "person-add",  color: "#06B6D4", label: "começou a seguir você",  labelN: "começaram a seguir você",  sameUserN: "começou a seguir você"         },
  mention: { icon: "at-circle",   color: "#F59E0B", label: "mencionou você",         labelN: "mencionaram você",         sameUserN: "mencionou você {n} vezes"      },
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function filterOld(notifications: RawNotification[]): RawNotification[] {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return notifications.filter(n => new Date(n.createdAt).getTime() > cutoff);
}

/**
 * Chave de grupo:
 * - follow → todos follows juntos
 * - mesma pessoa, mesmo tipo → agrupa por actorId (ex: Felipe curtiu 3 posts)
 * - pessoas diferentes, mesmo post → agrupa por tipo+postId
 */
function groupKey(n: RawNotification): string {
  if (n.type === "follow") return "follow";
  const actorId = n.actor?.id || "unknown";
  const postId  = n.post?.id  || "no-post";
  // Primeiro tenta agrupar pelo ator (mesmo usuário, tipo igual)
  return `${n.type}__actor__${actorId}__post__${postId}`;
}

/**
 * Segunda passagem: mescla grupos do mesmo ator/tipo em diferentes posts
 * Ex: Felipe curtiu post-A e post-B → 1 grupo "Felipe curtiu 2 dos seus posts"
 */
function mergeActorGroups(
  map: Map<string, RawNotification[]>
): Map<string, RawNotification[]> {
  const merged = new Map<string, RawNotification[]>();

  for (const [key, items] of map.entries()) {
    const actorId = items[0].actor?.id;
    const type    = items[0].type;
    if (!actorId || type === "follow") {
      merged.set(key, items);
      continue;
    }
    // Chave de ator: agrupa TODAS as ações do mesmo ator/tipo
    const actorKey = `${type}__actor__${actorId}`;
    if (!merged.has(actorKey)) merged.set(actorKey, []);
    merged.get(actorKey)!.push(...items);
  }

  return merged;
}

export function groupNotifications(raw: RawNotification[]): NotificationGroup[] {
  const filtered = filterOld(raw);
  const map = new Map<string, RawNotification[]>();

  for (const n of filtered) {
    const key = groupKey(n);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }

  // Mesclar grupos do mesmo ator
  const mergedMap = mergeActorGroups(map);
  const groups: NotificationGroup[] = [];

  for (const [key, items] of mergedMap.entries()) {
    // Ordenar por data decrescente
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const lead = items[0];
    const cfg  = NOTIF_CONFIG[lead.type] || NOTIF_CONFIG.like;

    // Atores únicos (deduplicar por userId)
    const actorMap = new Map<string, RawNotification["actor"]>();
    for (const item of items) {
      if (item.actor?.id) actorMap.set(item.actor.id, item.actor);
    }
    const uniqueActors = Array.from(actorMap.values());

    // Posts únicos
    const postMap = new Map<string, RawNotification["post"]>();
    for (const item of items) {
      if (item.post?.id) postMap.set(item.post.id, item.post);
    }
    const uniquePosts = Array.from(postMap.values());

    const isSameActor = uniqueActors.length === 1;
    const actorName   = lead.actor?.displayName || lead.actor?.username || "Alguém";
    const nPosts      = uniquePosts.length;
    const nActors     = uniqueActors.length;

    let summary: string;

    if (lead.type === "follow") {
      if (nActors === 1) {
        summary = `${actorName} ${cfg.label}`;
      } else if (nActors === 2) {
        const second = uniqueActors[1]?.displayName || uniqueActors[1]?.username || "outro";
        summary = `${actorName} e ${second} ${cfg.labelN}`;
      } else {
        summary = `${actorName} e mais ${nActors - 1} pessoas ${cfg.labelN}`;
      }
    } else if (isSameActor && nPosts > 1) {
      // Mesmo usuário, vários posts
      summary = `${actorName} ${cfg.sameUserN.replace("{n}", String(nPosts))}`;
    } else if (nActors === 1) {
      summary = `${actorName} ${cfg.label}`;
    } else if (nActors === 2) {
      const second = uniqueActors[1]?.displayName || uniqueActors[1]?.username || "outro";
      summary = `${actorName} e ${second} ${cfg.labelN}`;
    } else {
      summary = `${actorName} e mais ${nActors - 1} pessoas ${cfg.labelN}`;
    }

    groups.push({
      key,
      type:         lead.type,
      notifications: items,
      leadActor:    lead.actor,
      post:         lead.post,
      latestAt:     lead.createdAt,
      hasUnread:    items.some(i => !i.isRead),
      summary,
      uniqueActors,
      uniquePosts,
    });
  }

  groups.sort((a, b) => {
    if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
    return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
  });

  return groups;
}
