import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This is failing
});

export async function POST(req: NextRequest) {
  try {
    // You can customize the tone here or get it from the request body
    const tone = "controversial"; // or "witty", "absurd", etc.
    
    const prompt = `
You are @dril, the legendary twitter account known for absurdist, chaotic posts.

Generate a **${tone}** @dril-style tweet in 1-2 sentences. Must feel authentic to @dril's specific voice and energy.

Critical @dril Style Rules:
- Write in lowercase unless using ALL CAPS for emphasis
- Present absurd scenarios as completely serious and matter-of-fact
- Include bizarre, specific details that make no logical sense
- Use unconventional grammar and occasional typos naturally
- Reference pop culture, brands, or mundane things in weird ways
- Make declarative statements about impossible or ridiculous things
- Sometimes include parenthetical asides like (((this))) or random capitalization
- Create internal logic that is completely unhinged but presented confidently
- Do NOT be witty or clever - be chaotic and absurdist
- ABSOLUTELY NO quotation marks around the opinion
- NEVER end with question marks
- NEVER mention pizza
- Each opinion must be completely different from previous ones
- Output the raw opinion text only, no quotes or formatting

Example @dril Tweets for Style Reference Only:
- "i refuse to consume any product that has been created by, or is claimed to have been created by, the (((Keebler Elves)))"
- "commercials used to be like 'Envision a world where a kid can have Lunch. No teachers' . now theyre like 'Please buy the 2025 nissan altima'"
- "its messed up how there are like 1000 christmas songs but only 1 song aboutr the boys being back in town"
- "'we dont deserve dogs' of course we deserve dogs you fool. before we bred the evil out of them they were basically giant rats"
- "If your grave doesn't say 'rest in peace' on it you are automatically drafted into the skeleton war"
- "in real life yoda would get eaten by a dog"
- "IF THE ZOO BANS ME FOR HOLLERING AT THE ANIMALS I WILL FACE GOD AND WALK BACKWARDS INTO HELL"
- "every generation deserves at least 5 movies named 'Spider Man 2'"

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
      temperature: 1.1, // Maximum chaos for authentic @dril energy
    });

    const opinion = completion.choices[0]?.message?.content?.trim();

    if (!opinion) {
      throw new Error('No opinion generated');
    }

    return NextResponse.json({ opinion });

  } catch (error) {
    console.error('Error generating opinion:', error);
    console.error('API Key exists:', !!process.env.OPENAI_API_KEY);
    console.error('API Key length:', process.env.OPENAI_API_KEY?.length);
    console.error('API Key first 10 chars:', process.env.OPENAI_API_KEY?.slice(0, 10));
    
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

