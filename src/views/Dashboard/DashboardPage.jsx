import { useEffect, useState } from 'react';
import { Paper, Typography, MenuItem, Select, FormControl, InputLabel, Box, CircularProgress, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { apiGetDashboard, apiGetApontamentos, apiGetFornecedores } from '../../services/api';
import { MainLayout } from '../../components/Layout/MainLayout';

const fmt = (n) => new Intl.NumberFormat('pt-BR').format(Math.round(n));
const FONTE_TITULO = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";

const CardHead = ({ titulo, subtitulo }) => {
  const theme = useTheme();
  return (
    <Box mb={0.5}>
      <Typography sx={{ fontFamily: FONTE_TITULO, fontSize: 14, fontWeight: 600, color: theme.palette.text.primary, letterSpacing: 0 }}>
        {titulo}
      </Typography>
      <Typography sx={{ fontFamily: FONTE_TITULO, fontSize: 12, fontWeight: 400, color: theme.palette.text.secondary, mt: 0.1 }}>
        {subtitulo}
      </Typography>
    </Box>
  );
};

// Legenda própria, centralizada em relação ao card (a <Legend> do recharts centraliza
// em relação à área de plotagem, que fica deslocada quando as margens left/right diferem)
const ChartLegend = ({ itens }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display:'flex', justifyContent:'center', flexWrap:'wrap', gap:2, mb:0.5 }}>
      {itens.map(it => (
        <Box key={it.rotulo} sx={{ display:'flex', alignItems:'center', gap:0.7 }}>
          <Box sx={{ width:10, height:10, borderRadius:'2px', backgroundColor: it.cor, flexShrink:0 }} />
          <Typography sx={{ fontFamily:FONTE_TITULO, fontSize:12, fontWeight:600, color: theme.palette.text.secondary }}>{it.rotulo}</Typography>
        </Box>
      ))}
    </Box>
  );
};

// Tick do eixo Y dos gráficos de barra: uma linha, quebrando em duas só se o nome for longo
const EixoCategoriaTick = ({ x, y, payload }) => {
  const theme = useTheme();
  const valor = payload?.value || '';
  let linha1 = valor, linha2 = '';
  if (valor.length > 12) {
    const palavras = valor.split(' ');
    const meio = Math.ceil(palavras.length / 2);
    linha1 = palavras.slice(0, meio).join(' ');
    linha2 = palavras.slice(meio).join(' ');
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={linha2 ? -3 : 4} textAnchor="end" fontSize={10} fontWeight={600} fill={theme.palette.text.primary} fontFamily={FONTE_TITULO}>{linha1}</text>
      {linha2 && <text x={0} y={11} textAnchor="end" fontSize={10} fontWeight={600} fill={theme.palette.text.primary} fontFamily={FONTE_TITULO}>{linha2}</text>}
    </g>
  );
};

// Tick de uma linha só (sem quebra), usado quando o nome completo precisa aparecer inteiro
const EixoCategoriaTickLinhaUnica = ({ x, y, payload }) => {
  const theme = useTheme();
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={4} textAnchor="end" fontSize={10} fontWeight={600} fill={theme.palette.text.primary} fontFamily={FONTE_TITULO}>
        {payload?.value || ''}
      </text>
    </g>
  );
};

// Label do total empilhado na ponta da barra
const TotalLabel = ({ x, y, width, height, payload }) => {
  const theme = useTheme();
  if (!payload || typeof x !== 'number') return null;
  const total = (payload.normal||0)+(payload.extra||0);
  return (
    <text x={x+width+6} y={y+height/2} fill={theme.palette.text.primary} fontSize={10} fontWeight="bold" dominantBaseline="middle">
      {`${fmt(total)} h`}
    </text>
  );
};

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const periodoParaData = (periodo) => {
  const [mes, ano] = (periodo||'').split('/');
  return new Date(parseInt(ano)||0, MESES_PT.indexOf(mes), 1);
};

