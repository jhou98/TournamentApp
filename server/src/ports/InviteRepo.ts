export interface InviteRecord {
  id: string;
  code: string;
  grantsAdmin: boolean;
  createdBy: string;
  expiresAt: Date | null;
  usedBy: string | null;
  usedAt: Date | null;
}

export interface InviteRepo {
  create(input: {
    code: string;
    grantsAdmin: boolean;
    createdBy: string;
    expiresAt: Date | null;
  }): Promise<InviteRecord>;
  findByCode(code: string): Promise<InviteRecord | null>;
  markUsed(id: string, usedBy: string): Promise<void>;
}
