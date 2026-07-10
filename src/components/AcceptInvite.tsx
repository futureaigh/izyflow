import { useEffect, useState } from "react";
import { api } from "../lib/api";

const icons: Record<string, [string, string]> = {
  loading: ["bg-violet-100", "⏳"],
  success: ["bg-emerald-100", "✓"],
  error: ["bg-rose-100", "✗"],
  "need-auth": ["bg-violet-100", "👁"],
};

export function AcceptInvite() {
  const [status, setStatus] = useState<"loading" | "need-auth" | "success" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setStatus("error"); setMsg("Missing invitation token."); return; }

    api.acceptInvite(token).then(r => { setStatus("success"); setMsg(r.message || "You've joined the workspace!"); }).catch((err: any) => {
      const m = err?.message || "";
      if (m.includes("401") || m.includes("Unauthorized")) { setStatus("need-auth"); setMsg("Sign in to accept this invitation."); }
      else { setStatus("error"); setMsg(m || "Failed to accept invitation."); }
    });
  }, []);

  if (status === "need-auth") return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center space-y-4">
        <div className={`w-16 h-16 rounded-full ${icons["need-auth"][0]} flex items-center justify-center mx-auto text-2xl`}>{icons["need-auth"][1]}</div>
        <h1 className="text-2xl font-black text-gray-900">Sign in to accept</h1>
        <p className="text-gray-600">You need to sign in with the email address that was invited.</p>
      </div>
    </div>
  );

  const [bg, icon] = icons[status] || icons.loading;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center space-y-4">
        <div className={`w-16 h-16 rounded-full ${bg} flex items-center justify-center mx-auto text-2xl ${status === "loading" ? "animate-pulse" : ""}`}>{icon}</div>
        {status === "loading" && <h1 className="text-2xl font-black text-gray-900">Accepting invitation...</h1>}
        {status === "success" && <><h1 className="text-2xl font-black text-gray-900">You're in!</h1><p className="text-gray-600">{msg}</p><a href="/" className="inline-block mt-4 px-6 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700">Go to Dashboard</a></>}
        {status === "error" && <><h1 className="text-2xl font-black text-gray-900">Invitation failed</h1><p className="text-gray-600">{msg}</p><a href="/" className="inline-block mt-4 px-6 py-3 bg-gray-600 text-white rounded-xl font-bold hover:bg-gray-700">Go Home</a></>}
      </div>
    </div>
  );
}
