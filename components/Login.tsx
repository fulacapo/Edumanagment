import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, AlertCircle, UserPlus, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isRegistering) {
        await register(email, password);
      } else {
        await login(email, password);
      }

      onLogin();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Usuario o contraseña incorrectos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('El email ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Cuenta bloqueada temporalmente. Intente luego.');
      } else {
        setError('Error: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfbf7] relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-brand-green/5 skew-x-12 transform origin-top-right z-0"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl z-0"></div>

      <div className="relative z-10 w-full max-w-md px-6 animate-in fade-in duration-700 slide-in-from-bottom-8">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">

          {/* Header */}
          <div className="bg-white p-8 pt-12 text-center relative">
            <div className={`w-20 h-20 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl transform rotate-3 transition-colors duration-500 ${isRegistering ? 'bg-indigo-600 shadow-indigo-200' : 'bg-brand-green shadow-brand-green/20'}`}>
              {isRegistering ? <Sparkles className="text-white" size={32} /> : <span className="font-serif font-bold text-white text-3xl">EM</span>}
            </div>
            <h2 className="font-serif font-bold text-3xl text-gray-900 mb-2">
              {isRegistering ? 'Crear Cuenta' : 'Bienvenido'}
            </h2>
            <p className="text-gray-500 text-sm tracking-wide font-medium">
              {isRegistering ? 'Plataforma de Gestión Institucional' : 'Inicia sesión para continuar'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 pt-2 space-y-6">

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 text-sm animate-in slide-in-from-top-2 border border-red-100">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative group">
                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${isRegistering ? 'group-focus-within:text-indigo-600' : 'group-focus-within:text-brand-green'} text-gray-400`}>
                  <User size={20} />
                </div>
                <input
                  type="email"
                  placeholder="Email Institucional"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white outline-none transition-all text-gray-900 placeholder-gray-400 font-medium ${isRegistering ? 'focus:border-indigo-600' : 'focus:border-brand-green'}`}
                  autoFocus
                  required
                />
              </div>

              <div className="relative group">
                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${isRegistering ? 'group-focus-within:text-indigo-600' : 'group-focus-within:text-brand-green'} text-gray-400`}>
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  placeholder={isRegistering ? "Crear Contraseña" : "Contraseña"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white outline-none transition-all text-gray-900 placeholder-gray-400 font-medium ${isRegistering ? 'focus:border-indigo-600' : 'focus:border-brand-green'}`}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full text-white font-bold py-4 rounded-xl transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed ${isRegistering ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-brand-green hover:bg-[#1e3f2e] shadow-brand-green/30'}`}
            >
              {isLoading ? (
                <span className="animate-pulse">{isRegistering ? 'Creando...' : 'Verificando...'}</span>
              ) : (
                <>
                  {isRegistering ? 'Registrar Instituto' : 'Ingresar al Portal'}
                  {isRegistering ? <UserPlus size={20} /> : <ArrowRight size={20} />}
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 pt-2">
              <span className="text-gray-400 text-sm">{isRegistering ? "¿Ya tienes cuenta?" : "¿No tienes acceso?"}</span>
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError('');
                }}
                className={`text-sm font-bold hover:underline transition-colors ${isRegistering ? 'text-indigo-600' : 'text-brand-green'}`}
              >
                {isRegistering ? "Iniciar Sesión" : "Crear Cuenta"}
              </button>
            </div>
          </form>

          <div className="bg-gray-50 p-4 text-center border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
            <ShieldCheck size={14} />
            Secure System • EduManage Pro
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;