/* eslint-disable @typescript-eslint/no-explicit-any */
import { queueConnection } from '@/app/lib/redis';
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

export async function POST(request: NextRequest) {
  const SALT = process.env.SALT;
  const bucketName = process.env.DO_BUCKET

  const addSalt = (text: string) => {
    return text + SALT;
  };

  const createMD5 = (text: string) => {
    const textWithSalt = addSalt(text);
    return crypto.createHash("md5").update(textWithSalt).digest("hex");
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

  const checkFileExists = async (text: string) => {
    try {
        const hash = createMD5(text)
        const audioUrl = `https://${bucketName}.ams3.digitaloceanspaces.com/jingle/clips/${hash}.mp3`
        console.log('CHECK IF URL EXISTS', audioUrl)
      const response = await fetch(
        audioUrl,
        { method: "HEAD" }
      );
      return { success: response.ok, audioUrl };
    } catch (e) {
        console.log('e', e)
      return { success: false }

    }
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
    
    const alreadyExists = await checkFileExists(selectedSentence?.text)

    if(alreadyExists?.success) {
        return NextResponse.json(
            { success: true, audioUrl: alreadyExists?.audioUrl, text: selectedSentence?.text },
            { status: 201 }
          );
    }

    const job = await queueConnection.add("generate", { text: selectedSentence?.text, count: 8 });

    let tries = 0;
    const MAX_TRIES = 15;

    const checkJobCompletion = async () => {
      tries += 1;
      try {
        if (queueConnection) {
          const completedJobs = await queueConnection.getJobs(["completed"]);
          const completedJob = completedJobs.find((j) => j.id === job.id);

          if (completedJob) {
            if (completedJob.returnvalue?.error) {
              return NextResponse.json(
                {
                  error: "An error has occurred, please try again",
                  success: false,
                },
                { status: 500 }
              );
            }

            const audioUrl = completedJob.returnvalue.clipUrl;
            console.log("Clip URL:", audioUrl);

            await queueConnection.clean(0, 500, "completed");

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
