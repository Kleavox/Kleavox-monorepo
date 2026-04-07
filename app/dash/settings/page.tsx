//app/dash/settings/page.tsx

"use client";

import { useState, useEffect } from "react";
import { User, Lock, Loader2, Shield, Trash2, AlertTriangle, X, ArrowLeft, Check, Eye, EyeOff, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
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
      
      setProfileMessage("NAME_UPDATED");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Profile update failed");
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handleUpdateSecurity(e: React.FormEvent) {
    e.preventDefault();
    setLoadingSecurity(true); setSecurityMessage(""); setSecurityError("");

    if (!newPassword || !oldPassword) {
        setSecurityError("Missing credentials.");
        setLoadingSecurity(false);
        return;
    }

    if (newPassword !== confirmNewPassword) {
        setSecurityError("Key mismatch.");
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
      
      setSecurityMessage("SECURITY_KEYS_UPDATED");
      setOldPassword(""); setNewPassword(""); setConfirmNewPassword("");
    } catch (err) {
      setSecurityError(err instanceof Error ? err.message : "Security update failed");
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

      if (!res.ok) throw new Error(data.error || "Deletion authorization failed");

      if (data.requireOtp) {
          setShowOtpInput(true);
          setDeleteLoading(false);
          setResendCooldown(60);
          return;
      }

      window.location.href = "/account-deleted"; 
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error");
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
        setResendMessage("Authorization code dispatched.");
    } catch {
        setDeleteError("Dispatch failed.");
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
    <div className="flex flex-col gap-10 md:gap-16 pb-20 max-w-4xl"> 
      
      <section className="space-y-4 px-2">
        <Link 
          href="/dash" 
          className="btn-secondary w-fit px-5 py-2 text-[10px] nothing-label opacity-100 hover:bg-(--db-text) hover:text-(--db-bg) transition-all"
        >
            <ArrowLeft className="h-3.5 w-3.5" /> BACK_TO_SYSTEM
        </Link>
        <h1 className="text-4xl md:text-5xl nothing-title text-(--db-text)">SETTINGS</h1>
        <p className="nothing-label normal-case tracking-normal opacity-40">Profile & Security Protocol management</p>
      </section>

      <div className="flex flex-col gap-8">
        
        <div className="db-card overflow-hidden">
            <button 
                onClick={() => setIsProfileExpanded(!isProfileExpanded)}
                className="w-full flex items-center justify-between p-6 lg:p-8 hover:bg-(--db-surface-hover) transition-colors focus:outline-none"
            >
                <div className="flex items-center gap-4">
                    <div className="bg-(--db-accent) p-3 rounded-2xl">
                        <User className="h-6 w-6 text-(--db-accent-fg)" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-xl nothing-title text-(--db-text)">IDENTITY_CORE</h2>
                        <p className="nothing-label">Display name configuration</p>
                    </div>
                </div>
                {isProfileExpanded ? <ChevronUp className="h-6 w-6 opacity-40"/> : <ChevronDown className="h-6 w-6 opacity-40"/>}
            </button>

            {isProfileExpanded && (
                <div className="p-6 lg:p-10 border-t border-(--db-border)/30 animate-reveal bg-(--db-surface-hover)/30">
                    <form onSubmit={handleUpdateProfile} className="space-y-8">
                        <div className="space-y-2">
                            <label className="nothing-label block ml-1">Assigned_Name</label>
                            <input 
                                className="w-full text-base font-bold bg-(--db-surface)"
                                placeholder="User Identity" 
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4">
                            <div className="flex-1">
                                {profileMessage && <div className="text-green-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 animate-reveal"><Check className="h-4 w-4"/> {profileMessage}</div>}
                                {profileError && <div className="text-red-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 animate-error-shake"><AlertTriangle className="h-4 w-4"/> {profileError}</div>}
                            </div>
                            <button type="submit" disabled={loadingProfile} className="btn-primary px-10 py-4 text-xs tracking-widest w-full md:w-auto">
                                {loadingProfile ? <Loader2 className="h-4 w-4 animate-spin"/> : "COMMIT_PROFILE"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>

        <div className="db-card overflow-hidden">
            <button 
                onClick={() => setIsSecurityExpanded(!isSecurityExpanded)}
                className="w-full flex items-center justify-between p-6 lg:p-8 hover:bg-(--db-surface-hover) transition-colors focus:outline-none"
            >
                <div className="flex items-center gap-4">
                    <div className="bg-(--db-primary)/10 p-3 rounded-2xl">
                        <Shield className="h-6 w-6 text-(--db-primary)" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-xl nothing-title text-(--db-text)">SECURITY_PROTOCOL</h2>
                        <p className="nothing-label">Access key rotation</p>
                    </div>
                </div>
                {isSecurityExpanded ? <ChevronUp className="h-6 w-6 opacity-40"/> : <ChevronDown className="h-6 w-6 opacity-40"/>}
            </button>

            {isSecurityExpanded && (
                <div className="p-6 lg:p-10 border-t border-(--db-border)/30 animate-reveal bg-(--db-surface-hover)/30">
                    <form onSubmit={handleUpdateSecurity} className="space-y-8">
                        
                        <div className="space-y-2">
                            <label className="nothing-label block ml-1">Current_Access_Key</label>
                            <div className="relative">
                                <input 
                                    type="password" 
                                    className="pl-12 bg-(--db-surface) text-base font-bold"
                                    placeholder="••••••••" 
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                />
                                <Lock className="absolute left-4 top-3.5 h-5 w-5 text-(--db-text-muted)" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="nothing-label block ml-1">New_Access_Key</label>
                                <div className="relative">
                                    <input 
                                        type={showNewPassword ? "text" : "password"}
                                        className="pl-12 pr-12 bg-(--db-surface) text-base font-bold"
                                        placeholder="Min. 8 chars" 
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                    />
                                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-(--db-text-muted)" />
                                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-3.5 text-(--db-text-muted) hover:text-(--db-text)">
                                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="nothing-label block ml-1">Verify_New_Key</label>
                                <div className="relative">
                                    <input 
                                        type="password" 
                                        className={`pl-12 bg-(--db-surface) text-base font-bold ${confirmNewPassword && newPassword !== confirmNewPassword ? "border-red-500" : ""}`}
                                        placeholder="Confirm key" 
                                        value={confirmNewPassword}
                                        onChange={e => setConfirmNewPassword(e.target.value)}
                                    />
                                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-(--db-text-muted)" />
                                    {confirmNewPassword && newPassword === confirmNewPassword && (
                                        <Check className="absolute right-4 top-3.5 h-5 w-5 text-green-500" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4">
                            <div className="flex-1">
                                {securityMessage && <div className="text-green-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 animate-reveal"><Check className="h-4 w-4"/> {securityMessage}</div>}
                                {securityError && <div className="text-red-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 animate-error-shake"><AlertTriangle className="h-4 w-4"/> {securityError}</div>}
                            </div>
                            <button type="submit" disabled={loadingSecurity} className="btn-primary px-10 py-4 text-xs tracking-widest w-full md:w-auto">
                                {loadingSecurity ? <Loader2 className="h-4 w-4 animate-spin"/> : "ROTATE_KEYS"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>

      </div>

      <div className="mt-20 border-t-2 border-(--db-border) border-dashed pt-12">
        <div className="flex items-center gap-3 mb-8 px-2">
            <AlertTriangle className="h-6 w-6 text-(--db-primary)" />
            <h2 className="text-2xl nothing-title text-(--db-primary)">DANGER_ZONE</h2>
        </div>

        <div className="db-card border-(--db-primary)/30 p-8 lg:p-12 shadow-2xl bg-(--db-surface-hover)/20">
            <h3 className="text-xl nothing-title mb-4">TERMINATE_ACCOUNT</h3>
            <p className="nothing-label normal-case tracking-normal opacity-60 mb-10 max-w-2xl">
                Initiating account termination will permanently erase all shortlink mappings, analytics aggregates, and system configurations associated with this identity. This operation is IRREVERSIBLE.
            </p>
            <button 
                onClick={() => setShowDeleteModal(true)}
                className="btn-secondary border-(--db-primary) text-(--db-primary) hover:bg-(--db-primary) hover:text-white px-10 py-4 text-xs tracking-widest"
            >
                <Trash2 className="h-4.5 w-4.5 mr-3" /> INITIATE_TERMINATION
            </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-(--db-bg)/95 backdrop-blur-2xl animate-reveal">
           <div className="db-card w-full max-w-md p-10 space-y-10 border-(--db-primary)/50 relative">
              <button 
                 onClick={closeDeleteModal} 
                 className="absolute top-6 right-6 p-2 rounded-full hover:bg-(--db-surface-hover) transition-colors"
              >
                 <X className="h-5 w-5 opacity-40" />
              </button>

              <div className="text-center">
                 <div className="inline-flex p-6 bg-(--db-primary)/10 text-(--db-primary) rounded-3xl mb-8">
                    <Trash2 className="h-10 w-10 animate-soft-pulse" />
                 </div>
                 <h2 className="text-3xl nothing-title text-(--db-text) mb-4">
                    {showOtpInput ? "AUTHORIZE" : "WARNING"}
                 </h2>
                 <p className="nothing-label text-(--db-primary) mb-2">ACCOUNT_DESTRUCTION_IN_PROGRESS</p>
                 <p className="nothing-label normal-case tracking-normal opacity-40 text-[10px]">
                    {showOtpInput 
                        ? "Enter the 6-digit confirmation key dispatched to your terminal (email)." 
                        : "Enter your primary access key to confirm final termination."}
                 </p>
              </div>

              <form onSubmit={handleDeleteAccount} className="space-y-6">
                 <input 
                    type="password" 
                    className="w-full text-center text-lg font-bold bg-(--db-surface-hover) border-(--db-border)"
                    placeholder="CONFIRM_PASSWORD" 
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoFocus={!showOtpInput}
                    disabled={showOtpInput} 
                    required
                 />

                 {showOtpInput && (
                     <div className="space-y-6 animate-reveal">
                         <input 
                            className="w-full text-center text-4xl font-dot tracking-[0.5em] py-6 bg-(--db-surface-hover) border-(--db-border)"
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
                                 className="nothing-label hover:text-(--db-text) flex items-center justify-center gap-2 mx-auto disabled:opacity-40 transition-colors"
                             >
                                 {resendLoading ? (
                                     <Loader2 className="h-3 w-3 animate-spin"/>
                                 ) : (
                                     <RefreshCw className={`h-3 w-3 ${resendCooldown === 0 ? "hover:rotate-180 transition-transform duration-700" : ""}`}/>
                                 )}
                                 {resendCooldown > 0 ? `RESEND_AVAILABLE_IN_${resendCooldown}S` : "RESEND_KEY"}
                             </button>
                             {resendMessage && (
                                 <p className="nothing-label text-green-500 mt-2">{resendMessage}</p>
                             )}
                          </div>
                     </div>
                 )}

                 {deleteError && (
                    <div className="bg-red-500/10 text-red-500 font-bold p-4 rounded-2xl border border-red-500/20 text-[10px] animate-error-shake text-center uppercase tracking-widest">
                       {deleteError}
                    </div>
                 )}

                 <div className="flex gap-4 pt-4">
                    <button 
                       type="button"
                       onClick={closeDeleteModal}
                       className="flex-1 py-4 btn-secondary text-[10px] nothing-label opacity-100"
                    >
                       ABORT
                    </button>
                    <button 
                       type="submit"
                       disabled={deleteLoading}
                       className="flex-1 py-4 btn-primary text-xs tracking-widest border-none"
                    >
                       {deleteLoading ? <Loader2 className="animate-spin h-5 w-5 mx-auto"/> : (showOtpInput ? "TERMINATE" : "PROCEED")}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

    </div>
  );
}
