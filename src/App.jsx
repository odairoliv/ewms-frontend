import { useState, Suspense, lazy } from 'react';
import { CircularProgress, Box } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeModeProvider } from './contexts/ThemeModeContext';
import { LoginPage } from './views/Login/LoginPage';

// Altere o bloco de imports lazy para capturar o componente de dentro do módulo:
const DashboardPage  = lazy(() => import('./views/Dashboard/DashboardPage').then(module => ({ default: module.DashboardPage })));
const UploadPage     = lazy(() => import('./views/Upload/UploadPage').then(module => ({ default: module.UploadPage })));
const CadastrosPage  = lazy(() => import('./views/Cadastros/CadastrosPage').then(module => ({ default: module.CadastrosPage })));
const FechamentoPage = lazy(() => import('./views/Fechamento/FechamentoPage').then(module => ({ default: module.FechamentoPage })));
const AuditoriaPage  = lazy(() => import('./views/Auditoria/AuditoriaPage').then(module => ({ default: module.AuditoriaPage })));
const ConfiguracaoFormulariosPage = lazy(() => import('./views/Configuracao/ConfiguracaoFormulariosPage').then(module => ({ default: module.ConfiguracaoFormulariosPage })));

// 2. Mapeamento centralizado de permissões (Deve bater exatamente com o seu Sidebar.jsx)
const REGRAS_ACESSO = {
  dashboard:  ['SuperUsuario', 'Administrador', 'Liderança', 'Fornecedor', 'Usuário'],
  upload:     ['SuperUsuario', 'Administrador'],
  fechamento: ['SuperUsuario', 'Administrador', 'Liderança', 'Fornecedor'],
  cadastros:  ['SuperUsuario', 'Administrador', 'Liderança', 'Usuário'],
  auditoria:  ['SuperUsuario', 'Administrador'],
  configForm: ['SuperUsuario']
};

const TELAS = {
  dashboard:  DashboardPage,
  upload:     UploadPage,
  cadastros:  CadastrosPage,
  fechamento: FechamentoPage,
  auditoria:  AuditoriaPage,
  configForm: ConfiguracaoFormulariosPage
};

const MainNavigator = () => {
  const { isAuthenticated, usuario } = useAuth();
  const [tela, setTela] = useState('login');

  // Se não estiver logado, força a tela de login
  if (!isAuthenticated || tela === 'login') {
    return <LoginPage onNavigate={setTela} />;
  }

  // 3. Validação de Segurança de Rota/Tela (RBAC)
  const perfisPermitidos = REGRAS_ACESSO[tela];
  const temPermissao = perfisPermitidos?.includes(usuario?.perfil);

  // Se a tela não existir ou o usuário tentar forçar a barra via console/estado:
  if (!TELAS[tela] || !temPermissao) {
    // Redireciona de volta para o Dashboard padrão seguro
    return <DashboardPage key={usuario?.id} onNavigate={setTela} />;
  }

  const Comp = TELAS[tela];

  return (
    // 4. O Suspense exibe o loading enquanto o arquivo da view específica é baixado sob demanda
    <Suspense 
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a' }}>
          <CircularProgress sx={{ color: '#38bdf8' }} />
        </Box>
      }
    >
      {/* A key força a remontagem completa da tela quando a identidade muda
          (login normal, impersonação pelo SuperUsuario, ou retorno dela) */}
      <Comp key={usuario?.id} onNavigate={setTela} />
    </Suspense>
  );
};

export const App = () => (
  <ThemeModeProvider>
    <AuthProvider>
      <MainNavigator />
    </AuthProvider>
  </ThemeModeProvider>
);

export default App;