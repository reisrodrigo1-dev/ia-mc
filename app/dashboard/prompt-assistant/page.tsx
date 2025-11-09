'use client';

import { Sparkles, Send, Wand2, BookOpen, Info, ArrowLeft, Copy, Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function PromptAssistantPage() {
  const { user } = useAuth();
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [promptName, setPromptName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const systemPrompt = `Você é um especialista em criar prompts eficazes usando a metodologia RICE (Role, Instructions, Context, Examples).

Quando o usuário descrever o que precisa, você deve:

1. Fazer perguntas clarificadoras se necessário para entender melhor:
   - Qual é o objetivo final?
   - Quem é o público-alvo?
   - Que tipo de resposta espera?
   - Há alguma restrição específica?

2. Criar um prompt estruturado usando RICE:
   - **ROLE (Papel)**: Defina claramente o papel que a IA deve assumir
   - **INSTRUCTIONS (Instruções)**: Liste as tarefas específicas que a IA deve realizar
   - **CONTEXT (Contexto)**: Forneça o contexto necessário para a tarefa
   - **EXAMPLES (Exemplos)**: Quando relevante, inclua exemplos do formato esperado

3. Apresentar o prompt de forma clara e organizada, pronto para uso.

4. Explicar brevemente por que o prompt foi estruturado dessa forma.

Seja direto, claro e focado em criar prompts que realmente funcionam.`;

  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: userInput };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
            userMessage
          ],
          model: 'gpt-4',
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro na requisição');
      }

      // Processar stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (!reader) {
        throw new Error('Reader não disponível');
      }

      // Adicionar mensagem vazia do assistente para ir preenchendo
      const assistantMessageIndex = messages.length + 1;
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                // Atualizar mensagem em tempo real
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[assistantMessageIndex] = {
                    role: 'assistant',
                    content: fullContent
                  };
                  return newMessages;
                });
              }
            } catch (e) {
              // Ignorar erros de parse de chunks parciais
            }
          }
        }
      }

      // Extrair o prompt gerado se houver um bloco de código ou seção de prompt
      const promptMatch = fullContent.match(/```[\s\S]*?```|## PROMPT FINAL[\s\S]*?(?=\n\n|$)/);
      if (promptMatch) {
        setGeneratedPrompt(promptMatch[0].replace(/```/g, '').trim());
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPrompt = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSavePrompt = async () => {
    if (!user || !promptName.trim() || !generatedPrompt) {
      alert('Por favor, preencha o nome do prompt');
      return;
    }

    setSaving(true);

    try {
      const promptDoc = {
        title: promptName,
        content: generatedPrompt,
        category: 'AI Generated',
        tags: ['assistente-ia', 'metodologia-rice'],
        visibility: 'private',
        ownerId: user.id,
        ownerName: user.name,
        sectorId: user.sectorId,
        allowedUsers: [user.id],
        usageCount: 0,
        method: 'ai-assistant',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'prompts'), promptDoc);
      
      alert(`Prompt "${promptName}" salvo com sucesso!`);
      setShowSaveModal(false);
      setPromptName('');
    } catch (error) {
      console.error('Erro ao salvar prompt:', error);
      alert('Erro ao salvar prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setGeneratedPrompt('');
    setUserInput('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/prompts"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <Wand2 className="w-8 h-8 text-purple-600" />
                  Assistente de Prompts
                </h1>
                <p className="text-gray-600 mt-1">
                  IA que ajuda você a criar prompts eficazes usando metodologia RICE
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chat Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Info Card */}
            {messages.length === 0 && (
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-white">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-3">Como funciona?</h2>
                    <div className="space-y-2 text-purple-50">
                      <p className="flex items-start gap-2">
                        <span className="font-bold">1.</span>
                        <span>Descreva o que você precisa fazer com a IA</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-bold">2.</span>
                        <span>O assistente fará perguntas para entender melhor</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-bold">3.</span>
                        <span>Receba um prompt estruturado pronto para usar</span>
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="font-bold">4.</span>
                        <span>Salve na biblioteca ou copie para usar</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-gray-900">Conversa</h3>
                  {messages.length > 0 && (
                    <button
                      onClick={handleReset}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Limpar conversa
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-4 min-h-[400px] max-h-[500px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <Wand2 className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                      Digite sua necessidade abaixo para começar
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                      <span className="text-sm text-gray-600">Pensando...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-6 border-t border-gray-100">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ex: Preciso de um prompt para analisar feedbacks de clientes..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !userInput.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Enviar
                  </button>
                </div>
              </div>
            </div>

            {/* Generated Prompt Preview */}
            {generatedPrompt && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Prompt Gerado
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyPrompt}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-green-600" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copiar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <BookOpen className="w-4 h-4" />
                      Salvar
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                    {generatedPrompt}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Methodology Card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-lg text-gray-900">Metodologia RICE</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="font-semibold text-purple-600 text-sm mb-1">R - Role (Papel)</div>
                  <p className="text-xs text-gray-600">Define o papel que a IA deve assumir</p>
                </div>
                <div>
                  <div className="font-semibold text-purple-600 text-sm mb-1">I - Instructions (Instruções)</div>
                  <p className="text-xs text-gray-600">Lista as tarefas específicas</p>
                </div>
                <div>
                  <div className="font-semibold text-purple-600 text-sm mb-1">C - Context (Contexto)</div>
                  <p className="text-xs text-gray-600">Fornece contexto necessário</p>
                </div>
                <div>
                  <div className="font-semibold text-purple-600 text-sm mb-1">E - Examples (Exemplos)</div>
                  <p className="text-xs text-gray-600">Exemplos do formato esperado</p>
                </div>
              </div>
            </div>

            {/* Tips Card */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5" />
                <h3 className="font-bold text-lg">Dicas para Melhores Prompts</h3>
              </div>
              <ul className="space-y-2 text-sm text-purple-50">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Seja específico sobre o que você precisa</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Mencione o formato de saída desejado</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Inclua restrições importantes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Forneça exemplos quando possível</span>
                </li>
              </ul>
            </div>

            {/* Quick Examples */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
              <h3 className="font-bold text-lg text-gray-900 mb-4">Exemplos Rápidos</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setUserInput('Preciso analisar feedbacks de clientes e identificar padrões')}
                  className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-purple-50 rounded-lg transition-colors text-gray-700"
                >
                  Análise de Feedbacks
                </button>
                <button
                  onClick={() => setUserInput('Quero criar conteúdo para redes sociais sobre produtos')}
                  className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-purple-50 rounded-lg transition-colors text-gray-700"
                >
                  Conteúdo para Redes Sociais
                </button>
                <button
                  onClick={() => setUserInput('Preciso resumir relatórios longos mantendo pontos principais')}
                  className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-purple-50 rounded-lg transition-colors text-gray-700"
                >
                  Resumo de Relatórios
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-900">Salvar Prompt</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Prompt
              </label>
              <input
                type="text"
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                placeholder="Ex: Analisador de Feedbacks"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePrompt}
                disabled={saving || !promptName.trim()}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
