import { useEffect, useState } from 'react';
import {
  Paper, Typography, Box, Button, TextField, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete,
  CircularProgress, Alert, InputAdornment, IconButton, Tooltip
} from '@mui/material';
import { AddOutlined, SearchOutlined, FileDownloadOutlined, EditOutlined,
         DeleteOutlined, BusinessOutlined, PeopleOutlined, PersonOutlined,
         BadgeOutlined, ApartmentOutlined, CheckCircleOutlined, CancelOutlined,
         RestartAltOutlined } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import {
  apiGetConsultores, apiCreateConsultor, apiUpdateConsultor, apiDeleteConsultor,
  apiGetFornecedores, apiCreateFornecedor, apiUpdateFornecedor, apiDeleteFornecedor,
  apiGetUsuarios, apiCreateUsuario, apiUpdateUsuario, apiDeleteUsuario, apiGetEmpresas,
  apiGetEmpresaById, apiCreateEmpresa, apiUpdateEmpresa, apiAprovarEmpresa, apiReativarFornecedor,
  apiGetUsuarioById, apiAprovarEdicaoUsuario
} from '../../services/api';
import { MainLayout } from '../../components/Layout/MainLayout';
import { useCamposCustom } from '../../hooks/useCamposCustom';
import { useNomesCampos } from '../../hooks/useNomesCampos';
import * as XLSX from 'xlsx';

// ── helpers ──────────────────────────────────────────────────────────────────
const moeda = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);

const StatusBadge = ({ ativo }) => (
  <Box sx={{ display:'inline-flex', alignItems:'center', gap:0.5, px:1.5, py:0.4, borderRadius:99,
             fontSize:11, fontWeight:700,
             backgroundColor:ativo?'#dcfce7':'#fee2e2', color:ativo?'#166534':'#991b1b' }}>
    <Box sx={{ width:6, height:6, borderRadius:'50%', backgroundColor:'currentColor' }} />
    {ativo?'Ativo':'Inativo'}
  </Box>
);

const TabBtn = ({ ativo, icone, rotulo, onClick }) => (
  <Button onClick={onClick} startIcon={icone}
    sx={{ textTransform:'none', px:2.5, py:1.2, borderRadius:2, fontWeight:600, fontSize:13,
          backgroundColor:ativo?'#1d4ed8':'transparent', color:ativo?'#fff':'text.secondary',
          border:ativo?'none':'1px solid', borderColor:ativo?'transparent':'divider',
          '&:hover':{ backgroundColor:ativo?'#1e40af':'action.hover' } }}>
    {rotulo}
  </Button>
);

