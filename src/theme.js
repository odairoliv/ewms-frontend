import { createTheme } from '@mui/material/styles';

// Tokens semânticos compartilhados pelas páginas (substituem os hex fixos espalhados
// pelo app). Cada página deve ler estes valores via useAppColors() em vez de strings
// de cor fixas, para que o tema claro/escuro se propague de fato.
const TOKENS = {
  light: {
    bgApp: '#f8fafc',
    bgCard: '#ffffff',
    bgSubtle: '#f8fafc',
    bgHover: '#f1f5f9',
    border: '#e2e8f0',
    borderSubtle: '#f1f5f9',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',
    shadow: '0 2px 12px rgba(15,23,42,.04)',
  },
  dark: {
    bgApp: '#0b1220',
    bgCard: '#141b2d',
    bgSubtle: '#0f172a',
    bgHover: '#1e293b',
    border: '#27324a',
    borderSubtle: '#1e293b',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    shadow: '0 2px 12px rgba(0,0,0,.35)',
  },
};

export const getAppColors = (mode) => TOKENS[mode] || TOKENS.light;

export const buildTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: { main: '#1d4ed8' },
    secondary: { main: '#7c3aed' },
    background: {
      default: TOKENS[mode].bgApp,
      paper: TOKENS[mode].bgCard,
    },
    text: {
      primary: TOKENS[mode].textPrimary,
      secondary: TOKENS[mode].textSecondary,
    },
    divider: TOKENS[mode].border,
  },
  typography: {
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
  },
});
