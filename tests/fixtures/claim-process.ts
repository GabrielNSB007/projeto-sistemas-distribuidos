import { claimTask } from '../../src/worker/task-claim.js';

const [claimsDirectory, taskId] = process.argv.slice(2);
if (!claimsDirectory || !taskId) throw new Error('Argumentos insuficientes.');

const result = await claimTask(taskId, claimsDirectory);
if (!result.acquired) throw new Error('Não foi possível adquirir o lock de teste.');

console.log(JSON.stringify({ event: 'test.claim_acquired', task_id: taskId, pid: process.pid }));
// Encerra sem liberar o lock, como uma interrupção abrupta do Worker.
process.exit(0);
