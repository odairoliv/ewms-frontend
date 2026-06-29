/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { apiAuthLogin, apiImpersonar } from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(() => {
    const saved = sessionStorage.getItem('@EWMS:user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('@EWMS:token'));
  const [superUsuario, setSuperUsuario] = useState(() => {
    const saved = sessionStorage.getItem('@EWMS:super_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email, senha) => {
    const res = await apiAuthLogin(email, senha);
    // Destrutura direto de res, assumindo o envelope .data adaptado na api.js
    const { access_token, usuario: userData } = res.data;

    sessionStorage.setItem('@EWMS:token', access_token);
    sessionStorage.setItem('@EWMS:user', JSON.stringify(userData));
    setToken(access_token);
    setUsuario(userData);
  };

  const logout = () => {
    sessionStorage.clear();
    setToken(null);
    setUsuario(null);
    setSuperUsuario(null);
  };

  // Proxy/impersonação: só o SuperUsuario pode acessar o sistema "como" outro usuário.
  // Guarda a sessão original do SuperUsuario para permitir voltar depois.
  const impersonar = async (usuarioId) => {
    const res = await apiImpersonar(token, usuarioId);
    const { access_token, usuario: userData } = res.data;

    if (!superUsuario) {
      sessionStorage.setItem('@EWMS:super_token', token);
      sessionStorage.setItem('@EWMS:super_user', JSON.stringify(usuario));
      setSuperUsuario(usuario);
    }

    sessionStorage.setItem('@EWMS:token', access_token);
    sessionStorage.setItem('@EWMS:user', JSON.stringify(userData));
    setToken(access_token);
    setUsuario(userData);
  };

  const voltarSuperUsuario = () => {
    const tokenOriginal = sessionStorage.getItem('@EWMS:super_token');
    const userOriginal = sessionStorage.getItem('@EWMS:super_user');
    if (!tokenOriginal || !userOriginal) return;

    sessionStorage.setItem('@EWMS:token', tokenOriginal);
    sessionStorage.setItem('@EWMS:user', userOriginal);
    sessionStorage.removeItem('@EWMS:super_token');
    sessionStorage.removeItem('@EWMS:super_user');
    setToken(tokenOriginal);
    setUsuario(JSON.parse(userOriginal));
    setSuperUsuario(null);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!token, usuario, token, login, logout,
      impersonando: !!superUsuario, superUsuario, impersonar, voltarSuperUsuario
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
