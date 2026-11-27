import { useRef, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { ApiError, createTask } from './api'
import type { TaskReceipt } from './api'
import { Icon } from './Icon'

const maxBytes = 10 * 1024 * 1024
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${number.format(bytes / 1024)} KiB`
  return `${number.format(bytes / (1024 * 1024))} MiB`
}

export function UploadForm({ onAccepted }: {
  onAccepted: (task: TaskReceipt, filename: string, sentAt: string) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)

  function selectFiles(files: File[]) {
    if (submitting.current || files.length === 0) return

    const selected = files[0]
    let issue = ''
    if (files.length > 1) issue = 'Selecione apenas um arquivo por vez.'
    else if (!/\.txt$/i.test(selected.name)) issue = 'Somente arquivos .txt são aceitos.'
    else if (selected.size === 0) issue = 'O arquivo está vazio. Selecione um TXT com conteúdo.'
    else if (selected.size > maxBytes) issue = 'O tamanho máximo do arquivo é 10 MiB.'

    setFile(issue ? null : selected)
    setError(issue)
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    selectFiles(Array.from(event.dataTransfer.files))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || submitting.current) return

    submitting.current = true
    setSending(true)
    setError('')
    const sentAt = new Date().toISOString()

    try {
      const task = await createTask(file)
      onAccepted(task, file.name, sentAt)
      setFile(null)
    } catch (error) {
      setError(error instanceof ApiError ? error.message : 'Não foi possível enviar o arquivo. Tente novamente.')
    } finally {
      submitting.current = false
      setSending(false)
    }
  }

  function useExample() {
    const content = 'Olá! Este é um arquivo de exemplo.\nA conversão mantém os acentos e as quebras de linha.\n\nConstruído para a disciplina de Sistemas Distribuídos.\n'
    selectFiles([new File([content], 'exemplo.txt', { type: 'text/plain;charset=utf-8' })])
  }

  return (
    <section className="card" aria-labelledby="upload-heading">
      <h2 id="upload-heading">Nova conversão</h2>
      <p className="section-description" id="file-requirements">TXT em UTF-8 · Até 10 MiB</p>

      <form onSubmit={submit} aria-busy={sending}>
        <div className={`dropzone${dragging ? ' dropzone--active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = sending ? 'none' : 'copy'
            if (!sending && event.dataTransfer.types.includes('Files')) setDragging(true)
          }}
          onDragLeave={(event) => {
            if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
              setDragging(false)
            }
          }}
          onDrop={drop}>
          <input type="file" ref={input} accept=".txt" aria-label="Arquivo TXT" hidden disabled={sending}
            onChange={(event) => {
              selectFiles(Array.from(event.currentTarget.files ?? []))
              event.currentTarget.value = ''
            }} />
          <span className="upload-icon"><Icon name={file ? 'document' : 'upload'} /></span>
          <p className="dropzone-title">{file ? file.name : 'Arraste seu arquivo aqui'}</p>
          <p className="dropzone-caption">{file ? fileSize(file.size) : 'ou selecione um arquivo do dispositivo'}</p>
          <div className="file-actions">
            <button type="button" className="button button--outline" disabled={sending}
              aria-describedby="file-requirements" onClick={() => input.current?.click()}>
              {file ? 'Trocar arquivo' : 'Selecionar arquivo'}
            </button>
            {file && (
              <button type="button" className="button button--text remove-button" disabled={sending}
                onClick={() => { setFile(null); setError('') }}>
                Remover
              </button>
            )}
          </div>
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button type="submit" className="button button--primary convert-button" disabled={!file || sending}>
          {sending ? 'Enviando…' : 'Converter para PDF'}
        </button>
        <button type="button" className="button button--text example-button" disabled={sending} onClick={useExample}>
          Usar arquivo de exemplo
        </button>
      </form>
    </section>
  )
}
