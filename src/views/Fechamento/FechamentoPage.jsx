import { useEffect, useState } from 'react';
import {
  Paper, Typography, Box, Button, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, Alert
} from '@mui/material';
import { FileDownloadOutlined, CheckCircleOutlined, CancelOutlined,
         PaidOutlined, ScheduleOutlined, PendingActionsOutlined, EditOutlined, DeleteOutlined } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { apiGetApontamentos, apiUpdateApontamento, apiEditarHorasApontamento, apiAprovarHorasApontamento, apiDeleteApontamento } from '../../services/api';
import { MainLayout } from '../../components/Layout/MainLayout';
import { useColunasTabela } from '../../hooks/useColunasTabela';
import * as XLSX from 'xlsx';

// Catálogo de colunas configuráveis pelo SuperUsuario em "Config. de Formulários" (objeto "apontamento").
// "lideranca" e "nome_projeto" são dados adicionais (vindos de outras tabelas) — ocultos por padrão.
const CAMPOS_PADRAO_FECHAMENTO = [
  { nome_coluna:'nome_consultor', nome:'Nome do Consultor', defaultVisivel:true },
  { nome_coluna:'fornecedor',     nome:'Fornecedor',        defaultVisivel:true },
  { nome_coluna:'periodo',        nome:'Período',           defaultVisivel:true },
  { nome_coluna:'semana',         nome:'Semana',            defaultVisivel:true },
  { nome_coluna:'horas_trabalhadas', nome:'Horas Trab.',    defaultVisivel:true },
  { nome_coluna:'valor_hora',     nome:'Valor/Hora',        defaultVisivel:true },
  { nome_coluna:'valor_total',    nome:'Total (R$)',        defaultVisivel:true },
  { nome_coluna:'status',         nome:'Status',            defaultVisivel:true },
  { nome_coluna:'lideranca',      nome:'Liderança',         defaultVisivel:false },
  { nome_coluna:'nome_projeto',   nome:'Projeto',           defaultVisivel:false },
];

// ── helpers ──────────────────────────────────────────────────────────────────
const moeda = (v) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(v);

const StatusChip = ({ status }) => {
  const map = {
    'Em Análise': { bg:'#fef9c3', color:'#854d0e' },
    'Aprovado':   { bg:'#dcfce7', color:'#166534' },
    'Recusado':   { bg:'#fee2e2', color:'#991b1b' }
  };
  const s = map[status] || map['Em Análise'];
  return (
    <Box sx={{ display:'inline-flex', alignItems:'center', gap:0.5, px:1.5, py:0.4,
               borderRadius:99, fontSize:11, fontWeight:700, backgroundColor:s.bg, color:s.color }}>
      <Box sx={{ width:6, height:6, borderRadius:'50%', backgroundColor:'currentColor' }} />
      {status}
    </Box>
  );
};

