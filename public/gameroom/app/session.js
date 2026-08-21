import { api } from './api.js';
import { applyTheme } from './theme.js';

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export const session = {
  me: null,
  profiles: [],
  settings: { siteName: 'The Game Room', rivalry: null },

  async init() {
    const [profiles, settings] = await Promise.all([
      api.get('/api/profiles'),
      api.get('/api/settings'),
    ]);
    this.profiles = profiles;
    this.settings = settings;
    this.me = await api.get('/api/me');
    applyTheme(this.me?.theme);
  },

  async refresh() {
    this.profiles = await api.get('/api/profiles');
    this.settings = await api.get('/api/settings');
    this.me = await api.get('/api/me');
    applyTheme(this.me?.theme);
    emit();
  },

  // Logs in as profileId (switching users is just logging in as someone else).
  async login(profileId, pin) {
    this.me = await api.post('/api/login', { profileId, pin });
    applyTheme(this.me.theme);
    emit();
    return this.me;
  },

  async logout() {
    await api.post('/api/logout');
    this.me = null;
    applyTheme('felt');
    emit();
  },

  profile(id) { return this.profiles.find((p) => p.id === id) || null; },

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
