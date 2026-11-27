import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { TaskReceipt } from './api'
import { Icon } from './Icon'
import { TaskItem } from './TaskItem'
import type { RecentTask } from './TaskItem'
import { UploadForm } from './UploadForm'
import './styles.css'

const historyKey = 'file-conversion-task-ids'

function loadHistory(): RecentTask[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(historyKey) ?? '[]')
    if (Array.isArray(ids)) {
      return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)),
        (id) => ({ id }))
    }
  } catch {
    // History is optional when storage is unavailable or contains invalid data.
  }
  return []
}

function App() {
  const [history, setHistory] = useState(loadHistory)

  function addTask(task: TaskReceipt, filename: string, sentAt: string) {
    const entry = { id: task.task_id, accepted: { ...task, filename, sentAt } }
    setHistory((previous) => [entry, ...previous.filter(({ id }) => id !== entry.id)])

    try {
      const ids = [entry.id, ...loadHistory().map(({ id }) => id).filter((id) => id !== entry.id)]
      localStorage.setItem(historyKey, JSON.stringify(ids))
    } catch {
      // The current page can still monitor tasks without persistent storage.
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="shell brand">
          <span className="brand-icon"><Icon name="document" /></span>
          File Conversion
        </div>
      </header>
      <main className="shell">
        <div className="intro">
          <h1>Converter TXT para PDF</h1>
          <p>Envie seu arquivo de texto, acompanhe a conversão e baixe o PDF.</p>
        </div>
        <div className="columns">
          <UploadForm onAccepted={addTask} />
          <section className="card history-card" aria-labelledby="history-heading">
            <h2 id="history-heading">Conversões recentes</h2>
            <p className="section-description">Acompanhe o status e baixe seus PDFs.</p>
            {history.length ? (
              <ul className="history-list">
                {history.map((entry) => <TaskItem key={entry.id} entry={entry} />)}
              </ul>
            ) : (
              <div className="empty-state">
                <span className="empty-icon"><Icon name="document" /></span>
                <p>Nenhuma conversão ainda</p>
                <span>Os arquivos enviados aparecem aqui.</span>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
