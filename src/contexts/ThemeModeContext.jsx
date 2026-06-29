/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { buildTheme, getAppColors } from '../theme';

const ThemeModeContext = createContext({});

export const ThemeModeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => localStorage.getItem('@EWMS:theme') || 'light');

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('@EWMS:theme', next);
      return next;
    });
  };

  const theme = useMemo(() => buildTheme(mode), [mode]);
  const colors = useMemo(() => getAppColors(mode), [mode]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode, colors }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export const useThemeMode = () => useContext(ThemeModeContext);
