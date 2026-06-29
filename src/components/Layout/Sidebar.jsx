import { useState, useEffect } from 'react';
import { Box, Typography, Button, IconButton, Collapse, Dialog, DialogTitle, DialogContent,
  DialogActions, Autocomplete, TextField, CircularProgress, Tooltip } from '@mui/material';
import { LogoutOutlined, SecurityOutlined, DashboardOutlined,
  UploadFileOutlined, PeopleOutlined, ManageSearchOutlined, AssignmentOutlined,
  MenuOutlined, CloseOutlined, LightModeOutlined, DarkModeOutlined,
  VpnKeyOutlined, KeyboardReturnOutlined, TuneOutlined } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeModeContext';
import { apiGetUsuarios } from '../../services/api';

const ICONES = {
  dashboard: <DashboardOutlined sx={{ fontSize: 18 }} />,
  upload:    <UploadFileOutlined sx={{ fontSize: 18 }} />,
  cadastros: <PeopleOutlined sx={{ fontSize: 18 }} />,
  fechamento:<AssignmentOutlined sx={{ fontSize: 18 }} />,
  auditoria: <ManageSearchOutlined sx={{ fontSize: 18 }} />,
  configForm: <TuneOutlined sx={{ fontSize: 18 }} />
};

// Regras RBAC exatas conforme especificação:
// - Upload: só Administrador
// - Cadastros: Administrador, Liderança, Usuário (Usuário vê apenas aba de editar perfil)
// - Fechamento: Administrador, Liderança, Fornecedor, Usuário
// - Auditoria: só Administrador
const MENU = [
  { id: 'dashboard', rotulo: 'Dashboard',           visivelPara: ['SuperUsuario','Administrador','Liderança','Fornecedor','Usuário'] },
  { id: 'upload',    rotulo: 'Upload de Excel',      visivelPara: ['SuperUsuario','Administrador'] },
  { id: 'fechamento',rotulo: 'Dados de Fechamento',  visivelPara: ['SuperUsuario','Administrador','Liderança','Fornecedor'] },
  { id: 'cadastros', rotulo: 'Central de Cadastros', visivelPara: ['SuperUsuario','Administrador','Liderança','Usuário'] },
  { id: 'auditoria', rotulo: 'Logs de Auditoria',    visivelPara: ['SuperUsuario','Administrador'] },
  { id: 'configForm', rotulo: 'Config. de Formulários', visivelPara: ['SuperUsuario'] }
];

// Botão de alternância de tema, usado tanto no painel mobile quanto na sidebar fixa
const ThemeToggleButton = ({ fullWidth }) => {
  const { mode, toggleMode } = useThemeMode();
  const escuro = mode === 'dark';
  return (
    <Button
      fullWidth={fullWidth} onClick={toggleMode}
      startIcon={escuro ? <LightModeOutlined sx={{ fontSize: 16 }} /> : <DarkModeOutlined sx={{ fontSize: 16 }} />}
      sx={{ justifyContent: 'flex-start', px: 2, py: 1, borderRadius: 1.5, textTransform: 'none',
            fontSize: 12, fontWeight: 600, color: '#94a3b8', backgroundColor: 'transparent',
            '&:hover': { backgroundColor: '#1e293b', color: '#e2e8f0' },
            '& .MuiButton-startIcon': { mr: 1 } }}>
      {escuro ? 'Tema claro' : 'Tema escuro'}
    </Button>
  );
};

