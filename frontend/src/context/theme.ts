import { create } from 'zustand';

type ThemeState = {
  dark: boolean;
  toggle: () => void;
  setDark: (v: boolean) => void;
};

const saved = localStorage.getItem('ccodit_theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initial = saved ? saved === 'dark' : prefersDark;

if (initial) document.documentElement.classList.add('dark');

export const useTheme = create<ThemeState>((set) => ({
  dark: initial,
  toggle: () => set((s) => {
    const next = !s.dark;
    if (next) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('ccodit_theme', next ? 'dark' : 'light');
    return { dark: next };
  }),
  setDark: (v) => set(() => {
    if (v) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('ccodit_theme', v ? 'dark' : 'light');
    return { dark: v };
  }),
}));
