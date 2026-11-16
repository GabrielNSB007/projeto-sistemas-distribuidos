
import * as readline from 'node:readline';
import connectToServer from './connect.js';

const HOST = '127.0.0.1';
const PORT = 5000;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

console.log('BEM VINDO AO CONVERSOR 2000: TXT PARA PDF');
console.log('---------------------------------------');

try {
    const fileName = await askQuestion(
        'Insira o nome do arquivo com .txt no final: '
    );

    await connectToServer(
        fileName,
        HOST,
        PORT
    );

    console.log('Conversão finalizada com sucesso!');

} catch (error) {
    console.error('Erro na solicitação:', error);
} finally {
    rl.close();
}