const Campo = ({ label, ...props }) => (
  <TextField size="small" label={label} fullWidth sx={{ '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }} {...props} />
);
const SelField = ({ label, value, onChange, opcoes, disabled }) => (
  <FormControl size="small" fullWidth disabled={disabled}>
    <InputLabel sx={{ fontSize:13 }}>{label}</InputLabel>
    <Select value={value||''} onChange={onChange} label={label} sx={{ borderRadius:1.5, fontSize:13 }}>
      {opcoes.map(o=><MenuItem key={o} value={o}>{o}</MenuItem>)}
    </Select>
  </FormControl>
);

// Colunas de ação (editar / excluir)
const AcoesCell = ({ onEdit, onDelete, podeDeletar = true }) => (
  <Box sx={{ display:'flex', gap:0.5 }}>
    <Tooltip title="Editar">
      <IconButton size="small" onClick={onEdit} sx={{ color:'#1d4ed8', '&:hover':{ backgroundColor:'#eff6ff' } }}>
        <EditOutlined sx={{ fontSize:16 }} />
      </IconButton>
    </Tooltip>
    {podeDeletar && (
      <Tooltip title="Excluir">
        <IconButton size="small" onClick={onDelete} sx={{ color:'#dc2626', '&:hover':{ backgroundColor:'#fee2e2' } }}>
          <DeleteOutlined sx={{ fontSize:16 }} />
        </IconButton>
      </Tooltip>
    )}
  </Box>
);

// ── Modal genérico de confirmação de exclusão ─────────────────────────────────
const ModalExclusao = ({ open, nome, onConfirm, onCancel, loading }) => (
  <Dialog open={open} maxWidth="xs" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
    <DialogTitle sx={{ fontWeight:700, color:'text.primary' }}>Confirmar exclusão</DialogTitle>
    <DialogContent>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Tem certeza que deseja excluir <strong>{nome}</strong>? Esta ação não poderá ser desfeita.
      </Typography>
    </DialogContent>
    <DialogActions sx={{ px:3, pb:2, gap:1 }}>
      <Button onClick={onCancel} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
      <Button onClick={onConfirm} variant="contained" disabled={loading}
        sx={{ textTransform:'none', borderRadius:1.5, backgroundColor:'#dc2626', '&:hover':{ backgroundColor:'#b91c1c' } }}>
        {loading?<CircularProgress size={18} color="inherit"/>:'Sim, excluir'}
      </Button>
    </DialogActions>
  </Dialog>
);

// ══════════════════════════════════════════════════════════════════════════════
// ABA CONSULTORES
// ══════════════════════════════════════════════════════════════════════════════
const AbaConsultores = () => {
  const { token, usuario } = useAuth();
  const camposCustom = useCamposCustom('consultor');
  const { nomeDe, obrigatorioDe } = useNomesCampos('consultor');
  const [lista, setLista] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [alerta, setAlerta] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Modal form
  const [modal, setModal] = useState({ open:false, modo:'criar', item:null });
  // Modal exclusão
  const [modalExc, setModalExc] = useState({ open:false, item:null });

  const FORM_VAZIO = {
    usuario_id:null, id_fornecedor:'', lideranca_id:null, cargo:'', departamento:'',
    valor_hora:'', horas_previstas_semana:'', status:'Ativo', data_inicio:'', data_fim:'',
    custom01:'', custom02:'', custom03:'', custom04:''
  };
  const [form, setForm] = useState(FORM_VAZIO);

  const formatarCustom = (valor, tipo) => {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (tipo === 'float') return Number(valor).toLocaleString('pt-BR');
    return valor;
  };

  // Usuários elegíveis a serem consultores: mesma empresa (já filtrado pela API) e perfil != Fornecedor
  const usuariosElegiveis = usuarios.filter(u => u.perfil !== 'Fornecedor');
  // Quem pode ser escolhido como líder: qualquer usuário que não seja Fornecedor — o perfil
  // "Liderança" é automático a partir desse vínculo, não precisa já estar marcado como tal.
  const usuariosLideranca = usuarios.filter(u => u.perfil !== 'Fornecedor');

  const carregar = async () => {
    setCarregando(true);
    try {
      const [resConsultores, resUsuarios, resFornecedores] = await Promise.all([
        apiGetConsultores(token, usuario.perfil, usuario.empresa, usuario.email, usuario.id_fornecedor),
        apiGetUsuarios(token),
        apiGetFornecedores(token)
      ]);
      setLista(resConsultores.data);
      setUsuarios(resUsuarios.data);
      setFornecedores(resFornecedores.data);
    } catch(e){ console.error(e); }
    finally { setCarregando(false); }
  };

  useEffect(() => { carregar(); }, []);

  const filtrado = lista.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.cargo?.toLowerCase().includes(busca.toLowerCase()) ||
    c.fornecedor?.toLowerCase().includes(busca.toLowerCase())
  );

  const abrirCriar = () => { setForm(FORM_VAZIO); setModal({ open:true, modo:'criar' }); };
  const abrirEditar = (item) => {
    setForm({
      usuario_id:item.usuario_id||null, id_fornecedor:item.id_fornecedor||'',
      lideranca_id:item.lideranca_id||null, cargo:item.cargo||'', departamento:item.departamento||'',
      valor_hora:item.valor_hora||'', horas_previstas_semana:item.horas_previstas_semana||'',
      status:item.status||'Ativo', data_inicio:item.data_inicio||'', data_fim:item.data_fim||'',
      custom01:item.custom01||'', custom02:item.custom02||'', custom03:item.custom03||'', custom04:item.custom04??''
    });
    setModal({ open:true, modo:'editar', item });
  };
  const abrirExcluir = (item) => setModalExc({ open:true, item });

  const salvar = async () => {
    if (!form.usuario_id || !form.id_fornecedor || !form.valor_hora) {
      setAlerta({ tipo:'error', msg:'Usuário, fornecedor vinculado e valor da hora são obrigatórios.' });
      return;
    }
    const campoPadraoFaltante = ['cargo','departamento','horas_previstas_semana','data_inicio','data_fim','lideranca_id'].find(c => obrigatorioDe(c) && !form[c]);
    if (campoPadraoFaltante) { setAlerta({ tipo:'error', msg:`O campo "${nomeDe(campoPadraoFaltante,campoPadraoFaltante)}" é obrigatório.` }); return; }
    const faltante = camposCustom.find(c => c.obrigatorio && !form[c.nome_coluna]);
    if (faltante) { setAlerta({ tipo:'error', msg:`O campo "${faltante.nome}" é obrigatório.` }); return; }
    setSalvando(true);
    const payload = {
      ...form,
      valor_hora: parseFloat(form.valor_hora)||0,
      horas_previstas_semana: parseFloat(form.horas_previstas_semana)||0,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
    };
    try {
      if (modal.modo === 'criar') await apiCreateConsultor(token, payload);
      else await apiUpdateConsultor(token, modal.item.id, payload);
      await carregar();
      setModal({ open:false });
      setAlerta({ tipo:'success', msg:`Consultor ${modal.modo==='criar'?'cadastrado':'atualizado'} com sucesso!` });
    } catch { setAlerta({ tipo:'error', msg:'Erro ao salvar.' }); }
    finally { setSalvando(false); }
  };

  const excluir = async () => {
    setExcluindo(true);
    try {
      await apiDeleteConsultor(token, modalExc.item.id);
      await carregar();
      setModalExc({ open:false });
      setAlerta({ tipo:'success', msg:'Consultor removido.' });
    } catch { setAlerta({ tipo:'error', msg:'Erro ao excluir.' }); }
    finally { setExcluindo(false); }
  };

  const exportar = () => {
    const ws = XLSX.utils.json_to_sheet(filtrado.map(c=>({
      ID:c.id, Nome:c.nome, CPF:c.cpf, Cargo:c.cargo, Departamento:c.departamento,
      'Valor/Hora':c.valor_hora, Fornecedor:c.fornecedor, Liderança:c.lideranca, Status:c.status
    })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Consultores');
    XLSX.writeFile(wb,'consultores.xlsx');
  };

  const podeEditar = ['SuperUsuario','Administrador','Liderança'].includes(usuario?.perfil);

  return (
    <>
      {alerta&&<Alert severity={alerta.tipo} onClose={()=>setAlerta(null)} sx={{ mb:2, borderRadius:2 }}>{alerta.msg}</Alert>}

      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2, flexWrap:'wrap', gap:1 }}>
        <TextField size="small" placeholder="Buscar…" value={busca} onChange={e=>setBusca(e.target.value)}
          InputProps={{ startAdornment:<InputAdornment position="start"><SearchOutlined sx={{ fontSize:18, color:'text.secondary' }} /></InputAdornment> }}
          sx={{ width:{ xs:'100%', sm:300 }, '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }} />
        <Box sx={{ display:'flex', gap:1 }}>
          <Button size="small" variant="outlined" startIcon={<FileDownloadOutlined />} onClick={exportar}
            sx={{ textTransform:'none', borderColor:'divider', color:'text.secondary', borderRadius:1.5 }}>Exportar</Button>
          {podeEditar && (
            <Button size="small" variant="contained" startIcon={<AddOutlined />} onClick={abrirCriar}
              sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, '&:hover':{ backgroundColor:'#1e40af' } }}>
              Novo consultor
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ borderRadius:2.5, border:'1px solid', borderColor:'divider', overflow:'hidden' }}>
        {carregando ? <Box sx={{ display:'flex', justifyContent:'center', p:4 }}><CircularProgress size={28} /></Box> : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ backgroundColor:'action.hover' }}>
                <TableRow>
                  {['ID','Nome','CPF',nomeDe('cargo','Cargo'),nomeDe('departamento','Depto'),nomeDe('valor_hora','Valor/h'),'Fornecedor','Liderança','Status',...camposCustom.map(c=>c.nome),''].map((h,idx)=>(
                    <TableCell key={`${h}-${idx}`} sx={{ fontWeight:700, fontSize:12, color:'text.secondary', border:0 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtrado.map((c,i)=>(
                  <TableRow key={c.id} sx={{ '&:hover':{ backgroundColor:'action.hover' }, backgroundColor:i%2?'action.hover':'background.paper' }}>
                    <TableCell sx={{ fontSize:11, color:'text.secondary', border:0 }}>{c.id}</TableCell>
                    <TableCell sx={{ fontSize:12, fontWeight:600, color:'text.primary', border:0 }}>{c.nome}</TableCell>
                    <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{c.cpf}</TableCell>
                    <TableCell sx={{ fontSize:12, color:'text.primary', border:0 }}>{c.cargo}</TableCell>
                    <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{c.departamento}</TableCell>
                    <TableCell sx={{ fontSize:12, fontWeight:700, color:'#1d4ed8', border:0 }}>{moeda(c.valor_hora)}</TableCell>
                    <TableCell sx={{ fontSize:12, color:'text.primary', border:0 }}>{c.fornecedor}</TableCell>
                    <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{c.lideranca}</TableCell>
                    <TableCell sx={{ border:0 }}><StatusBadge ativo={c.status==='Ativo'} /></TableCell>
                    {camposCustom.map(cc=>(
                      <TableCell key={cc.nome_coluna} sx={{ fontSize:12, color:'text.secondary', border:0, whiteSpace:'nowrap' }}>
                        {formatarCustom(c[cc.nome_coluna], cc.tipo)}
                      </TableCell>
                    ))}
                    <TableCell sx={{ border:0 }}>
                      {podeEditar && <AcoesCell onEdit={()=>abrirEditar(c)} onDelete={()=>abrirExcluir(c)} />}
                    </TableCell>
                  </TableRow>
                ))}
                {filtrado.length===0&&<TableRow><TableCell colSpan={10+camposCustom.length} sx={{ textAlign:'center', color:'text.secondary', py:4, border:0 }}>Nenhum resultado encontrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Modal form */}
      <Dialog open={modal.open} onClose={()=>setModal({open:false})} maxWidth="sm" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ display:'flex', alignItems:'center', gap:1, fontWeight:700, color:'text.primary', pb:1 }}>
          <BadgeOutlined sx={{ color:'#1d4ed8' }} />
          {modal.modo==='criar'?'Cadastro de Consultor/Terceiro':'Editar Consultor/Terceiro'}
        </DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:'16px !important' }}>
          <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'1fr 1fr' }, gap:2 }}>
            <Autocomplete
              sx={{ gridColumn:'1 / -1' }}
              size="small"
              disabled={modal.modo==='editar'}
              options={usuariosElegiveis}
              getOptionLabel={(u)=>u.nome?`${u.nome} (${u.email})`:''}
              isOptionEqualToValue={(o,v)=>o.id===v.id}
              value={usuariosElegiveis.find(u=>u.id===form.usuario_id)||null}
              onChange={(_,v)=>setForm(p=>({...p,usuario_id:v?v.id:null}))}
              renderInput={(params)=><TextField {...params} label="Usuário *" placeholder="Selecione o usuário" />}
            />
            <Autocomplete
              size="small"
              options={fornecedores}
              getOptionLabel={(f)=>f.razao_social?`${f.id} — ${f.razao_social}`:''}
              isOptionEqualToValue={(o,v)=>o.id===v.id}
              value={fornecedores.find(f=>f.id===form.id_fornecedor)||null}
              onChange={(_,v)=>setForm(p=>({...p,id_fornecedor:v?v.id:''}))}
              renderInput={(params)=><TextField {...params} label="Fornecedor vinculado *" placeholder="Pesquise por nome ou ID" />}
            />
            <Autocomplete
              size="small"
              options={usuariosLideranca}
              getOptionLabel={(u)=>u.nome?`${u.nome} (${u.email})`:''}
              isOptionEqualToValue={(o,v)=>o.id===v.id}
              value={usuariosLideranca.find(u=>u.id===form.lideranca_id)||null}
              onChange={(_,v)=>setForm(p=>({...p,lideranca_id:v?v.id:null}))}
              renderInput={(params)=><TextField {...params} label={nomeDe('lideranca_id','Liderança responsável')} placeholder="Selecione a liderança — vira automaticamente perfil Liderança" />}
            />
            <Campo label={`${nomeDe('cargo','Cargo')}${obrigatorioDe('cargo')?' *':''}`}         value={form.cargo}        onChange={e=>setForm(p=>({...p,cargo:e.target.value}))} />
            <Campo label={`${nomeDe('departamento','Departamento')}${obrigatorioDe('departamento')?' *':''}`}  value={form.departamento} onChange={e=>setForm(p=>({...p,departamento:e.target.value}))} />
            <Campo label={`${nomeDe('valor_hora','Valor da hora (R$)')} *`} type="number" value={form.valor_hora} onChange={e=>setForm(p=>({...p,valor_hora:e.target.value}))} />
            <Campo label={`${nomeDe('horas_previstas_semana','Horas previstas na semana')} *`} type="number" value={form.horas_previstas_semana} onChange={e=>setForm(p=>({...p,horas_previstas_semana:e.target.value}))} />
            <SelField label="Status" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} opcoes={['Ativo','Inativo']} />
            <Campo label={`${nomeDe('data_inicio','Data de início')}${obrigatorioDe('data_inicio')?' *':''}`} type="date" value={form.data_inicio} onChange={e=>setForm(p=>({...p,data_inicio:e.target.value}))} slotProps={{ inputLabel:{ shrink:true } }} />
            <Campo label={`${nomeDe('data_fim','Data de fim')}${obrigatorioDe('data_fim')?' *':''}`} type="date" value={form.data_fim} onChange={e=>setForm(p=>({...p,data_fim:e.target.value}))} slotProps={{ inputLabel:{ shrink:true } }} />
            {camposCustom.map(cc=>(
              <Campo key={cc.nome_coluna}
                label={`${cc.nome}${cc.obrigatorio?' *':''}`}
                type={cc.tipo==='date'?'date':cc.tipo==='float'?'number':'text'}
                value={form[cc.nome_coluna]}
                onChange={e=>setForm(p=>({...p,[cc.nome_coluna]:e.target.value}))}
                slotProps={cc.tipo==='date'?{ inputLabel:{ shrink:true } }:undefined}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModal({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} variant="contained"
            sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, px:3, '&:hover':{ backgroundColor:'#1e40af' } }}>
            {salvando?<CircularProgress size={18} color="inherit"/>:'Salvar cadastro'}
          </Button>
        </DialogActions>
      </Dialog>

      <ModalExclusao open={modalExc.open} nome={modalExc.item?.nome} onConfirm={excluir} onCancel={()=>setModalExc({open:false})} loading={excluindo} />
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ABA FORNECEDORES
// ══════════════════════════════════════════════════════════════════════════════
const AbaFornecedores = () => {
  const { token, usuario } = useAuth();
  const isAdmin = ['SuperUsuario','Administrador'].includes(usuario?.perfil);
  const camposCustom = useCamposCustom('fornecedor');
  const { nomeDe, obrigatorioDe } = useNomesCampos('fornecedor');
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [alerta, setAlerta] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [modal, setModal] = useState({ open:false, modo:'criar', item:null });
  const [modalExc, setModalExc] = useState({ open:false, item:null });
  const VAZIO = { razao_social:'', nome_fantasia:'', cnpj:'', segmento:'', cidade:'', uf:'', status:'Ativo', contato:'', telefone:'', email:'',
    custom01:'', custom02:'', custom03:'', custom04:'' };
  const [form, setForm] = useState(VAZIO);

  const formatarCustom = (valor, tipo) => {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (tipo === 'float') return Number(valor).toLocaleString('pt-BR');
    return valor;
  };

  const carregar = async () => {
    setCarregando(true);
    try { const res = await apiGetFornecedores(token); setLista(res.data); } catch(e){ console.error(e); }
    finally { setCarregando(false); }
  };
  useEffect(()=>{ carregar(); },[]);

  const filtrado = lista.filter(f=>
    f.razao_social.toLowerCase().includes(busca.toLowerCase())||
    f.cnpj.includes(busca)||f.segmento.toLowerCase().includes(busca.toLowerCase())
  );

  const abrirEditar = (item) => {
    setForm({ razao_social:item.razao_social||'', nome_fantasia:item.nome_fantasia||'', cnpj:item.cnpj||'',
               segmento:item.segmento||'', cidade:item.cidade||'', uf:item.uf||'', status:item.status||'Ativo',
               contato:item.contato||'', telefone:item.telefone||'', email:item.email||'',
               custom01:item.custom01||'', custom02:item.custom02||'', custom03:item.custom03||'', custom04:item.custom04??'' });
    setModal({ open:true, modo:'editar', item });
  };

  const salvar = async () => {
    if (!form.razao_social||!form.cnpj){ setAlerta({ tipo:'error', msg:'Razão Social e CNPJ obrigatórios.' }); return; }
    const campoPadraoFaltante = ['cidade','uf','contato','segmento'].find(c => obrigatorioDe(c) && !form[c]);
    if (campoPadraoFaltante) { setAlerta({ tipo:'error', msg:`O campo "${nomeDe(campoPadraoFaltante,campoPadraoFaltante)}" é obrigatório.` }); return; }
    const faltante = camposCustom.find(c => c.obrigatorio && !form[c.nome_coluna]);
    if (faltante) { setAlerta({ tipo:'error', msg:`O campo "${faltante.nome}" é obrigatório.` }); return; }
    setSalvando(true);
    try {
      if (modal.modo==='criar') await apiCreateFornecedor(token, form);
      else await apiUpdateFornecedor(token, modal.item.id, form);
      await carregar(); setModal({open:false});
      setAlerta({ tipo:'success', msg:`Fornecedor ${modal.modo==='criar'?'cadastrado':'atualizado'}!` });
    } catch { setAlerta({ tipo:'error', msg:'Erro ao salvar.' }); }
    finally { setSalvando(false); }
  };

  const excluir = async () => {
    setExcluindo(true);
    try { await apiDeleteFornecedor(token, modalExc.item.id); await carregar(); setModalExc({open:false}); setAlerta({ tipo:'success', msg:'Fornecedor excluído.' }); }
    catch { setAlerta({ tipo:'error', msg:'Erro ao excluir.' }); }
    finally { setExcluindo(false); }
  };

  const reativar = async (item) => {
    try { await apiReativarFornecedor(token, item.id); await carregar(); setAlerta({ tipo:'success', msg:'Fornecedor reativado.' }); }
    catch { setAlerta({ tipo:'error', msg:'Erro ao reativar.' }); }
  };

  const exportar = () => {
    const ws = XLSX.utils.json_to_sheet(filtrado.map(f=>({ ID:f.id,'Razão Social':f.razao_social, CNPJ:f.cnpj, Segmento:f.segmento, 'Cidade/UF':`${f.cidade}/${f.uf}`, Contato:f.contato, Status:f.status })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Fornecedores'); XLSX.writeFile(wb,'fornecedores.xlsx');
  };

  return (
    <>
      {alerta&&<Alert severity={alerta.tipo} onClose={()=>setAlerta(null)} sx={{ mb:2, borderRadius:2 }}>{alerta.msg}</Alert>}
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2, flexWrap:'wrap', gap:1 }}>
        <TextField size="small" placeholder="Buscar…" value={busca} onChange={e=>setBusca(e.target.value)}
          InputProps={{ startAdornment:<InputAdornment position="start"><SearchOutlined sx={{ fontSize:18, color:'text.secondary' }} /></InputAdornment> }}
          sx={{ width:{ xs:'100%', sm:300 }, '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }} />
        <Box sx={{ display:'flex', gap:1 }}>
          <Button size="small" variant="outlined" startIcon={<FileDownloadOutlined />} onClick={exportar}
            sx={{ textTransform:'none', borderColor:'divider', color:'text.secondary', borderRadius:1.5 }}>Exportar</Button>
          {isAdmin && (
            <Button size="small" variant="contained" startIcon={<AddOutlined />} onClick={()=>{ setForm(VAZIO); setModal({open:true,modo:'criar'}); }}
              sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, '&:hover':{ backgroundColor:'#1e40af' } }}>
              Novo fornecedor
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ borderRadius:2.5, border:'1px solid', borderColor:'divider', overflow:'hidden' }}>
        {carregando ? <Box sx={{ display:'flex', justifyContent:'center', p:4 }}><CircularProgress size={28} /></Box> : (
          <TableContainer><Table size="small">
            <TableHead sx={{ backgroundColor:'action.hover' }}>
              <TableRow>{[
                'ID', nomeDe('razao_social','Razão Social'), nomeDe('cnpj','CNPJ'), nomeDe('segmento','Segmento'),
                nomeDe('cidade','Cidade'), nomeDe('uf','UF'), nomeDe('contato','Contato'), 'Status',
                ...camposCustom.map(c=>c.nome), ''
              ].map((h,idx)=>(
                <TableCell key={`${h}-${idx}`} sx={{ fontWeight:700, fontSize:12, color:'text.secondary', border:0 }}>{h}</TableCell>
              ))}</TableRow>
            </TableHead>
            <TableBody>
              {filtrado.map((f,i)=>(
                <TableRow key={f.id} sx={{ '&:hover':{ backgroundColor:'action.hover' }, backgroundColor:i%2?'action.hover':'background.paper' }}>
                  <TableCell sx={{ fontSize:11, color:'text.secondary', border:0 }}>{f.id}</TableCell>
                  <TableCell sx={{ fontSize:12, fontWeight:600, color:'text.primary', border:0 }}>{f.razao_social}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{f.cnpj}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.primary', border:0 }}>{f.segmento}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{f.cidade}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{f.uf}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.primary', border:0 }}>{f.contato}</TableCell>
                  <TableCell sx={{ border:0 }}><StatusBadge ativo={f.status==='Ativo'} /></TableCell>
                  {camposCustom.map(c=>(
                    <TableCell key={c.nome_coluna} sx={{ fontSize:12, color:'text.secondary', border:0, whiteSpace:'nowrap' }}>
                      {formatarCustom(f[c.nome_coluna], c.tipo)}
                    </TableCell>
                  ))}
                  <TableCell sx={{ border:0 }}>
                    {isAdmin && (
                      f.status === 'Inativo' ? (
                        <Tooltip title="Reativar fornecedor">
                          <IconButton size="small" onClick={()=>reativar(f)} sx={{ color:'#16a34a', '&:hover':{ backgroundColor:'#dcfce7' } }}>
                            <RestartAltOutlined sx={{ fontSize:16 }} />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <AcoesCell onEdit={()=>abrirEditar(f)} onDelete={()=>setModalExc({open:true,item:f})} />
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtrado.length===0&&<TableRow><TableCell colSpan={9+camposCustom.length} sx={{ textAlign:'center', color:'text.secondary', py:4, border:0 }}>Nenhum resultado.</TableCell></TableRow>}
            </TableBody>
          </Table></TableContainer>
        )}
      </Paper>

      <Dialog open={modal.open} onClose={()=>setModal({open:false})} maxWidth="sm" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ display:'flex', alignItems:'center', gap:1, fontWeight:700, color:'text.primary', pb:1 }}>
          <BusinessOutlined sx={{ color:'#1d4ed8' }} />
          {modal.modo==='criar'?'Cadastro de Fornecedor':'Editar Fornecedor'}
        </DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:'16px !important' }}>
          <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'1fr 1fr' }, gap:2 }}>
            <Campo label={`${nomeDe('razao_social','Razão Social')} *`} value={form.razao_social} onChange={e=>setForm(p=>({...p,razao_social:e.target.value}))} sx={{ gridColumn:'1 / -1' }} />
            <Campo label="Nome Fantasia"  value={form.nome_fantasia} onChange={e=>setForm(p=>({...p,nome_fantasia:e.target.value}))} />
            <Campo label={`${nomeDe('cnpj','CNPJ')} *`} value={form.cnpj}          onChange={e=>setForm(p=>({...p,cnpj:e.target.value}))} placeholder="00.000.000/0000-00" />
            <SelField label={nomeDe('segmento','Segmento')} value={form.segmento}      onChange={e=>setForm(p=>({...p,segmento:e.target.value}))} opcoes={['TI','Software','Consultoria','Suporte','Infraestrutura','Outro']} />
            <Campo label={`${nomeDe('cidade','Cidade')}${obrigatorioDe('cidade')?' *':''}`} value={form.cidade}        onChange={e=>setForm(p=>({...p,cidade:e.target.value}))} />
            <Campo label={`${nomeDe('uf','UF')}${obrigatorioDe('uf')?' *':''}`}             value={form.uf}            onChange={e=>setForm(p=>({...p,uf:e.target.value}))} />
            {camposCustom.map(c=>(
              <Campo key={c.nome_coluna}
                label={`${c.nome}${c.obrigatorio?' *':''}`}
                type={c.tipo==='date'?'date':c.tipo==='float'?'number':'text'}
                value={form[c.nome_coluna]}
                onChange={e=>setForm(p=>({...p,[c.nome_coluna]:e.target.value}))}
                slotProps={c.tipo==='date'?{ inputLabel:{ shrink:true } }:undefined}
              />
            ))}
            <Campo label={`${nomeDe('contato','Contato')}${obrigatorioDe('contato')?' *':''}`} value={form.contato}       onChange={e=>setForm(p=>({...p,contato:e.target.value}))} />
            <Campo label="Telefone"       value={form.telefone}      onChange={e=>setForm(p=>({...p,telefone:e.target.value}))} />
            <Campo label="E-mail"         value={form.email}         onChange={e=>setForm(p=>({...p,email:e.target.value}))} sx={{ gridColumn:'1 / -1' }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModal({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} variant="contained"
            sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, px:3, '&:hover':{ backgroundColor:'#1e40af' } }}>
            {salvando?<CircularProgress size={18} color="inherit"/>:'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>
      <ModalExclusao open={modalExc.open} nome={modalExc.item?.razao_social} onConfirm={excluir} onCancel={()=>setModalExc({open:false})} loading={excluindo} />
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ABA USUÁRIOS  (Admin vê todos; Usuário comum vê só a si mesmo)
// ══════════════════════════════════════════════════════════════════════════════
// Fornecedor e Liderança não são selecionáveis: são automáticos (Fornecedor quando há um
// fornecedor vinculado; Liderança quando o usuário é referenciado como líder de um consultor).
const PERFIS_DISPONIVEIS = ['Administrador','Usuário'];

const AbaUsuarios = () => {
  const { token, usuario } = useAuth();
  const camposCustom = useCamposCustom('usuario');
  const { nomeDe, obrigatorioDe } = useNomesCampos('usuario');
  const [lista, setLista] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [alerta, setAlerta] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [modal, setModal] = useState({ open:false, modo:'criar', item:null });
  const [modalExc, setModalExc] = useState({ open:false, item:null });
  const FORM_VAZIO = {
    nome:'', email:'', senha:'', perfil:'Usuário', cpf:'', telefone:'', departamento:'',
    cargo:'', status:'Ativo', id_fornecedor:'', empresa_id:'',
    custom01:'', custom02:'', custom03:'', custom04:''
  };
  const [form, setForm] = useState(FORM_VAZIO);

  const formatarCustom = (valor, tipo) => {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (tipo === 'float') return Number(valor).toLocaleString('pt-BR');
    return valor;
  };

  const isAdmin = ['SuperUsuario','Administrador'].includes(usuario?.perfil);
  const isSuper = usuario?.perfil === 'SuperUsuario';
  // GET /usuarios (lista completa) só é permitido a esses perfis no backend — os demais
  // (Usuário, Fornecedor) só podem consultar o próprio cadastro via GET /usuarios/{id}.
  const podeListarTodos = ['SuperUsuario','Administrador','Liderança'].includes(usuario?.perfil);
  // Edição autoaplicada (Administrador/SuperUsuario) vs. autoedição que fica pendente de
  // aprovação (qualquer outro perfil editando o próprio cadastro).
  const autoEdicaoPendente = modal.item && modal.item.id === usuario?.id && !isAdmin;

  const carregar = async () => {
    setCarregando(true);
    try {
      const [resUsuarios, resFornecedores, resEmpresas] = await Promise.all([
        podeListarTodos ? apiGetUsuarios(token) : apiGetUsuarioById(token, usuario.id).then(r=>({ data:[r.data] })),
        isAdmin ? apiGetFornecedores(token) : Promise.resolve({ data:[] }),
        isSuper ? apiGetEmpresas(token) : Promise.resolve({ data:[] })
      ]);
      // Usuário comum vê apenas a si mesmo
      const dados = isAdmin ? resUsuarios.data : resUsuarios.data.filter(u => u.id === usuario.id);
      setLista(dados);
      setFornecedores(resFornecedores.data);
      setEmpresas(resEmpresas.data);
    } catch(e){ console.error(e); }
    finally { setCarregando(false); }
  };
  useEffect(()=>{ carregar(); },[]);

  const abrirCriar = () => { setForm(FORM_VAZIO); setModal({ open:true, modo:'criar' }); };
  const abrirEditar = (item) => {
    setForm({
      nome:item.nome||'', email:item.email||'', senha:'', perfil:item.perfil||'Usuário',
      cpf:item.cpf||'', telefone:item.telefone||'', departamento:item.departamento||'',
      cargo:item.cargo||'', status:item.status||'Ativo', id_fornecedor:item.id_fornecedor||'',
      empresa_id:item.empresa_id||'',
      custom01:item.custom01||'', custom02:item.custom02||'', custom03:item.custom03||'', custom04:item.custom04??''
    });
    setModal({ open:true, modo:'editar', item });
  };

  const filtrado = lista.filter(u =>
    u.nome?.toLowerCase().includes(busca.toLowerCase())||
    u.email?.toLowerCase().includes(busca.toLowerCase())||
    u.perfil?.toLowerCase().includes(busca.toLowerCase())
  );

  const salvar = async () => {
    if (modal.modo === 'criar' && (!form.nome || !form.email || !form.senha)) {
      setAlerta({ tipo:'error', msg:'Nome, e-mail e senha são obrigatórios.' });
      return;
    }
    const campoPadraoFaltante = ['cpf','telefone','departamento','cargo'].find(c => obrigatorioDe(c) && !form[c]);
    if (campoPadraoFaltante) { setAlerta({ tipo:'error', msg:`O campo "${nomeDe(campoPadraoFaltante,campoPadraoFaltante)}" é obrigatório.` }); return; }
    const faltante = camposCustom.find(c => c.obrigatorio && !form[c.nome_coluna]);
    if (faltante) { setAlerta({ tipo:'error', msg:`O campo "${faltante.nome}" é obrigatório.` }); return; }
    setSalvando(true);
    // Numa autoedição (não-admin editando o próprio cadastro), só os campos não sensíveis
    // podem ir no payload — o backend rejeita se qualquer outro campo vier presente,
    // mesmo que com o valor inalterado.
    const payload = autoEdicaoPendente
      ? { nome:form.nome, telefone:form.telefone, departamento:form.departamento, cargo:form.cargo,
          custom01:form.custom01||null, custom02:form.custom02, custom03:form.custom03, custom04:form.custom04||null,
          ...(form.senha ? { senha:form.senha } : {}) }
      : { ...form, id_fornecedor: form.id_fornecedor || null, empresa_id: form.empresa_id || null };
    try {
      if (modal.modo === 'criar') {
        await apiCreateUsuario(token, payload);
        setAlerta({ tipo:'success', msg:'Usuário cadastrado com sucesso!' });
      } else {
        const res = await apiUpdateUsuario(token, modal.item.id, payload);
        setAlerta(res.data.edicao_status === 'Pendente'
          ? { tipo:'success', msg:'Edição enviada! Ficará pendente até o Administrador da sua empresa aprovar.' }
          : { tipo:'success', msg:'Usuário atualizado com sucesso!' });
      }
      await carregar(); setModal({open:false});
    } catch (e) { setAlerta({ tipo:'error', msg: e.message || 'Erro ao salvar.' }); }
    finally { setSalvando(false); }
  };

  const excluir = async () => {
    setExcluindo(true);
    try { await apiDeleteUsuario(token, modalExc.item.id); await carregar(); setModalExc({open:false}); setAlerta({ tipo:'success', msg:'Usuário removido.' }); }
    catch { setAlerta({ tipo:'error', msg:'Erro ao excluir.' }); }
    finally { setExcluindo(false); }
  };

  const [modalAprovEdicao, setModalAprovEdicao] = useState({ open:false, item:null, acao:null });
  const [justAprovEdicao, setJustAprovEdicao] = useState('');
  const [aprovandoEdicao, setAprovandoEdicao] = useState(false);

  const abrirAprovacaoEdicao = (item, acao) => { setJustAprovEdicao(''); setModalAprovEdicao({ open:true, item, acao }); };
  const confirmarAprovacaoEdicao = async () => {
    if (modalAprovEdicao.acao === 'Recusado' && !justAprovEdicao.trim()) {
      setAlerta({ tipo:'error', msg:'Justificativa é obrigatória para recusar a edição.' });
      return;
    }
    setAprovandoEdicao(true);
    try {
      await apiAprovarEdicaoUsuario(token, modalAprovEdicao.item.id, modalAprovEdicao.acao, justAprovEdicao);
      setAlerta({ tipo:'success', msg:`Edição ${modalAprovEdicao.acao==='Aprovado'?'aprovada':'recusada'}.` });
      setModalAprovEdicao({ open:false, item:null, acao:null });
      await carregar();
    } catch { setAlerta({ tipo:'error', msg:'Erro ao processar aprovação.' }); }
    finally { setAprovandoEdicao(false); }
  };

  const exportar = () => {
    const ws = XLSX.utils.json_to_sheet(filtrado.map(u=>({ ID:u.id, Nome:`${u.nome} ${u.sobrenome||''}`, Email:u.email, Perfil:u.perfil, Departamento:u.departamento, Cargo:u.cargo, Status:u.status })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Usuários'); XLSX.writeFile(wb,'usuarios.xlsx');
  };

  return (
    <>
      {alerta&&<Alert severity={alerta.tipo} onClose={()=>setAlerta(null)} sx={{ mb:2, borderRadius:2 }}>{alerta.msg}</Alert>}

      {!isAdmin && (
        <Alert severity="info" sx={{ mb:2, borderRadius:2 }}>
          Como usuário, você pode visualizar e editar apenas seus próprios dados de perfil.
        </Alert>
      )}

      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2, flexWrap:'wrap', gap:1 }}>
        <TextField size="small" placeholder="Buscar…" value={busca} onChange={e=>setBusca(e.target.value)}
          InputProps={{ startAdornment:<InputAdornment position="start"><SearchOutlined sx={{ fontSize:18, color:'text.secondary' }} /></InputAdornment> }}
          sx={{ width:{ xs:'100%', sm:300 }, '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }} />
        <Box sx={{ display:'flex', gap:1 }}>
          <Button size="small" variant="outlined" startIcon={<FileDownloadOutlined />} onClick={exportar}
            sx={{ textTransform:'none', borderColor:'divider', color:'text.secondary', borderRadius:1.5 }}>Exportar</Button>
          {isAdmin && (
            <Button size="small" variant="contained" startIcon={<AddOutlined />} onClick={abrirCriar}
              sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, '&:hover':{ backgroundColor:'#1e40af' } }}>
              Novo usuário
            </Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ borderRadius:2.5, border:'1px solid', borderColor:'divider', overflow:'hidden' }}>
        {carregando ? <Box sx={{ display:'flex', justifyContent:'center', p:4 }}><CircularProgress size={28} /></Box> : (
          <TableContainer><Table size="small">
            <TableHead sx={{ backgroundColor:'action.hover' }}>
              <TableRow>{['ID','Nome','E-mail','Perfil',nomeDe('departamento','Departamento'),nomeDe('cargo','Cargo'),'Status',...camposCustom.map(c=>c.nome),''].map((h,idx)=>(
                <TableCell key={`${h}-${idx}`} sx={{ fontWeight:700, fontSize:12, color:'text.secondary', border:0 }}>{h}</TableCell>
              ))}</TableRow>
            </TableHead>
            <TableBody>
              {filtrado.map((u,i)=>(
                <TableRow key={u.id} sx={{ '&:hover':{ backgroundColor:'action.hover' }, backgroundColor:i%2?'action.hover':'background.paper' }}>
                  <TableCell sx={{ fontSize:11, color:'text.secondary', border:0 }}>{u.id}</TableCell>
                  <TableCell sx={{ fontSize:12, fontWeight:600, color:'text.primary', border:0 }}>{u.nome} {u.sobrenome}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{u.email}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.primary', border:0 }}>{u.perfil}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{u.departamento||'—'}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{u.cargo||'—'}</TableCell>
                  <TableCell sx={{ border:0 }}>
                    <StatusBadge ativo={u.status==='Ativo'} />
                    {u.edicao_status==='Pendente' && (
                      <Typography variant="caption" sx={{ display:'block', color:'#854d0e', fontWeight:700 }}>
                        Edição pendente
                      </Typography>
                    )}
                    {u.edicao_status==='Recusada' && (
                      <Typography variant="caption" sx={{ display:'block', color:'#991b1b', fontWeight:700 }}>
                        Edição recusada
                      </Typography>
                    )}
                  </TableCell>
                  {camposCustom.map(cc=>(
                    <TableCell key={cc.nome_coluna} sx={{ fontSize:12, color:'text.secondary', border:0, whiteSpace:'nowrap' }}>
                      {formatarCustom(u[cc.nome_coluna], cc.tipo)}
                    </TableCell>
                  ))}
                  <TableCell sx={{ border:0 }}>
                    <Box sx={{ display:'flex', gap:0.5, alignItems:'center' }}>
                      <AcoesCell onEdit={()=>abrirEditar(u)} onDelete={()=>setModalExc({open:true,item:u})} podeDeletar={isAdmin&&u.id!==usuario.id} />
                      {isAdmin && u.edicao_status==='Pendente' && (
                        <>
                          <Tooltip title="Aprovar edição">
                            <IconButton size="small" onClick={()=>abrirAprovacaoEdicao(u,'Aprovado')} sx={{ color:'#16a34a', '&:hover':{ backgroundColor:'#dcfce7' } }}>
                              <CheckCircleOutlined sx={{ fontSize:16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Recusar edição">
                            <IconButton size="small" onClick={()=>abrirAprovacaoEdicao(u,'Recusado')} sx={{ color:'#dc2626', '&:hover':{ backgroundColor:'#fee2e2' } }}>
                              <CancelOutlined sx={{ fontSize:16 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {filtrado.length===0&&<TableRow><TableCell colSpan={8+camposCustom.length} sx={{ textAlign:'center', color:'text.secondary', py:4, border:0 }}>Nenhum resultado.</TableCell></TableRow>}
            </TableBody>
          </Table></TableContainer>
        )}
      </Paper>

      {/* Modal form */}
      <Dialog open={modal.open} onClose={()=>setModal({open:false})} maxWidth="sm" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ display:'flex', alignItems:'center', gap:1, fontWeight:700, color:'text.primary', pb:1 }}>
          <PersonOutlined sx={{ color:'#1d4ed8' }} />
          {modal.modo==='criar'?'Cadastro de Usuário':'Editar Usuário'}
        </DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:'16px !important' }}>
          {autoEdicaoPendente && (
            <Alert severity="warning" sx={{ borderRadius:1.5 }}>
              Você está editando seu próprio cadastro: só os campos não sensíveis (nome, telefone, departamento, cargo e campos customizados) podem ser alterados, e a edição ficará pendente até o Administrador da sua empresa aprovar.
            </Alert>
          )}
          <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'1fr 1fr' }, gap:2 }}>
            <Campo label="Nome *"        value={form.nome||''}          onChange={e=>setForm(p=>({...p,nome:e.target.value}))} sx={{ gridColumn:'1 / -1' }} />
            <Campo label="E-mail *"      value={form.email||''}         onChange={e=>setForm(p=>({...p,email:e.target.value}))} disabled={modal.modo==='editar'} />
            <SelField label="Perfil *"   value={form.perfil} onChange={e=>setForm(p=>({...p,perfil:e.target.value}))} opcoes={PERFIS_DISPONIVEIS} disabled={modal.modo==='editar'} />
            {modal.modo==='criar' && (
              <Campo label="Senha *"     type="password" value={form.senha||''} onChange={e=>setForm(p=>({...p,senha:e.target.value}))} sx={{ gridColumn:'1 / -1' }} />
            )}
            {form.perfil!=='Administrador' && (
              <Autocomplete
                sx={{ gridColumn:'1 / -1' }}
                size="small"
                disabled={autoEdicaoPendente}
                options={fornecedores}
                getOptionLabel={(f)=>f.razao_social?`${f.id} — ${f.razao_social}`:''}
                isOptionEqualToValue={(o,v)=>o.id===v.id}
                value={fornecedores.find(f=>f.id===form.id_fornecedor)||null}
                onChange={(_,v)=>setForm(p=>({...p,id_fornecedor:v?v.id:''}))}
                renderInput={(params)=><TextField {...params} label="Fornecedor representado" placeholder="Vincular torna o perfil Fornecedor automaticamente" />}
              />
            )}
            {isSuper && modal.modo==='criar' && (
              <Autocomplete
                sx={{ gridColumn:'1 / -1' }}
                size="small"
                options={empresas}
                getOptionLabel={(e)=>e.nome?`${e.id} — ${e.nome}`:''}
                isOptionEqualToValue={(o,v)=>o.id===v.id}
                value={empresas.find(e=>e.id===form.empresa_id)||null}
                onChange={(_,v)=>setForm(p=>({...p,empresa_id:v?v.id:''}))}
                renderInput={(params)=><TextField {...params} label="Empresa *" placeholder="Selecione a empresa" />}
              />
            )}
            <Campo label={`${nomeDe('cpf','CPF')}${obrigatorioDe('cpf')?' *':''}`}           value={form.cpf||''}           onChange={e=>setForm(p=>({...p,cpf:e.target.value}))} disabled={autoEdicaoPendente} />
            <Campo label={`${nomeDe('telefone','Telefone')}${obrigatorioDe('telefone')?' *':''}`}      value={form.telefone||''}      onChange={e=>setForm(p=>({...p,telefone:e.target.value}))} />
            <Campo label={`${nomeDe('departamento','Departamento')}${obrigatorioDe('departamento')?' *':''}`}  value={form.departamento||''} onChange={e=>setForm(p=>({...p,departamento:e.target.value}))} />
            <Campo label={`${nomeDe('cargo','Cargo')}${obrigatorioDe('cargo')?' *':''}`}         value={form.cargo||''}         onChange={e=>setForm(p=>({...p,cargo:e.target.value}))} />
            <SelField label="Status" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))} opcoes={['Ativo','Inativo']} disabled={autoEdicaoPendente} />
            {camposCustom.map(cc=>(
              <Campo key={cc.nome_coluna}
                label={`${cc.nome}${cc.obrigatorio?' *':''}`}
                type={cc.tipo==='date'?'date':cc.tipo==='float'?'number':'text'}
                value={form[cc.nome_coluna]}
                onChange={e=>setForm(p=>({...p,[cc.nome_coluna]:e.target.value}))}
                slotProps={cc.tipo==='date'?{ inputLabel:{ shrink:true } }:undefined}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModal({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} variant="contained"
            sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, px:3, '&:hover':{ backgroundColor:'#1e40af' } }}>
            {salvando?<CircularProgress size={18} color="inherit"/>:'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <ModalExclusao open={modalExc.open} nome={`${modalExc.item?.nome} ${modalExc.item?.sobrenome||''}`} onConfirm={excluir} onCancel={()=>setModalExc({open:false})} loading={excluindo} />

      {/* Modal de aprovação/recusa da autoedição de usuário */}
      <Dialog open={modalAprovEdicao.open} onClose={()=>setModalAprovEdicao({open:false})} maxWidth="sm" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ fontWeight:700, color:'text.primary', pb:1 }}>
          {modalAprovEdicao.acao==='Aprovado' ? '✅ Aprovar edição de cadastro' : '❌ Recusar edição de cadastro'}
        </DialogTitle>
        <DialogContent sx={{ pt:'12px !important', display:'flex', flexDirection:'column', gap:2 }}>
          {modalAprovEdicao.item && (
            <Box sx={{ p:2, backgroundColor:'action.hover', borderRadius:2, border:'1px solid', borderColor:'divider' }}>
              <Typography variant="body2" fontWeight={600} sx={{ color:'text.primary' }}>{modalAprovEdicao.item.nome}</Typography>
              <Typography variant="caption" sx={{ color:'text.secondary' }}>
                Campos propostos: {modalAprovEdicao.item.dados_pendentes && Object.keys(JSON.parse(modalAprovEdicao.item.dados_pendentes)).join(', ')}
              </Typography>
            </Box>
          )}
          {modalAprovEdicao.acao === 'Recusado' && (
            <TextField label="Justificativa *" multiline rows={3} fullWidth
              value={justAprovEdicao} onChange={e=>setJustAprovEdicao(e.target.value)}
              placeholder="Descreva o motivo da recusa..."
              sx={{ '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }} />
          )}
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModalAprovEdicao({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={confirmarAprovacaoEdicao} variant="contained" disabled={aprovandoEdicao}
            sx={{ textTransform:'none', borderRadius:1.5, px:3,
                  backgroundColor: modalAprovEdicao.acao==='Aprovado' ? '#16a34a' : '#dc2626',
                  '&:hover':{ backgroundColor: modalAprovEdicao.acao==='Aprovado' ? '#15803d' : '#b91c1c' } }}>
            {aprovandoEdicao ? <CircularProgress size={18} color="inherit" /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ABA EMPRESAS
// SuperUsuario: cria empresas e aprova/recusa edições pendentes de qualquer empresa.
// Administrador: só vê e edita a própria empresa; a edição fica pendente de aprovação.
// ══════════════════════════════════════════════════════════════════════════════
const AprovacaoBadge = ({ status }) => {
  const map = {
    Aprovado: { bg:'#dcfce7', color:'#166534' },
    Pendente: { bg:'#fef9c3', color:'#854d0e' },
    Recusado: { bg:'#fee2e2', color:'#991b1b' }
  };
  const s = map[status] || map.Aprovado;
  return (
    <Box sx={{ display:'inline-flex', alignItems:'center', gap:0.5, px:1.5, py:0.4, borderRadius:99,
               fontSize:11, fontWeight:700, backgroundColor:s.bg, color:s.color }}>
      <Box sx={{ width:6, height:6, borderRadius:'50%', backgroundColor:'currentColor' }} />
      {status}
    </Box>
  );
};

const AbaEmpresas = () => {
  const { token, usuario } = useAuth();
  const isSuper = usuario?.perfil === 'SuperUsuario';
  const camposCustom = useCamposCustom('empresa');
  const { nomeDe, obrigatorioDe } = useNomesCampos('empresa');
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [alerta, setAlerta] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [modal, setModal] = useState({ open:false, modo:'criar', item:null });
  const [modalAprovar, setModalAprovar] = useState({ open:false, item:null, acao:null });
  const [justificativaRecusa, setJustificativaRecusa] = useState('');
  const VAZIO = { nome:'', cnpj:'', telefone:'', email_contato:'', endereco:'', custom01:'', custom02:'', custom03:'', custom04:'' };
  const [form, setForm] = useState(VAZIO);

  const formatarCustom = (valor, tipo) => {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (tipo === 'float') return Number(valor).toLocaleString('pt-BR');
    return valor;
  };

  const carregar = async () => {
    setCarregando(true);
    try {
      const res = isSuper ? await apiGetEmpresas(token) : await apiGetEmpresaById(token, usuario.empresa_id);
      setLista(isSuper ? res.data : [res.data]);
    } catch(e){ console.error(e); }
    finally { setCarregando(false); }
  };
  useEffect(()=>{ carregar(); },[]);

  const filtrado = lista.filter(e =>
    e.nome?.toLowerCase().includes(busca.toLowerCase()) || e.id?.toLowerCase().includes(busca.toLowerCase())
  );

  const abrirCriar = () => { setForm(VAZIO); setModal({ open:true, modo:'criar' }); };
  const abrirEditar = (item) => {
    setForm({
      nome:item.nome||'', cnpj:item.cnpj||'', telefone:item.telefone||'',
      email_contato:item.email_contato||'', endereco:item.endereco||'',
      custom01:item.custom01||'', custom02:item.custom02||'', custom03:item.custom03||'', custom04:item.custom04??''
    });
    setModal({ open:true, modo:'editar', item });
  };

  const salvar = async () => {
    if (!form.nome) { setAlerta({ tipo:'error', msg:'Nome da empresa é obrigatório.' }); return; }
    const campoPadraoFaltante = ['cnpj','telefone','email_contato','endereco'].find(c => obrigatorioDe(c) && !form[c]);
    if (campoPadraoFaltante) { setAlerta({ tipo:'error', msg:`O campo "${nomeDe(campoPadraoFaltante,campoPadraoFaltante)}" é obrigatório.` }); return; }
    const faltante = camposCustom.find(c => c.obrigatorio && !form[c.nome_coluna]);
    if (faltante) { setAlerta({ tipo:'error', msg:`O campo "${faltante.nome}" é obrigatório.` }); return; }
    setSalvando(true);
    try {
      if (modal.modo === 'criar') {
        await apiCreateEmpresa(token, form);
        setAlerta({ tipo:'success', msg:'Empresa cadastrada com sucesso!' });
      } else {
        await apiUpdateEmpresa(token, modal.item.id, form);
        setAlerta(isSuper
          ? { tipo:'success', msg:'Empresa atualizada com sucesso!' }
          : { tipo:'success', msg:'Edição enviada! Suas alterações ficarão pendentes até o SuperUsuario aprovar.' });
      }
      await carregar();
      setModal({ open:false });
    } catch { setAlerta({ tipo:'error', msg:'Erro ao salvar.' }); }
    finally { setSalvando(false); }
  };

  const abrirAprovacao = (item, acao) => { setJustificativaRecusa(''); setModalAprovar({ open:true, item, acao }); };
  const confirmarAprovacao = async () => {
    if (modalAprovar.acao === 'Recusado' && !justificativaRecusa.trim()) {
      setAlerta({ tipo:'error', msg:'Justificativa é obrigatória para recusar a edição.' });
      return;
    }
    setSalvando(true);
    try {
      await apiAprovarEmpresa(token, modalAprovar.item.id, modalAprovar.acao, justificativaRecusa);
      setAlerta({ tipo:'success', msg:`Edição ${modalAprovar.acao === 'Aprovado' ? 'aprovada' : 'recusada'}.` });
      setModalAprovar({ open:false });
      await carregar();
    } catch { setAlerta({ tipo:'error', msg:'Erro ao processar aprovação.' }); }
    finally { setSalvando(false); }
  };

  return (
    <>
      {alerta&&<Alert severity={alerta.tipo} onClose={()=>setAlerta(null)} sx={{ mb:2, borderRadius:2 }}>{alerta.msg}</Alert>}

      {!isSuper && (
        <Alert severity="info" sx={{ mb:2, borderRadius:2 }}>
          Como Administrador, você pode editar os dados da sua empresa, mas a alteração só será aplicada após a aprovação do SuperUsuario.
        </Alert>
      )}

      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2, flexWrap:'wrap', gap:1 }}>
        {isSuper ? (
          <TextField size="small" placeholder="Buscar…" value={busca} onChange={e=>setBusca(e.target.value)}
            InputProps={{ startAdornment:<InputAdornment position="start"><SearchOutlined sx={{ fontSize:18, color:'text.secondary' }} /></InputAdornment> }}
            sx={{ width:{ xs:'100%', sm:300 }, '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }} />
        ) : <Box />}
        {isSuper && (
          <Button size="small" variant="contained" startIcon={<AddOutlined />} onClick={abrirCriar}
            sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, '&:hover':{ backgroundColor:'#1e40af' } }}>
            Nova empresa
          </Button>
        )}
      </Box>

      <Paper sx={{ borderRadius:2.5, border:'1px solid', borderColor:'divider', overflow:'hidden' }}>
        {carregando ? <Box sx={{ display:'flex', justifyContent:'center', p:4 }}><CircularProgress size={28} /></Box> : (
          <TableContainer><Table size="small">
            <TableHead sx={{ backgroundColor:'action.hover' }}>
              <TableRow>{['ID',nomeDe('nome','Nome'),nomeDe('cnpj','CNPJ'),nomeDe('telefone','Telefone'),nomeDe('email_contato','E-mail'),...camposCustom.map(c=>c.nome),'Status de Aprovação',''].map((h,idx)=>(
                <TableCell key={`${h}-${idx}`} sx={{ fontWeight:700, fontSize:12, color:'text.secondary', border:0 }}>{h}</TableCell>
              ))}</TableRow>
            </TableHead>
            <TableBody>
              {filtrado.map((e,i)=>(
                <TableRow key={e.id} sx={{ '&:hover':{ backgroundColor:'action.hover' }, backgroundColor:i%2?'action.hover':'background.paper' }}>
                  <TableCell sx={{ fontSize:11, color:'text.secondary', border:0 }}>{e.id}</TableCell>
                  <TableCell sx={{ fontSize:12, fontWeight:600, color:'text.primary', border:0 }}>{e.nome}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{e.cnpj||'—'}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{e.telefone||'—'}</TableCell>
                  <TableCell sx={{ fontSize:12, color:'text.secondary', border:0 }}>{e.email_contato||'—'}</TableCell>
                  {camposCustom.map(cc=>(
                    <TableCell key={cc.nome_coluna} sx={{ fontSize:12, color:'text.secondary', border:0, whiteSpace:'nowrap' }}>
                      {formatarCustom(e[cc.nome_coluna], cc.tipo)}
                    </TableCell>
                  ))}
                  <TableCell sx={{ border:0 }}>
                    <AprovacaoBadge status={e.status_aprovacao} />
                    {e.status_aprovacao==='Recusado' && e.justificativa_rejeicao && (
                      <Typography variant="caption" sx={{ display:'block', color:'text.secondary', mt:0.5 }}>
                        Motivo: {e.justificativa_rejeicao}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ border:0 }}>
                    <Box sx={{ display:'flex', gap:0.5, alignItems:'center' }}>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={()=>abrirEditar(e)} sx={{ color:'#1d4ed8', '&:hover':{ backgroundColor:'#eff6ff' } }}>
                          <EditOutlined sx={{ fontSize:16 }} />
                        </IconButton>
                      </Tooltip>
                      {isSuper && e.status_aprovacao==='Pendente' && (
                        <>
                          <Tooltip title="Aprovar edição">
                            <IconButton size="small" onClick={()=>abrirAprovacao(e,'Aprovado')} sx={{ color:'#16a34a', '&:hover':{ backgroundColor:'#dcfce7' } }}>
                              <CheckCircleOutlined sx={{ fontSize:16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Recusar edição">
                            <IconButton size="small" onClick={()=>abrirAprovacao(e,'Recusado')} sx={{ color:'#dc2626', '&:hover':{ backgroundColor:'#fee2e2' } }}>
                              <CancelOutlined sx={{ fontSize:16 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {filtrado.length===0&&<TableRow><TableCell colSpan={7+camposCustom.length} sx={{ textAlign:'center', color:'text.secondary', py:4, border:0 }}>Nenhuma empresa encontrada.</TableCell></TableRow>}
            </TableBody>
          </Table></TableContainer>
        )}
      </Paper>

      {/* Modal form */}
      <Dialog open={modal.open} onClose={()=>setModal({open:false})} maxWidth="sm" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ display:'flex', alignItems:'center', gap:1, fontWeight:700, color:'text.primary', pb:1 }}>
          <ApartmentOutlined sx={{ color:'#1d4ed8' }} />
          {modal.modo==='criar'?'Cadastro de Empresa':'Editar dados da Empresa'}
        </DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:'16px !important' }}>
          {!isSuper && modal.modo==='editar' && (
            <Alert severity="warning" sx={{ borderRadius:1.5 }}>
              Esta alteração será enviada para aprovação do SuperUsuario e só será aplicada depois de aprovada.
            </Alert>
          )}
          <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'1fr 1fr' }, gap:2 }}>
            <Campo label={`${nomeDe('nome','Nome da Empresa')} *`} value={form.nome} onChange={e=>setForm(p=>({...p,nome:e.target.value}))} sx={{ gridColumn:'1 / -1' }} />
            <Campo label={`${nomeDe('cnpj','CNPJ')}${obrigatorioDe('cnpj')?' *':''}`}              value={form.cnpj} onChange={e=>setForm(p=>({...p,cnpj:e.target.value}))} placeholder="00.000.000/0000-00" />
            <Campo label={`${nomeDe('telefone','Telefone')}${obrigatorioDe('telefone')?' *':''}`}          value={form.telefone} onChange={e=>setForm(p=>({...p,telefone:e.target.value}))} />
            <Campo label={`${nomeDe('email_contato','E-mail de contato')}${obrigatorioDe('email_contato')?' *':''}`} value={form.email_contato} onChange={e=>setForm(p=>({...p,email_contato:e.target.value}))} />
            <Campo label={`${nomeDe('endereco','Endereço')}${obrigatorioDe('endereco')?' *':''}`}          value={form.endereco} onChange={e=>setForm(p=>({...p,endereco:e.target.value}))} sx={{ gridColumn:'1 / -1' }} />
            {camposCustom.map(cc=>(
              <Campo key={cc.nome_coluna}
                label={`${cc.nome}${cc.obrigatorio?' *':''}`}
                type={cc.tipo==='date'?'date':cc.tipo==='float'?'number':'text'}
                value={form[cc.nome_coluna]}
                onChange={e=>setForm(p=>({...p,[cc.nome_coluna]:e.target.value}))}
                slotProps={cc.tipo==='date'?{ inputLabel:{ shrink:true } }:undefined}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModal({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando} variant="contained"
            sx={{ textTransform:'none', backgroundColor:'#1d4ed8', borderRadius:1.5, px:3, '&:hover':{ backgroundColor:'#1e40af' } }}>
            {salvando?<CircularProgress size={18} color="inherit"/>:(modal.modo==='criar'?'Cadastrar':'Salvar')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de aprovação/recusa */}
      <Dialog open={modalAprovar.open} onClose={()=>setModalAprovar({open:false})} maxWidth="sm" fullWidth PaperProps={{ sx:{ borderRadius:3 } }}>
        <DialogTitle sx={{ fontWeight:700, color:'text.primary', pb:1 }}>
          {modalAprovar.acao==='Aprovado' ? '✅ Aprovar edição da empresa' : '❌ Recusar edição da empresa'}
        </DialogTitle>
        <DialogContent sx={{ pt:'12px !important' }}>
          {modalAprovar.item && (
            <Box sx={{ mb:2, p:2, backgroundColor:'action.hover', borderRadius:2, border:'1px solid', borderColor:'divider' }}>
              <Typography variant="body2" fontWeight={600} sx={{ color:'text.primary' }}>{modalAprovar.item.nome}</Typography>
              <Typography variant="caption" sx={{ color:'text.secondary' }}>
                Solicitado por {modalAprovar.item.solicitado_por} — campos: {modalAprovar.item.dados_pendentes && Object.keys(JSON.parse(modalAprovar.item.dados_pendentes)).join(', ')}
              </Typography>
            </Box>
          )}
          {modalAprovar.acao === 'Recusado' && (
            <TextField label="Justificativa *" multiline rows={3} fullWidth
              value={justificativaRecusa} onChange={e=>setJustificativaRecusa(e.target.value)}
              placeholder="Descreva o motivo da recusa..."
              sx={{ '& .MuiOutlinedInput-root':{ borderRadius:1.5 } }} />
          )}
        </DialogContent>
        <DialogActions sx={{ px:3, pb:2, gap:1 }}>
          <Button onClick={()=>setModalAprovar({open:false})} sx={{ textTransform:'none', color:'text.secondary' }}>Cancelar</Button>
          <Button onClick={confirmarAprovacao} variant="contained" disabled={salvando}
            sx={{ textTransform:'none', borderRadius:1.5, px:3,
                  backgroundColor: modalAprovar.acao==='Aprovado' ? '#16a34a' : '#dc2626',
                  '&:hover':{ backgroundColor: modalAprovar.acao==='Aprovado' ? '#15803d' : '#b91c1c' } }}>
            {salvando ? <CircularProgress size={18} color="inherit" /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export const CadastrosPage = ({ onNavigate }) => {
  const { usuario } = useAuth();

  // Usuário comum só pode ver a aba de usuários (próprio perfil)
  const isUsuario = usuario?.perfil === 'Usuário';
  const podeVerEmpresas = ['SuperUsuario','Administrador'].includes(usuario?.perfil);
  const [aba, setAba] = useState(isUsuario ? 'usuario' : 'fornecedor');

  return (
    <MainLayout idTela="cadastros" tituloTela="CENTRAL DE CADASTROS" onNavigate={onNavigate}>
      <Box sx={{ display:'flex', flexDirection:'column', gap:2.5 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {isUsuario ? 'Visualize e edite seus dados de perfil.' : 'Cadastre, edite e gerencie fornecedores, consultores e usuários.'}
        </Typography>

        {/* Abas — Usuário só vê "Usuário" */}
        <Box sx={{ display:'flex', gap:1.5, flexWrap:'wrap' }}>
          {!isUsuario && (
            <>
              <TabBtn ativo={aba==='fornecedor'} icone={<BusinessOutlined />} rotulo="Fornecedor"          onClick={()=>setAba('fornecedor')} />
              <TabBtn ativo={aba==='consultor'}  icone={<PeopleOutlined />}   rotulo="Consultor / Terceiro" onClick={()=>setAba('consultor')} />
            </>
          )}
          <TabBtn ativo={aba==='usuario'} icone={<PersonOutlined />} rotulo="Usuários" onClick={()=>setAba('usuario')} />
          {podeVerEmpresas && (
            <TabBtn ativo={aba==='empresa'} icone={<ApartmentOutlined />} rotulo="Empresas" onClick={()=>setAba('empresa')} />
          )}
        </Box>

        {aba==='fornecedor' && <AbaFornecedores />}
        {aba==='consultor'  && <AbaConsultores />}
        {aba==='usuario'    && <AbaUsuarios />}
        {aba==='empresa'    && <AbaEmpresas />}
      </Box>
    </MainLayout>
  );
};
