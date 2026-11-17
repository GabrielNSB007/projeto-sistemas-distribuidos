import { SERVER_HOST, SERVER_PORT } from '../shared/constants/app.constants.js';
import { app } from './app.js';

app.listen(SERVER_PORT, SERVER_HOST, () => {
    console.log(`Servidor HTTP executando em http://localhost:${SERVER_PORT}`);
});
