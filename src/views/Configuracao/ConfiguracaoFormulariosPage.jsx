import { useEffect, useMemo, useState } from 'react';
import {
  Paper, Typography, Box, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Switch,
  CircularProgress, Alert, Tooltip, IconButton, Autocomplete
} from '@mui/material';
import { SettingsOutlined, RestartAltOutlined, SaveOutlined } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { apiGetEmpresas, apiGetCustomFields, apiUpsertCustomField, apiResetCustomField } from '../../services/api';
import { MainLayout } from '../../components/Layout/MainLayout';

// Campo padrão simples: nome técnico igual ao rótulo inicial, visível por padrão, não é "extra"
const p = (nome_coluna) => ({ nome_coluna, defaultVisivel: true, extra: false });
// Campo "extra": dado denormalizado de outra tabela (ex.: nome da liderança via consultor) —
// existe na resposta da API mas só aparece na tabela/formulário se o SuperUsuario ativar.
const x = (nome_coluna) => ({ nome_coluna, defaultVisivel: false, extra: true });

// ── Catálogo de objetos (formulários/tabelas) configuráveis e seus campos padrão ────────────
const OBJETOS = [
  { id: 'empresa', label: 'Empresa', camposPadrao: [p('nome'), p('cnpj'), p('telefone'), p('email_contato'), p('endereco')] },
  { id: 'fornecedor', label: 'Fornecedor', camposPadrao: [p('razao_social'), p('nome_fantasia'), p('cnpj'), p('segmento'), p('cidade'), p('uf'), p('contato'), p('telefone'), p('email')] },
  { id: 'consultor', label: 'Consultor / Terceiro', camposPadrao: [p('cargo'), p('departamento'), p('valor_hora'), p('horas_previstas_semana'), p('lideranca_id'), p('data_inicio'), p('data_fim')] },
  {
    id: 'apontamento', label: 'Apontamento (Fechamento)',
    camposPadrao: [
      p('nome_consultor'), p('fornecedor'), p('periodo'), p('semana'),
      p('horas_trabalhadas'), p('valor_hora'), p('valor_total'), p('status'),
      x('lideranca'), x('nome_projeto'),
    ],
  },
  { id: 'usuario', label: 'Usuário', camposPadrao: [p('nome'), p('cpf'), p('telefone'), p('departamento'), p('cargo')] },
];

// As 4 colunas customizáveis têm tipo fixo no banco — só o nome de exibição é livre
const CAMPOS_CUSTOM = [
  { nome_coluna: 'custom01', tipoFixo: 'date', tipoLabel: 'Data' },
  { nome_coluna: 'custom02', tipoFixo: 'texto', tipoLabel: 'Texto' },
  { nome_coluna: 'custom03', tipoFixo: 'texto', tipoLabel: 'Texto' },
  { nome_coluna: 'custom04', tipoFixo: 'float', tipoLabel: 'Número' },
];

const TIPO_LABEL = { padrao: 'Padrão', date: 'Data', texto: 'Texto', float: 'Número' };

