"use client";

export interface UserProfile {
  email: string;
  pat: string;
  repos: string[];
  teams?: TeamProfile[];
  isAdmin: boolean;
}

export interface TeamProfile {
  teamId: string;
  teamName: string;
  psId: string;
  repoLink: string;
}

export interface UserAccount {
  email: string;
  password?: string; // In a real app, this would be hashed on a backend
  isAdmin: boolean;
}

const STORAGE_KEY = "repomonitor_users";
const SESSION_KEY = "repomonitor_session";

export const auth = {
  getUsers: (): Record<string, UserAccount & { profile?: UserProfile }> => {
    if (typeof window === "undefined") return {};
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  },

  saveUser: (user: UserAccount) => {
    const users = auth.getUsers();
    users[user.email] = { ...user, profile: users[user.email]?.profile };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  },

  signup: (email: string, password?: string, isAdmin = false) => {
    const users = auth.getUsers();
    if (users[email]) throw new Error("User already exists");
    
    auth.saveUser({ email, password, isAdmin });
    auth.login(email);
  },

  login: (email: string, password?: string) => {
    const users = auth.getUsers();
    const user = users[email];
    if (!user) throw new Error("User not found");
    // In a real app, check password here
    
    localStorage.setItem(SESSION_KEY, email);
    return user;
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },

  getCurrentUserEmail: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(SESSION_KEY);
  },

  getCurrentUser: (): (UserAccount & { profile?: UserProfile }) | null => {
    const email = auth.getCurrentUserEmail();
    if (!email) return null;
    return auth.getUsers()[email] || null;
  },

  saveProfile: (pat: string, repos: string[], teams?: TeamProfile[]) => {
    const email = auth.getCurrentUserEmail();
    if (!email) return;
    
    const users = auth.getUsers();
    const user = users[email];
    if (user) {
      user.profile = {
        email,
        pat,
        repos,
        teams,
        isAdmin: user.isAdmin
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    }
  },

  getProfile: (): UserProfile | null => {
    const user = auth.getCurrentUser();
    return user?.profile || null;
  }
};
