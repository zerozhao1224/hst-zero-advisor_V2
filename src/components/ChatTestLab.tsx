import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ShieldAlert, Sparkles, Database, CheckCircle, RefreshCw, AlertCircle, Clock, Search, BookOpen, Swords, Share2, Copy, Check } from 'lucide-react';
import { ChatMessage, RetrievedDoc } from '../types';

interface ChatTestLabProps {
  systemBotName: string;
  isAdmin?: boolean;
}

export const ChatTestLab: React.FC<ChatTestLabProps> = ({ systemBotName, isAdmin = false }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: `主公近來可好！吾乃《熱血三國M》官方 AI 攻略軍師【${systemBotName}】。\n\n我精研官方資料庫內記載之【名將捕捉、戰法搭配、城防克制、兵種射程與開荒陣容】。主公有任何軍國要務或配隊疑難，請儘管示下！`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDocMsg, setSelectedDocMsg] = useState<ChatMessage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      });

      let rawResponseText = '';
      try {
        rawResponseText = await res.text();
      } catch (readErr: any) {
        throw new Error(`網路讀取失敗：${readErr.message}`);
      }

      let data: any = null;
      if (rawResponseText) {
        try {
          data = JSON.parse(rawResponseText);
        } catch (jsonErr) {
          if (rawResponseText.includes('<!DOCTYPE') || rawResponseText.includes('<html')) {
            throw new Error(`伺服器容器正在冷啟動中 (HTTP ${res.status})，請稍候 3~5 秒後再次點擊發送！`);
          }
          throw new Error(`伺服器未回傳有效 JSON (HTTP ${res.status})：${rawResponseText.slice(0, 100)}`);
        }
      }

      if (!res.ok || !data) {
        throw new Error(data?.message || `伺服器回應異常 (${res.status})，請稍候重試`);
      }

      if (data.success) {
        const botMsg: ChatMessage = {
          id: 'msg-ai-' + Date.now(),
          sender: 'assistant',
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          retrievedDocs: data.retrievedDocs || [],
          refused: data.refused,
          executionTimeMs: data.executionTimeMs,
          modelUsed: data.modelUsed,
        };
        setMessages((prev) => [...prev, botMsg]);
        setSelectedDocMsg(botMsg);
      } else {
        const errorMsg: ChatMessage = {
          id: 'msg-err-' + Date.now(),
          sender: 'assistant',
          text: '⚠️ 軍師提醒：' + (data.message || '無法連線至資料庫'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        sender: 'assistant',
        text: '⚠️ 查詢提示：' + err.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    { label: '🗡️ 關羽初始數值與戰略', text: '請問關羽的初始勇武、統率與智謀數值如何？適合作為主將攻城還是野戰？' },
    { label: '🏹 10級黃巾城標準配兵', text: '請問攻打10級黃巾城需要多少兵力？投石車與衝車應該如何配比？' },
    { label: '📜 12大兵種射程與克制', text: '請解析熱血三國投石車、弓箭兵、鐵騎兵與衝車的射程與克制機制。' },
    { label: '🏰 陷阱拒馬踩平算法', text: '敵城有 5000 陷阱與 3000 拒馬，需要多少砲灰義兵才能零傷亡踩平？' },
    { label: '👑 名將捕捉四步秘訣', text: '請問如何查看名將座標，並透過打降民心至0俘虜名將？' },
  ];

  return (
    <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-3' : 'max-w-4xl mx-auto'} gap-4 sm:gap-6 h-[calc(100dvh-8rem)] sm:h-[calc(100vh-9.5rem)] min-h-[520px] sm:min-h-[620px]`}>
      {/* Main Chat Area */}
      <div className={`${isAdmin ? 'lg:col-span-2' : 'w-full'} flex flex-col bg-slate-900/95 border border-amber-500/25 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md`}>
        {/* Chat Room Top Hero Banner */}
        <div className="relative bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-950 px-3.5 sm:px-5 py-2.5 sm:py-3.5 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 z-10 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-600 via-amber-700 to-red-900 border border-amber-400/40 flex items-center justify-center shadow-lg shrink-0">
              <Bot className="w-4 h-4 sm:w-6 sm:h-6 text-amber-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h2 className="text-xs sm:text-sm font-bold text-amber-100 truncate">
                  <span>官方 AI 軍師【{systemBotName}】</span>
                </h2>
                <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 shrink-0">
                  資料庫連線
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">解答戰法搭配、城池攻防、名將抓捕與行軍計算</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 z-10 shrink-0">
            <button
              onClick={() => {
                setMessages([
                  {
                    id: 'welcome-' + Date.now(),
                    sender: 'assistant',
                    text: `對話紀錄已重置。主公，我是【${systemBotName}】，請隨時示下軍情問題！`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  },
                ]);
                setSelectedDocMsg(null);
              }}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs text-slate-300 hover:text-amber-200 bg-slate-800/80 hover:bg-slate-700/80 rounded-lg border border-slate-700 transition"
              title="重新整理對話"
            >
              <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xs:inline">新對話</span>
            </button>
          </div>
        </div>

        {/* Quick Prompts Bar */}
        <div className="bg-slate-950/90 p-2 sm:p-2.5 border-b border-slate-800/80 flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] sm:text-xs text-amber-400 font-semibold whitespace-nowrap pl-1 flex items-center space-x-1 shrink-0">
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">推薦錦囊：</span>
          </span>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(qp.text)}
              disabled={loading}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs rounded-full bg-slate-800/90 hover:bg-amber-600/25 text-slate-300 hover:text-amber-200 border border-slate-700/80 hover:border-amber-500/40 whitespace-nowrap transition cursor-pointer shadow-sm shrink-0"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 bg-slate-950/40">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}
              >
                <div className={`flex space-x-2 sm:space-x-3 max-w-[92%] sm:max-w-[88%] ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-md ${
                      isUser
                        ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-slate-950 border border-amber-400/40 font-bold'
                        : msg.refused
                        ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                        : 'bg-slate-900 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />}
                  </div>

                  {/* Message Bubble */}
                  <div className="flex flex-col min-w-0">
                    <div
                      className={`p-3 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-lg break-words ${
                        isUser
                          ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 font-medium rounded-tr-none shadow-amber-900/20'
                          : msg.refused
                          ? 'bg-rose-950/50 border border-rose-800/70 text-rose-200 rounded-tl-none'
                          : 'bg-slate-900/90 border border-amber-500/20 text-slate-100 rounded-tl-none'
                      }`}
                    >
                      {/* Refusal Badge if applicable */}
                      {msg.refused && (
                        <div className="flex items-center space-x-1.5 text-[11px] sm:text-xs text-rose-400 font-semibold mb-2 pb-1.5 border-b border-rose-800/50">
                          <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                          <span>【已觸發官方知識庫領域防護】</span>
                        </div>
                      )}

                      {msg.text}

                      {/* Footer Info for AI Messages */}
                      {!isUser && (
                        <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between text-[10px] sm:text-[11px] text-slate-400 gap-1.5">
                          <div className="flex items-center space-x-2">
                            {msg.executionTimeMs && (
                              <span className="flex items-center space-x-1 text-slate-500 font-mono">
                                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span>{msg.executionTimeMs}ms</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1.5">
                            {/* Copy button */}
                            <button
                              onClick={() => copyMessage(msg.id, msg.text)}
                              className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] sm:text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition"
                              title="複製錦囊內容"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                                  <span className="text-emerald-400">已複製</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  <span>複製</span>
                                </>
                              )}
                            </button>

                            {/* Inspect Documents Button (Admin or player) */}
                            {isAdmin && msg.retrievedDocs && msg.retrievedDocs.length > 0 && (
                              <button
                                onClick={() => setSelectedDocMsg(msg)}
                                className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] sm:text-xs transition ${
                                  selectedDocMsg?.id === msg.id
                                    ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                                    : 'bg-slate-800 hover:bg-slate-700 text-amber-400'
                                }`}
                              >
                                <Database className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                <span>參考條目 ({msg.retrievedDocs.length})</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className={`text-[9px] sm:text-[10px] text-slate-500 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start items-center space-x-2 sm:space-x-3">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-slate-900 border border-amber-500/40 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 animate-spin" />
              </div>
              <div className="bg-slate-900 p-2.5 sm:p-3.5 rounded-2xl rounded-tl-none border border-amber-500/30 text-[11px] sm:text-xs text-slate-200 flex items-center space-x-2 shadow-lg">
                <div className="flex space-x-1 shrink-0">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 animate-bounce"></div>
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]"></div>
                </div>
                <span>軍師正在查閱《熱血三國M》官方資料庫研擬破敵之策...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-2.5 sm:p-3.5 bg-slate-950 border-t border-slate-800/90">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2 sm:space-x-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="輸入問題（例：桃園盾配法？10級黃巾城衝車帶多少？...）"
              className="flex-1 bg-slate-900 text-slate-100 border border-slate-700/80 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm focus:outline-none focus:border-amber-500/80 placeholder-slate-500 shadow-inner"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center space-x-1 sm:space-x-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer text-xs sm:text-sm shrink-0"
            >
              <span>請教軍師</span>
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* RAG Inspector Sidebar (Admin Only View) */}
      {isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-full overflow-hidden shadow-2xl">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-slate-100 text-sm">RAG 官方資料庫檢索監控 (管理員)</h3>
          </div>

          {selectedDocMsg && selectedDocMsg.retrievedDocs && selectedDocMsg.retrievedDocs.length > 0 ? (
            <div className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1">
              <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-300">
                <span className="font-semibold">當前審視訊息：</span>
                <p className="text-slate-300 italic mt-0.5 text-[11px] truncate">"{selectedDocMsg.text.slice(0, 50)}..."</p>
              </div>

              <div className="text-xs text-slate-400 font-medium">
                命中官方文獻條目 ({selectedDocMsg.retrievedDocs.length} 筆)：
              </div>

              {selectedDocMsg.retrievedDocs.map((doc, idx) => (
                <div
                  key={doc.id || idx}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 space-y-2 hover:border-amber-500/50 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <h4 className="text-xs font-bold text-slate-100">{doc.title}</h4>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-semibold shrink-0">
                      相關度 {Math.round(doc.score * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                    <span className="bg-slate-900 px-2 py-0.5 rounded text-amber-400 border border-slate-700">
                      分類：{doc.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-950/80 p-2 rounded border border-slate-800 leading-relaxed font-mono text-[11px]">
                    {doc.contentSnippet}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400">尚未選擇或無 RAG 檢索參考</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  發送提問或點選 AI 回應底部的【參考條目】按鈕，即可在此檢視檢索得出的官方遊戲條目。
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
