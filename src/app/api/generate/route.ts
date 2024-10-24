/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue } from "bullmq";
import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";
import crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

export async function POST(request: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });
  let connection: Queue | null = null;

  const redisHost = process.env.REDIS_HOSTNAME;
  const redisPassword = process.env.REDIS_PASSWORD;

  const SALT = process.env.SALT;

  const addSalt = (text: string) => {
    return text + SALT;
  };

  const convertPhoneticArray = (input: string) => {
    const phonemes = input
      .replace(/[\[\]]/g, "")
      .split(",")
      .map((s) => s.trim());

    return phonemes;
  };

  const validateMD5 = (text: string, hash: string) => {
    if (!text || !hash) {
      return false;
    }

    const textWithSalt = addSalt(text);
    const calculatedHash = crypto
      .createHash("md5")
      .update(textWithSalt)
      .digest("hex");
    return calculatedHash === hash;
  };

  try {
    const {
      selectedSentence,
    }: { selectedSentence: { text: string; hash: string } } =
      await request.json();

    const hashAreEqual = validateMD5(
      selectedSentence?.text,
      selectedSentence?.hash
    );

    if (!hashAreEqual) {
      return NextResponse.json(
        {
          error:
            "The text provided does not match any of the text originally generated",
          success: false,
        },
        { status: 400 }
      );
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "Generate the phonetic transcription of the given sentence using the following rules: Break down each word into its phonetic components (syllables). Represent each syllable using the ARPAbet phonetic alphabet. Enclose the entire transcription in square brackets [ ]. Separate each syllables phonetic representation with commas. Use spaces between words in the original sentence to separate their phonetic representations. Do not include punctuation marks in the phonetic transcription. For example, given the sentence 'The sun is shining bright today', the output should be: [dh ah, s ah n, ih z, sh ay n, ih ng, b r ay t, t ah, d ey], Each phonetic symbol represents a specific sound: Vowels: ah, iy, uw, eh, ih, ey, ae, ay, aw, ao, oy ,Consonants: b, d, f, g, h, j, k, l, m, n, p, r, s, t, v, w, y, z ,Special sounds: ng, th, dh, ch, jh, sh, zh ,Provide the phonetic transcription for the given sentence following these rules. Pay special attention to phonemes, particularly distinguishing sounds like 'zh' (as in 'genre') and 'jh' (as in 'judge'). The text is the following:",
      },
      { role: "user", content: selectedSentence?.text },
    ];

    const completion = await openai.chat.completions.create({
      messages,
      model: "gpt-4",
    });

    const result: any = completion.choices[0].message.content;

    connection = new Queue("jingle-queue", {
      connection: {
        host: redisHost,
        port: 6379,
        password: redisPassword,
      },
    });

    let fixedOutput = convertPhoneticArray(result);
    console.log("fixedOutput", fixedOutput, fixedOutput.length);

    let retryCount = 0;
    const MAX_RETRIES = 5;

    // Si hay menos de 6 o mas de 8 elementos, intentamos hasta 5 veces que chatgpt las combine o las divida
    while (
      (fixedOutput.length < 6 || fixedOutput.length > 8) &&
      retryCount < MAX_RETRIES
    ) {
      console.log(
        `Retry ${retryCount + 1} of ${MAX_RETRIES}: Output length is ${
          fixedOutput.length
        }`
      );

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `The next text is using the ARPAbet phonetic alphabet, Your task is ${
            fixedOutput.length < 6
              ? "to separate two of those phonemes, try to separate the ones that are from the same word"
              : "to combine two of those phonemes, try to combine the ones that are from the same word"
          }, return in the same structure as the input: ${fixedOutput}. `,
        },
        { role: "user", content: `${fixedOutput}` },
      ];

      const completion = await openai.chat.completions.create({
        messages,
        model: "gpt-4",
      });

      const chatgptOutput: any = completion.choices[0].message.content;
      fixedOutput = convertPhoneticArray(chatgptOutput);
      console.log(
        `After retry ${retryCount + 1}: Length ${fixedOutput.length}`,
        fixedOutput
      );

      retryCount++;
    }

    if (fixedOutput.length < 6 || fixedOutput.length > 8) {
      return NextResponse.json(
        { error: "An error has occurred, please try again", success: false },
        { status: 500 }
      );
    }

    // si hay 7 o 8 elementos y el ultimo es una letra sola, la combina con el anterior
    if (
      (fixedOutput.length === 7 || fixedOutput.length === 8) &&
      fixedOutput[fixedOutput.length - 1].trim().length === 1
    ) {
      const lastLetter = fixedOutput.pop()!;
      const previousElement = fixedOutput.pop()!;
      fixedOutput.push(`${previousElement}${lastLetter}`);
    }

    const job = await connection.add("generate", { text: fixedOutput });

    let tries = 0;
    const MAX_TRIES = 15;

    const checkJobCompletion = async () => {
      tries += 1;
      try {
        if (connection) {
          const completedJobs = await connection.getJobs(["completed"]);
          const completedJob = completedJobs.find((j) => j.id === job.id);

          if (completedJob) {
            const audioUrl = completedJob.returnvalue.clipUrl;
            console.log("Clip URL:", audioUrl);

            await connection.clean(0, 500, "completed");

            return audioUrl;
          }

          return null;
        }
      } catch (error) {
        console.error("Error obteniendo trabajos completados:", error);
        return NextResponse.json(
          { error: "An error has occurred, please try again", success: false },
          { status: 500 }
        );
      }
    };

    const waitForCompletion = async () => {
      let audioUrl = null;
      while (!audioUrl && tries < MAX_TRIES) {
        console.log(`Intento ${tries} de ${MAX_TRIES}...`);
        audioUrl = await checkJobCompletion();
        if (!audioUrl) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (tries >= MAX_TRIES) {
        return NextResponse.json(
          { error: "connection timeout", success: false },
          { status: 408 }
        );
      }

      return audioUrl;
    };

    const audioUrl = await waitForCompletion();

    console.log("TENEMOS CLIP URL", audioUrl);

    return NextResponse.json({ success: true, audioUrl }, { status: 201 });
  } catch (e) {
    const error = e instanceof Error ? e.message : "An error has occurred";
    const status =
      e instanceof Error && e.message === "Maximum number of tries exceeded"
        ? 408
        : 500;

    return NextResponse.json({ error, details: String(e) }, { status });
  }
}
