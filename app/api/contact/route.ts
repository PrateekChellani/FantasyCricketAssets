// app/api/contact/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// ensure Node runtime so Buffer is available
export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const email = (form.get('email') as string | null) ?? '';
    const nature = (form.get('nature') as string | null) ?? '';
    const description = (form.get('description') as string | null) ?? '';
    const username = (form.get('username') as string | null) ?? 'Unknown';

    // Collect jpg/png attachments as base64 for Resend
    const attachments: Array<{ filename: string; content: string }> = [];
    const files = form.getAll('attachments') as unknown as File[]; // TS: treat as File[]

    for (const file of files) {
      if (!file || typeof file === 'string') continue;
      if (!file.size) continue;
      const mime = file.type?.toLowerCase() || '';
      if (mime !== 'image/jpeg' && mime !== 'image/png') continue;

      const buf = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: file.name,
        content: buf.toString('base64'),
      });
    }

    const subject = `Fantasy Cricket - ${nature} from ${username}`;
    const admin = 'shadowchampion001@gmail.com';

    // Send to admin
    await resend.emails.send({
      from: 'Fantasy Cricket <support@your-domain.com>',
      to: admin,
      subject,
      text: [
        `Username: ${username}`,
        `Email: ${email}`,
        '',
        description,
      ].join('\n'),
      attachments,
    });

    // Send confirmation to requester
    if (email) {
      await resend.emails.send({
        from: 'Fantasy Cricket <support@your-domain.com>',
        to: email,
        subject: 'We received your request',
        text:
          'Thanks for reaching out! We’ve received your message and will respond within 48–72 hours.',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