// Dialog de seleção de usuário para o SuperUsuario "entrar como" (proxy/impersonação)
const ImpersonarDialog = ({ open, onClose, onConfirmar }) => {
  const { token } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const [entrando, setEntrando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try { const res = await apiGetUsuarios(token); setUsuarios(res.data); }
    catch (e) { console.error(e); }
    finally { setCarregando(false); }
  };

  useEffect(() => {
    if (open) { setSelecionado(null); carregar(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const confirmar = async () => {
    if (!selecionado) return;
    setEntrando(true);
    try { await onConfirmar(selecionado.id); }
    finally { setEntrando(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
      <DialogTitle sx={{ display:'flex', alignItems:'center', gap:1, fontWeight:700 }}>
        <VpnKeyOutlined sx={{ color:'#1d4ed8' }} />
        Acessar como outro usuário
      </DialogTitle>
      <DialogContent sx={{ pt:'16px !important' }}>
        <Typography variant="body2" sx={{ color:'text.secondary', mb:2 }}>
          Selecione um usuário para visualizar o sistema exatamente como ele veria.
          Essa ação é registrada nos logs de auditoria.
        </Typography>
        <Autocomplete
          size="small"
          loading={carregando}
          options={usuarios}
          getOptionLabel={(u)=>u.nome?`${u.nome} (${u.email}) — ${u.perfil}`:''}
          isOptionEqualToValue={(o,v)=>o.id===v.id}
          value={selecionado}
          onChange={(_,v)=>setSelecionado(v)}
          renderInput={(params)=><TextField {...params} label="Usuário" placeholder="Pesquise por nome ou e-mail"
            InputProps={{ ...params.InputProps, endAdornment: <>{carregando ? <CircularProgress size={16} /> : null}{params.InputProps?.endAdornment}</> }} />}
        />
      </DialogContent>
      <DialogActions sx={{ px:3, pb:2, gap:1 }}>
        <Button onClick={onClose} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
        <Button onClick={confirmar} disabled={!selecionado||entrando} variant="contained"
          sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, px:3, '&:hover':{ backgroundColor:'#1e40af' } }}>
          {entrando ? <CircularProgress size={18} color="inherit" /> : 'Acessar como este usuário'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Card com nome/perfil do usuário logado, botão de logout e (para SuperUsuario) o proxy/impersonação
const CardUsuario = ({ onNavigate }) => {
  const { usuario, logout, impersonando, superUsuario, impersonar, voltarSuperUsuario } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const handleLogout = () => { logout(); onNavigate('login'); };

  const confirmarImpersonar = async (usuarioId) => {
    await impersonar(usuarioId);
    setDialogOpen(false);
    onNavigate('dashboard');
  };

  return (
    <Box sx={{ backgroundColor: '#182235', borderRadius: 2, border: '1px solid #27354f', p: 2 }}>
      {impersonando && (
        <Box sx={{ display:'flex', alignItems:'center', gap:0.5, mb:1, px:1, py:0.5, borderRadius:1,
                   backgroundColor:'#3b1d1d', border:'1px solid #7f1d1d' }}>
          <Typography variant="caption" sx={{ color:'#fca5a5', fontWeight:600, fontSize:10.5 }}>
            Visualizando como outro usuário · {superUsuario?.nome}
          </Typography>
        </Box>
      )}
      <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ mb: 0.4, color: '#f8fafc' }}>
        {usuario?.nome}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
        <SecurityOutlined sx={{ fontSize: 12, color: '#38bdf8' }} />
        <Typography variant="caption" sx={{ color: '#38bdf8', fontWeight: 600, fontSize: 11 }}>
          {usuario?.perfil}
        </Typography>
        {usuario?.perfil === 'SuperUsuario' && !impersonando && (
          <Tooltip title="Acessar como outro usuário">
            <IconButton size="small" onClick={()=>setDialogOpen(true)} sx={{ color:'#38bdf8', ml:'auto', p:0.4 }}>
              <VpnKeyOutlined sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {impersonando && (
        <Button fullWidth variant="contained" size="small" startIcon={<KeyboardReturnOutlined sx={{ fontSize: 15 }} />}
          onClick={() => { voltarSuperUsuario(); onNavigate('dashboard'); }}
          sx={{ backgroundColor: '#1d4ed8', color: '#fff', boxShadow: 0, textTransform: 'none',
                fontSize: 12, borderRadius: 1.5, mb: 1, '&:hover': { backgroundColor: '#1e40af' } }}>
          Voltar para Super Usuário
        </Button>
      )}

      <Button fullWidth variant="contained" size="small" startIcon={<LogoutOutlined sx={{ fontSize: 15 }} />}
        onClick={handleLogout}
        sx={{ backgroundColor: '#273549', color: '#94a3b8', boxShadow: 0, textTransform: 'none',
              fontSize: 12, borderRadius: 1.5, '&:hover': { backgroundColor: '#ef4444', color: '#fff' } }}>
        Encerrar sessão
      </Button>

      <ImpersonarDialog open={dialogOpen} onClose={()=>setDialogOpen(false)} onConfirmar={confirmarImpersonar} />
    </Box>
  );
};

export const Sidebar = ({ telaAtual, onNavigate, isMobile, expandido, onToggleExpandir }) => {
  const { usuario } = useAuth();

  const itensVisiveis = MENU.filter(item => item.visivelPara.includes(usuario?.perfil));

  const handleNavegar = (id) => {
    onNavigate(id);
    if (isMobile) onToggleExpandir();
  };

  if (isMobile) {
    return (
      <Box sx={{ backgroundColor: '#0f172a', color: '#fff', borderBottom: '1px solid #1e293b' }}>
        {/* Barra superior compacta */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logo/Branco_Horizontal.png" alt="EWMS" style={{ height: 26 }} />
          </Box>
          <IconButton onClick={onToggleExpandir} size="small" sx={{ color: '#94a3b8' }}
            aria-label={expandido ? 'Recolher menu' : 'Expandir menu'}>
            {expandido ? <CloseOutlined /> : <MenuOutlined />}
          </IconButton>
        </Box>

        {/* Menu expansível */}
        <Collapse in={expandido}>
          <Box sx={{ px: 1.5, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {itensVisiveis.map(item => {
              const ativo = telaAtual === item.id;
              return (
                <Button key={item.id} fullWidth startIcon={ICONES[item.id]} onClick={() => handleNavegar(item.id)}
                  sx={{ justifyContent: 'flex-start', px: 2, py: 1.2, borderRadius: 2, textTransform: 'none',
                        fontSize: 13, fontWeight: ativo ? 700 : 500,
                        backgroundColor: ativo ? '#1e3a5f' : 'transparent',
                        color: ativo ? '#38bdf8' : '#94a3b8',
                        borderLeft: ativo ? '3px solid #38bdf8' : '3px solid transparent',
                        '&:hover': { backgroundColor: '#1e293b', color: '#e2e8f0' },
                        '& .MuiButton-startIcon': { mr: 1.5 } }}>
                  {item.rotulo}
                </Button>
              );
            })}

            <ThemeToggleButton fullWidth />

            <Box sx={{ mt: 1 }}>
              <CardUsuario onNavigate={onNavigate} />
            </Box>
          </Box>
        </Collapse>
      </Box>
    );
  }

  return (
    <Box sx={{ width: 260, height: '100vh', backgroundColor: '#0f172a', color: '#fff',
               display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e293b',
               overflow: 'hidden', flexShrink: 0 }}>

      {/* Logo */}
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <img src="/logo/Branco_Horizontal.png" alt="EWMS" style={{ height: 34 }} />
        </Box>
        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 500, letterSpacing: '0.04em' }}>
          Governança de Terceiros
        </Typography>
      </Box>

      <Box sx={{ mx: 3, mb: 2, height: '1px', backgroundColor: '#1e293b' }} />

      {/* Nav */}
      <Box sx={{ flex: 1, px: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, overflowY: 'auto' }}>
        {itensVisiveis.map(item => {
          const ativo = telaAtual === item.id;
          return (
            <Button key={item.id} fullWidth startIcon={ICONES[item.id]} onClick={() => onNavigate(item.id)}
              sx={{ justifyContent: 'flex-start', px: 2, py: 1.2, borderRadius: 2, textTransform: 'none',
                    fontSize: 13, fontWeight: ativo ? 700 : 500,
                    backgroundColor: ativo ? '#1e3a5f' : 'transparent',
                    color: ativo ? '#38bdf8' : '#94a3b8',
                    borderLeft: ativo ? '3px solid #38bdf8' : '3px solid transparent',
                    transition: 'all .15s',
                    '&:hover': { backgroundColor: '#1e293b', color: '#e2e8f0' },
                    '& .MuiButton-startIcon': { mr: 1.5 } }}>
              {item.rotulo}
            </Button>
          );
        })}
      </Box>

      {/* Card usuário */}
      <Box sx={{ p: 1.5, pt: 0 }}>
        <Box sx={{ mb: 0.5 }}>
          <ThemeToggleButton fullWidth />
        </Box>
        <CardUsuario onNavigate={onNavigate} />
      </Box>
    </Box>
  );
};
