import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { documentService } from '../services/index.js';
import { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { Spinner } from './Spinner.jsx';

const ALLOWED = ['.pdf', '.docx', '.txt'];
const MAX_MB = 15;

export default function UploadZone({ onUploaded, compact = false }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);

  async function handle(files) {
    const file = files?.[0];
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED.includes(ext)) return toast.error('Only PDF, DOCX and TXT files can be uploaded.');
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`That file is larger than ${MAX_MB} MB.`);

    setProgress(0);
    try {
      const { document } = await documentService.upload(file, setProgress);
      toast.success(`${document.originalName} uploaded. Processing has started.`);
      onUploaded?.(document);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const busy = progress !== null;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files); }}
      className={`rounded-lg border-2 border-dashed text-center transition-colors ${dragging ? 'border-seal bg-seal-tint' : 'border-rule bg-white'} ${compact ? 'p-5' : 'p-10'}`}
    >
      {busy ? (
        <div className="mx-auto max-w-xs" role="status">
          <p className="flex items-center justify-center gap-2 text-sm font-medium"><Spinner /> {progress < 100 ? `Uploading ${progress}%` : 'Starting processing'}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper"><div className="h-full bg-seal transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      ) : (
        <>
          <UploadCloud className="mx-auto h-8 w-8 text-muted" strokeWidth={1.5} aria-hidden />
          <p className="mt-2 font-medium">Drop a contract here</p>
          <p className="hint">PDF, DOCX or TXT, up to {MAX_MB} MB</p>
          <input ref={inputRef} id="file-input" type="file" accept={ALLOWED.join(',')} className="sr-only" onChange={(e) => handle(e.target.files)} />
          <label htmlFor="file-input" className="btn-primary mt-4 cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-seal">
            Choose a file
          </label>
        </>
      )}
    </div>
  );
}
