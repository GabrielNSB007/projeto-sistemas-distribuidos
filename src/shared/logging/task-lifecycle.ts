type LifecycleLevel = 'info' | 'error';

export function logTaskLifecycle(
    event: string,
    taskId: string | null,
    details: Record<string, unknown> = {},
    level: LifecycleLevel = 'info',
): void {
    const entry = {
        ...details,
        timestamp: new Date().toISOString(),
        event,
        task_id: taskId,
        pid: process.pid,
    };
    const serialized = JSON.stringify(entry);

    if (level === 'error') {
        console.error(serialized);
        return;
    }

    console.log(serialized);
}
