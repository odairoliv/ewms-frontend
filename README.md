# EWMS Frontend

Aplicação React + Vite (MUI v9) do sistema EWMS. Consome a API REST do `ewms-backend` (FastAPI), que deve estar rodando em `http://localhost:8000` antes de iniciar este frontend.

## Pré-requisitos

- Node.js 18+
- O backend (`ewms-backend`) rodando em `http://localhost:8000` — ver `README.md` daquele projeto

## Passo a passo

1. Instalar dependências:
   ```
   npm install
   ```
2. Conferir o arquivo `.env` (já existe na raiz do projeto) e ajustar a URL da API se o backend não estiver na porta padrão:
   ```
   VITE_API_BASE_URL=http://localhost:8000/api
   ```
3. Rodar o servidor de desenvolvimento:
   ```
   npm run dev
   ```
4. Acessar no navegador: http://localhost:5173

## Login de demonstração

Os botões de "acesso rápido" na tela de login preenchem as credenciais dos 5 perfis de teste criados pelo seed do backend (SuperUsuario, Administrador, Liderança, Fornecedor, Usuário). As senhas não são publicadas neste README por segurança — consulte quem administra o ambiente.

## Outros comandos

```
npm run build     # build de produção
npm run preview   # serve o build de produção localmente
npm run lint      # checagem de lint
```
