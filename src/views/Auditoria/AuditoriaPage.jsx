import { useEffect, useMemo, useState } from 'react';
import {
  Paper, Typography, Box, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, InputAdornment, Pagination, Divider
} from '@mui/material';
import { SearchOutlined, FileDownloadOutlined, RestartAltOutlined, FilterAltOutlined,
         CheckCircleOutlined, CancelOutlined, ArticleOutlined, WarningAmberOutlined,
         HighlightOffOutlined, CalendarMonthOutlined } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { apiGetAuditoria, apiAprovarAuditoria, apiGetEmpresas } from '../../services/api';
import { MainLayout } from '../../components/Layout/MainLayout';
import * as XLSX from 'xlsx';

// Converte "29/05/2026 14:20" em Date para permitir filtro por período
const paraData = (str) => {
  const m = str?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mes, y] = m;
  return new Date(`${y}-${mes}-${d}`);
};

// Card de KPI com ícone em círculo preenchido; o valor herda a cor do ícone
const KpiCard = ({ valor, rotulo, cor, icone }) => (
  <Paper sx={{ p: 1.75, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', flex: 1,
               display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
    <Box sx={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: `${cor}1f`,
               display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Box sx={{ color: cor, display: 'flex' }}>{icone}</Box>
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, display: 'block', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
        {rotulo}
      </Typography>
      <Typography variant="h6" fontWeight="800" sx={{ color: cor }}>{valor}</Typography>
    </Box>
  </Paper>
);

// ── helpers ──────────────────────────────────────────────────────────────────
const TipoChip = ({ tipo }) => {
  const map = {
    'Em Análise': { bg:'#fef9c3', color:'#854d0e' },
    'Aprovado':   { bg:'#dcfce7', color:'#166534' },
    'Recusado':   { bg:'#fee2e2', color:'#991b1b' }
  };
  const s = map[tipo] || map['Em Análise'];
  return (
    <Box sx={{ display:'inline-flex', alignItems:'center', gap:0.5, px:1.5, py:0.4,
               borderRadius:99, fontSize:11, fontWeight:700, backgroundColor:s.bg, color:s.color }}>
      <Box sx={{ width:6, height:6, borderRadius:'50%', backgroundColor:'currentColor' }} />
      {tipo}
    </Box>
  );
};

const NivelChip = ({ nivel }) => {
  const map = {
    Crítico:        { bg:'#fee2e2', color:'#991b1b' },
    Administrativo: { bg:'#dbeafe', color:'#1e40af' },
    Atenção:        { bg:'#fef9c3', color:'#854d0e' },
    Sucesso:        { bg:'#dcfce7', color:'#166534' }
  };
  const s = map[nivel] || { bg:'action.hover', color:'text.secondary' };
  return (
    <Box sx={{ display:'inline-flex', px:1.2, py:0.3, borderRadius:99, fontSize:11,
               fontWeight:700, backgroundColor:s.bg, color:s.color }}>{nivel}</Box>
  );
};

const DetalheRow = ({ label, valor, destaque }) => (
  <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'110px 1fr', sm:'140px 1fr' }, gap:1, py:0.8,
             borderBottom:'1px solid', borderColor:'divider', '&:last-child':{ borderBottom:0 } }}>
    <Typography variant="caption" sx={{ color: "text.secondary" }} fontWeight={600}>{label}</Typography>
    <Typography variant="caption" color={destaque||'text.primary'} fontWeight={destaque?700:400}>{valor||'—'}</Typography>
  </Box>
);

const POR_PAG = 8;

