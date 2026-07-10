import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function AcceptInvite() {
  const [status, setStatus] = useState<"loading" | "need-auth" | "success" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMsg("Missing invitation token.");
      return;
    }
    localStorage.setItem("pending_invite_token", token);

    const accept = async () => {
      try {
        const res = await api.acceptInvite(token);
        setStatus("success");
        setMsg(res.message || "You've joined the workspace!");
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.includes("401") || msg.includes("Unauthorized")) {
          setStatus("need-auth");
          setMsg("Sign in to accept this invitation.");
        } else {
          setStatus("error");
          setMsg(msg || "Failed to accept invitation.");
        }
      }
    };
    accept();
  }, []);

  if (status === "need-auth") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          </div>
          <h1 className="text-2xl font-black text-gray-900">Sign in to accept</h1>
          <p className="text-gray-600">You need to sign in with the email address that was invited.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-100 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center space-y-4">
        {status === "loading" && (
          <>
            <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mx-auto animate-pulse">
              <svg className="w-8 h-8 text-violet-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            </div>
            <h1 className="text-2xl font-black text-gray-900">Accepting invitation...</h1>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
            </div>
            <h1 className="text-2xl font-black text-gray-900">You're in!</h1>
            <p className="text-gray-600">{msg}</p>
            <a href="/" className="inline-block mt-4 px-6 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700">Go to Dashboard</a>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
            <h1 className="text-2xl font-black text-gray-900">Invitation failed</h1>
            <p className="text-gray-600">{msg}</p>
            <a href="/" className="inline-block mt-4 px-6 py-3 bg-gray-600 text-white rounded-xl font-bold hover:bg-gray-700">Go Home</a>
          </>
        )}
      </div>
    </div>
  );
}
