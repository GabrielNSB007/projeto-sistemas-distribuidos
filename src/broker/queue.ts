import type { Task } from "../tasks/task.model.js";
import { logTaskLifecycle } from "../shared/logging/task-lifecycle.js";
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

            const taskId = msg.properties.messageId ?? null;
            let content: Task;
            try {
                content = JSON.parse(msg.content.toString()) as Task;
            } catch (error) {
                logTaskLifecycle('broker.message_rejected', taskId, {
                    queue: queueName,
                    error: error instanceof Error ? error.message : String(error),
                }, 'error');
                channel.nack(msg, false, false);
                return;
            }

            try {
                await callback(content);
                channel.ack(msg);
                logTaskLifecycle('broker.message_acknowledged', content.task_id, {
                    queue: queueName,
                });
            } catch (error) {
                logTaskLifecycle('broker.message_processing_failed', content.task_id, {
                    queue: queueName,
                    error: error instanceof Error ? error.message : String(error),
                    requeued: true,
                }, 'error');
                channel.nack(msg, false, true);
            }
        });
    }

    async close(): Promise<void> {
        await mqConnection.close();
    }
}

const queue = new Queue();

export default queue;