import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiGetCustomFields } from '../services/api';

const CUSTOM_PADRAO = [
  { nome_coluna: 'custom01', tipo: 'date' },
  { nome_coluna: 'custom02', tipo: 'texto' },
  { nome_coluna: 'custom03', tipo: 'texto' },
  { nome_coluna: 'custom04', tipo: 'float' },
];

/**
 * Monta a lista de colunas visíveis de uma tabela (padrão + customizáveis), de acordo com a
 * configuração que o SuperUsuario salvou para a empresa do usuário logado em "Config. de
 * Formulários". Campos padrão sem configuração salva caem no `defaultVisivel` informado pela
 * tela que consome o hook; campos Custom01-04 sem configuração ficam ocultos por padrão.
 *
 * @param {string} idObjeto - "apontamento" | "fornecedor" | "consultor" | "usuario" | "empresa"
 * @param {{nome_coluna:string, nome:string, defaultVisivel:boolean}[]} camposPadrao
 * @returns {{nome_coluna:string, nome:string, tipo:string}[]} colunas visíveis, na ordem configurada
 */
export const useColunasTabela = (idObjeto, camposPadrao) => {
  const { token, usuario } = useAuth();
  const [colunas, setColunas] = useState(
    camposPadrao.filter(c => c.defaultVisivel).map(c => ({ ...c, tipo: 'padrao' }))
  );

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const res = await apiGetCustomFields(token, usuario?.empresa_id, idObjeto);
        if (!ativo) return;
        const configs = res.data;

        const padrao = camposPadrao.map((campo, i) => {
          const cfg = configs.find(c => c.nome_coluna === campo.nome_coluna);
          if (cfg) return { nome_coluna: campo.nome_coluna, nome: cfg.nome, tipo: 'padrao', visivel: cfg.visivel, ordem: cfg.ordem ?? i };
          return { nome_coluna: campo.nome_coluna, nome: campo.nome, tipo: 'padrao', visivel: campo.defaultVisivel, ordem: i };
        });

        const custom = CUSTOM_PADRAO.map((campo, i) => {
          const cfg = configs.find(c => c.nome_coluna === campo.nome_coluna);
          if (cfg) return { nome_coluna: campo.nome_coluna, nome: cfg.nome, tipo: campo.tipo, visivel: cfg.visivel, ordem: cfg.ordem ?? 100 + i };
          return { nome_coluna: campo.nome_coluna, nome: campo.nome_coluna, tipo: campo.tipo, visivel: false, ordem: 100 + i };
        });

        setColunas(
          [...padrao, ...custom]
            .filter(c => c.visivel)
            .sort((a, b) => a.ordem - b.ordem)
        );
      } catch (e) { console.error(e); }
    };
    if (usuario?.empresa_id) carregar();
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, usuario?.empresa_id, idObjeto]);

  return colunas;
};
