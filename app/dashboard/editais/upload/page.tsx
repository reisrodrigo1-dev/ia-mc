'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  FileText,
} from 'lucide-react';

interface ResumoImportacao {
  totalAulas: number;
  materias: string[];
  aulasPorMateria: Array<{
    materia: string;
    quantidade: number;
  }>;
}

export default function UploadVideoAulasPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const [catalogoId, setCatalogoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResumo(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) {
      setError('Selecione um arquivo primeiro');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.uid || user.id);

      const response = await fetch('/api/editais/import-excel', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar arquivo');
      }

      setResumo(data.resumo);
      setCatalogoId(data.catalogoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    // Template de exemplo
    const template = `ID_AULA,NOME_AULA,DATA_GRAVAÇÃO,QUANTIDA_BLOCOS,PROFESSOR
1,Publicidade profissional,2018-07-03,1,Marco Antonio Araujo Junior
2,Direito do advogado,2018-07-05,1,Marco Antonio Araujo Junior
3,Organização dos Poderes,2018-07-17,1,Daniel Lamounier`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_video_aulas.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Upload de Vídeo Aulas
          </h1>
          <p className="text-gray-600">
            Importe seu catálogo de vídeo aulas em Excel para análise de editais
          </p>
        </div>

        {/* Template Download */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Primeira vez usando?
              </h3>
              <p className="text-sm text-blue-700 mb-2">
                Baixe nosso template de exemplo para entender o formato correto do Excel
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Baixar Template de Exemplo
              </button>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-orange-500 transition-colors">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <FileSpreadsheet className="w-8 h-8 text-orange-600" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {file ? file.name : 'Selecione seu arquivo Excel'}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Formatos aceitos: .xlsx, .xls, .csv
              </p>
            </div>

            <div className="flex gap-3">
              <label className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer transition-colors flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Escolher Arquivo
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {file && (
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Importar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Instruções */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            📋 Formato esperado do Excel:
          </h4>
          <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
            <li><strong>ID_AULA</strong>: Identificador único da vídeo aula</li>
            <li><strong>NOME_AULA</strong>: Nome/título da aula</li>
            <li><strong>DATA_GRAVAÇÃO</strong>: Data de gravação (opcional)</li>
            <li><strong>QUANTIDA_BLOCOS</strong>: Quantidade de blocos (opcional)</li>
            <li><strong>PROFESSOR</strong>: Nome do professor</li>
          </ul>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900 mb-1">Erro ao processar</h4>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Resumo */}
        {resumo && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-green-900 mb-1">
                  ✅ Importação Concluída!
                </h3>
                <p className="text-sm text-green-700">
                  ID do Catálogo: <code className="bg-green-100 px-2 py-1 rounded">{catalogoId}</code>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600 mb-1">Total de Aulas</p>
                <p className="text-2xl font-bold text-gray-900">{resumo.totalAulas}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600 mb-1">Matérias</p>
                <p className="text-2xl font-bold text-gray-900">{resumo.materias.length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <p className="text-lg font-bold text-green-600">Pronto</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-green-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                📚 Aulas por Matéria:
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {resumo.aulasPorMateria.map((item) => (
                  <div
                    key={item.materia}
                    className="flex justify-between items-center p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm text-gray-700">{item.materia}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {item.quantidade} aulas
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Próximo passo:</strong> Vá para "Analisar Edital" para usar este catálogo na análise de editais de concurso!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
