import type { Task } from "../tasks/task.model.js";
import mqConnection from "./connection.js";

class Queue {
    async createQueue(queueName: string) {
        const channel = await mqConnection.connect();

        await channel.assertQueue(queueName, {
            durable: true
        });

        return channel;
    }

    async publish(queueName: string, task: Task) {
        const channel = await this.createQueue(queueName);

        await new Promise<void>((resolve, reject) => {
            channel.sendToQueue(
                queueName,
                Buffer.from(JSON.stringify(task)),
                { persistent: true, contentType: "application/json", messageId: task.task_id },
                (error) => {
                    if (error) reject(error);
                    else resolve();
                }
            );
        });
    }

    async consume(queueName: string, callback: (task: Task) => Promise<void> | void) {
        const channel = await this.createQueue(queueName);

        await channel.prefetch(1);

        await channel.consume(queueName, async (msg) => {
            if (!msg) return;

            try {
                const content: Task = JSON.parse(msg.content.toString());

                await callback(content);

                channel.ack(msg);
            } catch (error) {
                console.error("Erro ao processar mensagem:", error);
                channel.nack(msg, false, false);
            }
        });
    }

    async close(): Promise<void> {
        await mqConnection.close();
    }
}

const queue = new Queue();

export default queue;