"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/actions/auth";

type Mode = "signin" | "signup";

export function AuthForm({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signInAction, signingIn] = useActionState<AuthFormState, FormData>(signIn, { error: initialError });
  const [signUpState, signUpAction, signingUp] = useActionState<AuthFormState, FormData>(signUp, {});

  const state = mode === "signin" ? signInState : signUpState;
  const pending = mode === "signin" ? signingIn : signingUp;

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div role="tablist" aria-label="Authentication" className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md py-1.5 font-medium transition-colors ${
              mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form key={mode} action={mode === "signin" ? signInAction : signUpAction} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.email}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
          {mode === "signup" && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
