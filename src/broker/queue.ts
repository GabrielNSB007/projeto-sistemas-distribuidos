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

        channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(task)),
            { persistent: true }
        );
    }

    async consume(queueName: string, callback: (task: Task) => void) {
        const channel = await this.createQueue(queueName);

        await channel.consume(queueName, (msg) => {
            if (!msg) return;

            try {
                const content = JSON.parse(msg.content.toString());

                callback(content);

                channel.ack(msg);
            } catch (error) {
                console.error("Erro ao processar mensagem:", error);
                channel.nack(msg, false, false);
            }
        });
    }
}

const queue = new Queue();

export default queue;