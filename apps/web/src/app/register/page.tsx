"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!sb) return setMsg("Supabase yapılandırılmamış (.env eksik).");
    if (password.length < 10) return setMsg("Şifre en az 10 karakter olmalı.");
    const { error } = await sb.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMsg(error ? "Kayıt tamamlanamadı: " + error.message : "Doğrulama bağlantısı e-postanıza gönderildi.");
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8, maxWidth: 320 }}>
      <h1>Kayıt ol</h1>
      <input type="email" required placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" required minLength={10} placeholder="Şifre (en az 10 karakter)" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /> Kullanım şartlarını ve KVKK aydınlatma metnini kabul ediyorum (metinler taslak).</label>
      <button type="submit" disabled={!accepted}>Kayıt ol</button>
      {msg && <p role="status">{msg}</p>}
      <Link href="/login">Zaten hesabım var</Link>
    </form>
  );
}
