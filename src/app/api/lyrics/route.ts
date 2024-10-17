/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(request: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });

  try {
    const { text }: { text: string } = await request.json();

    console.log("ANTES OPENAI");

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          'I need to convert any text into a new text of 7 syllables, The final text MUST HAVE 7 SYLLABLES. you need to change or modify the text to meet the requirement of 7 syllables. You must return 10 different examples each different from the other in the structure of the following example: UserInput: "I would like to eat some avocados right now" => "Craving avocados here", you must also for each example return the ammount of syllabes it has, in the following format => ["cra", "ving", "avo", "ca", "dos", "he", "re"]. You must return a pair of text and syllables for each of the ten different texts in the following format [{"text": "craving avocados here", "syllables": ["cra", "ving", "avo", "ca", "dos", "he", "re"]}] you must only return the array containing all the examples DO NOT ADD ```json``` around the array, just return the array, each object for example containing text and syllables. Do as the instruction tell for the following example:',
      },
      { role: "user", content: text },
    ];

    const completion: any = await openai.chat.completions.create({
      messages,
      model: "gpt-4o",
    });

    const result: any = await JSON.parse(completion.choices[0].message.content);
    const examplesOfSevenSyllables: any = [];
    console.log("result", result);
    if (result?.length > 0) {
      console.log("adentro if");
      result.forEach((element: any) => {
        console.log("FOR EACH", element);
        console.log("element?.syllables.length", element?.syllables.length);
        if (
          examplesOfSevenSyllables.length < 3 &&
          (element?.syllables.length === 7 ||
            element?.syllables.length === 6 ||
            element?.syllables.length === 8)
        ) {
          console.log("HAY MENOS DE 3 Y LA SILABA TIENE MAS DE 6 DE LENGHT");
          examplesOfSevenSyllables.push(element?.text);
        }
      });
    }

    console.log(
      "three examples of seven #####################",
      examplesOfSevenSyllables
    );

    return NextResponse.json(examplesOfSevenSyllables, {
      status: 201,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "An error has occurred", text: e },
      { status: 500 }
    );
  }
}
