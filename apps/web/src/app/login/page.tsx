"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!sb) return setMsg("Supabase yapılandırılmamış (.env eksik).");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message.includes("Email not confirmed") ? "E-posta adresinizi doğrulayın." : "E-posta veya şifre hatalı.");
    else window.location.href = "/app";
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8, maxWidth: 320 }}>
      <h1>Giriş</h1>
      <input type="email" required placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" required placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Giriş yap</button>
      {msg && <p role="alert">{msg}</p>}
      <Link href="/register">Hesabınız yok mu? Kayıt olun</Link>
    </form>
  );
}