// Card de KPI com ícone em círculo preenchido; o valor herda a cor do ícone
const KpiCard = ({ label, valor, cor = '#1d4ed8', icone }) => (
  <Paper sx={{ p:1.75, borderRadius:2.5, border:'1px solid', borderColor:'divider', flex:1,
               display:'flex', alignItems:'center', gap:1.5, minWidth:0 }}>
    <Box sx={{ width:40, height:40, borderRadius:'50%', backgroundColor:`${cor}1f`,
               display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <Box sx={{ color:cor, display:'flex' }}>{icone}</Box>
    </Box>
    <Box sx={{ minWidth:0 }}>
      <Typography variant="caption" sx={{ color:'text.secondary', fontWeight:500, display:'block', lineHeight:1.3, whiteSpace:'nowrap' }}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} sx={{ color:cor }}>{valor}</Typography>
    </Box>
  </Paper>
);

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const periodoParaData = (periodo) => {
  const [mes, ano] = (periodo||'').split('/');
  return new Date(parseInt(ano)||0, MESES_PT.indexOf(mes), 1);
};

// ── componente principal ─────────────────────────────────────────────────────
export const FechamentoPage = ({ onNavigate }) => {
  const { token, usuario } = useAuth();
  const colunas = useColunasTabela('apontamento', CAMPOS_PADRAO_FECHAMENTO);
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState('');
  const [opcoesPeriodo, setOpcoesPeriodo] = useState([]);
  const [alerta, setAlerta] = useState(null);

  // Modal de ação (aprovar/recusar)
  const [modalAcao, setModalAcao] = useState({ open:false, apontamento:null, acao:null });
  const [justificativa, setJustificativa] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  // Modal de confirmação dupla
  const [modalConfirm, setModalConfirm] = useState({ open:false });

  // Modal de edição de horas (Administrador/Liderança)
  const [modalHoras, setModalHoras] = useState({ open:false, apontamento:null });
  const [novasHoras, setNovasHoras] = useState('');
  const [justHoras, setJustHoras] = useState('');
  const [salvandoHoras, setSalvandoHoras] = useState(false);

  // Modal de aprovação de edição de horas (Administrador/SuperUsuario)
  const [modalAprovHoras, setModalAprovHoras] = useState({ open:false, apontamento:null, acao:null });
  const [justAprovHoras, setJustAprovHoras] = useState('');
  const [aprovandoHoras, setAprovandoHoras] = useState(false);

  // Modal de exclusão (soft delete) de apontamento
  const [modalExc, setModalExc] = useState({ open:false, apontamento:null });
  const [excluindo, setExcluindo] = useState(false);

  const carregar = async (p) => {
    setCarregando(true);
    try {
      const res = await apiGetApontamentos(token, usuario.perfil, usuario.id_fornecedor, usuario.email, p);
      setLista(res.data);
    } catch(e){ console.error(e); }
    finally { setCarregando(false); }
  };

  // Carrega os períodos reais com dados salvos no banco e seleciona o mais recente
  useEffect(() => {
    const iniciar = async () => {
      setCarregando(true);
      try {
        const res = await apiGetApontamentos(token, usuario.perfil, usuario.id_fornecedor, usuario.email, null);
        const periodosReais = [...new Set(res.data.map(a => a.periodo))]
          .sort((a, b) => periodoParaData(b) - periodoParaData(a));
        setOpcoesPeriodo(periodosReais);
        const periodoInicial = periodosReais[0] || '';
        setPeriodo(periodoInicial);
        await carregar(periodoInicial);
      } catch(e){ console.error(e); }
      finally { setCarregando(false); }
    };
    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodo = (v) => { setPeriodo(v); carregar(v); };

  // Abre modal com ação e apontamento
  const abrirAcao = (apontamento, acao) => {
    setJustificativa('');
    setModalAcao({ open:true, apontamento, acao });
  };

  // Confirmação dupla antes de salvar
  const pedirConfirmacao = () => {
    if (!justificativa.trim()) {
      setAlerta({ tipo:'error', msg:'Preencha a justificativa antes de confirmar.' });
      return;
    }
    setModalConfirm({ open:true });
  };

  const confirmarAcao = async () => {
    setConfirmando(true);
    setModalConfirm({ open:false });
    try {
      await apiUpdateApontamento(token, modalAcao.apontamento.id, modalAcao.acao, justificativa);
      setAlerta({ tipo:'success', msg:`Apontamento ${modalAcao.acao === 'Aprovado' ? 'aprovado' : 'recusado'} com sucesso.` });
      setModalAcao({ open:false, apontamento:null, acao:null });
      await carregar(periodo);
    } catch {
      setAlerta({ tipo:'error', msg:'Erro ao processar ação. Tente novamente.' });
    } finally { setConfirmando(false); }
  };

  // Abre modal de edição de horas
  const abrirEdicaoHoras = (apontamento) => {
    setNovasHoras(String(apontamento.horas_trabalhadas));
    setJustHoras('');
    setModalHoras({ open:true, apontamento });
  };

  const salvarEdicaoHoras = async () => {
    const valor = parseFloat(novasHoras);
    if (isNaN(valor) || valor < 0) {
      setAlerta({ tipo:'error', msg:'Informe um número de horas válido.' });
      return;
    }
    setSalvandoHoras(true);
    try {
      await apiEditarHorasApontamento(token, modalHoras.apontamento.id, valor, justHoras);
      const isAdmin = ['SuperUsuario','Administrador'].includes(usuario?.perfil);
      setAlerta(isAdmin
        ? { tipo:'success', msg:'Horas atualizadas com sucesso. Como Administrador, esta edição foi aplicada automaticamente (auto-aprovação).' }
        : { tipo:'success', msg:'Edição de horas enviada! Ficará pendente até o Administrador aprovar.' });
      setModalHoras({ open:false, apontamento:null });
      await carregar(periodo);
    } catch {
      setAlerta({ tipo:'error', msg:'Erro ao salvar a edição de horas.' });
    } finally { setSalvandoHoras(false); }
  };

  // Abre modal de aprovação/recusa da edição de horas pendente
  const abrirAprovacaoHoras = (apontamento, acao) => {
    setJustAprovHoras('');
    setModalAprovHoras({ open:true, apontamento, acao });
  };

  const confirmarAprovacaoHoras = async () => {
    if (modalAprovHoras.acao === 'Recusado' && !justAprovHoras.trim()) {
      setAlerta({ tipo:'error', msg:'Justificativa é obrigatória para recusar a edição.' });
      return;
    }
    setAprovandoHoras(true);
    try {
      await apiAprovarHorasApontamento(token, modalAprovHoras.apontamento.id, modalAprovHoras.acao, justAprovHoras);
      setAlerta({ tipo:'success', msg:`Edição de horas ${modalAprovHoras.acao === 'Aprovado' ? 'aprovada' : 'recusada'}.` });
      setModalAprovHoras({ open:false, apontamento:null, acao:null });
      await carregar(periodo);
    } catch {
      setAlerta({ tipo:'error', msg:'Erro ao processar aprovação.' });
    } finally { setAprovandoHoras(false); }
  };

  const excluirApontamento = async () => {
    setExcluindo(true);
    try {
      await apiDeleteApontamento(token, modalExc.apontamento.id);
      setAlerta({ tipo:'success', msg:'Apontamento excluído.' });
      setModalExc({ open:false, apontamento:null });
      await carregar(periodo);
    } catch {
      setAlerta({ tipo:'error', msg:'Erro ao excluir apontamento.' });
    } finally { setExcluindo(false); }
  };

  // Exportar para Excel
  const exportar = () => {
    const linhas = lista.map(a => ({
      'ID':              a.id,
      'Consultor':       a.nome_consultor,
      'Fornecedor':      a.fornecedor,
      'Período':         a.periodo,
      'Semana':          a.semana,
      'Horas Trabalhadas': a.horas_trabalhadas,
      'Valor/Hora (R$)': a.valor_hora,
      'Total (R$)':      a.valor_total,
      'Status':          a.status
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fechamento');
    XLSX.writeFile(wb, `fechamento_${periodo.replace('/','_')}.xlsx`);
  };

  const totalValor   = lista.reduce((s,a) => s + a.valor_total, 0);
  const totalHoras   = lista.reduce((s,a) => s + a.horas_trabalhadas, 0);
  const emAnalise    = lista.filter(a => a.status === 'Em Análise').length;
  const aprovados    = lista.filter(a => a.status === 'Aprovado').length;

  const podeFazerAcao = ['SuperUsuario','Administrador','Liderança'].includes(usuario?.perfil);
  const podeEditarHoras = ['SuperUsuario','Administrador','Liderança'].includes(usuario?.perfil);
  const podeAprovarHoras = ['SuperUsuario','Administrador'].includes(usuario?.perfil);
  const podeExcluir = ['SuperUsuario','Administrador'].includes(usuario?.perfil);

  const cols = ['ID Consul.', ...colunas.map(c=>c.nome), 'Ações'];

  // Renderiza o valor de uma coluna configurável (padrão ou Custom01-04) para um apontamento
  const renderCelula = (a, c) => {
    if (c.nome_coluna === 'horas_trabalhadas') {
      return (
        <>
          {a.horas_trabalhadas} h
          {a.edicao_status === 'Pendente' && (
            <Typography variant="caption" sx={{ display:'block', color:'#854d0e', fontWeight:700 }}>
              Edição pendente: {a.horas_pendentes} h
            </Typography>
          )}
          {a.edicao_status === 'Recusada' && (
            <Typography variant="caption" sx={{ display:'block', color:'#991b1b', fontWeight:700 }}>
              Edição recusada
            </Typography>
          )}
        </>
      );
    }
    if (c.nome_coluna === 'valor_hora' || c.nome_coluna === 'valor_total') return moeda(a[c.nome_coluna]);
    if (c.nome_coluna === 'status') return <StatusChip status={a.status} />;
    if (c.tipo === 'float') return a[c.nome_coluna] != null ? Number(a[c.nome_coluna]).toLocaleString('pt-BR') : '—';
    return (a[c.nome_coluna] ?? '—') || '—';
  };

  return (
    <MainLayout idTela="fechamento" tituloTela="DADOS DE FECHAMENTO" onNavigate={onNavigate}>
      <Box sx={{ display:'flex', flexDirection:'column', gap:3, height:'100%', minHeight:0 }}>

        {/* Bloco fixo: descrição, KPIs e filtros não rolam com a tabela */}
        <Box sx={{ display:'flex', flexDirection:'column', gap:3, flexShrink:0 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Visualize o resumo das horas trabalhadas e os valores a serem fechados.
          </Typography>

          {alerta && (
            <Alert severity={alerta.tipo} onClose={()=>setAlerta(null)} sx={{ borderRadius:2 }}>
              {alerta.msg}
            </Alert>
          )}

          {/* KPIs */}
          <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px, 1fr))', gap:2 }}>
            <KpiCard label="Valor Total do Período" valor={moeda(totalValor)} cor="#2563eb" icone={<PaidOutlined sx={{ fontSize:19 }} />} />
            <KpiCard label="Total de Horas"         valor={`${totalHoras.toLocaleString('pt-BR')} h`} cor="#7c3aed" icone={<ScheduleOutlined sx={{ fontSize:19 }} />} />
            <KpiCard label="Em Análise"             valor={emAnalise}  cor="#d97706" icone={<PendingActionsOutlined sx={{ fontSize:19 }} />} />
            <KpiCard label="Aprovados"              valor={aprovados}  cor="#16a34a" icone={<CheckCircleOutlined sx={{ fontSize:19 }} />} />
          </Box>

          {/* Barra de filtros + ação */}
          <Box sx={{ display:'flex', gap:2, alignItems:'center', flexWrap:'wrap' }}>
            <FormControl size="small" sx={{ width:{ xs:'100%', sm:200 } }}>
              <InputLabel sx={{ fontSize:13 }}>Período</InputLabel>
              <Select value={periodo} label="Período" onChange={e=>handlePeriodo(e.target.value)}
                sx={{ borderRadius:1.5, fontSize:13 }}>
                {opcoesPeriodo.length === 0 && <MenuItem value="">Sem dados</MenuItem>}
                {opcoesPeriodo.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ ml:{ xs:0, sm:'auto' }, width:{ xs:'100%', sm:'auto' } }}>
              <Button size="small" variant="outlined" startIcon={<FileDownloadOutlined />} onClick={exportar} fullWidth
                sx={{ textTransform:'none', borderColor:'divider', color:'text.secondary', borderRadius:1.5 }}>
                Exportar Excel
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Tabela: cabeçalho fixo, corpo rola com barra de rolagem própria */}
        <Paper sx={{ borderRadius:2.5, border:'1px solid', borderColor:'divider', overflow:'hidden',
                     flex:1, minHeight:0, display:'flex', flexDirection:'column' }}>
          {carregando ? (
            <Box sx={{ display:'flex', justifyContent:'center', p:4 }}><CircularProgress size={28} /></Box>
          ) : (
            <TableContainer sx={{
              flex:1, minHeight:0, overflow:'auto',
              '&::-webkit-scrollbar':       { width:6, height:6 },
              '&::-webkit-scrollbar-track': { background:'transparent' },
              '&::-webkit-scrollbar-thumb': { background:'divider', borderRadius:3 },
              '&::-webkit-scrollbar-thumb:hover': { background:'text.secondary' }
            }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {cols.map(c => (
                      <TableCell key={c} sx={{ fontWeight:700, fontSize:12, color:'text.secondary', border:0,
                                                whiteSpace:'nowrap', backgroundColor:'background.paper' }}>{c}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lista.map((a,i) => (
                    <TableRow key={a.id} sx={{ '&:hover':{ backgroundColor:'action.hover' }, backgroundColor: i%2?'action.hover':'background.paper' }}>
                      <TableCell sx={{ fontSize:11, color:'text.secondary', border:0 }}>{a.id_consultor}</TableCell>
                      {colunas.map(c => (
                        <TableCell key={c.nome_coluna} sx={{ fontSize:12, color:'text.primary', border:0, whiteSpace:'nowrap' }}>
                          {renderCelula(a, c)}
                        </TableCell>
                      ))}
                      <TableCell sx={{ border:0 }}>
                        <Box sx={{ display:'flex', gap:0.5, alignItems:'center' }}>
                          {podeFazerAcao && a.status === 'Em Análise' && (
                            <>
                              <Button size="small" onClick={() => abrirAcao(a,'Aprovado')}
                                sx={{ minWidth:0, p:0.5, color:'#16a34a', '&:hover':{ backgroundColor:'#dcfce7' } }}>
                                <CheckCircleOutlined sx={{ fontSize:18 }} />
                              </Button>
                              <Button size="small" onClick={() => abrirAcao(a,'Recusado')}
                                sx={{ minWidth:0, p:0.5, color:'#dc2626', '&:hover':{ backgroundColor:'#fee2e2' } }}>
                                <CancelOutlined sx={{ fontSize:18 }} />
                              </Button>
                            </>
                          )}
                          {podeEditarHoras && a.edicao_status !== 'Pendente' && (
                            <Button size="small" onClick={() => abrirEdicaoHoras(a)}
                              sx={{ minWidth:0, p:0.5, color:'#1d4ed8', '&:hover':{ backgroundColor:'#eff6ff' } }}>
                              <EditOutlined sx={{ fontSize:16 }} />
                            </Button>
                          )}
                          {podeAprovarHoras && a.edicao_status === 'Pendente' && (
                            <>
                              <Button size="small" onClick={() => abrirAprovacaoHoras(a,'Aprovado')}
                                sx={{ minWidth:0, p:0.5, color:'#16a34a', '&:hover':{ backgroundColor:'#dcfce7' } }}>
                                <CheckCircleOutlined sx={{ fontSize:18 }} />
                              </Button>
                              <Button size="small" onClick={() => abrirAprovacaoHoras(a,'Recusado')}
                                sx={{ minWidth:0, p:0.5, color:'#dc2626', '&:hover':{ backgroundColor:'#fee2e2' } }}>
                                <CancelOutlined sx={{ fontSize:18 }} />
                              </Button>
                            </>
                          )}
                          {podeExcluir && a.edicao_status !== 'Pendente' && (
                            <Button size="small" onClick={() => setModalExc({ open:true, apontamento:a })}
                              sx={{ minWidth:0, p:0.5, color:'#dc2626', '&:hover':{ backgroundColor:'#fee2e2' } }}>
                              <DeleteOutlined sx={{ fontSize:16 }} />
                            </Button>
                          )}
                          {!podeFazerAcao && !podeEditarHoras && !podeExcluir && (
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>—</Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lista.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={colunas.length+2} sx={{ textAlign:'center', color:'text.secondary', py:4, border:0 }}>
                        Nenhum apontamento encontrado para o período selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* ── Modal de ação (aprovar / recusar) ──────────────────────────── */}
      <Dialog open={modalAcao.open} onClose={()=>setModalAcao({open:false})} maxWidth="sm" fullWidth
        PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ fontWeight:700, color:'text.primary', pb:1 }}>
          {modalAcao.acao === 'Aprovado' ? '✅ Aprovar apontamento' : '❌ Recusar apontamento'}
        </DialogTitle>
        <DialogContent sx={{ pt:'12px !important' }}>
          {modalAcao.apontamento && (
            <Box sx={{ mb:2, p:2, backgroundColor:'action.hover', borderRadius:2, border:'1px solid', borderColor:'divider' }}>
              <Typography variant="body2" fontWeight={600} sx={{ color: "text.primary" }}>{modalAcao.apontamento.nome_consultor}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {modalAcao.apontamento.fornecedor} · {modalAcao.apontamento.horas_trabalhadas} h · {moeda(modalAcao.apontamento.valor_total)}
              </Typography>
            </Box>
          )}
          <TextField
            label="Justificativa *" multiline rows={3} fullWidth
            value={justificativa} onChange={e=>setJustificativa(e.target.value)}
            placeholder="Descreva o motivo desta ação..."
            sx={{ '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }}
          />
          {alerta?.tipo === 'error' && (
            <Alert severity="error" sx={{ mt:1.5, borderRadius:1.5 }}>{alerta.msg}</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>{ setModalAcao({open:false}); setAlerta(null); }}
            sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={pedirConfirmacao} variant="contained" disabled={confirmando}
            sx={{ textTransform:'none', borderRadius:1.5, px:3,
                  backgroundColor: modalAcao.acao==='Aprovado' ? '#16a34a' : '#dc2626',
                  '&:hover':{ backgroundColor: modalAcao.acao==='Aprovado' ? '#15803d' : '#b91c1c' } }}>
            {confirmando ? <CircularProgress size={18} color="inherit" /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modal de confirmação dupla ──────────────────────────────────── */}
      <Dialog open={modalConfirm.open} maxWidth="xs" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ fontWeight:700, color:'text.primary' }}>Tem certeza?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Você está prestes a <strong>{modalAcao.acao === 'Aprovado' ? 'aprovar' : 'recusar'}</strong> o apontamento de{' '}
            <strong>{modalAcao.apontamento?.nome_consultor}</strong>.
            Esta ação ficará registrada no log de auditoria.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModalConfirm({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Voltar</Button>
          <Button onClick={confirmarAcao} variant="contained"
            sx={{ textTransform:'none', borderRadius:1.5, px:3,
                  backgroundColor: modalAcao.acao==='Aprovado' ? '#16a34a' : '#dc2626',
                  '&:hover':{ backgroundColor: modalAcao.acao==='Aprovado' ? '#15803d' : '#b91c1c' } }}>
            Sim, confirmar
          </Button>
        </DialogActions>
      </Dialog>
      {/* ── Modal de edição de horas ──────────────────────────────────────── */}
      <Dialog open={modalHoras.open} onClose={()=>setModalHoras({open:false})} maxWidth="sm" fullWidth
        PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ fontWeight:700, color:'text.primary', pb:1 }}>
          ✏️ Editar horas trabalhadas
        </DialogTitle>
        <DialogContent sx={{ pt:'12px !important', display:'flex', flexDirection:'column', gap:2 }}>
          {modalHoras.apontamento && (
            <Box sx={{ p:2, backgroundColor:'action.hover', borderRadius:2, border:'1px solid', borderColor:'divider' }}>
              <Typography variant="body2" fontWeight={600} sx={{ color: "text.primary" }}>{modalHoras.apontamento.nome_consultor}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {modalHoras.apontamento.fornecedor} · Atual: {modalHoras.apontamento.horas_trabalhadas} h
              </Typography>
            </Box>
          )}
          {['SuperUsuario','Administrador'].includes(usuario?.perfil) ? (
            <Alert severity="warning" sx={{ borderRadius:1.5 }}>
              Como Administrador, esta edição será aplicada automaticamente (auto-aprovação), sem necessidade de aprovação adicional.
            </Alert>
          ) : (
            <Alert severity="info" sx={{ borderRadius:1.5 }}>
              Como Liderança, esta edição ficará pendente até o Administrador aprovar.
            </Alert>
          )}
          <TextField
            label="Novas horas trabalhadas *" type="number" fullWidth
            value={novasHoras} onChange={e=>setNovasHoras(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }}
          />
          <TextField
            label="Justificativa" multiline rows={2} fullWidth
            value={justHoras} onChange={e=>setJustHoras(e.target.value)}
            placeholder="Descreva o motivo da alteração (opcional)..."
            sx={{ '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModalHoras({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={salvarEdicaoHoras} variant="contained" disabled={salvandoHoras}
            sx={{ textTransform:'none', borderRadius:1.5, px:3, backgroundColor:'#1d4ed8', '&:hover':{ backgroundColor:'#1e40af' } }}>
            {salvandoHoras ? <CircularProgress size={18} color="inherit" /> : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modal de aprovação/recusa da edição de horas ───────────────────── */}
      <Dialog open={modalAprovHoras.open} onClose={()=>setModalAprovHoras({open:false})} maxWidth="sm" fullWidth
        PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ fontWeight:700, color:'text.primary', pb:1 }}>
          {modalAprovHoras.acao === 'Aprovado' ? '✅ Aprovar edição de horas' : '❌ Recusar edição de horas'}
        </DialogTitle>
        <DialogContent sx={{ pt:'12px !important', display:'flex', flexDirection:'column', gap:2 }}>
          {modalAprovHoras.apontamento && (
            <Box sx={{ p:2, backgroundColor:'action.hover', borderRadius:2, border:'1px solid', borderColor:'divider' }}>
              <Typography variant="body2" fontWeight={600} sx={{ color: "text.primary" }}>{modalAprovHoras.apontamento.nome_consultor}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Solicitado por {modalAprovHoras.apontamento.solicitado_por} — de {modalAprovHoras.apontamento.horas_trabalhadas} h para {modalAprovHoras.apontamento.horas_pendentes} h
              </Typography>
            </Box>
          )}
          {modalAprovHoras.acao === 'Recusado' && (
            <TextField label="Justificativa *" multiline rows={3} fullWidth
              value={justAprovHoras} onChange={e=>setJustAprovHoras(e.target.value)}
              placeholder="Descreva o motivo da recusa..."
              sx={{ '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }} />
          )}
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModalAprovHoras({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={confirmarAprovacaoHoras} variant="contained" disabled={aprovandoHoras}
            sx={{ textTransform:'none', borderRadius:1.5, px:3,
                  backgroundColor: modalAprovHoras.acao==='Aprovado' ? '#16a34a' : '#dc2626',
                  '&:hover':{ backgroundColor: modalAprovHoras.acao==='Aprovado' ? '#15803d' : '#b91c1c' } }}>
            {aprovandoHoras ? <CircularProgress size={18} color="inherit" /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
      {/* ── Modal de exclusão (soft delete) ────────────────────────────────── */}
      <Dialog open={modalExc.open} onClose={()=>setModalExc({open:false})} maxWidth="xs" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ fontWeight:700, color:'text.primary' }}>Confirmar exclusão</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Tem certeza que deseja excluir o apontamento de <strong>{modalExc.apontamento?.nome_consultor}</strong>?
            O registro ficará inativo e não poderá mais ser visualizado nesta tela.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModalExc({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={excluirApontamento} variant="contained" disabled={excluindo}
            sx={{ textTransform:'none', borderRadius:1.5, backgroundColor:'#dc2626', '&:hover':{ backgroundColor:'#b91c1c' } }}>
            {excluindo ? <CircularProgress size={18} color="inherit" /> : 'Sim, excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  );
};
