import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  Mail, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Crown, 
  Users, 
  KeyRound,
  Send,
  Lock
} from 'lucide-react';
import { AdminUser, AdminInvite } from '../types';

interface AdminInviteManagerProps {
  currentUser: AdminUser | null;
  onRefreshAuth?: () => void;
}

export const AdminInviteManager: React.FC<AdminInviteManagerProps> = ({
  currentUser,
}) => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [superAdminEmail, setSuperAdminEmail] = useState<string>('zeroatos@gmail.com');
  const [loading, setLoading] = useState(true);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Last Generated Invite Modal / Details
  const [latestInvite, setLatestInvite] = useState<AdminInvite | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMail, setCopiedMail] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/list');
      const data = await res.json();
      if (data.success) {
        setAdmins(data.admins || []);
        setInvites(data.invites || []);
        if (data.superAdmin) setSuperAdminEmail(data.superAdmin);
      }
    } catch (e) {
      console.error('Failed to fetch admin list:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setErrorMsg('請輸入受邀者的 Gmail 地址');
      return;
    }

    if (!inviteEmail.includes('@')) {
      setErrorMsg('請輸入格式正確的 Email 地址');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          note: inviteNote.trim(),
          senderEmail: currentUser?.email || superAdminEmail,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || '邀請已成功建立！');
        setLatestInvite(data.invite);
        setInviteEmail('');
        setInviteNote('');
        await fetchAdminData();
      } else {
        setErrorMsg(data.message || '建立邀請失敗');
      }
    } catch (e: any) {
      setErrorMsg('網路錯誤：' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!window.confirm(`確定要撤銷管理員【${email}】的所有後台權限嗎？`)) return;
    try {
      const res = await fetch(`/api/admin/remove-admin/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await fetchAdminData();
      } else {
        alert(data.message || '撤銷失敗');
      }
    } catch (e: any) {
      alert('撤銷管理員失敗：' + e.message);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!window.confirm('確定要撤回此管理員邀請嗎？')) return;
    try {
      const res = await fetch(`/api/admin/revoke-invite/${inviteId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await fetchAdminData();
      }
    } catch (e: any) {
      alert('撤回邀請失敗：' + e.message);
    }
  };

  const getInviteUrl = (inviteCode: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}?invite=${encodeURIComponent(inviteCode)}&mode=admin`;
  };

  const getEmailContent = (invite: AdminInvite) => {
    const link = getInviteUrl(invite.inviteCode);
    return `主旨：【熱血三國M】官方 AI 軍師系統 — 管理員後台授權邀請函

您好：

您已被授權開通《熱血三國M》AI 攻略軍師系統之後台管理員權限！

【受邀 Google 帳號】：${invite.email}
【授權身份】：軍師後台管理員 (Invited Admin)
【邀請人】：${invite.invitedBy}
${invite.note ? `【備註說明】：${invite.note}\n` : ''}
【啟用與登入說明】：
本系統採嚴格邀請制與 Google 登入雙重驗證。請點擊下方專屬授權連結，並強制使用受邀之 Gmail 帳號完成 Google 登入驗證即可自動開通權限：

👉 開通管理權限連結：
${link}

感謝您共同維護熱血三國M官方策略軍師大腦！
熱血三國M 官方軍師團隊 敬上`;
  };

  const openGmailCompose = (invite: AdminInvite) => {
    const subject = encodeURIComponent('【熱血三國M】官方 AI 軍師系統 — 管理員後台授權邀請函');
    const body = encodeURIComponent(getEmailContent(invite));
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invite.email)}&su=${subject}&body=${body}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-amber-950/50 border border-indigo-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-300" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center space-x-2">
                <span>管理員權限與邀請制度中心</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Google 驗證邀請制
                </span>
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300">
              預設最高管理員為建立者 (<strong className="text-amber-300 font-mono">{superAdminEmail}</strong>)。所有後續管理員必須經由現任管理員寄送邀請，並強制使用 Google / Gmail 登入驗證身分。
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 rounded-xl border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>重新整理名單</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Send Invitation Form + Architecture Note */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Invite Form (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <UserPlus className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">發送新管理員邀請 (Send Admin Invite)</h3>
          </div>

          <form onSubmit={handleSendInvite} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span>受邀者 Gmail 帳號（必須為 Google 帳號）：</span>
                <span className="text-[11px] text-amber-400">登入時強制驗證此 Gmail</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="例如：tactician_general@gmail.com"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                職務稱謂或備註（選填）：
              </label>
              <input
                type="text"
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                placeholder="例如：攻略組組長 / 盟主諸葛孔明 / 戰術推演官"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                邀請建立後，系統將產生專屬連結，受邀者登入 Google 後即自動綁定授權。
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? '建立中...' : '建立邀請並產生郵件'}</span>
              </button>
            </div>
          </form>

          {/* Latest Generated Invite Card */}
          {latestInvite && (
            <div className="mt-4 p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>最新邀請已產生 (受邀帳號：{latestInvite.email})</span>
                </span>
                <button
                  onClick={() => setLatestInvite(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  關閉
                </button>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg text-xs font-mono text-slate-300 border border-slate-800 break-all select-all flex items-center justify-between gap-2">
                <span className="truncate">{getInviteUrl(latestInvite.inviteCode)}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getInviteUrl(latestInvite.inviteCode));
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded border border-amber-500/30 text-xs flex items-center space-x-1 shrink-0"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? '已複製' : '複製連結'}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => openGmailCompose(latestInvite)}
                  className="px-3.5 py-1.5 bg-red-950/70 hover:bg-red-900/80 text-red-200 border border-red-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-red-400" />
                  <span>🚀 開啟 Gmail 撰寫邀請信給 {latestInvite.email}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getEmailContent(latestInvite));
                    setCopiedMail(true);
                    setTimeout(() => setCopiedMail(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center space-x-1 transition cursor-pointer"
                >
                  {copiedMail ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedMail ? '信件內容已複製' : '複製邀請信完整範本'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Security & Architecture Info (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">權限防護安全機制說明</h3>
          </div>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
              <div className="font-bold text-amber-300 flex items-center space-x-1">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>1. 系統建立者永久最高權限</span>
              </div>
              <p className="text-slate-400">
                建立者帳號 <strong className="text-amber-300 font-mono">{superAdminEmail}</strong> 享有永久 root 權限，無法被他人撤銷或覆蓋。
              </p>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
              <div className="font-bold text-indigo-300 flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>2. 強制 Google OAuth 登入驗證</span>
              </div>
              <p className="text-slate-400">
                後台不再使用明文密碼。受邀者點選邀請連結後，必須使用指定之 Gmail 登入以確認身分真實性。
              </p>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
              <div className="font-bold text-emerald-300 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>3. 動態權限撤銷與立即生效</span>
              </div>
              <p className="text-slate-400">
                現有管理員可隨時在下方名單中撤銷受邀者的管理員權限，撤銷後該 Google 帳號將立即喪失所有後台操作權利。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Whitelist of Active Administrators */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              已授權管理員名單 (Active Whitelist · 共 {admins.length} 位)
            </h3>
          </div>
          <span className="text-xs text-slate-400">均已通過 Google 身分驗證</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">管理員 Google 帳號</th>
                <th className="py-3 px-4">稱謂 / 角色</th>
                <th className="py-3 px-4">權限等級</th>
                <th className="py-3 px-4">邀請來源</th>
                <th className="py-3 px-4">最後登入</th>
                <th className="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {admins.map((admin) => {
                const isRoot = admin.email.toLowerCase() === superAdminEmail.toLowerCase() || admin.isCreator;
                return (
                  <tr key={admin.email} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300 shrink-0 overflow-hidden">
                          {admin.picture ? (
                            <img src={admin.picture} alt={admin.name} className="w-full h-full object-cover" />
                          ) : (
                            admin.email[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100 font-mono flex items-center space-x-1.5">
                            <span>{admin.email}</span>
                            {isRoot && (
                              <Crown className="w-3.5 h-3.5 text-amber-400" title="建立者 / 最高管理員" />
                            )}
                          </div>
                          <span className="text-[11px] text-emerald-400">Google 驗證有效</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 font-medium">
                      {admin.name || '管理員'}
                    </td>
                    <td className="py-3.5 px-4">
                      {isRoot ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-[10px]">
                          👑 最高管理員 (建立者)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30 text-[10px]">
                          🛡️ 受邀管理員
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {admin.invitedBy || '系統創始'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : '尚未登入'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isRoot ? (
                        <span className="text-slate-500 text-[11px] italic">永久擁有最高權限</span>
                      ) : (
                        <button
                          onClick={() => handleRemoveAdmin(admin.email)}
                          className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-xs transition cursor-pointer flex items-center space-x-1 ml-auto"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>撤銷權限</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              待驗證受邀名單 (Pending Invites · 共 {invites.filter((i) => i.status === 'pending').length} 封有效邀請)
            </h3>
          </div>
        </div>

        {invites.filter((i) => i.status === 'pending').length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            目前暫無待接受的管理員邀請。若需指派新夥伴，請在上方輸入其 Gmail 寄送邀請函。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">受邀 Google 帳號</th>
                  <th className="py-3 px-4">備註稱謂</th>
                  <th className="py-3 px-4">邀請人</th>
                  <th className="py-3 px-4">建立時間</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invites
                  .filter((i) => i.status === 'pending')
                  .map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-semibold text-amber-300">
                        {inv.email}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {inv.note || '未填寫'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {inv.invitedBy}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(inv.invitedAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openGmailCompose(inv)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 text-xs flex items-center space-x-1 cursor-pointer"
                            title="開啟 Gmail 寄信"
                          >
                            <Mail className="w-3 h-3" />
                            <span>寄信</span>
                          </button>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(getInviteUrl(inv.inviteCode));
                              alert('已複製邀請專屬連結！');
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs flex items-center space-x-1 cursor-pointer"
                            title="複製邀請連結"
                          >
                            <Copy className="w-3 h-3" />
                            <span>複製連結</span>
                          </button>

                          <button
                            onClick={() => handleRevokeInvite(inv.id)}
                            className="px-2.5 py-1 bg-rose-950/50 hover:bg-rose-900 text-rose-300 rounded border border-rose-800/80 text-xs flex items-center space-x-1 cursor-pointer"
                            title="撤回此邀請"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>撤回</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
