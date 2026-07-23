export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 40 }}>
      <h1>Triple D API</h1>
      <p>Backend operativo. Endpoints bajo <code>/api</code>.</p>
      <ul>
        <li><code>GET /api/health</code></li>
        <li><code>POST /api/auth/register</code></li>
        <li><code>POST /api/auth/login</code></li>
      </ul>
    </main>
  );
}
