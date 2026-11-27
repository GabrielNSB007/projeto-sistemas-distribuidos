export type TaskStatus = 'PENDENTE' | 'PROCESSANDO' | 'CONCLUÍDA' | 'FALHA'

export interface TaskReceipt {
  task_id: string
  status: TaskStatus
}

export interface Task extends TaskReceipt {
  nome_arquivo: string
  timestamps: {
    criado_em: string
    iniciado_em: string | null
    finalizado_em: string | null
  }
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function checkResponse(response: Response, expected: number, fallback: string) {
  if (response.status === expected) return

  const body = await response.json().catch(() => null)
  throw new ApiError(typeof body?.erro === 'string' ? body.erro : fallback, response.status)
}

export async function createTask(file: File): Promise<TaskReceipt> {
  const fallback = 'Não foi possível enviar o arquivo. Tente novamente.'
  const form = new FormData()
  form.append('arquivo', file)
  form.append('formato_destino', 'pdf')

  const response = await fetch('/tasks', { method: 'POST', body: form })
  await checkResponse(response, 202, fallback)
  return response.json()
}

export async function getTask(id: string, signal: AbortSignal): Promise<Task> {
  const response = await fetch(`/tasks/${encodeURIComponent(id)}`, { signal, cache: 'no-store' })
  await checkResponse(response, 200, 'Não foi possível consultar a tarefa.')
  return response.json()
}

// Express may send an ASCII fallback and a UTF-8 filename for the same attachment.
function attachmentName(header: string | null): string | undefined {
  const encoded = header?.match(/;\s*filename\*=UTF-8'[^']*'([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim())
    } catch {
      // Fall back to the regular filename parameter.
    }
  }

  const filename = header?.match(/;\s*filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]+))/i)
  return filename?.[1]?.replace(/\\(.)/g, '$1') ?? filename?.[2]?.trim()
}

export async function downloadTask(id: string, originalName: string) {
  const fallback = 'Não foi possível baixar o PDF. Tente novamente.'
  const response = await fetch(`/tasks/${encodeURIComponent(id)}/download`, { cache: 'no-store' })
  await checkResponse(response, 200, fallback)

  if (response.headers.get('Content-Type')?.split(';')[0] !== 'application/pdf') {
    throw new ApiError(fallback, response.status)
  }

  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = attachmentName(response.headers.get('Content-Disposition')) ??
    originalName.replace(/\.txt$/i, '.pdf')
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
