"use client";

import { useState } from "react";
import { apiPost, errorMessage } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await apiPost("/api/contact", { name, email, message });
      setSuccess("Thanks! We'll get back to you soon.");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      setError(errorMessage(err, "Could not send your message. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card as="form" onSubmit={handleSubmit} className="p-8 flex flex-col gap-4">
      <TextField label="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
      <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Message<span className="text-danger">*</span>
        </label>
        <textarea
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-card-border bg-background outline-none focus:border-primary resize-y"
        />
      </div>
      <FormMessage error={error} success={success} />
      <Button type="submit" loading={loading}>
        {loading ? "Sending..." : "Send message"}
      </Button>
    </Card>
  );
}
