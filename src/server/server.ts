import { SERVER_HOST, SERVER_PORT } from '../shared/constants/app.constants.js';
import { app } from './app.js';
import { TaskService } from './services/tasks.service.js';

async function startServer(): Promise<void> {
    await new TaskService().startResultConsumer();

    app.listen(SERVER_PORT, SERVER_HOST, () => {
        console.log(`Servidor HTTP executando em http://localhost:${SERVER_PORT}`);
    });
}

startServer().catch((error) => {
    console.error('Erro ao iniciar a API:', error);
    process.exit(1);
});
