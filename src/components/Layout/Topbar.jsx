import { AppBar, Toolbar, Typography, Box, IconButton, Badge } from '@mui/material';
import { NotificationsOutlined, HelpOutlineOutlined } from '@mui/icons-material';

export const Topbar = ({ titulo, children }) => {
    return (
        <AppBar position="static" color="transparent" elevation={0}
            sx={{ borderBottom: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
            <Toolbar sx={{
                justifyContent: 'space-between', flexWrap: 'wrap',
                py: { xs: 1, md: 1 }, px: { xs: 2, sm: 3, md: 4 }, gap: 1.5,
                minHeight: { xs: 'auto', md: 56 }
            }}>
                <Typography variant="h4" fontWeight="800"
                    sx={{ color: 'text.primary', letterSpacing: '-0.5px', fontSize: { xs: 12, sm: 14, md: 18 } }}>
                    {titulo}
                </Typography>

                {/* Lado Direito: Área para Filtros específicos da tela + Ícones Globais */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 3 }, flexWrap: 'wrap' }}>
                    {/* Se a tela injetar filtros (como os seletores de período da Dashboard), eles renderizam aqui */}
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {children}
                    </Box>

                    {/* Botões de Ação e Suporte presentes em todas as telas corporativas do documento */}
                    <Box sx={{ display: 'flex', gap: 1, borderLeft: { xs: 'none', sm: '1px solid' }, borderColor: { sm: 'divider' }, pl: { xs: 0, sm: 2 } }}>
                        <IconButton color="inherit" title="Notificações e Alertas de Fechamento">
                            <Badge color="error" variant="dot">
                                <NotificationsOutlined sx={{ color: 'text.secondary' }} />
                            </Badge>
                        </IconButton>
                        <IconButton color="inherit" title="Central de Ajuda e Documentação Técnica">
                            <HelpOutlineOutlined sx={{ color: 'text.secondary' }} />
                        </IconButton>
                    </Box>
                </Box>
            </Toolbar>
        </AppBar>
    );
};