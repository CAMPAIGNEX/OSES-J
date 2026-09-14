"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Button, Card, Field, Input } from "@/components/ui/primitives";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", companyName: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      await api("/api/auth/register", { body: form });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fieldErrors());
        setError(err.message);
      } else setError("Could not create the account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">Create your workspace</h1>
      <p className="mt-1 text-[13px] text-muted">Set up your exporter organization. You can invite teammates later.</p>
      <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
        <Field label="Your name" error={fields.name}>
          <Input autoComplete="name" value={form.name} onChange={set("name")} placeholder="Ahmed Khan" required invalid={Boolean(fields.name)} />
        </Field>
        <Field label="Company name" error={fields.companyName}>
          <Input autoComplete="organization" value={form.companyName} onChange={set("companyName")} placeholder="ABC Sportswear" required invalid={Boolean(fields.companyName)} />
        </Field>
        <Field label="Work email" error={fields.email}>
          <Input type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@company.com" required invalid={Boolean(fields.email)} />
        </Field>
        <Field label="Password" error={fields.password} description="At least 8 characters.">
          <Input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required invalid={Boolean(fields.password)} />
        </Field>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
