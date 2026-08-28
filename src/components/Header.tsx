import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  ShieldCheck, 
  Database, 
  MessageSquare, 
  Castle, 
  Settings, 
  Code, 
  Sparkles, 
  Lock, 
  Unlock, 
  Users, 
  ShieldAlert, 
  ExternalLink,
  Crown,
  KeyRound,
  Mail,
  AlertTriangle,
  CheckCircle,
  LogIn,
  LogOut,
  User
} from 'lucide-react';
import { AdminUser } from '../types';

interface HeaderProps {
  activeTab: 'chat' | 'kb' | 'siege' | 'config' | 'discord' | 'admins';
  setActiveTab: (tab: 'chat' | 'kb' | 'siege' | 'config' | 'discord' | 'admins') => void;
  kbCount: number;
  strictnessLevel: string;
  isAdmin: boolean;
  setIsAdmin: (val: boolean) => void;
  currentUser: AdminUser | null;
  setCurrentUser: (user: AdminUser | null) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  kbCount,
  strictnessLevel,
  isAdmin,
  setIsAdmin,
  currentUser,
  setCurrentUser,
}) => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Check URL params on mount for auto-invitation claiming
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get('invite');
      if (invite) {
        setInviteCodeInput(invite);
        setShowAdminModal(true);
      }
    }
  }, []);

  const handleGoogleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = googleEmailInput.trim();
    if (!email) {
      setAuthError('請輸入您的 Google / Gmail 帳號');
      return;
    }

    if (!email.includes('@')) {
      setAuthError('請輸入格式正確的 Email 信箱 (例如: yourname@gmail.com)');
      return;
    }

    setVerifying(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const res = await fetch('/api/admin/verify-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          name: googleNameInput.trim() || undefined,
          inviteCode: inviteCodeInput.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.authorized) {
        setAuthSuccess(data.message || 'Google 登入驗證成功！');
        setCurrentUser(data.user);
        setIsAdmin(true);
        setTimeout(() => {
          setShowAdminModal(false);
          setAuthSuccess(null);
          setGoogleEmailInput('');
          setGoogleNameInput('');
          setInviteCodeInput('');
        }, 1200);
      } else {
        setAuthError(
          data.message ||
          `⛔ 拒絕存取：Google 帳號 (${email}) 未在管理員授權名單內。\n管理員後台採邀請制，請聯絡建立者 (zeroatos@gmail.com) 寄送邀請郵件。`
        );
      }
    } catch (err: any) {
      setAuthError('連線驗證失敗：' + err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleQuickCreatorLogin = async () => {
    setGoogleEmailInput('zeroatos@gmail.com');
    setGoogleNameInput('建立者 (zeroatos)');
    setVerifying(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/verify-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'zeroatos@gmail.com',
          name: '系統建立者 (zeroatos)',
        }),
      });

      const data = await res.json();
      if (data.success && data.authorized) {
        setAuthSuccess('建立者身份驗證成功！');
        setCurrentUser(data.user);
        setIsAdmin(true);
        setTimeout(() => {
          setShowAdminModal(false);
          setAuthSuccess(null);
        }, 800);
      }
    } catch (e: any) {
      setAuthError('建立者登入失敗：' + e.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setCurrentUser(null);
    if (['kb', 'config', 'discord', 'admins'].includes(activeTab)) {
      setActiveTab('chat');
    }
  };

  return (
    <>
      <header className="bg-slate-950/90 border-b border-amber-500/20 text-slate-100 sticky top-0 z-50 backdrop-blur-md shadow-2xl">
        {/* Top Gold Foil Accent Line */}
        <div className="h-0.5 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 w-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo & Branding - Synchronized with hsg.94hi.net */}
            <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
              <div className="relative group cursor-pointer shrink-0" onClick={() => setActiveTab('chat')}>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-b from-amber-950/80 via-slate-900 to-slate-950 border border-amber-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.25)] group-hover:border-amber-400 transition-all">
                  <img
                    src="https://hsg.94hi.net/assets/rxsg-logo.png"
                    alt="熱血三國Logo"
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-md"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" title="在線" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="text-base sm:text-xl font-extrabold tracking-wider bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent drop-shadow-sm font-serif truncate">
                    熱血三國 M
                  </h1>
                  <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-inner shrink-0">
                    官方 AI 軍師
                  </span>
                  {!isAdmin && (
                    <span className="hidden md:inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-500/30 shrink-0">
                      玩家專屬公開版
                    </span>
                  )}
                  {isAdmin && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 animate-pulse shrink-0">
                      <ShieldAlert className="w-3 h-3 text-indigo-400" />
                      <span>管理員後台</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span className="hidden xs:inline">正統經典 SLG 戰略 · 即時破防推演 · 名將數值庫</span>
                  <span className="xs:hidden">即時破防推演 · 名將數據庫</span>
                  <a
                    href="https://hsg.94hi.net"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-500/80 hover:text-amber-400 underline flex items-center space-x-0.5 text-[11px]"
                  >
                    <span>官網</span>
                    <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </a>
                </p>
              </div>
            </div>

            {/* Mode Switch & User Auth Status */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Database & Guardrail Badges (Desktop) */}
              <div className="hidden lg:flex items-center space-x-2 text-xs">
                <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 shadow-inner">
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <span>資料庫：<strong className="text-amber-300 font-mono">{kbCount}</strong> 筆</span>
                </div>

                <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-medium">AI 大軍師連線中</span>
                </div>
              </div>

              {/* View Switch / Login Button */}
              {isAdmin ? (
                <div className="flex items-center space-x-2">
                  {currentUser && (
                    <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                      {currentUser.role === 'super_admin' ? (
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      )}
                      <span className="font-mono text-slate-300 text-[11px] max-w-[120px] truncate">
                        {currentUser.email}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-800/60 shadow transition cursor-pointer"
                    title="登出管理員身分並返回玩家版"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">登出管理員</span>
                    <span className="sm:hidden">登出</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAdminModal(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-700/70 hover:border-amber-500/40 transition shadow cursor-pointer"
                  title="Google 驗證邀請制管理員登入"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
                  <span className="hidden sm:inline">管理員登入 (邀請制)</span>
                  <span className="sm:hidden">後台</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1.5 border-t border-slate-800/80 pt-1.5 overflow-x-auto no-scrollbar pb-1">
            {/* Player View Tabs */}
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-t from-amber-500/20 to-transparent text-amber-200 border-b-2 border-amber-400 font-bold shadow-[0_-4px_12px_rgba(245,158,11,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>⚔️ 臥龍軍師問答</span>
            </button>

            <button
              onClick={() => setActiveTab('siege')}
              className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap ${
                activeTab === 'siege'
                  ? 'bg-gradient-to-t from-amber-500/20 to-transparent text-amber-200 border-b-2 border-amber-400 font-bold shadow-[0_-4px_12px_rgba(245,158,11,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Castle className="w-4 h-4 text-amber-400" />
              <span>🏰 城池破防攻堅規劃器</span>
            </button>

            {/* Admin-Only Tabs (Visible when authenticated) */}
            {isAdmin && (
              <>
                <div className="h-6 w-px bg-slate-800 self-center mx-1" />

                <button
                  onClick={() => setActiveTab('admins')}
                  className={`flex items-center space-x-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                    activeTab === 'admins'
                      ? 'bg-indigo-950/80 text-indigo-200 border-b-2 border-indigo-400 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>👥 權限與邀請管理</span>
                </button>

                <button
                  onClick={() => setActiveTab('kb')}
                  className={`flex items-center space-x-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                    activeTab === 'kb'
                      ? 'bg-indigo-950/60 text-indigo-200 border-b-2 border-indigo-400 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>📚 知識庫歸檔</span>
                </button>

                <button
                  onClick={() => setActiveTab('config')}
                  className={`flex items-center space-x-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                    activeTab === 'config'
                      ? 'bg-indigo-950/60 text-indigo-200 border-b-2 border-indigo-400 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 text-indigo-400" />
                  <span>⚙️ 語境與邊界防護</span>
                </button>

                <button
                  onClick={() => setActiveTab('discord')}
                  className={`flex items-center space-x-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                    activeTab === 'discord'
                      ? 'bg-indigo-950/60 text-indigo-200 border-b-2 border-indigo-400 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Code className="w-3.5 h-3.5 text-indigo-400" />
                  <span>🤖 Discord BOT 控制台</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Google Authentication & Invite Verification Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <span>管理員邀請制身分驗證</span>
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    Google 登入驗證
                  </span>
                </h3>
                <p className="text-xs text-slate-400">僅限系統建立者或已獲授權邀請之 Gmail 登入</p>
              </div>
            </div>

            {/* Quick Super Admin (Creator) Fast Login Banner */}
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-300">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>系統建立者快捷身分驗證</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  zeroatos@gmail.com
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                若您是系統建立者 (zeroatos)，可直接點選快速驗證進入最高管理員後台。
              </p>
              <button
                type="button"
                onClick={handleQuickCreatorLogin}
                disabled={verifying}
                className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-lg text-xs transition flex items-center justify-center space-x-1.5 shadow cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>以建立者 (zeroatos@gmail.com) 登入後台</span>
              </button>
            </div>

            {/* Form for Google / Invited Admin Verification */}
            <form onSubmit={handleGoogleVerify} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span>受邀 Google / Gmail 帳號：</span>
                    <span className="text-[11px] text-amber-400">強制 Gmail 格式</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={googleEmailInput}
                      onChange={(e) => {
                        setGoogleEmailInput(e.target.value);
                        setAuthError(null);
                      }}
                      placeholder="請輸入您的 Gmail 帳號 (例如: yourname@gmail.com)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      顯示名稱（選填）：
                    </label>
                    <input
                      type="text"
                      value={googleNameInput}
                      onChange={(e) => setGoogleNameInput(e.target.value)}
                      placeholder="例：副盟主 趙雲"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                      <KeyRound className="w-3 h-3 text-slate-400" />
                      <span>邀請代碼（若有）：</span>
                    </label>
                    <input
                      type="text"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value)}
                      placeholder="例：rxsg_inv_..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Error Message Alert */}
              {authError && (
                <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-xs text-rose-300 space-y-1 animate-fadeIn">
                  <div className="font-bold flex items-center space-x-1.5 text-rose-400">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>身分授權未通過</span>
                  </div>
                  <p className="whitespace-pre-line leading-relaxed text-[11px]">{authError}</p>
                </div>
              )}

              {/* Success Message Alert */}
              {authSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800 text-xs text-emerald-300 flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{authSuccess}</span>
                </div>
              )}

              {/* Security Hint */}
              <div className="bg-slate-950/80 rounded-lg p-3 text-[11px] text-slate-400 space-y-1 border border-slate-800">
                <div className="font-semibold text-amber-400 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>邀請制安全規範：</span>
                </div>
                <div>• 本系統預設管理員為建立者 (<span className="text-amber-300 font-mono">zeroatos@gmail.com</span>)。</div>
                <div>• 後續管理員需由現任管理員於後台寄送專屬邀請函開通。</div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false);
                    setAuthError(null);
                    setAuthSuccess(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                >
                  取消返回
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-slate-100 shadow-lg shadow-indigo-500/20 transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{verifying ? '正在驗證 Google 身分...' : '進行 Google 授權驗證'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

