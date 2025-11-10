# Instructions: Adding Exit Keywords UI Fields

## Problem
The file `app/dashboard/whatsapp/training/page.tsx` has duplicate modal code (Create Modal + Edit Modal), making automated string replacement fail.

## Solution
Manually add the exit keywords UI fields in **TWO locations**:

### Location 1: CREATE MODAL (around line 874)
Find this section:
```tsx
                    {/* Tipo de Match */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Correspondência
                      </label>
                      ...
                    </div>
                  </>
                )}

                {/* Prioridade */}
```

**ADD BEFORE** `{/* Prioridade */}`:

```tsx
                    {/* Exit Keywords - Palavras de Saída */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Palavras de Saída (opcional)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Palavras que finalizam o treinamento para aquela conversa (ex: tchau, obrigado, sair)
                      </p>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={exitKeywordInput}
                          onChange={(e) => setExitKeywordInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddExitKeyword())}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          placeholder="Digite uma palavra de saída"
                        />
                        <button
                          type="button"
                          onClick={handleAddExitKeyword}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {exitKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                          >
                            {keyword}
                            <button
                              type="button"
                              onClick={() => handleRemoveExitKeyword(keyword)}
                              className="hover:text-red-900"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Mensagem de Despedida */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mensagem de Despedida (opcional)
                      </label>
                      <textarea
                        value={exitMessage}
                        onChange={(e) => setExitMessage(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Mensagem enviada quando o treinamento é finalizado (ex: Obrigado pelo contato!)"
                      />
                    </div>
```

---

### Location 2: EDIT MODAL (around line 1220)
Find the **second occurrence** of "Tipo de Correspondência" (in the edit modal starting around line 1064).

Look for:
```tsx
{showEditModal && editingTrainingId && (
```

Then scroll down to find the same "Tipo de Match" section and add the SAME code as above before `{/* Prioridade */}`.

---

## Verification
After adding both:
1. Save the file
2. Check for errors in the terminal
3. Test creating a training → should see "Palavras de Saída" and "Mensagem de Despedida" fields
4. Test editing a training → should see the same fields populated with existing data

## Backend Status
✅ Backend is 100% complete:
- States: `exitKeywords`, `exitKeywordInput`, `exitMessage` - DONE
- Handlers: `handleAddExitKeyword()`, `handleRemoveExitKeyword()` - DONE
- Save operations: Create and Update both save exit fields - DONE
- Load operation: Edit modal loads exit fields from Firestore - DONE
- Webhook: Processes exit keywords and deactivates training - DONE

Only missing: Visual form fields (this addition)
