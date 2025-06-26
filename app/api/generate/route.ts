// app/api/generate/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  console.log('✅ /api/generate endpoint was hit');

  /* ---------- build the prompt ---------- */
  const styles = ['odd', 'funny', 'off-beat', 'witty', 'absurd'];
  const tone   = styles[Math.floor(Math.random() * styles.length)];

const prompt = `
You are a witty, absurdist internet presence. 

Give me an **${tone}** example of the kind of statement that could go viral online in 1–2 sentences. It must feel fresh. The tone is Tracy Jordan meets Woody Allen meets Mitch Hedberg meets Dr. Leo Spaceman.

Rules:
- You **cannot** add a new statement after the opinion.
- You cannot add hashtags.
- You may sometimes make a prediction about current events.
- There can only be **one** opinion, and it must be different from anything previously returned.
- Write in the style of an off-beat social-media post that goes viral.
- Do **not** wrap the opinion in quotation marks.
- The opinion should be edgy but not offensive. You cannot use profanity or mention offensive figures or remarks. 
- Do **not** end with a question mark.
- Do **not** mention pizza.

Example opinions (for style only):
- NYC is the last place you can still eat carbs.
- I'm not afraid of death; I just don't want to be there when it happens.
- Life doesn't imitate art, it imitates bad television.
- Confidence is what you have before you understand the problem.
- I took the money I was saving for my honeymoon and bought a cemetery plot.
- I took the money I was saving for my honeymoon and bought a cemetery plot
- What can you do? Medicine is not a science.
- I watched Boston Legal nine times before I realized it was not a new Star Trek.
- Stop eating people's old french fries, pigeon! Have some self respect! Don't you know you can fly?
- Live every week like it is shark week.
- Factories provide three things this country desperately needs: jobs, pride, and material for Bruce Springsteen songs

Return **only** the new opinion.`;

  /* ---------- call OpenAI ---------- */
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type' : 'application/json',
        Authorization   : `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model      : 'gpt-3.5-turbo',
        messages   : [{ role: 'user', content: prompt }],
        temperature: 1,
        max_tokens : 100,
      }),
    });

    /* ---- handle non-OK responses from OpenAI ---- */
    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ OpenAI returned', response.status, errText);
      return NextResponse.json(
        { error: 'Failed to generate opinion' },
        { status: 500 },
      );
    }

    const data  = await response.json();
    console.log('🔁 OpenAI response:', data);

    const idea =
      data.choices?.[0]?.message?.content ?? 'No idea returned';

    return NextResponse.json({ idea });
  } catch (err) {
    console.error('❌ /api/generate crashed:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 },
    );
  }
}
