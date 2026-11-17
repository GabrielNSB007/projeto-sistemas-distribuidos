import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const OUTPUT_DIRECTORY = path.resolve(PROJECT_ROOT, 'convertidos');

export default function connectToServer(
    inputFileName: string,
    host: string,
    port: number
): Promise<void> {

    return new Promise((resolve, reject) => {
        const filePath = path.resolve(PROJECT_ROOT, inputFileName);
        const fileName = path.basename(filePath);
        const pdfName = `${path.parse(fileName).name}.pdf`;
        const pdfPath = path.join(OUTPUT_DIRECTORY, pdfName);

        const socket = net.createConnection({ host, port });

        type TransferStage =
            | 'AGUARDANDO_ACEITE'
            | 'ENVIANDO_ARQUIVO'
            | 'RECEBENDO_PDF'
            | 'CONCLUIDO';

        let stage: TransferStage = 'AGUARDANDO_ACEITE';
        let response = '';
        let pdfSize: number | null = null;
        let pdfData = Buffer.alloc(0);
        let finished = false;

        const fail = (error: Error) => {
            if (finished) return;

            finished = true;
            socket.destroy();
            reject(error);
        };

        const sendFile = async () => {
            try {
                const file = await fs.promises.readFile(filePath);

                const fileSize = Buffer.alloc(4);
                fileSize.writeUInt32BE(file.length);

                stage = 'ENVIANDO_ARQUIVO';

                socket.write(Buffer.concat([
                    fileSize,
                    file
                ]));

                console.log('Arquivo enviado ao servidor!');
                console.log('Aguardando conversão...');

                stage = 'RECEBENDO_PDF';

            } catch (error) {
                fail(
                    error instanceof Error
                        ? error
                        : new Error(String(error))
                );
            }
        };

        const receivePdf = async (data: Buffer) => {
            pdfData = Buffer.concat([pdfData, data]);

            if (pdfSize === null) {
                if (pdfData.length < 4) return;

                pdfSize = pdfData.readUInt32BE(0);
                pdfData = pdfData.subarray(4);
            }

            if (pdfData.length > pdfSize) {
                fail(new Error('O servidor enviou mais bytes do que o esperado.'));
                return;
            }

            if (pdfData.length === pdfSize) {
                stage = 'CONCLUIDO';

                try {
                    await fs.promises.mkdir(OUTPUT_DIRECTORY, {
                        recursive: true
                    });

                    await fs.promises.writeFile(pdfPath, pdfData);

                    finished = true;

                    console.log(`PDF salvo em: ${pdfPath}`);

                    socket.end();
                    resolve();

                } catch (error) {
                    fail(
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    );
                }
            }
        };

        socket.on('connect', () => {
            console.log('Conectado ao servidor!');

            socket.write(`CONVERT txt pdf ${fileName}\n`);
        });

        socket.on('data', (data: Buffer) => {
            if (stage === 'AGUARDANDO_ACEITE') {
                response += data.toString('utf-8');

                const headerEnd = response.indexOf('\n');

                if (headerEnd === -1) return;

                const message = response.slice(0, headerEnd).trim();

                if (message === 'ACCEPT') {
                    console.log('Solicitação aceita pelo servidor!');

                    void sendFile();
                    return;
                }

                fail(new Error(`Solicitação rejeitada: ${message}`));
                return;
            }

            if (stage === 'RECEBENDO_PDF') {
                void receivePdf(data);
            }
        });

        socket.on('error', (error) => {
            fail(error);
        });

        socket.on('close', () => {
            console.log('Conexão encerrada.');

            if (!finished && stage !== 'CONCLUIDO') {
                fail(
                    new Error(
                        'Conexão encerrada antes da conclusão da transferência.'
                    )
                );
                return;
            }
        });
    });
}