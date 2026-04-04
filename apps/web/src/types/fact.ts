export interface Fact {
  id: string;
  externalId: string;
  source: string;
  sourceUrl: string | null;
  occurredAt: string;
  title: string;
  summary: string | null;
  content: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  groupId?: string | null;
  groupType?: string | null;
  projectId?: string | null;
  categoryId?: string | null;
  childCount?: number;
}

export interface F2ACategory {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface F2AProject {
  id: string;
  title: string;
  status: string;
  category_id: string | null;
}

export interface FactsResponse {
  data: Fact[];
  meta: {
    hasMore: boolean;
    nextCursor?: string;
  };
}
