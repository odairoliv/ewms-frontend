import { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, CircularProgress, IconButton } from '@mui/material';
import { LockOutlined, EmailOutlined, LightModeOutlined, DarkModeOutlined } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeModeContext';

export const LoginPage = ({ onNavigate }) => {
  const { login } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const escuro = mode === 'dark';
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await login(email, senha);
      onNavigate('dashboard');
    } catch (err) {
      setErro(err.message || 'Erro ao contactar o servidor de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {/* Alternância de tema claro/escuro */}
      <IconButton
        onClick={toggleMode}
        title={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        sx={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          color: 'text.secondary', backgroundColor: 'background.paper',
          border: '1px solid', borderColor: 'divider',
          '&:hover': { backgroundColor: 'action.hover' }
        }}
      >
        {escuro ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
      </IconButton>

      {/* ── Painel esquerdo ── */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: '50%',
          flexShrink: 0,
          background: 'radial-gradient(ellipse at 40% 60%, #1c2e6b 0%, #0a1128 100%)',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: 8,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Detalhe decorativo de pontos */}
        <Box sx={{ position: 'absolute', top: 32, left: 32, display: 'grid',
                   gridTemplateColumns: 'repeat(6, 8px)', gap: 1.5 }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <Box key={i} sx={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: '#1e3a6b' }} />
          ))}
        </Box>

        <Box sx={{ maxWidth: 440, position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <img src="/logo/Branco_Horizontal.png" alt="EWMS" style={{ height: 48 }} />
          </Box>

          <Typography variant="h5" fontWeight={700} gutterBottom sx={{ lineHeight: 1.3, color: '#ffffff' }}>
            External Workforce<br />Management System
          </Typography>

          <Typography variant="body2" sx={{ mt: 1.5, mb: 4, lineHeight: 1.8, color: 'rgba(255,255,255,0.75)' }}>
            Plataforma corporativa para padronização, transparência e controle operacional da mão de obra terceirizada.
          </Typography>

          {/* Destaques */}
          {[
            'Controle de horas',
            'Aprovações e fluxos',
            'Relatórios e indicadores'
          ].map(item => (
            <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
              <Typography variant="body2" fontWeight={500} sx={{ color: 'rgba(255,255,255,0.85)' }}>{item}</Typography>
            </Box>
          ))}

          <Box sx={{ mt: 4, borderLeft: '3px solid #1d4ed8', pl: 2, py: 0.5 }}>
            <Typography variant="caption" lineHeight={1.7} sx={{ color: 'rgba(255,255,255,0.65)' }}>
              Acesso seguro por perfil: Administrador, Liderança, Fornecedor e Terceiro.
              Conformidade estrita com a LGPD.
            </Typography>
          </Box>
        </Box>

        {/* Rodapé esquerdo */}
        <Typography variant="caption" sx={{ position: 'absolute', bottom: 24, left: 32, color: 'rgba(255,255,255,0.4)' }}>
          © 2026 – Sistema de Gestão de Horas de Terceiros
        </Typography>
      </Box>

      {/* ── Painel direito ── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'background.default',
          p: { xs: 3, md: 6 },
          overflowY: 'auto'
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Typography variant="h4" fontWeight={800} sx={{ color: "text.primary" }} gutterBottom>
            Bem-vindo de volta
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", marginBottom: '15px' }}>
            Acesse a plataforma com seu e-mail corporativo.
          </Typography>

          {erro && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{erro}</Alert>}

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2}}>
              <TextField
                required fullWidth label="E-mail" autoComplete="email" autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                InputProps={{ startAdornment: <EmailOutlined sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} /> }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                required fullWidth label="Senha" type="password"
                value={senha} onChange={e => setSenha(e.target.value)}
                InputProps={{ startAdornment: <LockOutlined sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} /> }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Box>

            <Button
              type="submit" fullWidth variant="contained" disabled={loading}
              sx={{
                mt: 3, mb: 2, py: 1.5, borderRadius: 2,
                backgroundColor: '#1d4ed8',
                '&:hover': { backgroundColor: '#1e40af' },
                fontWeight: 700, textTransform: 'none', fontSize: 15,
                boxShadow: '0 4px 14px rgba(29,78,216,.3)'
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Entrar'}
            </Button>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button variant="text" size="small" sx={{ textTransform: 'none', color: 'text.secondary', fontSize: 12 }}>
                Esqueci minha senha
              </Button>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Acesso seguro via JWT</Typography>
            </Box>
          </form>
        </Box>
      </Box>
    </Box>
  );
};
