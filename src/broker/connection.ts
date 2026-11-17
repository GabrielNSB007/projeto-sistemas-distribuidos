import amqp, { type ChannelModel, type ConfirmChannel } from "amqplib";
import { rmqUser, rmqPass, rmqHost, rmqPort } from "./config.js";

class RabbitMQConnection {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connectionPromise: Promise<ConfirmChannel> | null = null;

  async connect(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel;

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.createConnection();

    try {
      return await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async createConnection(): Promise<ConfirmChannel> {
    let connection: ChannelModel | null = null;

    try {
      console.log("Conectando ao servidor RabbitMQ");

      const url = `amqp://${encodeURIComponent(rmqUser)}:${encodeURIComponent(rmqPass)}@${rmqHost}:${rmqPort}`;

      connection = await amqp.connect(url);
      this.connection = connection;

      connection.on("error", (error) => {
        console.error("Erro na conexão RabbitMQ:", error);
      });

      connection.on("close", () => {
        if (this.connection === connection) {
          this.connection = null;
          this.channel = null;
        }

        console.log("Conexão com RabbitMQ encerrada");
      });

      this.channel = await connection.createConfirmChannel();

      const channel = this.channel;

      channel.on("error", (error) => {
        console.error("Erro no canal RabbitMQ:", error);
      });

      channel.on("close", () => {
        if (this.channel === channel) {
          this.channel = null;
        }

        console.log("Canal RabbitMQ encerrado");
      });

      console.log("Conexão estabelecida!");
      console.log("Canal com RabbitMQ criado com sucesso!");

      return channel;
    } catch (error) {
      if (connection) {
        await connection.close().catch(() => {});
      }

      if (this.connection === connection) {
        this.connection = null;
        this.channel = null;
      }

      console.error("Não foi possível estabelecer conexão com RabbitMQ");
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.connection?.close();
  }

}

const mqConnection = new RabbitMQConnection();

export default mqConnection;
