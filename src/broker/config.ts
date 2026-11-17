// config.ts
import dotenv from "dotenv";
dotenv.config();

export const rmqUser = process.env.RABBITMQ_USER || "guest";
export const rmqPass = process.env.RABBITMQ_PASS || "guest";
export const rmqHost = process.env.RABBITMQ_HOST || "localhost";
export const rmqPort = process.env.RABBITMQ_PORT || 5672;
export const TASK_QUEUE = process.env.TASK_QUEUE || "task_queue";
export const RESULT_QUEUE = process.env.RESULT_QUEUE || "task_results";