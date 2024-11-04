/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { queueConnection } from "@/app/lib/redis";

export async function GET() {
 
    const counts = await queueConnection.getJobCounts('active','wait', 'completed', 'failed');

    console.log('counts', counts)

    const failedJobs = await queueConnection.getFailed();

    const workers = await queueConnection.getWorkers();

    return NextResponse.json(
      { success: true, data: counts, failedJobs, workers },
      {
        status: 201,
      }
    );

}