export const DashboardPage = ({ onNavigate }) => {
  const { usuario, token } = useAuth();
  const [dados, setDados] = useState(null);
  const [periodo, setPeriodo] = useState('');
  const [empresa, setEmpresa] = useState(usuario?.perfil === 'Fornecedor' ? (usuario?.empresa || 'Todas as empresas') : 'Todas as empresas');
  const [opcoesPeriodo, setOpcoesPeriodo] = useState([]);
  const [opcoesEmpresa, setOpcoesEmpresa] = useState(['Todas as empresas']);
  const [carregando, setCarregando] = useState(true);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const CARD = {
    p: 2, borderRadius: 2.5, backgroundColor: 'background.paper',
    boxShadow: theme.palette.mode === 'dark' ? '0 2px 12px rgba(0,0,0,.4)' : '0 2px 12px rgba(15,23,42,.04)',
    border: '1px solid', borderColor: 'divider',
    display: 'flex', flexDirection: 'column'
  };

  const podeFiltrarEmpresa = ['SuperUsuario','Administrador','Liderança'].includes(usuario?.perfil);

  // Determina a empresa padrão pelo perfil
  const empresaEfetiva = usuario?.perfil === 'Fornecedor' ? (usuario?.empresa || empresa) : empresa;

  const carregar = async (novoPeriodo, novaEmpresa) => {
    try {
      const res = await apiGetDashboard(token, usuario.perfil, novaEmpresa ?? empresaEfetiva, novoPeriodo ?? periodo);
      setDados(res.data);
    } catch (e) { console.error(e); }
  };

  // Carrega as opções reais de filtro (períodos e prestadores com dados de fato salvos no banco)
  // e só então busca o dashboard com o período mais recente disponível.
  useEffect(() => {
    const iniciar = async () => {
      setCarregando(true);
      try {
        const [resApontamentos, resFornecedores] = await Promise.all([
          apiGetApontamentos(token, usuario.perfil, usuario.id_fornecedor, usuario.email, null),
          podeFiltrarEmpresa ? apiGetFornecedores(token) : Promise.resolve({ data: [] })
        ]);
        const periodosReais = [...new Set(resApontamentos.data.map(a => a.periodo))]
          .sort((a, b) => periodoParaData(b) - periodoParaData(a));
        setOpcoesPeriodo(periodosReais);
        setOpcoesEmpresa(['Todas as empresas', ...resFornecedores.data.map(f => f.razao_social)]);

        const periodoInicial = periodosReais[0] || '';
        setPeriodo(periodoInicial);
        await carregar(periodoInicial, empresa);
      } catch (e) { console.error(e); }
      finally { setCarregando(false); }
    };
    iniciar();
  }, []);

  const handlePeriodo = async (v) => { setPeriodo(v); setCarregando(true); await carregar(v, empresa); setCarregando(false); };
  const handleEmpresa = async (v) => { setEmpresa(v); setCarregando(true); await carregar(periodo, v); setCarregando(false); };

  const FiltrosDashboard = (
    <>
      <FormControl size="small" sx={{ width: { xs: 140, sm: 160 }, backgroundColor: 'background.paper', borderRadius: 1.5 }}>
        <InputLabel sx={{ fontSize: 13 }}>Período</InputLabel>
        <Select value={periodo} label="Período" onChange={e => handlePeriodo(e.target.value)} sx={{ borderRadius: 1.5, fontSize: 13 }}>
          {opcoesPeriodo.length === 0 && <MenuItem value="">Sem dados</MenuItem>}
          {opcoesPeriodo.map(p => <MenuItem key={p} value={p}>{p.replace('/', ' / ')}</MenuItem>)}
        </Select>
      </FormControl>

      {/* Filtro de empresa só visível para Admin, Liderança e SuperUsuario */}
      {podeFiltrarEmpresa && (
        <FormControl size="small" sx={{ width: { xs: 160, sm: 220 }, backgroundColor: 'background.paper', borderRadius: 1.5 }}>
          <InputLabel sx={{ fontSize: 13 }}>Prestador de Serviço</InputLabel>
          <Select value={empresa} label="Prestador de Serviço" onChange={e => handleEmpresa(e.target.value)} sx={{ borderRadius: 1.5, fontSize: 13 }}>
            {opcoesEmpresa.map(e => <MenuItem key={e} value={e}>{e}</MenuItem>)}
          </Select>
        </FormControl>
      )}
    </>
  );

  if (carregando || !dados) {
    return (
      <MainLayout idTela="dashboard" tituloTela="VISÃO GERAL" acoesTopo={FiltrosDashboard} onNavigate={onNavigate}>
        <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh' }}>
          <CircularProgress />
        </Box>
      </MainLayout>
    );
  }

  return (
    <MainLayout idTela="dashboard" tituloTela="VISÃO GERAL" acoesTopo={FiltrosDashboard} onNavigate={onNavigate}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 2.5 } }}>

        {/* ── LINHA 1 ─────────────────────────────────────────────────── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: { xs: 2, md: 2.5 } }}>

          {/* Horas por prestador — não exibido para os perfis Usuário e Fornecedor */}
          {!['Usuário','Fornecedor'].includes(usuario?.perfil) && (
            <Paper sx={{ ...CARD, height: { xs: 220, sm: 300 } }}>
              <CardHead titulo="Horas por prestador" subtitulo="Top prestadores por consumo de horas" />
              <Box sx={{ flex:1, minHeight:0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={dados.horas_por_prestador} margin={{ top:0, right:62, left:0, bottom:10 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="prestador" type="category" width={isMobile ? 80 : 96} tickLine={false} axisLine={false}
                      tick={<EixoCategoriaTick />} />
                    <Tooltip formatter={v => [`${fmt(v)} h`,'Horas']} contentStyle={{ borderRadius:8, fontSize:12 }} />
                    <Bar dataKey="horas" fill="#1d4ed8" radius={[0,4,4,0]} maxBarSize={25}>
                      <LabelList dataKey="horas" position="right" formatter={v=>`${fmt(v)} h`}
                        style={{ fill:theme.palette.text.primary, fontSize:'10px', fontWeight:'700' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          )}

          {/* Horas por projeto */}
          <Paper sx={{ ...CARD, height: { xs: 220, sm: 300 } }}>
            <CardHead titulo="Horas por projeto" subtitulo="Top projetos por consumo de horas" />
            <Box sx={{ flex:1, minHeight:0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={dados.horas_por_projeto} margin={{ top:0, right:62, left:0, bottom:10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="projeto" type="category" width={isMobile ? 80 : 96} tickLine={false} axisLine={false}
                    tick={<EixoCategoriaTick />} />
                  <Tooltip formatter={v=>[`${fmt(v)} h`,'Horas']} contentStyle={{ borderRadius:8, fontSize:12 }} />
                  <Bar dataKey="horas" fill="#7c3aed" radius={[0,4,4,0]} maxBarSize={25}>
                    <LabelList dataKey="horas" position="right" formatter={v=>`${fmt(v)} h`}
                      style={{ fill:theme.palette.text.primary, fontSize:'10px', fontWeight:'700' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          {/* Previsto x Realizado */}
          <Paper sx={{ ...CARD, height: { xs: 380, sm: 300 } }}>
            <Box mb={0.5} textAlign="center">
              <Typography sx={{ fontFamily: FONTE_TITULO, fontSize: 14, fontWeight: 600, color: theme.palette.text.primary, letterSpacing: 0 }}>
                Horas previstas × Realizadas
              </Typography>
              <Typography sx={{ fontFamily: FONTE_TITULO, fontSize: 12, fontWeight: 400, color: theme.palette.text.secondary, mt: 0.1 }}>
                Comparativo por projeto
              </Typography>
            </Box>
            <ChartLegend itens={[{ cor:'#93c5fd', rotulo:'Previstas' }, { cor:'#2563eb', rotulo:'Realizadas' }]} />
            <Box sx={{ flex:1, minHeight:0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={dados.previsto_vs_realizado}
                  margin={{ top:0, right:46, left:4, bottom:12 }}
                  barCategoryGap="16%"
                  barGap={1.5}
                >
                  <XAxis type="number" tickLine={false} axisLine={{ stroke:theme.palette.divider }} tick={{ fill:theme.palette.text.secondary, fontSize:10, fontFamily:FONTE_TITULO }}
                    tickFormatter={v => fmt(v)}
                    label={{ value:'Horas', position:'bottom', offset:0, fill:theme.palette.text.secondary, fontSize:10, fontWeight:600, fontFamily:FONTE_TITULO }} />
                  <YAxis
                    dataKey="projeto" type="category" width={isMobile ? 88 : 92}
                    tickLine={false} axisLine={{ stroke:theme.palette.divider }}
                    tick={<EixoCategoriaTick />}
                  />
                  <Tooltip formatter={v=>[`${fmt(v)} h`]} contentStyle={{ borderRadius:8, fontSize:12 }} />
                  <Bar dataKey="previsto"  fill="#93c5fd" name="Previstas"   maxBarSize={25} radius={[0,3,3,0]}>
                    <LabelList dataKey="previsto"  position="right" offset={4} formatter={v=>`${fmt(v)} h`}
                      style={{ fill:theme.palette.text.primary, fontSize:'9px', fontWeight:700, fontFamily:FONTE_TITULO }} />
                  </Bar>
                  <Bar dataKey="realizado" fill="#2563eb" name="Realizadas"  maxBarSize={25} radius={[0,3,3,0]}>
                    <LabelList dataKey="realizado" position="right" offset={4} formatter={v=>`${fmt(v)} h`}
                      style={{ fill:theme.palette.text.primary, fontSize:'9px', fontWeight:800, fontFamily:FONTE_TITULO }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Box>

        {/* ── LINHA 2 ─────────────────────────────────────────────────── */}
        <Box sx={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: { xs: 2, md: 2.5 } }}>

          {/* Hora por terceiro × tipo */}
          <Paper sx={{ ...CARD, height: { xs: 250, sm: 300 } }}>
            <CardHead titulo="Hora por terceiro × tipo" subtitulo="Horas dentro do previsto (Normal) e excedentes (Extra) por terceiro" />
            <ChartLegend itens={[
              { cor:'#1d4ed8', rotulo:'Normal' }, { cor:'#7c3aed', rotulo:'Extra' }
            ]}/>
            {/* Overflow vertical com barra de rolagem: necessário quando há muitos terceiros
                (ex: SuperUsuario vendo todas as empresas) — cada barra mantém altura mínima legível */}
            <Box sx={{ flex:1, minHeight:0, overflowY:'auto' }}>
              <Box sx={{ height: Math.max(200, dados.horas_por_tipo.length * 34) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={dados.horas_por_tipo} margin={{ top:0, right:68, left:0, bottom:0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="terceiro" type="category" width={isMobile ? 120 : 150} tickLine={false} axisLine={false}
                      tick={<EixoCategoriaTickLinhaUnica />} interval={0} />
                    <Tooltip contentStyle={{ borderRadius:8, fontSize:12 }} />
                    <Bar dataKey="normal" stackId="a" fill="#1d4ed8" name="Normal" maxBarSize={25}>
                      <LabelList dataKey="normal" position="inside" fill="#fff" fontSize={10} formatter={v=>v>40?Math.round(v):''} />
                    </Bar>
                    <Bar dataKey="extra"  stackId="a" fill="#7c3aed" name="Extra"  maxBarSize={25} radius={[0,4,4,0]}>
                      <LabelList content={TotalLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </Paper>

          {/* Evolução mensal */}
          <Paper sx={{ ...CARD, height: { xs: 250, sm: 300 } }}>
            <CardHead titulo="Evolução mensal de horas" subtitulo="Total de horas realizadas ao longo do tempo" />
            <Box sx={{ flex:1, minHeight:0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.evolucao_mensal} margin={{ top:18, right:8, left:-22, bottom:0 }}>
                  <XAxis dataKey="mes" tick={{ fill:theme.palette.text.secondary, fontSize:10 }} tickLine={false} axisLine={false} interval={isMobile ? 1 : 0} />
                  <YAxis tick={{ fill:theme.palette.text.secondary, fontSize:10 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={v=>[`${fmt(v)} h`,'Horas']} contentStyle={{ borderRadius:8, fontSize:12 }} />
                  <Bar dataKey="horas" radius={[4,4,0,0]} maxBarSize={28}>
                    {dados.evolucao_mensal.map((d,i) => (
                      <Cell key={i} fill={d.mes==='Mai' ? '#1d4ed8' : '#dbeafe'} />
                    ))}
                    <LabelList dataKey="horas" position="top" formatter={v=>fmt(v)}
                      style={{ fill:theme.palette.text.secondary, fontSize:'9px', fontWeight:700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Box>
      </Box>
    </MainLayout>
  );
};
