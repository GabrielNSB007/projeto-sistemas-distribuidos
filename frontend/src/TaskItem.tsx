import { useEffect, useState } from 'react'
import { ApiError, downloadTask, getTask } from './api'
import type { Task, TaskReceipt, TaskStatus } from './api'
import { Icon } from './Icon'

export interface RecentTask {
  id: string
  accepted?: TaskReceipt & { filename: string; sentAt: string }
}

const statuses: Record<TaskStatus, { label: string; tone: string }> = {
  PENDENTE: { label: 'Na fila', tone: 'pending' },
  PROCESSANDO: { label: 'Convertendo…', tone: 'processing' },
  CONCLUÍDA: { label: 'PDF pronto', tone: 'complete' },
  FALHA: { label: 'Falha na conversão', tone: 'failed' },
}

const fullDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })

function TaskTime({ value }: { value: string }) {
  return <time dateTime={value}>{fullDate.format(new Date(value))}</time>
}

export function TaskItem({ entry }: { entry: RecentTask }) {
  const { id, accepted } = entry
  const [task, setTask] = useState<Task>()
  const [unavailable, setUnavailable] = useState(false)
  const [connectionIssue, setConnectionIssue] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    const lifetime = new AbortController()
    let timer: number

    async function poll() {
      try {
        const data = await getTask(id, AbortSignal.any([lifetime.signal, AbortSignal.timeout(10_000)]))
        if (lifetime.signal.aborted) return

        setTask(data)
        setConnectionIssue(false)
        if (data.status === 'CONCLUÍDA' || data.status === 'FALHA') return
      } catch (error) {
        if (lifetime.signal.aborted) return
        if (error instanceof ApiError && error.status === 404) {
          setUnavailable(true)
          setConnectionIssue(false)
          return
        }
        setConnectionIssue(true)
      }

      timer = window.setTimeout(poll, 1_500)
    }

    void poll()
    return () => {
      lifetime.abort()
      window.clearTimeout(timer)
    }
  }, [id])

  const filename = task?.nome_arquivo ?? accepted?.filename ?? 'Tarefa de conversão'
  const sentAt = task?.timestamps.criado_em ?? accepted?.sentAt
  const status = task?.status ?? accepted?.status
  const badge = unavailable
    ? { label: 'Tarefa indisponível', tone: 'failed' }
    : status ? statuses[status] : { label: 'Consultando…', tone: 'pending' }

  async function download() {
    setDownloading(true)
    setDownloadError('')
    try {
      await downloadTask(id, filename)
    } catch (error) {
      setDownloadError(error instanceof ApiError ? error.message : 'Não foi possível baixar o PDF. Tente novamente.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <li className="task">
      <div className="task-row">
        <span className="task-icon"><Icon name="document" /></span>
        <div className="task-info">
          <h3>{filename}</h3>
          {sentAt && <p className="task-time">Enviado em <TaskTime value={sentAt} /></p>}
        </div>
        <div className="task-actions">
          <span className={`status status--${badge.tone}`} role="status">{badge.label}</span>
          {!unavailable && status === 'CONCLUÍDA' && (
            <button className="button button--outline download-button" disabled={downloading} onClick={download}>
              <Icon name="download" /> {downloading ? 'Baixando…' : 'Baixar PDF'}
            </button>
          )}
        </div>
      </div>

      <div className="task-details">
        {connectionIssue && <p className="task-message" role="status">Não foi possível atualizar a tarefa. Tentando novamente…</p>}
        {!unavailable && status === 'FALHA' && <p className="task-message">Envie o arquivo novamente para tentar outra conversão.</p>}
        {downloadError && <p className="error-message" role="alert">{downloadError}</p>}
        <details>
          <summary>Detalhes <Icon name="chevron" /></summary>
          <dl>
            <dt>ID da tarefa</dt><dd>{id}</dd>
            {sentAt && <><dt>Envio</dt><dd><TaskTime value={sentAt} /></dd></>}
            {task?.timestamps.iniciado_em && <><dt>Início</dt><dd><TaskTime value={task.timestamps.iniciado_em} /></dd></>}
            {task?.timestamps.finalizado_em && <><dt>Fim</dt><dd><TaskTime value={task.timestamps.finalizado_em} /></dd></>}
          </dl>
        </details>
      </div>
    </li>
  )
}