export const ConfiguracaoFormulariosPage = ({ onNavigate }) => {
  const { token } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [empresaSel, setEmpresaSel] = useState(null);
  const [objeto, setObjeto] = useState('fornecedor');
  const [configs, setConfigs] = useState([]); // linhas vindas do backend (overrides existentes)
  const [carregando, setCarregando] = useState(true);
  const [salvandoChave, setSalvandoChave] = useState(null); // nome_coluna em salvamento
  const [alerta, setAlerta] = useState(null);

  const objetoAtual = OBJETOS.find(o => o.id === objeto);

  const carregarEmpresas = async () => {
    try { const res = await apiGetEmpresas(token); setEmpresas(res.data); if (res.data.length) setEmpresaSel(res.data[0]); }
    catch (e) { console.error(e); }
  };
  useEffect(() => { carregarEmpresas(); }, []);

  const carregarConfigs = async () => {
    if (!empresaSel) return;
    setCarregando(true);
    try {
      const res = await apiGetCustomFields(token, empresaSel.id, objeto);
      setConfigs(res.data);
    } catch (e) { console.error(e); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregarConfigs(); }, [empresaSel, objeto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mescla campos padrão + custom com as configurações salvas (ou valores-padrão quando não há override)
  const linhas = useMemo(() => {
    const padrao = (objetoAtual?.camposPadrao || []).map((campo, i) => {
      const cfg = configs.find(c => c.nome_coluna === campo.nome_coluna);
      if (cfg) return { ...cfg, extra: campo.extra };
      return {
        nome_coluna: campo.nome_coluna, nome: campo.nome_coluna, tipo: 'padrao',
        visivel: campo.defaultVisivel, obrigatorio: false, ordem: i, id: null, extra: campo.extra,
      };
    });
    const custom = CAMPOS_CUSTOM.map((c, i) => {
      const cfg = configs.find(cf => cf.nome_coluna === c.nome_coluna);
      return cfg || { nome_coluna: c.nome_coluna, nome: `Campo customizado ${i + 1}`, tipo: c.tipoFixo, visivel: false, obrigatorio: false, ordem: 100 + i, id: null };
    });
    return [...padrao, ...custom];
  }, [configs, objetoAtual]);

  const [rascunho, setRascunho] = useState({});
  useEffect(() => {
    const r = {};
    linhas.forEach(l => { r[l.nome_coluna] = { nome: l.nome, visivel: l.visivel, obrigatorio: l.obrigatorio }; });
    setRascunho(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs, objeto, empresaSel]);

  const alterarRascunho = (nomeColuna, campo, valor) => {
    setRascunho(r => ({ ...r, [nomeColuna]: { ...r[nomeColuna], [campo]: valor } }));
  };

  const salvarLinha = async (linha) => {
    setSalvandoChave(linha.nome_coluna);
    const draft = rascunho[linha.nome_coluna];
    try {
      await apiUpsertCustomField(token, {
        empresa_id: empresaSel.id,
        id_objeto: objeto,
        nome_coluna: linha.nome_coluna,
        nome: draft.nome,
        tipo: linha.tipo,
        visivel: draft.visivel,
        obrigatorio: draft.obrigatorio,
        ordem: linha.ordem,
      });
      setAlerta({ tipo: 'success', msg: `Campo "${draft.nome}" salvo para ${empresaSel.nome}.` });
      await carregarConfigs();
    } catch { setAlerta({ tipo: 'error', msg: 'Erro ao salvar configuração.' }); }
    finally { setSalvandoChave(null); }
  };

  const resetarLinha = async (linha) => {
    if (!linha.id) return; // já está no padrão
    setSalvandoChave(linha.nome_coluna);
    try {
      await apiResetCustomField(token, linha.id);
      setAlerta({ tipo: 'success', msg: 'Configuração revertida ao padrão global.' });
      await carregarConfigs();
    } catch { setAlerta({ tipo: 'error', msg: 'Erro ao resetar.' }); }
    finally { setSalvandoChave(null); }
  };

  return (
    <MainLayout idTela="configForm" tituloTela="CONFIGURAÇÃO DE FORMULÁRIOS" onNavigate={onNavigate}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Defina, por empresa, o nome exibido de cada campo (padrão ou customizável), se ele aparece nos
          formulários/tabelas e se é obrigatório. Sem configuração, o sistema usa o padrão global.
        </Typography>

        {alerta && <Alert severity={alerta.tipo} onClose={() => setAlerta(null)} sx={{ borderRadius: 2 }}>{alerta.msg}</Alert>}

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Autocomplete
            size="small"
            sx={{ width: { xs: '100%', sm: 280 } }}
            options={empresas}
            getOptionLabel={(e) => e.nome || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            value={empresaSel}
            onChange={(_, v) => setEmpresaSel(v)}
            renderInput={(params) => <TextField {...params} label="Empresa" />}
          />
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 240 } }}>
            <InputLabel sx={{ fontSize: 13 }}>Formulário / Tabela</InputLabel>
            <Select value={objeto} label="Formulário / Tabela" onChange={e => setObjeto(e.target.value)}
              sx={{ borderRadius: 1.5, fontSize: 13 }}>
              {OBJETOS.map(o => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Paper sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
          {carregando ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={28} /></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ backgroundColor: 'action.hover' }}>
                  <TableRow>
                    {['Campo (técnico)', 'Tipo', 'Nome exibido', 'Visível', 'Obrigatório', ''].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary', border: 0 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linhas.map((l, i) => {
                    const draft = rascunho[l.nome_coluna] || { nome: l.nome, visivel: l.visivel, obrigatorio: l.obrigatorio };
                    const isCustom = l.nome_coluna.startsWith('custom');
                    return (
                      <TableRow key={l.nome_coluna} sx={{ backgroundColor: i % 2 ? 'action.hover' : 'background.paper' }}>
                        <TableCell sx={{ fontSize: 12, color: 'text.secondary', border: 0, fontFamily: 'monospace' }}>
                          {l.nome_coluna}
                          {isCustom && <Box component="span" sx={{ ml: 0.5, color: '#7c3aed', fontWeight: 700 }}>★</Box>}
                          {l.extra && <Box component="span" sx={{ ml: 0.5, color: '#0891b2', fontWeight: 700 }}>◆</Box>}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: 'text.primary', border: 0 }}>{TIPO_LABEL[l.tipo] || l.tipo}</TableCell>
                        <TableCell sx={{ border: 0, minWidth: 200 }}>
                          <TextField size="small" fullWidth value={draft.nome}
                            onChange={e => alterarRascunho(l.nome_coluna, 'nome', e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }} />
                        </TableCell>
                        <TableCell sx={{ border: 0 }}>
                          <Switch size="small" checked={draft.visivel}
                            onChange={e => alterarRascunho(l.nome_coluna, 'visivel', e.target.checked)} />
                        </TableCell>
                        <TableCell sx={{ border: 0 }}>
                          <Switch size="small" checked={draft.obrigatorio}
                            onChange={e => alterarRascunho(l.nome_coluna, 'obrigatorio', e.target.checked)} />
                        </TableCell>
                        <TableCell sx={{ border: 0 }}>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Salvar para esta empresa">
                              <IconButton size="small" onClick={() => salvarLinha(l)} disabled={salvandoChave === l.nome_coluna}
                                sx={{ color: '#1d4ed8' }}>
                                {salvandoChave === l.nome_coluna ? <CircularProgress size={16} /> : <SaveOutlined sx={{ fontSize: 16 }} />}
                              </IconButton>
                            </Tooltip>
                            {l.id && (
                              <Tooltip title="Resetar para o padrão global">
                                <IconButton size="small" onClick={() => resetarLinha(l)} sx={{ color: 'text.secondary' }}>
                                  <RestartAltOutlined sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <SettingsOutlined sx={{ fontSize: 14 }} /> ★ = campo customizável (Custom01-04). ◆ = dado adicional vindo de outra tabela (ex.: nome da liderança), oculto por padrão. Campos sem configuração salva usam o padrão global do sistema.
        </Typography>
      </Box>
    </MainLayout>
  );
};
