export interface NewUser {
  username: string;
  displayName: string;
  passwordHash: string;
  isAdmin: boolean;
}

/** Full record including the password hash — never send this outward. */
export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: Date;
}

/** Safe projection for API responses. */
export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: Date;
}

export interface UserRepo {
  create(user: NewUser): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  findByUsername(username: string): Promise<UserRecord | null>;
  list(): Promise<PublicUser[]>;
  setAdmin(id: string, isAdmin: boolean): Promise<PublicUser>;
}

export function toPublicUser(u: UserRecord): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt,
  };
}
