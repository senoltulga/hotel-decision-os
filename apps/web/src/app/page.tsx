import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>Gelir Motoru</h1>
      <p>Gayrimenkul yatırımınızın gelir ve gider kalemlerini modelleyin, geri dönüş süresini hesaplayın.</p>
      <p><Link href="/login">Giriş yap</Link> · <Link href="/register">Kayıt ol</Link></p>
    </>
  );
}
