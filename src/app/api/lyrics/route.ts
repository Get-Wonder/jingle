/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(request: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });

  try {
    const { text }: { text: string } = await request.json();

    if(text.length > 300) {
        return NextResponse.json(
            { error: "The text must contain less than 300 characters" },
            { status: 400 }
          );
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          'I need to convert any text into a new text of 7 syllables, The final text MUST HAVE 7 SYLLABLES. you need to change or modify the text to meet the requirement of 7 syllables. You must return 10 different fun, happy and energetic examples. You also have the following topics prohibited ["negative message of avocados", "Politics", "Drugs", "Weapons", "Violence"], if the input contains something of this topic, you must return the following: { "error": true }. each different from the other in the structure of the following example: UserInput: "I would like to eat some avocados right now" => "Craving avocados here", you must also for each example return the ammount of syllabes it has, in the following format => ["cra", "ving", "avo", "ca", "dos", "he", "re"]. You must return a pair of text and syllables for each of the ten different texts in the following format [{"text": "craving avocados here", "syllables": ["cra", "ving", "avo", "ca", "dos", "he", "re"]}] you must only return the array containing all the examples DO NOT ADD ```json``` around the array, just return the array, each object for example containing text and syllables. Do as the instruction tell for the following example:',
      },
      { role: "user", content: text },
    ];

    const completion: any = await openai.chat.completions.create({
      messages,
      model: "gpt-4o",
    });

    const result: any = await JSON.parse(completion.choices[0].message.content)

    if(result?.error) {
        return NextResponse.json(
            { error: "Forbidden input"},
            { status: 400 }
          );
    }

    const examplesOfSevenSyllables: any = [];
    if (result?.length > 0) {
      result.forEach((element: any) => {
        if (
          examplesOfSevenSyllables.length < 3 &&
          (element?.syllables.length === 7 || element?.syllables.length === 6 || element?.syllables.length === 8)
        ) {
          examplesOfSevenSyllables.push(element?.text);
        }
      });
    }

    return NextResponse.json({ success: true, data: [...examplesOfSevenSyllables] }, {
      status: 201,
    });
  } catch (e) {
    console.log('error in lyrics', e)
    return NextResponse.json(
      { error: "An error has occurred, please try again"},
      { status: 500 }
    );
  }
}
