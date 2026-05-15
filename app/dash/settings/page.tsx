//app/dash/settings/page.tsx

"use client";

import { useState, useEffect } from "react";
import { User, Lock, CircleNotch, Shield, Trash, Warning, X, ArrowLeft, Check, Eye, EyeSlash, CaretDown, CaretUp, ArrowClockwise } from "@phosphor-icons/react";
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
      if (data.user?.name) setName(data.user.name);
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
    if (!newPassword || !oldPassword) { setSecurityError("Missing credentials."); setLoadingSecurity(false); return; }
    if (newPassword !== confirmNewPassword) { setSecurityError("Key mismatch."); setLoadingSecurity(false); return; }
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
        body: JSON.stringify({ password: deletePassword, otp: showOtpInput ? deleteOtp : undefined }),
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
    setResendLoading(true); setResendMessage("");
    try {
      const res = await fetch("/api/auth/resend-delete-code", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      setResendCooldown(60);
      setResendMessage("Authorization code dispatched.");
    } catch {
      setDeleteError("Dispatch failed.");
    } finally {
      setResendLoading(false);
    }
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false); setShowOtpInput(false);
    setDeletePassword(""); setDeleteOtp(""); setDeleteError("");
  };

  return (
    <div className="flex flex-col gap-8 sm:gap-10 md:gap-14 pb-20 max-w-3xl">

      <section className="space-y-3 px-1">
        <Link href="/dash" className="btn-secondary w-fit px-5 py-2 text-[10px] nothing-label opacity-100 hover:bg-(--db-text) hover:text-(--db-bg) transition-all">
          <ArrowLeft size={13} /> BACK_TO_SYSTEM
        </Link>
        <h1 className="text-4xl sm:text-5xl nothing-title text-(--db-text)">SETTINGS</h1>
        <p className="nothing-label normal-case tracking-normal opacity-40">Profile & Security Protocol management</p>
      </section>

      <div className="flex flex-col gap-5">

        {/* Profile */}
        <div className="db-card overflow-hidden">
          <button
            onClick={() => setIsProfileExpanded(!isProfileExpanded)}
            className="w-full flex items-center justify-between p-5 sm:p-7 hover:bg-(--db-surface-hover) transition-colors focus:outline-none"
          >
            <div className="flex items-center gap-4">
              <div className="bg-(--db-accent) p-3 rounded-2xl shrink-0">
                <User size={18} className="text-(--db-accent-fg)" />
              </div>
              <div className="text-left">
                <h2 className="text-xl nothing-title text-(--db-text)">IDENTITY_CORE</h2>
                <p className="nothing-label text-[9px]">Display name configuration</p>
              </div>
            </div>
            {isProfileExpanded ? <CaretUp size={18} className="opacity-30" /> : <CaretDown size={18} className="opacity-30" />}
          </button>

          {isProfileExpanded && (
            <div className="p-5 sm:p-8 border-t border-(--db-border)/30 animate-reveal bg-(--db-surface-hover)/20">
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="space-y-2">
                  <label className="nothing-label block ml-1">Assigned_Name</label>
                  <input
                    className="db-input"
                    placeholder="User Identity"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    {profileMessage && <div className="text-(--db-primary) font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 animate-reveal"><Check size={14} /> {profileMessage}</div>}
                    {profileError && <div className="text-red-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 animate-error-shake"><Warning size={14} weight="fill" /> {profileError}</div>}
                  </div>
                  <button type="submit" disabled={loadingProfile} className="btn-primary px-8 py-3.5 text-xs tracking-widest w-full sm:w-auto disabled:opacity-40">
                    {loadingProfile ? <CircleNotch size={16} className="animate-spin" /> : "COMMIT_PROFILE"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Security */}
        <div className="db-card overflow-hidden">
          <button
            onClick={() => setIsSecurityExpanded(!isSecurityExpanded)}
            className="w-full flex items-center justify-between p-5 sm:p-7 hover:bg-(--db-surface-hover) transition-colors focus:outline-none"
          >
            <div className="flex items-center gap-4">
              <div className="bg-(--db-primary)/15 p-3 rounded-2xl shrink-0">
                <Shield size={18} className="text-(--db-primary)" />
              </div>
              <div className="text-left">
                <h2 className="text-xl nothing-title text-(--db-text)">SECURITY_PROTOCOL</h2>
                <p className="nothing-label text-[9px]">Access key rotation</p>
              </div>
            </div>
            {isSecurityExpanded ? <CaretUp size={18} className="opacity-30" /> : <CaretDown size={18} className="opacity-30" />}
          </button>

          {isSecurityExpanded && (
            <div className="p-5 sm:p-8 border-t border-(--db-border)/30 animate-reveal bg-(--db-surface-hover)/20">
              <form onSubmit={handleUpdateSecurity} className="space-y-6">
                <div className="space-y-2">
                  <label className="nothing-label block ml-1">Current_Access_Key</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
                      <Lock size={16} />
                    </div>
                    <input
                      type="password"
                      className="db-input pl-10!"
                      placeholder="••••••••"
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="nothing-label block ml-1">New_Access_Key</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
                        <Lock size={16} />
                      </div>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        className="db-input pl-10! pr-10!"
                        placeholder="Min. 8 chars"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                      <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) hover:text-(--db-text) transition-colors">
                        {showNewPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="nothing-label block ml-1">Verify_New_Key</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
                        <Lock size={16} />
                      </div>
                      <input
                        type="password"
                        className={`db-input pl-10! pr-10! ${confirmNewPassword && newPassword !== confirmNewPassword ? "border-red-500/50!" : ""}`}
                        placeholder="Confirm key"
                        value={confirmNewPassword}
                        onChange={e => setConfirmNewPassword(e.target.value)}
                      />
                      {confirmNewPassword && newPassword === confirmNewPassword && (
                        <Check size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-(--db-primary) pointer-events-none" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    {securityMessage && <div className="text-(--db-primary) font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 animate-reveal"><Check size={14} /> {securityMessage}</div>}
                    {securityError && <div className="text-red-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 animate-error-shake"><Warning size={14} weight="fill" /> {securityError}</div>}
                  </div>
                  <button type="submit" disabled={loadingSecurity} className="btn-primary px-8 py-3.5 text-xs tracking-widest w-full sm:w-auto disabled:opacity-40">
                    {loadingSecurity ? <CircleNotch size={16} className="animate-spin" /> : "ROTATE_KEYS"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-10 sm:mt-16 border-t-2 border-(--db-danger)/20 border-dashed pt-10 sm:pt-12">
        <div className="flex items-center gap-3 mb-6 px-1">
          <Warning size={20} weight="fill" className="text-(--db-danger)" />
          <h2 className="text-2xl nothing-title text-(--db-danger)">DANGER_ZONE</h2>
        </div>

        <div className="db-card border-(--db-danger)/20 p-6 sm:p-10 shadow-xl">
          <h3 className="text-xl nothing-title mb-3">TERMINATE_ACCOUNT</h3>
          <p className="nothing-label normal-case tracking-normal opacity-50 mb-8 max-w-xl text-[10px] leading-relaxed">
            Initiating account termination will permanently erase all shortlink mappings, analytics, and system configurations associated with this identity. This operation is IRREVERSIBLE.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn-secondary border-(--db-danger)/40 text-(--db-danger) hover:bg-(--db-danger) hover:text-white hover:border-(--db-danger) px-8 py-3.5 text-xs tracking-widest"
          >
            <Trash size={15} /> INITIATE_TERMINATION
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-(--db-bg)/95 backdrop-blur-2xl animate-reveal">
          <div className="db-card w-full max-w-md p-8 sm:p-10 space-y-8 border-(--db-danger)/30 relative">
            <button onClick={closeDeleteModal} className="absolute top-5 right-5 p-2 rounded-full hover:bg-(--db-surface-hover) transition-colors opacity-40 hover:opacity-100">
              <X size={18} />
            </button>

            <div className="text-center">
              <div className="inline-flex p-5 bg-(--db-danger)/10 text-(--db-danger) rounded-3xl mb-6">
                <Trash size={36} className="animate-soft-pulse" />
              </div>
              <h2 className="text-2xl sm:text-3xl nothing-title text-(--db-text) mb-3">
                {showOtpInput ? "AUTHORIZE" : "WARNING"}
              </h2>
              <p className="nothing-label text-(--db-danger) mb-2">ACCOUNT_DESTRUCTION_IN_PROGRESS</p>
              <p className="nothing-label normal-case tracking-normal opacity-40 text-[10px]">
                {showOtpInput
                  ? "Enter the 6-digit confirmation key dispatched to your terminal."
                  : "Enter your primary access key to confirm final termination."}
              </p>
            </div>

            <form onSubmit={handleDeleteAccount} className="space-y-5">
              <input
                type="password"
                className="db-input text-center font-bold"
                placeholder="CONFIRM_PASSWORD"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoFocus={!showOtpInput}
                disabled={showOtpInput}
                required
              />

              {showOtpInput && (
                <div className="space-y-5 animate-reveal">
                  <input
                    className="db-input text-center text-3xl! font-dot tracking-[0.5em] py-6!"
                    placeholder="000000"
                    value={deleteOtp}
                    onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, ""))}
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
                      {resendLoading ? <CircleNotch size={12} className="animate-spin" /> : <ArrowClockwise size={12} />}
                      {resendCooldown > 0 ? `RESEND_IN_${resendCooldown}S` : "RESEND_KEY"}
                    </button>
                    {resendMessage && <p className="nothing-label text-(--db-primary) mt-2">{resendMessage}</p>}
                  </div>
                </div>
              )}

              {deleteError && (
                <div className="bg-red-500/10 text-red-500 font-bold p-4 rounded-2xl border border-red-500/20 text-[10px] animate-error-shake text-center uppercase tracking-widest">
                  {deleteError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeDeleteModal} className="flex-1 py-3.5 btn-secondary text-[10px] nothing-label opacity-100">ABORT</button>
                <button type="submit" disabled={deleteLoading} className="flex-1 py-3.5 btn-danger text-xs tracking-widest disabled:opacity-40">
                  {deleteLoading ? <CircleNotch size={18} className="animate-spin" /> : (showOtpInput ? "TERMINATE" : "PROCEED")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
