import { Queue } from "bullmq";

declare global {
  // eslint-disable-next-line no-var
  var queueConnection: Queue | undefined;
}

const redisHost = process.env.REDIS_HOSTNAME;
// const redisPassword = process.env.REDIS_PASSWORD;

const redisPassword = "he@$6&Lzh4XkRJ$_";

export const createQueueConnection = () => {
  if (!global.queueConnection) {
    global.queueConnection = new Queue("jingle-queue", {
      connection: {
        host: redisHost,
        port: 6379,
        password: redisPassword,
      },
    });
  }

  return global.queueConnection;
};

export const queueConnection = createQueueConnection();
