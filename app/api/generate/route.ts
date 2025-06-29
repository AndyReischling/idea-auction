import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // You can customize the tone here or get it from the request body
    const tone = "controversial"; // or "witty", "absurd", etc.
    
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

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // or "gpt-4" if you prefer
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.9, // High creativity for absurdist humor
    });

    const opinion = completion.choices[0]?.message?.content?.trim();

    if (!opinion) {
      throw new Error('No opinion generated');
    }

    return NextResponse.json({ opinion });

  } catch (error) {
    console.error('Error generating opinion:', error);
    
    // Fallback to mock opinions if OpenAI fails
    const mockOpinions = [
      "I'm not saying I'm always right, but I can't recall a time when I was wrong. But hey, it's all part of the charm.",
      "The best way to predict the future is to invent it yourself, then immediately forget where you put it.",
      "My therapist says I have a pre-existing condition of not knowing when to stop talking.",
      "I took the money I was saving for retirement and bought a really good pen.",
      "Confidence is what you have before you understand the problem, which explains most of my life decisions.",
      "I'm not lazy, I'm just highly motivated to do nothing.",
      "My diet is basically see food and eat food, but pronounced with a really pretentious accent.",
      "I went to buy some camouflage pants the other day but couldn't find any.",
      "The early bird might get the worm, but the second mouse gets the cheese.",
      "I haven't slept for ten days, because that would be too long."
    ];
    
    const randomOpinion = mockOpinions[Math.floor(Math.random() * mockOpinions.length)];
    
    return NextResponse.json({ 
      opinion: randomOpinion,
      fallback: true 
    });
  }
}

