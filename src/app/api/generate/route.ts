/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import { Queue } from 'bullmq';

export async function POST(request: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });

  try {
    const { selectedSentence }: { selectedSentence: string } = await request.json();

    console.log("ANTES OPENAI");

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          'Generate the phonetic transcription of the given sentence using the following rules: Break down each word into its phonetic components (syllables). Represent each syllable using the ARPAbet phonetic alphabet. Enclose the entire transcription in square brackets [ ]. Separate each syllables phonetic representation with commas. Use spaces between words in the original sentence to separate their phonetic representations. Do not include punctuation marks in the phonetic transcription. For example, given the sentence "The sun is shining bright today", the output should be: [dh ah, s ah n, ih z, sh ay n, ih ng, b r ay t, t ah, d ey], Each phonetic symbol represents a specific sound: Vowels: ah, iy, uw, eh, ih, ey, ae, ay, aw, ao, oy ,Consonants: b, d, f, g, h, j, k, l, m, n, p, r, s, t, v, w, y, z ,Special sounds: ng, th, dh, ch, jh, sh, zh ,Provide the phonetic transcription for the given sentence following these rules.',
      },
      { role: "user", content: selectedSentence },
    ];

    const completion: any = await openai.chat.completions.create({
      messages,
      model: "gpt-4o",
    });

    const result: any = completion.choices[0].message.content;

    // const myQueue = new Queue('myqueue', { connection: {
    //     host: "myredis.taskforce.run",
    //     port: 32856
    //   }});

    console.log("result", result);

    return NextResponse.json(result, {
      status: 201,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "An error has occurred", text: e },
      { status: 500 }
    );
  }
}
