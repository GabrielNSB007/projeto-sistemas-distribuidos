// config.ts
import dotenv from "dotenv";
dotenv.config();

export const rmqUser = process.env.RABBITMQ_USER || "guest";
export const rmqPass = process.env.RABBITMQ_PASS || "guest";
export const rmqHost = process.env.RABBITMQ_HOST || "localhost";
export const CONVERSION_QUEUE = process.env.CONVERSION_QUEUE || "conversion_queue";