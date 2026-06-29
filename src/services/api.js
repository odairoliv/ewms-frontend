const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const H = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
});

// Para multipart/form-data: NÃO definir Content-Type (o browser define o boundary)
const HFile = (token) => ({
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

// Auxiliar para tratar erros globais de expiração de token (401/403)
const checarResposta = async (retornoFetch) => {
  if (retornoFetch.status === 401 || retornoFetch.status === 403) {
    sessionStorage.clear();
    window.location.href = '/';
    throw new Error('Sessão expirada ou não autorizada');
  }
  if (!retornoFetch.ok) {
    const erro = await retornoFetch.json().catch(() => ({}));
    // FastAPI manda erro de validação (422) como uma lista de objetos {loc,msg,...} —
    // sem isso, new Error(array) virava o texto "[object Object],[object Object]".
    const mensagem = Array.isArray(erro.detail)
      ? erro.detail.map(d => d.msg || JSON.stringify(d)).join('; ')
      : erro.detail;
    throw new Error(mensagem || 'Erro ao comunicar com o servidor.');
  }
  if (retornoFetch.status === 204) {
    return { data: { message: 'OK' } };
  }
  const json = await retornoFetch.json();
  // Se o back-end já retornar o objeto envelopado em { data: ... }, mantém.
  // Caso contrário, envelopamos aqui para padronizar o consumo no frontend:
  return json.data ? json : { data: json };
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const apiAuthLogin = (email, senha) =>
  fetch(`${BASE}/auth/login`, { method:'POST', headers:H(), body:JSON.stringify({email,senha}) }).then(checarResposta);

export const apiImpersonar = (token, usuarioId) =>
  fetch(`${BASE}/auth/impersonar/${usuarioId}`, { method:'POST', headers:H(token) }).then(checarResposta);

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export const apiGetDashboard = (token, perfil, empresa, periodo) =>
  fetch(`${BASE}/dashboard?empresa=${encodeURIComponent(empresa||'')}&periodo=${periodo||''}`, { headers:H(token) }).then(checarResposta);

// ── CONSULTORES ───────────────────────────────────────────────────────────────
export const apiGetConsultores = (token) =>
  fetch(`${BASE}/consultores`, {headers:H(token)}).then(checarResposta);

export const apiCreateConsultor = (token, payload) =>
  fetch(`${BASE}/consultores`, {method:'POST', headers:H(token), body:JSON.stringify(payload)}).then(checarResposta);

export const apiUpdateConsultor = (token, id, payload) =>
  fetch(`${BASE}/consultores/${id}`, {method:'PUT', headers:H(token), body:JSON.stringify(payload)}).then(checarResposta);

export const apiDeleteConsultor = (token, id) =>
  fetch(`${BASE}/consultores/${id}`, {method:'DELETE', headers:H(token)}).then(checarResposta);

// ── FORNECEDORES ──────────────────────────────────────────────────────────────
export const apiGetFornecedores = (token) =>
  fetch(`${BASE}/fornecedores`, {headers:H(token)}).then(checarResposta);

export const apiCreateFornecedor = (token, payload) =>
  fetch(`${BASE}/fornecedores`, {method:'POST', headers:H(token), body:JSON.stringify(payload)}).then(checarResposta);

export const apiUpdateFornecedor = (token, id, payload) =>
  fetch(`${BASE}/fornecedores/${id}`, {method:'PUT', headers:H(token), body:JSON.stringify(payload)}).then(checarResposta);

export const apiDeleteFornecedor = (token, id) =>
  fetch(`${BASE}/fornecedores/${id}`, {method:'DELETE', headers:H(token)}).then(checarResposta);

export const apiReativarFornecedor = (token, id) =>
  fetch(`${BASE}/fornecedores/${id}/reativar`, {method:'POST', headers:H(token)}).then(checarResposta);

// ── USUÁRIOS ──────────────────────────────────────────────────────────────────
export const apiGetUsuarios = (token) =>
  fetch(`${BASE}/usuarios`, {headers:H(token)}).then(checarResposta);

export const apiCreateUsuario = (token, payload) =>
  fetch(`${BASE}/usuarios`, {method:'POST', headers:H(token), body:JSON.stringify(payload)}).then(checarResposta);

export const apiGetUsuarioById = (token, id) =>
  fetch(`${BASE}/usuarios/${id}`, {headers:H(token)}).then(checarResposta);

export const apiUpdateUsuario = (token, id, payload) =>
  fetch(`${BASE}/usuarios/${id}`, {method:'PUT', headers:H(token), body:JSON.stringify(payload)}).then(checarResposta);

export const apiDeleteUsuario = (token, id) =>
  fetch(`${BASE}/usuarios/${id}`, {method:'DELETE', headers:H(token)}).then(checarResposta);

export const apiAprovarEdicaoUsuario = (token, id, acao, justificativa) =>
  fetch(`${BASE}/usuarios/${id}/aprovar-edicao`, {method:'POST', headers:H(token), body:JSON.stringify({acao, justificativa})}).then(checarResposta);

// ── EMPRESAS ──────────────────────────────────────────────────────────────────
// Listagem completa: somente SuperUsuario
export const apiGetEmpresas = (token) =>
  fetch(`${BASE}/empresas`, {headers:H(token)}).then(checarResposta);

// Uma empresa específica: SuperUsuario ou Administrador da própria empresa
export const apiGetEmpresaById = (token, id) =>
  fetch(`${BASE}/empresas/${id}`, {headers:H(token)}).then(checarResposta);

// Criar: somente SuperUsuario
export const apiCreateEmpresa = (token, payload) =>
  fetch(`${BASE}/empresas`, {method:'POST', headers:H(token), body:JSON.stringify(payload)}).then(checarResposta);

// Editar: Administrador (própria empresa, fica pendente de aprovação) ou SuperUsuario (aplica direto)
export const apiUpdateEmpresa = (token, id, payload) =>
  fetch(`${BASE}/empresas/${id}`, {method:'PUT', headers:H(token), body:JSON.stringify(payload)}).then(checarResposta);

// Aprovar/recusar edição pendente: somente SuperUsuario
export const apiAprovarEmpresa = (token, id, acao, justificativa) =>
  fetch(`${BASE}/empresas/${id}/aprovar`, {method:'POST', headers:H(token), body:JSON.stringify({acao, justificativa})}).then(checarResposta);

// ── UPLOADS ───────────────────────────────────────────────────────────────────
export const apiGetUploads = (token) =>
  fetch(`${BASE}/uploads`, {headers:H(token)}).then(checarResposta);

// Colunas do template de upload — nomes e obrigatoriedade podem variar por empresa
export const apiGetUploadTemplate = (token) =>
  fetch(`${BASE}/uploads/template`, {headers:H(token)}).then(checarResposta);

// Envia o arquivo: o servidor responde 202 na hora (status "Processando") e processa
// em segundo plano — o front deve consultar apiGetUploads depois para ver o resultado final.
export const apiProcessarUpload = (token, arquivo, periodo) => {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (periodo) formData.append('periodo', periodo);
  return fetch(`${BASE}/uploads`, { method: 'POST', headers: HFile(token), body: formData }).then(checarResposta);
};

// ── APONTAMENTOS (fechamento) ─────────────────────────────────────────────────
export const apiGetApontamentos = (token, perfil, idFornecedor, emailUsuario, periodo) =>
  fetch(`${BASE}/apontamentos?periodo=${periodo||''}`, {headers:H(token)}).then(checarResposta);

export const apiUpdateApontamento = (token, id, status, just) =>
  fetch(`${BASE}/apontamentos/${id}`, {method:'PUT', headers:H(token), body:JSON.stringify({status, justificativa:just})}).then(checarResposta);

export const apiEditarHorasApontamento = (token, id, horas, just) =>
  fetch(`${BASE}/apontamentos/${id}/horas`, {method:'PUT', headers:H(token), body:JSON.stringify({horas_trabalhadas:horas, justificativa:just})}).then(checarResposta);

export const apiAprovarHorasApontamento = (token, id, acao, just) =>
  fetch(`${BASE}/apontamentos/${id}/aprovar-horas`, {method:'POST', headers:H(token), body:JSON.stringify({acao, justificativa:just})}).then(checarResposta);

export const apiDeleteApontamento = (token, id) =>
  fetch(`${BASE}/apontamentos/${id}`, {method:'DELETE', headers:H(token)}).then(checarResposta);

// ── AUDITORIA ─────────────────────────────────────────────────────────────────
export const apiGetAuditoria = (token, empresaId) =>
  fetch(`${BASE}/auditoria?empresa_id=${empresaId||''}`, {headers:H(token)}).then(checarResposta);

export const apiAprovarAuditoria = (token, id, acao, just) =>
  fetch(`${BASE}/auditoria/${id}/revisar`, {method:'POST', headers:H(token), body:JSON.stringify({acao, justificativa:just})}).then(checarResposta);

// ── CAMPOS CUSTOMIZÁVEIS (tb_custom) ──────────────────────────────────────────
export const apiGetCustomFields = (token, empresaId, idObjeto) => {
  const params = new URLSearchParams();
  if (empresaId) params.set('empresa_id', empresaId);
  if (idObjeto) params.set('id_objeto', idObjeto);
  return fetch(`${BASE}/custom-fields?${params}`, {headers:H(token)}).then(checarResposta);
};

export const apiUpsertCustomField = (token, payload) =>
  fetch(`${BASE}/custom-fields`, {method:'POST', headers:H(token), body:JSON.stringify(payload)}).then(checarResposta);

export const apiResetCustomField = (token, id) =>
  fetch(`${BASE}/custom-fields/${id}`, {method:'DELETE', headers:H(token)}).then(checarResposta);
