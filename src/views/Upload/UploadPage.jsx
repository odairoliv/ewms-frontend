import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Paper, Typography, Box, Button, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, CircularProgress, TextField, Select, MenuItem, FormControl,
  Pagination, IconButton, Divider, InputAdornment, Tooltip
} from '@mui/material';
import {
  UploadFileOutlined, CheckCircleOutlined, HighlightOffOutlined,
  AccessTimeOutlined, DownloadOutlined, PlayArrowOutlined,
  CloseOutlined, FilterAltOutlined, RestartAltOutlined, SearchOutlined,
  CalendarMonthOutlined
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { apiGetUploads, apiProcessarUpload, apiGetUploadTemplate } from '../../services/api';
import { MainLayout } from '../../components/Layout/MainLayout';
import * as XLSX from 'xlsx';

// ── helpers ──────────────────────────────────────────────────────────────────
const POR_PAG = 5;

// Quantas vezes (e com que intervalo) o front consulta o servidor depois de enviar
// o arquivo, até o processamento assíncrono terminar (status deixar de ser "Processando").
const POLL_INTERVALO_MS = 2000;
const POLL_MAX_TENTATIVAS = 30;

// Converte "29/05/2026 14:30" ou "26/06/2026, 20:52:04" em Date para permitir filtro por período
const paraData = (str) => {
  const m = str?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, d, mes, y] = m;
  return new Date(`${y}-${mes}-${d}`);
};

// Ícone do arquivo Excel (.xlsx), em verde
const ExcelIcon = ({ size = 22 }) => (
  <Box sx={{ width: size, height: size, borderRadius: '5px', backgroundColor: '#16a34a',
             display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <Typography sx={{ color: '#fff', fontSize: size * 0.55, fontWeight: 800, lineHeight: 1 }}>X</Typography>
  </Box>
);

const StatusChip = ({ status }) => {
  const map = {
    Processado:  { bg: '#dcfce7', text: '#166534', label: 'Processado'  },
    Processando: { bg: '#fef9c3', text: '#854d0e', label: 'Processando' },
    Recusado:    { bg: '#fee2e2', text: '#991b1b', label: 'Recusado'    }
  };
  const s = map[status] || map['Processando'];
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1.4, py: 0.3, borderRadius: 99,
               backgroundColor: s.bg, color: s.text, fontWeight: 700, fontSize: 11.5 }}>
      {s.label}
    </Box>
  );
};