// ── componente principal ─────────────────────────────────────────────────────
export const AuditoriaPage = ({ onNavigate }) => {
  const { token, usuario } = useAuth();
  const isSuper = usuario?.perfil === 'SuperUsuario';
  const [logs, setLogs] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [alerta, setAlerta] = useState(null);

  // Filtros (rascunho vs. aplicado — o botão "Filtrar" só aplica ao clicar)
  const FILTROS_VAZIOS = { inicio: '', fim: '', modulo: 'Todos', tipo: 'Todos', nivel: 'Todos', empresa: '' };
  const [rascunho, setRascunho] = useState(FILTROS_VAZIOS);
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);

  // Modal de detalhes
  const [detalhe, setDetalhe] = useState({ open:false, log:null });

  // Modal de ação
  const [modalAcao, setModalAcao] = useState({ open:false, log:null, acao:null });
  const [justificativa, setJustificativa] = useState('');
  const [modalConfirm, setModalConfirm] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = async (empresaId) => {
    setCarregando(true);
    try {
      const [resLogs, resEmpresas] = await Promise.all([
        apiGetAuditoria(token, empresaId),
        isSuper ? apiGetEmpresas(token) : Promise.resolve({ data:[] })
      ]);
      setLogs(resLogs.data);
      setEmpresas(resEmpresas.data);
    }
    catch(e){ console.error(e); }
    finally { setCarregando(false); }
  };

  useEffect(() => { carregar(); }, []);

  const modulos = ['Todos', ...new Set(logs.map(l=>l.modulo))];
  const tipos   = ['Todos','Em Análise','Aprovado','Recusado'];
  const niveis  = ['Todos','Crítico','Administrativo','Atenção','Sucesso'];

  const filtrado = useMemo(() => logs.filter(l => {
    const q = busca.toLowerCase();
    const data = paraData(l.data_hora);
    if (filtros.inicio && data && data < new Date(filtros.inicio)) return false;
    if (filtros.fim && data && data > new Date(filtros.fim)) return false;
    return (
      (filtros.modulo==='Todos'||l.modulo===filtros.modulo) &&
      (filtros.tipo==='Todos'||l.tipo_acao===filtros.tipo) &&
      (filtros.nivel==='Todos'||l.nivel===filtros.nivel) &&
      (!q||l.usuario.toLowerCase().includes(q)||l.modulo.toLowerCase().includes(q)||l.entidade?.toLowerCase().includes(q))
    );
  }), [logs, filtros, busca]);

  const totalPags = Math.ceil(filtrado.length / POR_PAG);
  const paginado  = filtrado.slice((pagina-1)*POR_PAG, pagina*POR_PAG);

  const aplicarFiltros = () => { setFiltros(rascunho); setPagina(1); carregar(rascunho.empresa); };
  const limpar = () => { setBusca(''); setRascunho(FILTROS_VAZIOS); setFiltros(FILTROS_VAZIOS); setPagina(1); carregar(); };

  // Exportar Excel
  const exportar = () => {
    const linhas = filtrado.map(l => ({
      'ID': l.id, 'Data/Hora': l.data_hora, 'Usuário': l.usuario,
      'Módulo': l.modulo, 'Tipo de Ação': l.tipo_acao, 'IP': l.ip,
      'Nível': l.nivel, 'Entidade': l.entidade, 'Campo': l.campo_alterado,
      'Valor Antes': l.valor_antes, 'Valor Depois': l.valor_depois
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria');
    XLSX.writeFile(wb, 'logs_auditoria.xlsx');
  };

  // Abrir detalhes
  const abrirDetalhe = (log) => setDetalhe({ open:true, log });

  // Abrir modal de ação a partir dos detalhes
  const abrirAcao = (log, acao) => {
    setJustificativa('');
    setDetalhe({ open:false });
    setModalAcao({ open:true, log, acao });
  };

  const pedirConfirmacao = () => {
    if (!justificativa.trim()) { setAlerta({ tipo:'error', msg:'Justificativa obrigatória.' }); return; }
    setModalConfirm(true);
  };

  const confirmarAcao = async () => {
    setSalvando(true);
    setModalConfirm(false);
    try {
      await apiAprovarAuditoria(token, modalAcao.log.id, modalAcao.acao, justificativa);
      setAlerta({ tipo:'success', msg:`Log ${modalAcao.acao === 'Aprovado' ? 'aprovado' : 'recusado'} com sucesso.` });
      setModalAcao({ open:false });
      await carregar();
    } catch { setAlerta({ tipo:'error', msg:'Erro ao processar. Tente novamente.' }); }
    finally { setSalvando(false); }
  };

  const cols = ['ID','Data e hora','Usuário','Módulo','Tipo de ação','IP','Nível',''];

  const BuscaEExportar = (
    <>
      <TextField size="small" placeholder="Buscar logs…"
        value={busca} onChange={e=>{ setBusca(e.target.value); setPagina(1); }}
        InputProps={{ startAdornment:<InputAdornment position="start"><SearchOutlined sx={{ fontSize:18, color:'text.secondary' }} /></InputAdornment> }}
        sx={{ width:{ xs:160, sm:220 }, backgroundColor:'background.paper', '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }} />
      <Button size="small" variant="contained" startIcon={<FileDownloadOutlined />} onClick={exportar}
        sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, '&:hover':{ backgroundColor:'#1e40af' } }}>
        Exportar
      </Button>
    </>
  );

  return (
    <MainLayout idTela="auditoria" tituloTela="LOGS DE AUDITORIA" acoesTopo={BuscaEExportar} onNavigate={onNavigate}>
      <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>

        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Monitore ações, alterações e eventos críticos realizados na plataforma com rastreabilidade completa.
        </Typography>

        {alerta && (
          <Alert severity={alerta.tipo} onClose={()=>setAlerta(null)} sx={{ borderRadius:2 }}>{alerta.msg}</Alert>
        )}

        {/* KPIs */}
        <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(190px, 1fr))', gap:2 }}>
          <KpiCard valor={logs.length.toLocaleString('pt-BR')} rotulo="Eventos registrados" cor="#2563eb" icone={<ArticleOutlined sx={{ fontSize:19 }} />} />
          <KpiCard valor={logs.filter(l=>l.nivel==='Crítico').length} rotulo="Críticos" cor="#dc2626" icone={<WarningAmberOutlined sx={{ fontSize:19 }} />} />
          <KpiCard valor={logs.filter(l=>l.tipo_acao==='Aprovado').length} rotulo="Aprovados" cor="#16a34a" icone={<CheckCircleOutlined sx={{ fontSize:19 }} />} />
          <KpiCard valor={logs.filter(l=>l.tipo_acao==='Recusado').length} rotulo="Recusados" cor="#d97706" icone={<HighlightOffOutlined sx={{ fontSize:19 }} />} />
        </Box>

        {/* Filtros */}
        <Paper sx={{ p:1.5, borderRadius:2.5, border:'1px solid', borderColor:'divider' }}>
          <Box sx={{ display:'flex', gap:1.5, flexWrap:'wrap', alignItems:'center' }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:0.6, border:'1px solid', borderColor:'divider',
                       borderRadius:1.5, px:1, height:36, width:{ xs:'100%', sm:'auto' } }}>
              <CalendarMonthOutlined sx={{ fontSize:17, color:'text.secondary', flexShrink:0 }} />
              <TextField type="date" size="small" variant="standard" value={rascunho.inicio}
                onChange={e=>setRascunho(r=>({ ...r, inicio:e.target.value }))}
                InputProps={{ disableUnderline:true, sx:{ fontSize:13 } }} sx={{ width:112 }} />
              <Typography sx={{ color:'text.secondary', fontSize:13 }}>–</Typography>
              <TextField type="date" size="small" variant="standard" value={rascunho.fim}
                onChange={e=>setRascunho(r=>({ ...r, fim:e.target.value }))}
                InputProps={{ disableUnderline:true, sx:{ fontSize:13 } }} sx={{ width:112 }} />
            </Box>

            {[
              { label:'Módulo', key:'modulo', opts:modulos, w:140 },
              { label:'Tipo de ação', key:'tipo', opts:tipos, w:150 },
              { label:'Nível', key:'nivel', opts:niveis, w:150 }
            ].map(f => (
              <FormControl key={f.label} size="small" sx={{ width:{ xs:'calc(50% - 8px)', sm:f.w } }}>
                <InputLabel sx={{ fontSize:13 }}>{f.label}</InputLabel>
                <Select value={rascunho[f.key]} label={f.label} onChange={e=>setRascunho(r=>({ ...r, [f.key]:e.target.value }))}
                  sx={{ borderRadius:1.5, fontSize:13, height:36 }}>
                  {f.opts.map(o=><MenuItem key={o} value={o}>{o}</MenuItem>)}
                </Select>
              </FormControl>
            ))}

            {isSuper && (
              <FormControl size="small" sx={{ width:{ xs:'calc(50% - 8px)', sm:180 } }}>
                <InputLabel sx={{ fontSize:13 }}>Empresa</InputLabel>
                <Select value={rascunho.empresa} label="Empresa" onChange={e=>setRascunho(r=>({ ...r, empresa:e.target.value }))}
                  sx={{ borderRadius:1.5, fontSize:13, height:36 }}>
                  <MenuItem value="">Todas as empresas</MenuItem>
                  {empresas.map(e=><MenuItem key={e.id} value={e.id}>{e.nome}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            <Box sx={{ display:'flex', gap:1, ml:{ xs:0, sm:'auto' }, width:{ xs:'100%', sm:'auto' } }}>
              <Button size="small" variant="contained" startIcon={<FilterAltOutlined sx={{ fontSize:16 }} />} onClick={aplicarFiltros}
                sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, height:36, '&:hover':{ backgroundColor:'#1e40af' } }}>
                Filtrar
              </Button>
              <Button size="small" variant="outlined" startIcon={<RestartAltOutlined sx={{ fontSize:16 }} />} onClick={limpar}
                sx={{ textTransform:'none', borderColor:'divider', color:'text.secondary', borderRadius:1.5, height:36 }}>
                Limpar
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Tabela */}
        <Paper sx={{ borderRadius:2.5, border:'1px solid', borderColor:'divider', overflow:'hidden' }}>
          {carregando ? (
            <Box sx={{ display:'flex', justifyContent:'center', p:4 }}><CircularProgress size={28} /></Box>
          ) : (
            <>
              <Box sx={{ p:2, borderBottom:'1px solid', borderColor:'divider' }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }} fontWeight={500}>
                  Mostrando {paginado.length} de {filtrado.length} registros
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ backgroundColor:'action.hover' }}>
                    <TableRow>
                      {cols.map(c=><TableCell key={c} sx={{ fontWeight:700, fontSize:12, color:'text.secondary', border:0 }}>{c}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginado.map((l,i)=>(
                      <TableRow key={l.id} sx={{ '&:hover':{ backgroundColor:'action.hover' }, backgroundColor:i%2?'action.hover':'background.paper' }}>
                        <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{l.id}</TableCell>
                        <TableCell sx={{ fontSize:12, color:'text.secondary', border:0, whiteSpace:'nowrap' }}>{l.data_hora}</TableCell>
                        <TableCell sx={{ fontSize:12, fontWeight:600, color:'text.primary', border:0 }}>{l.usuario}</TableCell>
                        <TableCell sx={{ fontSize:12, color:'text.primary', border:0 }}>{l.modulo}</TableCell>
                        <TableCell sx={{ border:0 }}><TipoChip tipo={l.tipo_acao} /></TableCell>
                        <TableCell sx={{ fontSize:11, color:'text.secondary', border:0, fontFamily:'monospace' }}>{l.ip}</TableCell>
                        <TableCell sx={{ border:0 }}><NivelChip nivel={l.nivel} /></TableCell>
                        <TableCell sx={{ border:0 }}>
                          <Button size="small" onClick={()=>abrirDetalhe(l)}
                            sx={{ textTransform:'none', color:'#1d4ed8', fontSize:12, p:0, minWidth:0,
                                  '&:hover':{ backgroundColor:'transparent', textDecoration:'underline' } }}>
                            Ver detalhes →
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginado.length===0 && (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ textAlign:'center', color:'text.secondary', py:4, border:0 }}>
                          Nenhum log encontrado com os filtros aplicados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              {totalPags>1 && (
                <Box sx={{ display:'flex', justifyContent:'center', p:2, borderTop:'1px solid', borderColor:'divider' }}>
                  <Pagination count={totalPags} page={pagina} onChange={(_,v)=>setPagina(v)} size="small" color="primary" />
                </Box>
              )}
            </>
          )}
        </Paper>
      </Box>

      {/* ── Modal de detalhes ───────────────────────────────────────────── */}
      <Dialog open={detalhe.open} onClose={()=>setDetalhe({open:false})} maxWidth="sm" fullWidth
        PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ fontWeight:700, color:'text.primary', pb:1 }}>
          Detalhes do Evento — {detalhe.log?.id}
        </DialogTitle>
        <DialogContent sx={{ pt:'8px !important' }}>
          {detalhe.log && (
            <Box>
              <DetalheRow label="Data / Hora"    valor={detalhe.log.data_hora} />
              <DetalheRow label="Usuário"         valor={detalhe.log.usuario} />
              <DetalheRow label="E-mail"          valor={detalhe.log.email_usuario} />
              <DetalheRow label="IP de origem"    valor={detalhe.log.ip} />
              <DetalheRow label="Módulo"          valor={detalhe.log.modulo} />
              <DetalheRow label="Nível"           valor={detalhe.log.nivel} />
              <DetalheRow label="Entidade"        valor={`${detalhe.log.entidade} (${detalhe.log.entidade_id})`} />
              <Divider sx={{ my:1.5 }} />
              <DetalheRow label="Campo alterado"  valor={detalhe.log.campo_alterado} />
              <DetalheRow label="Valor anterior"  valor={detalhe.log.valor_antes}  destaque="#dc2626" />
              <DetalheRow label="Novo valor"      valor={detalhe.log.valor_depois} destaque="#16a34a" />
              <Divider sx={{ my:1.5 }} />
              <DetalheRow label="Status atual"    valor={detalhe.log.tipo_acao} />
              <Box sx={{ py:0.8 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }} fontWeight={600}>Justificativa</Typography>
                <Typography variant="body2" mt={0.5} sx={{ lineHeight:1.6, color:"text.primary" }}>
                  {detalhe.log.justificativa || '—'}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2.5, gap:1 }}>
          <Button onClick={()=>setDetalhe({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Fechar</Button>
          {detalhe.log?.tipo_acao === 'Em Análise' && (
            <>
              <Button onClick={()=>abrirAcao(detalhe.log,'Recusado')} variant="outlined"
                startIcon={<CancelOutlined />}
                sx={{ textTransform:'none', borderRadius:1.5, color:'#dc2626', borderColor:'#dc2626',
                      '&:hover':{ backgroundColor:'#fee2e2' } }}>
                Recusar
              </Button>
              <Button onClick={()=>abrirAcao(detalhe.log,'Aprovado')} variant="contained"
                startIcon={<CheckCircleOutlined />}
                sx={{ textTransform:'none', borderRadius:1.5, backgroundColor:'#16a34a',
                      '&:hover':{ backgroundColor:'#15803d' } }}>
                Aprovar
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Modal de ação (justificativa) ──────────────────────────────── */}
      <Dialog open={modalAcao.open} onClose={()=>setModalAcao({open:false})} maxWidth="sm" fullWidth
        PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ fontWeight:700, color:'text.primary', pb:1 }}>
          {modalAcao.acao==='Aprovado' ? '✅ Aprovar evento' : '❌ Recusar evento'}
        </DialogTitle>
        <DialogContent sx={{ pt:'12px !important', display:'flex', flexDirection:'column', gap:2 }}>
          {modalAcao.log && (
            <Box sx={{ p:2, backgroundColor:'action.hover', borderRadius:2, border:'1px solid', borderColor:'divider' }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>{modalAcao.log.id} · {modalAcao.log.modulo} · {modalAcao.log.usuario}</Typography>
            </Box>
          )}
          <TextField label="Justificativa da revisão *" multiline rows={3} fullWidth
            value={justificativa} onChange={e=>setJustificativa(e.target.value)}
            placeholder="Descreva o motivo desta revisão..."
            sx={{ '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }} />
          {alerta?.tipo==='error' && (
            <Alert severity="error" sx={{ borderRadius:1.5 }}>{alerta.msg}</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>{ setModalAcao({open:false}); setAlerta(null); }}
            sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={pedirConfirmacao} variant="contained" disabled={salvando}
            sx={{ textTransform:'none', borderRadius:1.5, px:3,
                  backgroundColor:modalAcao.acao==='Aprovado'?'#16a34a':'#dc2626',
                  '&:hover':{ backgroundColor:modalAcao.acao==='Aprovado'?'#15803d':'#b91c1c' } }}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modal de confirmação dupla ──────────────────────────────────── */}
      <Dialog open={modalConfirm} maxWidth="xs" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ fontWeight:700, color:'text.primary' }}>Tem certeza?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Você está prestes a <strong>{modalAcao.acao==='Aprovado'?'aprovar':'recusar'}</strong> o evento{' '}
            <strong>{modalAcao.log?.id}</strong>. Esta ação não poderá ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModalConfirm(false)} sx={{ textTransform:'none', color:'text.secondary' }}>Voltar</Button>
          <Button onClick={confirmarAcao} variant="contained" disabled={salvando}
            sx={{ textTransform:'none', borderRadius:1.5, px:3,
                  backgroundColor:modalAcao.acao==='Aprovado'?'#16a34a':'#dc2626',
                  '&:hover':{ backgroundColor:modalAcao.acao==='Aprovado'?'#15803d':'#b91c1c' } }}>
            {salvando?<CircularProgress size={18} color="inherit"/>:'Sim, confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </MainLayout>
  );
};
