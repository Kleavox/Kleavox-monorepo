//app/dash/settings/page.tsx

"use client";

import { useState, useEffect } from "react";
import { User, Lock, Loader2, Save, Shield, Trash2, AlertTriangle, X, ArrowLeft, Check, Eye, EyeOff, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  
  const [name, setName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isProfileExpanded, setIsProfileExpanded] = useState(true);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState(""); 
  const [showNewPassword, setShowNewPassword] = useState(false); 
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [isSecurityExpanded, setIsSecurityExpanded] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteOtp, setDeleteOtp] = useState(""); 
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    fetch("/api/session").then(r => r.json()).then(data => {
        if(data.user?.name) setName(data.user.name);
    });
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
        const timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoadingProfile(true); setProfileMessage(""); setProfileError("");

    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      
      setProfileMessage("NAME UPDATED");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handleUpdateSecurity(e: React.FormEvent) {
    e.preventDefault();
    setLoadingSecurity(true); setSecurityMessage(""); setSecurityError("");

    if (!newPassword || !oldPassword) {
        setSecurityError("Please fill in all password fields.");
        setLoadingSecurity(false);
        return;
    }

    if (newPassword !== confirmNewPassword) {
        setSecurityError("New passwords do not match.");
        setLoadingSecurity(false);
        return;
    }

    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      
      setSecurityMessage("PASSWORD UPDATED");
      setOldPassword(""); setNewPassword(""); setConfirmNewPassword("");
    } catch (err) {
      setSecurityError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoadingSecurity(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteLoading(true); setDeleteError("");

    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            password: deletePassword,
            otp: showOtpInput ? deleteOtp : undefined
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to delete account");

      if (data.requireOtp) {
          setShowOtpInput(true);
          setDeleteLoading(false);
          setResendCooldown(60);
          return;
      }

      window.location.href = "/account-deleted"; 
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Gagal");
      setDeleteLoading(false);
    }
  }

  async function handleResendDeleteCode() {
    if (resendCooldown > 0) return;
    setResendLoading(true);
    setResendMessage("");
    try {
        const res = await fetch("/api/auth/resend-delete-code", { method: "POST" });
        if(!res.ok) throw new Error("Failed");
        setResendCooldown(60);
        setResendMessage("Code sent to your email.");
    } catch {
        setDeleteError("Failed to resend verification code.");
    } finally {
        setResendLoading(false);
    }
  }

  const closeDeleteModal = () => {
      setShowDeleteModal(false);
      setShowOtpInput(false);
      setDeletePassword("");
      setDeleteOtp("");
      setDeleteError("");
  };

  return (
    <div className="w-full max-w-4xl space-y-8 pb-20"> 
      
      <div className="border-b-4 border-(--db-border) pb-4 lg:pb-6">
        <Link 
          href="/dash" 
          className="inline-flex items-center gap-2 mb-4 lg:mb-6 px-3 py-1.5 bg-(--db-surface) border-2 border-(--db-border) font-black text-[10px] lg:text-xs uppercase tracking-widest text-(--db-text) hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all"
        >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>
        <h1 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter text-(--db-text)">Account Settings</h1>
        <p className="text-xs lg:text-sm font-bold text-(--db-text-muted) mt-1">Manage your identity & security preferences.</p>
      </div>

      <div className="space-y-6">
        
        {}
        <div className="db-card shadow-[6px_6px_0px_0px_var(--db-border)] transition-all">
            <button 
                onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                className="w-full flex items-center justify-between p-4 lg:p-5 hover:bg-(--db-bg) transition-colors focus:outline-none"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-(--db-accent) p-2 border-2 border-(--db-border) shadow-[2px_2px_0px_0px_var(--db-border)]">
                        <User className="h-5 w-5 lg:h-6 lg:w-6 text-(--db-accent-fg)" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-lg lg:text-xl font-black uppercase text-(--db-text) leading-none">Basic Profile</h2>
                        <p className="text-[10px] font-bold text-(--db-text-muted) mt-1">Change your display name</p>
                    </div>
                </div>
                {isProfileExpanded ? <ChevronUp className="h-6 w-6 text-(--db-text)"/> : <ChevronDown className="h-6 w-6 text-(--db-text)"/>}
            </button>

            {isProfileExpanded && (
                <div className="p-4 lg:p-6 border-t-2 lg:border-t-4 border-(--db-border) animate-in slide-in-from-top-2">
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="font-black text-xs uppercase mb-1.5 block text-(--db-text-muted) tracking-wider">Display Name</label>
                            <input 
                                className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 lg:p-4 font-bold text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] focus:border-(--db-primary) transition-all placeholder:text-(--db-text-muted) placeholder:font-normal text-sm"
                                placeholder="Your Name" 
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
                            <div className="flex-1 w-full text-left">
                                {profileMessage && <div className="p-2 bg-(--db-success) border-2 border-(--db-border) text-white font-bold text-xs text-center uppercase shadow-[2px_2px_0px_0px_var(--db-border)]">{profileMessage}</div>}
                                {profileError && <div className="p-2 bg-(--db-danger) border-2 border-(--db-border) text-white font-bold text-xs text-center uppercase shadow-[2px_2px_0px_0px_var(--db-border)] animate-error-shake">{profileError}</div>}
                            </div>
                            <button type="submit" disabled={loadingProfile} className="w-full md:w-auto bg-(--db-text) text-(--db-bg) py-3 px-6 border-2 border-(--db-border) font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_var(--db-border)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_var(--db-border)] transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50">
                                {loadingProfile ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Save className="h-4 w-4"/> SAVE PROFILE</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>

        {}
        <div className="db-card shadow-[6px_6px_0px_0px_var(--db-border)] transition-all">
            <button 
                onClick={() => setIsSecurityExpanded(!isSecurityExpanded)}
                className="w-full flex items-center justify-between p-4 lg:p-5 hover:bg-(--db-bg) transition-colors focus:outline-none"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-(--db-primary) p-2 border-2 border-(--db-border) text-(--db-primary-fg) shadow-[2px_2px_0px_0px_var(--db-border)]">
                        <Shield className="h-5 w-5 lg:h-6 lg:w-6" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-lg lg:text-xl font-black uppercase text-(--db-text) leading-none">Security</h2>
                        <p className="text-[10px] font-bold text-(--db-text-muted) mt-1">Update your password</p>
                    </div>
                </div>
                {isSecurityExpanded ? <ChevronUp className="h-6 w-6 text-(--db-text)"/> : <ChevronDown className="h-6 w-6 text-(--db-text)"/>}
            </button>

            {isSecurityExpanded && (
                <div className="p-4 lg:p-6 border-t-2 lg:border-t-4 border-(--db-border) animate-in slide-in-from-top-2">
                    <form onSubmit={handleUpdateSecurity} className="space-y-4 lg:space-y-6">
                        
                        <div>
                            <label className="font-black text-xs uppercase mb-1.5 block text-(--db-text-muted) tracking-wider">Current Password</label>
                            <div className="relative">
                                <input 
                                    type="password" 
                                    className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 pl-10 lg:p-4 lg:pl-12 font-bold text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all placeholder:text-(--db-text-muted) placeholder:font-normal text-sm"
                                    placeholder="••••••••" 
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                />
                                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 lg:h-5 lg:w-5 text-(--db-text-muted)" />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="font-black text-xs uppercase mb-1.5 block text-(--db-text-muted) tracking-wider">New Password</label>
                                <div className="relative">
                                    <input 
                                        type={showNewPassword ? "text" : "password"}
                                        className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 pl-10 pr-10 lg:p-4 lg:pl-12 font-bold text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all placeholder:text-(--db-text-muted) placeholder:font-normal text-sm"
                                        placeholder="Min. 6 chars" 
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                    />
                                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 lg:h-5 lg:w-5 text-(--db-text-muted)" />
                                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3.5 top-3.5 text-(--db-text-muted) hover:text-(--db-text)">
                                        {showNewPassword ? <EyeOff className="h-4 w-4 lg:h-5 lg:w-5" /> : <Eye className="h-4 w-4 lg:h-5 lg:w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="font-black text-xs uppercase mb-1.5 block text-(--db-text-muted) tracking-wider">Confirm Password</label>
                                <div className="relative">
                                    <input 
                                        type="password" 
                                        className={`w-full bg-(--db-bg) border-2 border-(--db-border) p-3 pl-10 lg:p-4 lg:pl-12 font-bold text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all placeholder:text-(--db-text-muted) placeholder:font-normal text-sm ${confirmNewPassword && newPassword !== confirmNewPassword ? "border-red-500" : ""}`}
                                        placeholder="Retype password" 
                                        value={confirmNewPassword}
                                        onChange={e => setConfirmNewPassword(e.target.value)}
                                    />
                                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 lg:h-5 lg:w-5 text-(--db-text-muted)" />
                                    {confirmNewPassword && newPassword === confirmNewPassword && (
                                        <Check className="absolute right-3.5 top-3.5 h-4 w-4 lg:h-5 lg:w-5 text-green-500" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
                            <div className="flex-1 w-full text-left">
                                {securityMessage && <div className="p-2 bg-(--db-success) border-2 border-(--db-border) text-white font-bold text-xs text-center uppercase shadow-[2px_2px_0px_0px_var(--db-border)]">{securityMessage}</div>}
                                {securityError && <div className="p-2 bg-(--db-danger) border-2 border-(--db-border) text-white font-bold text-xs text-center uppercase shadow-[2px_2px_0px_0px_var(--db-border)] animate-error-shake">{securityError}</div>}
                            </div>
                            <button type="submit" disabled={loadingSecurity} className="w-full md:w-auto bg-(--db-text) text-(--db-bg) py-3 px-6 border-2 border-(--db-border) font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_var(--db-border)] active:translate-y-0 active:shadow-[2px_2px_0px_0px_var(--db-border)] transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50">
                                {loadingSecurity ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Save className="h-4 w-4"/> UPDATE PASSWORD</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>

      </div>

      <div className="mt-12 lg:mt-20 border-t-4 border-(--db-border) border-dashed pt-8 lg:pt-10">
        <div className="flex items-center gap-3 mb-4 lg:mb-6">
            <div className="bg-(--db-danger) p-1.5 lg:p-2 border-2 border-(--db-border) text-white shadow-[4px_4px_0px_0px_var(--db-border)]">
                <AlertTriangle className="h-5 w-5 lg:h-6 lg:w-6" />
            </div>
            <h2 className="text-xl lg:text-2xl font-black uppercase text-(--db-danger)">Danger Zone</h2>
        </div>

        <div className="db-card border-4 border-(--db-danger) p-4 lg:p-6 shadow-[8px_8px_0px_0px_var(--db-danger)]">
            <h3 className="text-base lg:text-lg font-black uppercase text-(--db-danger) mb-2">DELETE ACCOUNT PERMANENTLY</h3>
            <p className="text-xs lg:text-sm font-bold text-(--db-text) mb-6">
                Once you delete your account, there is no going back. All your shortlinks, analytics data, and settings will be permanently removed.
            </p>
            <button 
                onClick={() => setShowDeleteModal(true)}
                className="bg-(--db-danger) text-white font-black uppercase py-2.5 lg:py-3 px-6 border-2 border-(--db-border) hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all flex items-center gap-2 text-xs lg:text-sm"
            >
                <Trash2 className="h-4 w-4 lg:h-5 lg:w-5" /> DELETE MY ACCOUNT
            </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
           <div className="db-card w-full max-w-sm p-6 shadow-[12px_12px_0px_0px_var(--db-danger)] relative">
              <button 
                 onClick={closeDeleteModal} 
                 className="absolute top-3 right-3 border-2 border-(--db-border) p-1 hover:bg-(--db-bg) text-(--db-text)"
              >
                 <X className="h-5 w-5" />
              </button>

              <div className="text-center mb-6">
                 <div className="inline-block p-3 bg-(--db-danger) border-4 border-(--db-border) rounded-full mb-3 text-white shadow-[4px_4px_0px_0px_var(--db-border)]">
                    <Trash2 className="h-6 w-6" />
                 </div>
                 <h2 className="text-2xl font-black uppercase leading-none text-(--db-text) mb-2">
                    {showOtpInput ? "SECURITY CHECK" : "FINAL WARNING"}
                 </h2>
                 <p className="font-bold text-(--db-text-muted) text-xs">
                    {showOtpInput 
                        ? "Enter the confirmation code sent to your email to authorize DESTRUCTION." 
                        : "Enter your password to confirm deletion."}
                 </p>
              </div>

              <form onSubmit={handleDeleteAccount} className="space-y-4">
                 <input 
                    type="password" 
                    className="w-full bg-(--db-bg) border-4 border-(--db-border) p-3 font-bold text-center text-base text-(--db-text) focus:outline-none focus:shadow-[6px_6px_0px_0px_var(--db-border)] transition-all placeholder:text-(--db-text-muted) disabled:opacity-50"
                    placeholder="YOUR PASSWORD" 
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoFocus={!showOtpInput}
                    disabled={showOtpInput} 
                    required
                 />

                 {showOtpInput && (
                     <div className="animate-in slide-in-from-top-2 fade-in space-y-3">
                         <input 
                            type="text" 
                            className="w-full bg-(--db-bg) border-4 border-(--db-border) p-3 font-mono font-bold text-center text-xl tracking-widest text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-danger)] transition-all placeholder:text-(--db-text-muted)"
                            placeholder="000000" 
                            value={deleteOtp}
                            onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g,""))}
                            maxLength={6}
                            autoFocus
                            required
                         />
                         
                          <div className="text-center">
                             <button 
                                 type="button" 
                                 onClick={handleResendDeleteCode}
                                 disabled={resendCooldown > 0 || resendLoading}
                                 className="text-[10px] font-bold text-(--db-text-muted) hover:text-red-500 flex items-center justify-center gap-1 mx-auto disabled:opacity-50 transition-colors"
                             >
                                 {resendLoading ? (
                                     <Loader2 className="h-3 w-3 animate-spin"/>
                                 ) : (
                                     <RefreshCw className={`h-3 w-3 ${resendCooldown === 0 ? "hover:rotate-180 transition-transform" : ""}`}/>
                                 )}
                                 {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend Code"}
                             </button>
                             {resendMessage && (
                                 <p className="text-[10px] font-bold text-(--db-success) mt-1">{resendMessage}</p>
                             )}
                          </div>
                     </div>
                 )}

                 {deleteError && (
                    <div className="bg-(--db-danger) text-white font-bold p-2 border-2 border-(--db-border) text-center uppercase text-xs animate-error-shake">
                       {deleteError}
                    </div>
                 )}

                 <div className="flex gap-2 pt-2">
                    <button 
                       type="button"
                       onClick={closeDeleteModal}
                       className="flex-1 py-3 font-black border-4 border-(--db-border) text-(--db-text) hover:bg-(--db-bg) uppercase text-xs"
                    >
                       Cancel
                    </button>
                    <button 
                       type="submit"
                       disabled={deleteLoading}
                       className="flex-1 py-3 font-black bg-(--db-danger) text-white border-4 border-(--db-border) hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all uppercase flex justify-center items-center gap-2 text-xs"
                    >
                       {deleteLoading ? <Loader2 className="animate-spin h-4 w-4"/> : (showOtpInput ? "CONFIRM DELETION" : "CONFIRM DELETE")}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

    </div>
  );
}