// Ícone circular preenchido com tonalidade suave da cor (igual ao protótipo)
const KpiCard = ({ valor, rotulo, cor = '#1d4ed8', icone }) => (
  <Paper sx={{ p: 1.25, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', flex: 1,
               display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
    <Box sx={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: `${cor}1f`,
               display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Box sx={{ color: cor, display: 'flex' }}>{icone}</Box>
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, display: 'block', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
        {rotulo}
      </Typography>
      <Typography variant="h6" fontWeight="800" sx={{ color: 'text.primary' }}>{valor}</Typography>
    </Box>
  </Paper>
);

const LinhaInfo = ({ label, children }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.6 }}>
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
    <Box sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{children}</Box>
  </Box>
);

// ── componente principal ─────────────────────────────────────────────────────
export const UploadPage = ({ onNavigate }) => {
  const { token } = useAuth();
  const [uploads, setUploads] = useState([]);
  const [colunas, setColunas] = useState([]); // template dinâmico por empresa
  const [arquivo, setArquivo] = useState(null);
  const [periodo, setPeriodo] = useState('');
  const [enviando, setEnviando] = useState(false);   // requisição de envio em andamento
  const [acompanhando, setAcompanhando] = useState(null); // upload sendo acompanhado (status "Processando")
  const [resultado, setResultado] = useState(null); // { sucesso, msg, upload }
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const inputRef = useRef();

  // Filtros (rascunho vs. aplicado, para o botão "Filtrar" ter efeito real)
  const [rascunho, setRascunho] = useState({ inicio: '', fim: '', status: 'Todos' });
  const [filtros, setFiltros] = useState({ inicio: '', fim: '', status: 'Todos' });

  const carregarUploads = async () => {
    try {
      const res = await apiGetUploads(token);
      setUploads(res.data);
      return res.data;
    } catch (e) { console.error(e); return []; }
    finally { setCarregando(false); }
  };

  const carregarTemplate = async () => {
    try { const res = await apiGetUploadTemplate(token); setColunas(res.data); }
    catch (e) { console.error(e); }
  };

  useEffect(() => { carregarUploads(); carregarTemplate(); }, []);

  const handleArquivo = (e) => {
    const f = e.target.files?.[0];
    if (f) { setArquivo(f); setResultado(null); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) { setArquivo(f); setResultado(null); }
  };

  const removerArquivo = () => { setArquivo(null); setResultado(null); setAcompanhando(null); };

  // Depois que o servidor aceita o arquivo (202, status "Processando"), o processamento real
  // roda em background — o front só fica perguntando de tempos em tempos se já terminou.
  // Funciona mesmo que o usuário saia da tela e volte, pois o estado real está no servidor.
  const acompanharProcessamento = async (uploadId, tentativa = 0) => {
    if (tentativa >= POLL_MAX_TENTATIVAS) {
      setAcompanhando(null);
      setResultado({ sucesso: false, msg: 'O processamento está demorando mais que o esperado. Verifique o histórico em alguns instantes.' });
      return;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVALO_MS));
    const lista = await carregarUploads();
    const atual = lista.find(u => u.id === uploadId);
    if (!atual || atual.status === 'Processando') {
      acompanharProcessamento(uploadId, tentativa + 1);
      return;
    }
    setAcompanhando(null);
    setPagina(1);
    if (atual.status === 'Processado') {
      setResultado({ sucesso: true, msg: `Arquivo processado com sucesso! ${atual.processadas} linha(s) importada(s).`, upload: atual });
    } else {
      setResultado({ sucesso: false, msg: `Upload recusado: ${atual.erro_detalhe || 'erro não especificado.'}`, upload: atual });
    }
  };

  const processarArquivo = async () => {
    if (!arquivo) return;
    setEnviando(true);
    setResultado(null);
    try {
      const res = await apiProcessarUpload(token, arquivo, periodo);
      setEnviando(false);
      setAcompanhando(res.data);
      await carregarUploads();
      acompanharProcessamento(res.data.id);
    } catch {
      setEnviando(false);
      setResultado({ sucesso: false, msg: 'Falha ao enviar o arquivo. Verifique o formato e tente novamente.' });
    }
  };

  // Baixa um modelo .xlsx com as colunas do template da empresa do usuário logado —
  // colunas obrigatórias vêm marcadas com " *" no próprio cabeçalho.
  const baixarModelo = () => {
    const cabecalho = colunas.map(c => c.obrigatorio ? `${c.nome} *` : c.nome);
    const ws = XLSX.utils.aoa_to_sheet([cabecalho]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'modelo_apontamentos.xlsx');
  };

  const aplicarFiltros = () => { setFiltros(rascunho); setPagina(1); };
  const limparFiltros = () => {
    const vazio = { inicio: '', fim: '', status: 'Todos' };
    setRascunho(vazio); setFiltros(vazio); setPagina(1);
  };

  const filtrado = useMemo(() => uploads.filter(u => {
    const data = paraData(u.data_upload);
    if (filtros.inicio && data && data < new Date(filtros.inicio)) return false;
    if (filtros.fim && data && data > new Date(filtros.fim)) return false;
    if (filtros.status !== 'Todos' && u.status !== filtros.status) return false;
    if (busca && !u.arquivo.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [uploads, filtros, busca]);

  const totalPags = Math.ceil(filtrado.length / POR_PAG) || 1;
  const paginado = filtrado.slice((pagina - 1) * POR_PAG, pagina * POR_PAG);

  const totalUploadados  = uploads.length;
  const totalProcessados = uploads.filter(u => u.status === 'Processado').length;
  const totalRejeitados  = uploads.filter(u => u.status === 'Recusado').length;
  const totalPendentes   = uploads.filter(u => u.status === 'Processando').length;
  const ultimoUpload = uploads[0];

  const BuscaUploads = (
    <TextField
      size="small" placeholder="Buscar uploads…" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }}
      InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
      sx={{ width: { xs: 160, sm: 220 }, backgroundColor: 'background.paper', '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
    />
  );

  return (
    <MainLayout idTela="upload" tituloTela="UPLOAD DE EXCEL" acoesTopo={BuscaUploads} onNavigate={onNavigate}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%', minWidth: 0, flex: 1, minHeight: 0 }}>

        <Typography variant="body2" sx={{ color: 'text.secondary', flexShrink: 0 }}>
          Envie relatórios do SAP em Excel para validação, processamento e consolidação dos dados.
        </Typography>

        {/* KPIs */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 2, flexShrink: 0 }}>
          <KpiCard valor={totalUploadados}  rotulo="Uploads realizados"          cor="#2563eb" icone={<UploadFileOutlined sx={{ fontSize: 19 }} />} />
          <KpiCard valor={totalProcessados} rotulo="Processados com sucesso"     cor="#16a34a" icone={<CheckCircleOutlined sx={{ fontSize: 19 }} />} />
          <KpiCard valor={totalRejeitados}  rotulo="Recusado"                   cor="#dc2626" icone={<HighlightOffOutlined sx={{ fontSize: 19 }} />} />
          <KpiCard valor={totalPendentes}   rotulo="Pendentes de processamento" cor="#9333ea" icone={<AccessTimeOutlined sx={{ fontSize: 19 }} />} />
        </Box>

        {/* Linha principal: envio (esquerda) e detalhes do arquivo (direita) */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1.6fr) minmax(240px,1fr)' }, gap: 2, flexShrink: 0, alignItems: 'start' }}>

          {/* Enviar arquivo — barra compacta para não competir com a tabela por espaço */}
          <Paper sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
            <Box
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => !arquivo && inputRef.current?.click()}
              sx={{
                border: '1.5px dashed', borderColor: arquivo ? '#1d4ed8' : 'divider',
                borderRadius: 2, p: 1, cursor: arquivo ? 'default' : 'pointer',
                backgroundColor: arquivo ? 'rgba(29,78,216,0.08)' : 'action.hover',
                display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
                transition: 'all .2s',
                '&:hover': { borderColor: '#1d4ed8', backgroundColor: 'rgba(29,78,216,0.08)' }
              }}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleArquivo} />

              {!arquivo && (
                <>
                  <ExcelIcon size={28} />
                  <Box sx={{ flex: 1, minWidth: 180 }}>
                    <Typography fontWeight="600" sx={{ color: 'text.primary', fontSize: 13.5 }}>
                      Arraste e solte o arquivo Excel aqui, ou clique para selecionar
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Relatório do SAP (.xlsx) · máx. 10 MB
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined" size="small" startIcon={<DownloadOutlined />}
                    onClick={(e) => { e.stopPropagation(); baixarModelo(); }}
                    sx={{ textTransform: 'none', borderColor: 'divider', color: 'text.secondary', borderRadius: 1.5, flexShrink: 0 }}
                  >
                    Baixar modelo
                  </Button>
                  <Button
                    variant="contained" size="small" startIcon={<UploadFileOutlined />}
                    onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                    sx={{ textTransform: 'none', backgroundColor: '#1d4ed8', borderRadius: 1.5, flexShrink: 0,
                          '&:hover': { backgroundColor: '#1e40af' } }}
                  >
                    Selecionar arquivo
                  </Button>
                </>
              )}

              {arquivo && (
                <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                  <ExcelIcon size={26} />
                  <Box sx={{ flex: 1, minWidth: 140 }}>
                    <Typography fontWeight="700" sx={{ color: 'text.primary', fontSize: 13 }} noWrap>{arquivo.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{(arquivo.size / 1024).toFixed(1)} KB</Typography>
                  </Box>

                  {enviando && (
                    <Box sx={{ flex: 1, minWidth: 140, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={16} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Enviando…</Typography>
                    </Box>
                  )}

                  {acompanhando && !enviando && (
                    <Box sx={{ flex: 1, minWidth: 220 }}>
                      <LinearProgress sx={{ height: 6, borderRadius: 4 }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Processando no servidor… você já pode sair desta tela, o resultado aparecerá no histórico.
                      </Typography>
                    </Box>
                  )}

                  {!enviando && !acompanhando && !resultado && (
                    <>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1.2, py: 0.3, borderRadius: 99,
                                 backgroundColor: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>
                        Pronto para processar
                      </Box>
                      <Button
                        variant="outlined" size="small" onClick={removerArquivo}
                        sx={{ textTransform: 'none', borderColor: 'divider', color: 'text.secondary', borderRadius: 1.5, flexShrink: 0 }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="contained" size="small" startIcon={<PlayArrowOutlined />}
                        onClick={processarArquivo}
                        sx={{ textTransform: 'none', backgroundColor: '#1d4ed8', borderRadius: 1.5, flexShrink: 0,
                              '&:hover': { backgroundColor: '#1e40af' } }}
                      >
                        Processar arquivo
                      </Button>
                    </>
                  )}

                  {resultado && (
                    <Button
                      variant="outlined" size="small" onClick={removerArquivo}
                      sx={{ textTransform: 'none', borderColor: 'divider', color: 'text.secondary', borderRadius: 1.5, flexShrink: 0 }}
                    >
                      Enviar outro arquivo
                    </Button>
                  )}

                  {!enviando && !acompanhando && (
                    <IconButton size="small" onClick={removerArquivo}><CloseOutlined fontSize="small" /></IconButton>
                  )}
                </Box>
              )}
            </Box>

            {!arquivo && (
              <TextField
                size="small" placeholder="Período (opcional, ex: Junho/2026)" value={periodo}
                onChange={e => setPeriodo(e.target.value)}
                sx={{ mt: 1, width: { xs: '100%', sm: 220 }, '& .MuiOutlinedInput-root': { borderRadius: 1.5, fontSize: 13 } }}
              />
            )}

            {/* Resultado */}
            {resultado && (
              <Alert severity={resultado.sucesso ? 'success' : 'error'} sx={{ mt: 1, borderRadius: 2 }}>
                {resultado.msg}
              </Alert>
            )}
          </Paper>

          {/* Painel lateral: colunas esperadas (obrigatórias destacadas) + status do envio */}
          <Paper sx={{ p: 2.25, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" fontWeight="700" sx={{ color: 'text.primary' }} mb={0.5}>
              Colunas esperadas nesta empresa
            </Typography>
            {colunas.map(c => (
              <Box key={c.nome_coluna} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.4 }}>
                <Typography variant="body2" sx={{ fontSize: 12.5, color: c.obrigatorio ? '#991b1b' : 'text.secondary', fontWeight: c.obrigatorio ? 700 : 400 }}>
                  {c.nome}{c.obrigatorio && ' *'}
                </Typography>
                {c.obrigatorio && (
                  <Box sx={{ fontSize: 10, fontWeight: 700, color: '#991b1b', backgroundColor: '#fee2e2', px: 0.8, borderRadius: 99 }}>
                    obrigatório
                  </Box>
                )}
              </Box>
            ))}
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
              * No arquivo baixado, essas colunas já vêm marcadas com asterisco no cabeçalho.
            </Typography>

            {arquivo && (
              <>
                <Divider sx={{ my: 1.25 }} />
                <LinhaInfo label="Arquivo selecionado">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <ExcelIcon size={15} />
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }} noWrap maxWidth={150}>{arquivo.name}</Typography>
                  </Box>
                </LinhaInfo>
                <LinhaInfo label="Status">
                  <StatusChip status={acompanhando ? 'Processando' : resultado ? (resultado.sucesso ? 'Processado' : 'Recusado') : 'Processando'} />
                </LinhaInfo>
                {resultado?.upload && (
                  <>
                    <LinhaInfo label="Linhas no arquivo">{resultado.upload.linhas}</LinhaInfo>
                    <LinhaInfo label="Importadas">{resultado.upload.processadas}</LinhaInfo>
                  </>
                )}
                {resultado && !resultado.sucesso && resultado.upload?.erro_detalhe && (
                  <Alert severity="error" sx={{ mt: 1, borderRadius: 1.5, fontSize: 12.5 }}>
                    {resultado.upload.erro_detalhe}
                  </Alert>
                )}
              </>
            )}

            {ultimoUpload && (
              <>
                <Divider sx={{ my: 1.25 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AccessTimeOutlined sx={{ color: 'text.secondary', fontSize: 16 }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Último upload processado em {ultimoUpload.data_upload}
                  </Typography>
                </Box>
              </>
            )}
          </Paper>
        </Box>

        {/* Filtros */}
        <Paper sx={{ p: 1, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, border: '1px solid', borderColor: 'divider',
                       borderRadius: 1.5, px: 1, height: 32, width: { xs: '100%', sm: 'auto' } }}>
              <CalendarMonthOutlined sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
              <TextField type="date" size="small" variant="standard" value={rascunho.inicio}
                onChange={e => setRascunho(r => ({ ...r, inicio: e.target.value }))}
                InputProps={{ disableUnderline: true, sx: { fontSize: 12.5 } }} sx={{ width: 108 }} />
              <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>–</Typography>
              <TextField type="date" size="small" variant="standard" value={rascunho.fim}
                onChange={e => setRascunho(r => ({ ...r, fim: e.target.value }))}
                InputProps={{ disableUnderline: true, sx: { fontSize: 12.5 } }} sx={{ width: 108 }} />
            </Box>

            <FormControl size="small" sx={{ width: { xs: '45%', sm: 140 } }}>
              <Select value={rascunho.status} onChange={e => setRascunho(r => ({ ...r, status: e.target.value }))}
                sx={{ height: 32, fontSize: 13 }}>
                {['Todos', 'Processado', 'Processando', 'Recusado'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1, ml: { xs: 0, sm: 'auto' }, width: { xs: '100%', sm: 'auto' } }}>
              <Button size="small" variant="contained" startIcon={<FilterAltOutlined sx={{ fontSize: 16 }} />} onClick={aplicarFiltros}
                sx={{ textTransform: 'none', backgroundColor: '#1d4ed8', borderRadius: 1.5, height: 32, fontSize: 12.5, '&:hover': { backgroundColor: '#1e40af' } }}>
                Filtrar
              </Button>
              <Button size="small" variant="outlined" startIcon={<RestartAltOutlined sx={{ fontSize: 16 }} />} onClick={limparFiltros}
                sx={{ textTransform: 'none', borderColor: 'divider', color: 'text.secondary', borderRadius: 1.5, height: 32, fontSize: 12.5 }}>
                Limpar
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Histórico — a página permanece estática; só a tabela rola internamente, no espaço restante */}
        <Paper sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider',
                    display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
            <Typography variant="subtitle1" fontWeight="500" sx={{ color: 'text.primary' }}>
              Histórico de uploads
            </Typography>
          </Box>

          {carregando ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <>
              <TableContainer sx={{ flex: 1, minHeight: 0, maxHeight: 300}}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['ID', 'Arquivo', 'Período', 'Data do upload', 'Status'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, color: 'text.secondary',
                                                  border: 0, backgroundColor: 'background.paper', whiteSpace: 'nowrap' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginado.map((u) => (
                      <TableRow key={u.id} sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                        <TableCell sx={{ fontSize: 12, color: 'text.secondary', border: 0 }}>{u.id}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: 'text.primary', fontWeight: 500, border: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ExcelIcon size={18} />
                            {u.arquivo}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: 'text.primary', border: 0, whiteSpace: 'nowrap' }}>{u.periodo}</TableCell>
                        <TableCell sx={{ fontSize: 12, color: 'text.secondary', border: 0, whiteSpace: 'nowrap' }}>{u.data_upload}</TableCell>
                        <TableCell sx={{ border: 0 }}>
                          {u.status === 'Recusado' && u.erro_detalhe ? (
                            <Tooltip title={u.erro_detalhe}>
                              <span><StatusChip status={u.status} /></span>
                            </Tooltip>
                          ) : <StatusChip status={u.status} />}
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginado.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.secondary', py: 4, border: 0 }}>
                          Nenhum upload encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center',
                         p: 1, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  Mostrando {paginado.length} de {filtrado.length} registros
                </Typography>
                {totalPags > 1 && (
                  <Pagination count={totalPags} page={pagina} onChange={(_, v) => setPagina(v)} size="small" color="primary" />
                )}
              </Box>
            </>
          )}
        </Paper>
      </Box>
    </MainLayout>
  );
};
