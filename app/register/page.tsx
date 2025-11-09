'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/validation';
import { Sparkles, User, Mail, Lock, UserPlus, Users, MessageSquare, Award, Building } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface Sector {
  id: string;
  name: string;
  description: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Carregar setores do Firestore
  useEffect(() => {
    const fetchSectors = async () => {
      try {
        console.log('📂 Carregando setores do Firestore...');
        const sectorsCollection = collection(db, 'sectors');
        const snapshot = await getDocs(sectorsCollection);
        
        const sectorsData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          description: doc.data().description || ''
        }));
        
        console.log('✅ Setores carregados:', sectorsData.length);
        console.log('📋 Setores:', sectorsData);
        setSectors(sectorsData);
      } catch (error) {
        console.error('❌ Erro ao carregar setores:', error);
        // Tentar buscar sem query como fallback
        try {
          const sectorsCollection = collection(db, 'sectors');
          const snapshot = await getDocs(sectorsCollection);
          const sectorsData = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            description: doc.data().description || ''
          }));
          console.log('✅ Setores carregados (fallback):', sectorsData.length);
          setSectors(sectorsData);
        } catch (fallbackError) {
          console.error('❌ Erro no fallback:', fallbackError);
        }
      } finally {
        setLoadingSectors(false);
      }
    };

    fetchSectors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (!email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      setError(`Apenas emails ${ALLOWED_EMAIL_DOMAIN} são permitidos`);
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, name, sectorId || null);
      router.push('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email já está em uso');
      } else {
        setError(err.message || 'Erro ao criar conta');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-white"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Side - Hero Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  Junte-se à Equipe
                </div>
                <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Comece a trabalhar
                  <span className="block text-orange-600">com IA hoje</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
                  Solicite seu acesso e tenha disponível seu assistente de IA personalizado, 
                  organização por setores e ferramentas para aumentar sua produtividade.
                </p>
              </div>

              {/* Benefits */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
               
             
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Assistente Inteligente</div>
                    <div className="text-gray-600">IA especializada para auxiliar suas tarefas</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Award className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Organização por Setores</div>
                    <div className="text-gray-600">Recursos e permissões personalizados</div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="bg-orange-600 text-white p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">Solicite seu Acesso</div>
                    <div className="text-orange-100">Rápido e sem burocracia</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Register Form */}
            <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Solicitar Acesso
                </h2>
                <p className="text-gray-600">
                  Crie sua conta e comece a usar a IA
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5">⚠️</div>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-700">
                    Nome Completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="João Silva"
                      required
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                    Email Corporativo
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@empresa.com.br"
                      required
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Apenas emails {ALLOWED_EMAIL_DOMAIN}
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="sector" className="block text-sm font-semibold text-gray-700">
                    Setor (Opcional)
                  </label>
                  <div className="relative">
                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      id="sector"
                      value={sectorId}
                      onChange={(e) => setSectorId(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all appearance-none"
                      disabled={loading || loadingSectors}
                    >
                      <option value="">Selecione um setor (opcional)</option>
                      {sectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {loadingSectors ? (
                    <p className="text-xs text-gray-500 mt-1">Carregando setores...</p>
                  ) : sectors.length === 0 ? (
                    <p className="text-xs text-gray-500 mt-1">Nenhum setor disponível. Você pode escolher depois.</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      Escolha seu setor para acessar recursos compartilhados da equipe
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Digite a senha novamente"
                      required
                      minLength={6}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      disabled={loading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Criando conta...</span>
                    </>
                  ) : (
                    <>
                      <span>Criar Conta</span>
                      <UserPlus className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-gray-600 mb-4">
                  Já tem uma conta?
                </p>
                <Link 
                  href="/login"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all"
                >
                  Fazer Login
                </Link>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-500">
                  🔒 Seus dados estão 100% seguros e criptografados
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
