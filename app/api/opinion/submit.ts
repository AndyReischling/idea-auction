import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { opinion } = await request.json();
  // In real app you’d persist to a DB; here we just echo success
  return NextResponse.json({ message: 'Opinion submitted successfully!', opinion });
}
