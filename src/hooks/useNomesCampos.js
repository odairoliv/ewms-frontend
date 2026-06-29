import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiGetCustomFields } from '../services/api';

// Busca a configuração de nomes/obrigatoriedade de campos PADRÃO (não-customizáveis) de um
// objeto (formulário/tabela) para a empresa do usuário logado. Diferente de useCamposCustom
// (que trata só Custom01-04), este hook serve para renomear/exigir campos como "uf", "cargo" etc.
export const useNomesCampos = (idObjeto) => {
  const { token, usuario } = useAuth();
  const [configs, setConfigs] = useState([]);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const res = await apiGetCustomFields(token, usuario?.empresa_id, idObjeto);
        if (ativo) setConfigs(res.data);
      } catch (e) { console.error(e); }
    };
    if (usuario?.empresa_id) carregar();
    return () => { ativo = false; };
  }, [token, usuario?.empresa_id, idObjeto]);

  const nomeDe = (nomeColuna, padrao) => configs.find(c => c.nome_coluna === nomeColuna)?.nome || padrao;
  const obrigatorioDe = (nomeColuna) => configs.find(c => c.nome_coluna === nomeColuna)?.obrigatorio || false;
  const visivelDe = (nomeColuna, padraoVisivel = true) => {
    const cfg = configs.find(c => c.nome_coluna === nomeColuna);
    return cfg ? cfg.visivel : padraoVisivel;
  };

  return { nomeDe, obrigatorioDe, visivelDe };
};
