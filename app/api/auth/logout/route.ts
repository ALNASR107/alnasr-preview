import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('amanah_session', '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set('amanah_user', '', { path: '/', maxAge: 0 });
  return res;
}
