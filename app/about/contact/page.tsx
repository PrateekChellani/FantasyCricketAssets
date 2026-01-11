'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const NATURE_OPTIONS = [
  'Account/Log-in Issue',
  'Data Accuracy',
  'Gameplay Issue',
  'Feedback and Suggestions',
  'Legal',
  'Partnerships and Collabration',
  'Other',
];

export default function ContactPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [nature, setNature] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const validateEmail = (val: string) =>
    /^\S+@\S+\.\S+$/.test(val);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email.');
      return;
    }
    setEmailError(null);

    const formData = new FormData();
    formData.append('username', username);
    formData.append('email', email);
    formData.append('nature', nature || 'Other');
    formData.append('description', description);

    if (files) {
      // client-side filter to accept only jpg/png
      Array.from(files).forEach((f) => {
        const ok = ['image/jpeg', 'image/jpg', 'image/png'].includes(f.type);
        if (ok) formData.append('attachments', f);
      });
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/contact', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Failed to submit');
      }

      // Clear fields + show success banner + refresh page
      formRef.current?.reset();
      setUsername('');
      setEmail('');
      setNature('');
      setDescription('');
      setFiles(null);

      setBanner('Your request was submitted. We will get back to you within 48-72 hours.');
      router.refresh(); // light refresh
    } catch (err) {
      setBanner('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Banner */}
      {banner && (
        <div style={{
          padding: '10px 12px',
          border: '1px solid #d1e7dd',
          background: '#ecfdf5',
          borderRadius: 8,
          marginBottom: 16
        }}>
          {banner}
        </div>
      )}

      {/* Text A */}
      <p style={{ marginTop: 8 }}>
        While we are happy to help you with any requests, we recommend reading the{' '}
        <Link href="/guide/faq">FAQ</Link> page first, as that may provide you with a faster solution.
        Please allow 48-72 hours for a response once you submit this form.
      </p>

      {/* Heading */}
      <h1 style={{ fontSize: 28, marginTop: 24, marginBottom: 16 }}>Contact Us</h1>

      <form ref={formRef} onSubmit={onSubmit} noValidate>
        {/* Username */}
        <label style={{ display: 'block', marginBottom: 6 }}>Username</label>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
        />

        {/* Email */}
        <label style={{ display: 'block', marginTop: 18, marginBottom: 6 }}>Your Email</label>
        <input
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            ...inputStyle,
            borderColor: emailError ? '#dc2626' : '#e5e7eb',
          }}
        />
        {emailError && (
          <div style={{ color: '#dc2626', fontSize: 13, marginTop: 6 }}>
            {emailError}
          </div>
        )}

        {/* Nature of Request */}
        <label style={{ display: 'block', marginTop: 18, marginBottom: 6 }}>Nature of Request</label>
        <select
          value={nature}
          onChange={(e) => setNature(e.target.value)}
          style={{ ...inputStyle, height: 40 }}
        >
          <option value="">-</option>
          {NATURE_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>

        {/* Description */}
        <label style={{ display: 'block', marginTop: 18, marginBottom: 6 }}>Description</label>
        <textarea
          placeholder="Describe your issue or request…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }}
        />

        {/* Attachments */}
        <label style={{ display: 'block', marginTop: 18, marginBottom: 6 }}>
          Attachments (optional)
        </label>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png"
          onChange={(e) => setFiles(e.target.files)}
          style={{ display: 'block', marginBottom: 6 }}
        />
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          Currently only .jpg and .png files are accepted.
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={buttonStyle}
        >
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  outline: 'none',
  background: '#fff',
};

const buttonStyle: React.CSSProperties = {
  marginTop: 18,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #111',
  background: '#111',
  color: '#fff',
  cursor: 'pointer',
};
