export interface AuthUser {
  id: number;
  username: string;
  role?: string;
}

export interface ActiveSession {
  sessionId: number;
  campaignId: number;
  characterId: number;
}

export const auth = {
  getUser: (): AuthUser | null => {
    const data = localStorage.getItem('dnd_player');
    return data ? JSON.parse(data) : null;
  },
  setUser: (user: AuthUser) => {
    localStorage.setItem('dnd_player', JSON.stringify(user));
  },
  logout: () => {
    localStorage.removeItem('dnd_player');
    localStorage.removeItem('dnd_session');
  },
  getSession: (): ActiveSession | null => {
    const data = localStorage.getItem('dnd_session');
    return data ? JSON.parse(data) : null;
  },
  setSession: (session: ActiveSession) => {
    localStorage.setItem('dnd_session', JSON.stringify(session));
  }
};
