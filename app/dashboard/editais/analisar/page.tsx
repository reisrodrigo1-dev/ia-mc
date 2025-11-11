'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  BookOpen,
  Clock,
  User,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

interface Catalogo {
  id: string;
  nome: string;
  totalAulas: number;
  totalMaterias: number;
  criadoEm: Date;
}

interface AnaliseResultado {
  editalAnalisado: boolean;
  materiasEncontradas: string[];
  topicosIdentificados?: Record<string, string[]>;
  aulasRecomendadas: Array<{
    materia: string;
    aulas: Array<{
      id: string;
      nome: string;
      professor: string;
      quantidadeBlocos: number;
      dataGravacao?: string;
      relevancia: number;
      justificativa?: string;
      topicosRelacionados?: string[];
    }>;
  }>;
  estatisticas: {
    totalAulasRecomendadas: number;
    materiasCobertas: number;
    coberturaPercentual: number;
  };
}

export default function AnalisarEditalPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [catalogoSelecionado, setCatalogoSelecionado] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState<AnaliseResultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    carregarCatalogos();
  }, [user]);

  const carregarCatalogos = async () => {
    if (!user) return;

    try {
      const q = query(
        collection(db, 'editais_catalogos'),
        where('id', '>=', 'catalogo_'),
        where('id', '<', 'catalogo_\uf8ff'),
        orderBy('id', 'desc'),
        limit(10)
      );

      const querySnapshot = await getDocs(q);
      const catalogosData: Catalogo[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.nome && data.totalAulas) { // Verifica se é um documento principal
          catalogosData.push({
            id: data.id,
            nome: data.nome,
            totalAulas: data.totalAulas,
            totalMaterias: data.totalMaterias,
            criadoEm: data.criadoEm?.toDate() || new Date()
          });
        }
      });

      setCatalogos(catalogosData);
      if (catalogosData.length > 0 && !catalogoSelecionado) {
        setCatalogoSelecionado(catalogosData[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar catálogos:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Aceitar PDF ou TXT
      const isValidType = selectedFile.type === 'application/pdf' ||
                         selectedFile.type === 'text/plain' ||
                         selectedFile.name.toLowerCase().endsWith('.txt');

      if (!isValidType) {
        setError('Por favor, selecione um arquivo PDF ou TXT');
        return;
      }

      setFile(selectedFile);
      setError(null);
      setResultado(null);
    }
  };

  const handleAnalise = async () => {
    if (!file || !catalogoSelecionado || !user) {
      setError('Selecione um arquivo (PDF ou TXT) e um catálogo');
      return;
    }

    setAnalisando(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('catalogId', catalogoSelecionado);

      const response = await fetch('/api/editais/analisar', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao analisar edital');
      }

      setResultado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Analisar Edital
          </h1>
          <p className="text-gray-600">
            Faça upload de um edital (PDF ou TXT) e receba recomendações de vídeo aulas baseadas no conteúdo
          </p>
        </div>

        {/* Seletor de Catálogo */}
        {catalogos.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Selecione o Catálogo de Vídeo Aulas:
            </label>
            <select
              value={catalogoSelecionado}
              onChange={(e) => setCatalogoSelecionado(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              {catalogos.map((catalogo) => (
                <option key={catalogo.id} value={catalogo.id}>
                  {catalogo.nome} - {catalogo.totalAulas} aulas ({catalogo.totalMaterias} matérias)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Upload Area */}
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-orange-500 transition-colors mb-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-orange-600" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {file ? file.name : 'Selecione o edital'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Formatos aceitos: .pdf, .txt
                {file?.type === 'text/plain' && (
                  <span className="text-green-600 font-medium"> ✓ Texto será processado diretamente</span>
                )}
                {file?.type === 'application/pdf' && (
                  <span className="text-orange-600 font-medium"> ⚠️ PDFs ainda não suportados (use .txt)</span>
                )}
              </p>
            </div>

            <div className="flex gap-3">
              <label className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer transition-colors flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Escolher Arquivo
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {file && catalogoSelecionado && (
                <button
                  onClick={handleAnalise}
                  disabled={analisando}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {analisando ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Analisar Edital
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Instruções */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">
            📋 Sobre os formatos:
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li><strong>📄 Arquivos .txt:</strong> Suportados - texto será analisado diretamente</li>
            <li><strong>📕 Arquivos .pdf:</strong> Em desenvolvimento - use .txt por enquanto</li>
            <li><strong>💡 Dica:</strong> Copie o conteúdo do edital para um arquivo .txt para testar</li>
          </ul>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900 mb-1">Erro na análise</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Resultado da Análise */}
        {resultado && (
          <div className="space-y-6">
            {/* Estatísticas */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900 mb-1">
                    ✅ Análise Concluída!
                  </h3>
                  <p className="text-sm text-green-700">
                    Edital analisado com sucesso. Encontramos recomendações baseadas no conteúdo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600 mb-1">Matérias Identificadas</p>
                  <p className="text-2xl font-bold text-gray-900">{resultado.materiasEncontradas.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600 mb-1">Aulas Recomendadas</p>
                  <p className="text-2xl font-bold text-gray-900">{resultado.estatisticas.totalAulasRecomendadas}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600 mb-1">Cobertura</p>
                  <p className="text-2xl font-bold text-gray-900">{resultado.estatisticas.coberturaPercentual}%</p>
                </div>
              </div>
            </div>

            {/* Tópicos Identificados */}
            {resultado.topicosIdentificados && Object.keys(resultado.topicosIdentificados).length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900 mb-1">
                      📋 Tópicos que você precisa estudar
                    </h3>
                    <p className="text-sm text-blue-700">
                      Baseado na análise do edital, estes são os temas específicos identificados:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(resultado.topicosIdentificados).map(([materia, topicos]) => (
                    <div key={materia} className="bg-white p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-900 mb-2">{materia}</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        {topicos.map((topico, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-blue-600 mt-1">•</span>
                            <span>{topico}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recomendações por Matéria */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">📚 Recomendações por Matéria</h3>

              {resultado.aulasRecomendadas.map((materiaGroup) => (
                <div key={materiaGroup.materia} className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-orange-600" />
                    {materiaGroup.materia}
                    <span className="text-sm font-normal text-gray-600">
                      ({materiaGroup.aulas.length} aulas recomendadas)
                    </span>
                  </h4>

                  <div className="space-y-3">
                    {materiaGroup.aulas.map((aula) => (
                      <div key={aula.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-medium text-gray-900">{aula.nome}</h5>
                            <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                              ID: {aula.id}
                            </span>
                          </div>

                          {aula.justificativa && (
                            <p className="text-sm text-blue-700 mb-2 italic">
                              💡 {aula.justificativa}
                            </p>
                          )}

                          {aula.topicosRelacionados && aula.topicosRelacionados.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-600 mb-1">Tópicos relacionados:</p>
                              <div className="flex flex-wrap gap-1">
                                {aula.topicosRelacionados.map((topico, idx) => (
                                  <span key={idx} className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                    {topico}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {aula.professor}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {aula.quantidadeBlocos} bloco{aula.quantidadeBlocos !== 1 ? 's' : ''}
                            </span>
                            {aula.dataGravacao && (
                              <span className="flex items-center gap-1">
                                📅 {new Date(aula.dataGravacao).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-sm font-medium text-orange-600">
                            {Math.round(aula.relevancia * 100)}% relevante
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sem catálogos */}
        {catalogos.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Nenhum catálogo encontrado
            </h3>
            <p className="text-blue-700 mb-4">
              Você precisa primeiro importar um catálogo de vídeo aulas para poder analisar editais.
            </p>
            <a
              href="/dashboard/editais/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Ir para Upload
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
