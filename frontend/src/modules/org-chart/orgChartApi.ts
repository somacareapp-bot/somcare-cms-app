import api from '../../services/api';

export type OrgStatus = 'active' | 'inactive';
export type LinkType = 'role' | 'department' | 'position';

export interface OrgNode {
  id: string;
  title: string;
  subtitle?: string | null;
  department?: string | null;
  location?: string | null;
  headcount: number;
  order: number;
  status: OrgStatus;
  parentId?: string | null;
  linkType?: LinkType | null;
  linkValue?: string | null;
  linkedUserId?: string | null;
  children: OrgNode[];
}

export interface OrgNodeInput {
  title: string;
  subtitle?: string;
  department?: string;
  location?: string;
  headcount?: number;
  status?: OrgStatus;
  parentId?: string | null;
  linkType?: LinkType | null;
  linkValue?: string | null;
  linkedUserId?: string | null;
}

export const orgChartApi = {
  tree: () => api.get<OrgNode[]>('/api/org-chart/tree').then((r) => r.data),
  create: (data: OrgNodeInput) => api.post('/api/org-chart', data).then((r) => r.data),
  update: (id: string, data: Partial<OrgNodeInput>) =>
    api.patch(`/api/org-chart/${id}`, data).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/org-chart/${id}`).then((r) => r.data),
};
