import { useState } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Layout principal do EWMS.
 *
 * Desktop (md+):
 *   ┌──────────────────────────────────────────┐
 *   │ Sidebar (260px, fixo)  │  Coluna direita  │
 *   │                        │  ┌─────────────┐ │
 *   │                        │  │  Topbar     │ │
 *   │                        │  ├─────────────┤ │
 *   │                        │  │  Conteúdo   │ │
 *   │                        │  │  (scroll)   │ │
 *   └────────────────────────┴──┴─────────────┘ │
 *
 * Mobile (< md):
 *   ┌──────────────────────────────────────────┐
 *   │ Menu superior (barra + botão expandir)    │
 *   │ (itens de navegação, quando expandido)    │
 *   ├──────────────────────────────────────────┤
 *   │ Topbar                                    │
 *   ├──────────────────────────────────────────┤
 *   │ Conteúdo (scroll)                         │
 *   └──────────────────────────────────────────┘
 */
export const MainLayout = ({ idTela, tituloTela, acoesTopo, children, onNavigate }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [menuExpandido, setMenuExpandido] = useState(false);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',           // garante que NADA vaza para fora
        backgroundColor: 'background.default'
      }}
    >
      {/* Sidebar: barra fixa lateral no desktop, barra superior retrátil no mobile */}
      <Box sx={{ flexShrink: 0, width: isMobile ? '100%' : 260, height: isMobile ? 'auto' : '100vh' }}>
        <Sidebar
          telaAtual={idTela}
          onNavigate={onNavigate}
          isMobile={isMobile}
          expandido={menuExpandido}
          onToggleExpandir={() => setMenuExpandido(v => !v)}
        />
      </Box>

      {/* Coluna direita: cresce para preencher o espaço restante */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: isMobile ? '100%' : '100vh',
          minWidth: 0,                 // evita que o flex-child "empurre" para fora
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        <Topbar titulo={tituloTela}>
          {acoesTopo}
        </Topbar>

        {/* Área de conteúdo: cresce, rola verticalmente */}
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: { xs: 1.5, sm: 2, md: 3 },
            // Scrollbar discreta no estilo do protótipo
            '&::-webkit-scrollbar':       { width: 6 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: 'divider', borderRadius: 3 },
            '&::-webkit-scrollbar-thumb:hover': { background: 'text.secondary' }
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};
