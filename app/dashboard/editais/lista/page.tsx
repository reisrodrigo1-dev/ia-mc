'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  BookOpen,
  Calendar,
  Users,
  FileText,
  Eye,
  Trash2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';

interface Catalogo {
  id: string;
  nome: string;
  totalAulas: number;
  totalMaterias: number;
  materias: string[];
  criadoEm: Date;
}

interface MateriaDetail {
  materia: string;
  totalAulas: number;
  aulas: Array<{
    id: string;
    nome: string;
    professor: string;
    quantidadeBlocos: number;
    dataGravacao?: string;
  }>;
}

export default function ListaEditaisPage() {
  const { user } = useAuth();
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCatalogo, setSelectedCatalogo] = useState<Catalogo | null>(null);
  const [materiaDetails, setMateriaDetails] = useState<MateriaDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    carregarCatalogos();
  }, [user]);

  const carregarCatalogos = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'editais_catalogos'),
        where('id', '>=', 'catalogo_'),
        where('id', '<', 'catalogo_\uf8ff'),
        orderBy('id', 'desc')
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
            materias: data.materias || [],
            criadoEm: data.criadoEm?.toDate() || new Date()
          });
        }
      });

      setCatalogos(catalogosData);
    } catch (err) {
      console.error('Erro ao carregar catálogos:', err);
      setError('Erro ao carregar catálogos');
    } finally {
      setLoading(false);
    }
  };

  const visualizarCatalogo = async (catalogo: Catalogo) => {
    setSelectedCatalogo(catalogo);
    setLoadingDetails(true);
    setMateriaDetails([]);

    try {
      const details: MateriaDetail[] = [];

      for (const materia of catalogo.materias) {
        try {
          // Buscar todos os chunks da matéria
          const q = query(
            collection(db, 'editais_catalogos'),
            where('catalogId', '==', catalogo.id),
            where('materia', '==', materia)
          );

          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            let todasAulas: Array<{
              id: string;
              nome: string;
              professor: string;
              quantidadeBlocos: number;
              dataGravacao?: string;
            }> = [];
            let totalAulasMateria = 0;

            querySnapshot.forEach((doc) => {
              const data = doc.data();
              if (data.aulas) {
                todasAulas = todasAulas.concat(data.aulas);
                totalAulasMateria = data.totalAulas || 0;
              }
            });

            details.push({
              materia: materia,
              totalAulas: totalAulasMateria,
              aulas: todasAulas.slice(0, 10) // Mostrar apenas as primeiras 10 para preview
            });
          }
        } catch (err) {
          console.warn(`Erro ao carregar detalhes da matéria ${materia}:`, err);
        }
      }

      setMateriaDetails(details);
    } catch (err) {
      console.error('Erro ao carregar detalhes:', err);
      setError('Erro ao carregar detalhes do catálogo');
    } finally {
      setLoadingDetails(false);
    }
  };

  const excluirCatalogo = async (catalogoId: string) => {
    if (!confirm('Tem certeza que deseja excluir este catálogo? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      // Buscar todos os documentos relacionados ao catálogo
      const q = query(
        collection(db, 'editais_catalogos'),
        where('catalogId', '==', catalogoId)
      );

      const querySnapshot = await getDocs(q);
      const deletePromises = [];

      // Adicionar documento principal
      deletePromises.push(deleteDoc(doc(db, 'editais_catalogos', catalogoId)));

      // Adicionar documentos das matérias
      querySnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });

      await Promise.all(deletePromises);

      // Atualizar lista local
      setCatalogos(prev => prev.filter(c => c.id !== catalogoId));
      setSelectedCatalogo(null);
      setMateriaDetails([]);

      alert('Catálogo excluído com sucesso!');
    } catch (err) {
      console.error('Erro ao excluir catálogo:', err);
      alert('Erro ao excluir catálogo');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            <span className="ml-2 text-gray-600">Carregando catálogos...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Meus Catálogos
          </h1>
          <p className="text-gray-600">
            Gerencie seus catálogos de vídeo aulas importados
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900 mb-1">Erro</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Lista de Catálogos */}
        {catalogos.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Nenhum catálogo encontrado
            </h3>
            <p className="text-blue-700 mb-4">
              Você ainda não importou nenhum catálogo de vídeo aulas.
            </p>
            <a
              href="/dashboard/editais/upload"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Importar Catálogo
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Catálogos Disponíveis</h2>

              {catalogos.map((catalogo) => (
                <div
                  key={catalogo.id}
                  className={`bg-white border rounded-lg p-6 cursor-pointer transition-colors ${
                    selectedCatalogo?.id === catalogo.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => visualizarCatalogo(catalogo)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {catalogo.nome}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        ID: {catalogo.id}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          {catalogo.totalAulas} aulas
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {catalogo.totalMaterias} matérias
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {catalogo.criadoEm.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          visualizarCatalogo(catalogo);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Visualizar detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          excluirCatalogo(catalogo.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir catálogo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {catalogo.materias.slice(0, 3).map((materia) => (
                      <span
                        key={materia}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {materia}
                      </span>
                    ))}
                    {catalogo.materias.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        +{catalogo.materias.length - 3} mais
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Detalhes */}
            <div>
              {selectedCatalogo ? (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Detalhes do Catálogo
                  </h2>

                  {loadingDetails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                      <span className="ml-2 text-gray-600">Carregando detalhes...</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Total de Aulas</p>
                          <p className="text-2xl font-bold text-gray-900">{selectedCatalogo.totalAulas}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Matérias</p>
                          <p className="text-2xl font-bold text-gray-900">{selectedCatalogo.totalMaterias}</p>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Matérias e Aulas</h3>
                        <div className="space-y-3">
                          {materiaDetails.map((detail) => (
                            <div key={detail.materia} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gray-900">{detail.materia}</h4>
                                <span className="text-sm text-gray-600">{detail.totalAulas} aulas</span>
                              </div>
                              <div className="space-y-1">
                                {detail.aulas.slice(0, 3).map((aula) => (
                                  <div key={aula.id} className="text-sm text-gray-600 flex justify-between">
                                    <span className="truncate">{aula.nome}</span>
                                    <span className="text-gray-500 ml-2">{aula.professor}</span>
                                  </div>
                                ))}
                                {detail.aulas.length > 3 && (
                                  <p className="text-sm text-gray-500">
                                    ... e mais {detail.aulas.length - 3} aulas
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Selecione um catálogo
                  </h3>
                  <p className="text-gray-600">
                    Clique em um catálogo da lista para visualizar seus detalhes
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
