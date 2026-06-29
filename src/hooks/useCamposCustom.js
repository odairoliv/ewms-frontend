import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiGetCustomFields } from '../services/api';

const PADRAO_CUSTOM = [
  { nome_coluna: 'custom01', nome: 'Campo customizado 1', tipo: 'date' },
  { nome_coluna: 'custom02', nome: 'Campo customizado 2', tipo: 'texto' },
  { nome_coluna: 'custom03', nome: 'Campo customizado 3', tipo: 'texto' },
  { nome_coluna: 'custom04', nome: 'Campo customizado 4', tipo: 'float' },
];

// Busca a configuração de Custom01-04 da empresa do usuário logado para um objeto
// (formulário/tabela) e devolve só os campos marcados como visíveis, já com o nome
// e a obrigatoriedade definidos pelo SuperUsuario — pronto para renderizar dinamicamente.
export const useCamposCustom = (idObjeto) => {
  const { token, usuario } = useAuth();
  const [campos, setCampos] = useState([]);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const res = await apiGetCustomFields(token, usuario?.empresa_id, idObjeto);
        if (!ativo) return;
        const visiveis = PADRAO_CUSTOM
          .map(padrao => {
            const cfg = res.data.find(c => c.nome_coluna === padrao.nome_coluna);
            if (cfg) return { ...padrao, nome: cfg.nome, visivel: cfg.visivel, obrigatorio: cfg.obrigatorio };
            return { ...padrao, visivel: false, obrigatorio: false };
          })
          .filter(c => c.visivel);
        setCampos(visiveis);
      } catch (e) { console.error(e); }
    };
    if (usuario?.empresa_id) carregar();
    return () => { ativo = false; };
  }, [token, usuario?.empresa_id, idObjeto]);

  return campos;
};
