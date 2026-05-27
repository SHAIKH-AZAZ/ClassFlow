import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-panel">
        <p className="eyebrow">Institute Zoom LMS</p>
        <h1>Sign in</h1>
        <p className="muted">Use the email and password created in Supabase Auth.</p>
        <LoginForm />
      </section>
    </main>
  );
}
