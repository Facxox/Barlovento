'use client';

import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react';

type Props = {
  file: File | null;
  onFile: (f: File | null) => void;
  /** URL ya guardada (modo edición). Se muestra como preview cuando no hay file nuevo. */
  previewUrl?: string;
  label?: string;
  aspect?: 'square' | 'video' | 'auto';
  maxSizeMB?: number;
  /** Nota visible sobre el tamaño/formato recomendado para el front (ej.
   *  "Tamaño recomendado: 800 × 600 px (4:3)"). */
  hint?: string;
};

const ACCEPT = 'image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml';

/**
 * Dropzone de imagen con drag-and-drop y click-to-pick.
 * - Drag over -> highlight dorado.
 * - Suelta un archivo -> lo acepta.
 * - Click o teclado -> abre el file picker.
 * - Si ya hay file seleccionado, muestra preview + botón "Quitar".
 */
export default function ImageDropzone({
  file,
  onFile,
  previewUrl,
  label = 'Imagen',
  aspect = 'square',
  maxSizeMB = 8,
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const objectUrl = file ? URL.createObjectURL(file) : null;
  const previewSrc = objectUrl ?? previewUrl ?? null;

  const aspectCls =
    aspect === 'square' ? 'aspect-square' : aspect === 'video' ? 'aspect-video' : '';

  const handleFile = useCallback(
    (f: File | null) => {
      setError(null);
      if (!f) {
        onFile(null);
        return;
      }
      if (!f.type.startsWith('image/')) {
        setError('Tiene que ser una imagen.');
        return;
      }
      const sizeMB = f.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        setError(`Máximo ${maxSizeMB} MB (esta pesa ${sizeMB.toFixed(1)} MB).`);
        return;
      }
      onFile(f);
    },
    [onFile, maxSizeMB]
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    handleFile(f);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
    // Reset para poder re-seleccionar el mismo archivo.
    if (inputRef.current) inputRef.current.value = '';
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div>
      <p className="font-body text-[10px] uppercase tracking-ultra text-bone/50">
        {label}
      </p>

      <div
        role="button"
        tabIndex={0}
        aria-label={`Subir ${label.toLowerCase()}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={onKey}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          'mt-2 relative grid place-items-center overflow-hidden border-2 border-dashed transition cursor-pointer',
          aspectCls,
          dragging
            ? 'border-gold bg-gold/10'
            : 'border-carbon-line bg-carbon-raised/40 hover:border-gold/60 hover:bg-carbon-raised/60',
        ].join(' ')}
      >
        {previewSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-carbon/40 opacity-0 hover:opacity-100 transition grid place-items-center">
              <span className="font-body text-[11px] uppercase tracking-ultra text-bone">
                Click para cambiar
              </span>
            </div>
            {file && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFile(null);
                }}
                className="absolute top-2 right-2 rounded-full bg-carbon/80 px-3 py-1 font-body text-[10px] uppercase tracking-ultra text-bone hover:bg-red-500/80 transition"
              >
                Quitar
              </button>
            )}
          </>
        ) : (
          <div className="text-center px-6 py-8">
            <p className="font-display text-2xl text-bone/80">
              {dragging ? 'Soltá acá' : 'Arrastrá una imagen'}
            </p>
            <p className="mt-2 font-body text-xs text-bone/50">
              o hacé click para elegir · máx {maxSizeMB} MB
            </p>
            <p className="mt-1 font-body text-[10px] uppercase tracking-ultra text-bone/40">
              PNG · JPG · WEBP · AVIF
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onPick}
          className="hidden"
        />
      </div>

      {error && <p className="mt-2 font-body text-xs text-red-400">{error}</p>}
      {hint && !error && (
        <p className="mt-2 font-body text-[11px] uppercase tracking-ultra text-gold/70">
          {hint}
        </p>
      )}
      {file && !error && (
        <p className="mt-2 font-body text-[11px] text-bone/60">
          Nueva imagen: <span className="text-gold">{file.name}</span> ·{' '}
          {(file.size / (1024 * 1024)).toFixed(2)} MB
        </p>
      )}
    </div>
  );
}